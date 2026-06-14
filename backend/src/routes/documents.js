import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { extractDoklad } from '../services/anthropic.js';
import { lookupIco } from '../services/ares.js';
import { decodeSpaydFromImage } from '../services/qr.js';
import { periodKey } from '../services/period.js';
import { addDocument, updateDocument, getDocument, UPLOADS_DIR } from '../store.js';

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const router = Router();

// POST /api/documents — nahraj fotku, extrahuj, ověř v ARES, zařaď do období
router.post('/', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chybí soubor "photo".' });

  try {
    const buffer = fs.readFileSync(req.file.path);
    const data = await extractDoklad(buffer, req.file.mimetype);

    // ARES enrichment — oficiální jméno přebije OCR
    const ares = await lookupIco(data.dodavatel?.ico);
    if (ares) {
      data.dodavatel.nazev = ares.nazev || data.dodavatel.nazev;
      data.dodavatel.dic = ares.dic || data.dodavatel.dic;
      data.dodavatel.adresa = ares.adresa;
      data.ares_overeno = true;
    }

    // QR Platba (SPAYD) — pokud je v obrázku, její hodnoty jsou přesné a přebijí OCR
    const spayd = await decodeSpaydFromImage(buffer);
    if (spayd) {
      data.qr_platba_nalezena = true;
      data.qr = spayd;
      const mismatches = [];
      if (spayd.am != null && data.castka_celkem != null && spayd.am !== data.castka_celkem) {
        mismatches.push(`částka OCR ${data.castka_celkem} → QR ${spayd.am}`);
      }
      if (spayd.vs && data.variabilni_symbol && spayd.vs !== data.variabilni_symbol) {
        mismatches.push(`VS OCR ${data.variabilni_symbol} → QR ${spayd.vs}`);
      }
      if (spayd.am != null) data.castka_celkem = spayd.am;
      if (spayd.vs) data.variabilni_symbol = spayd.vs;
      // QR je autoritativní → tato pole už nejsou ke kontrole
      data.pole_ke_kontrole = (data.pole_ke_kontrole || [])
        .filter((f) => f !== 'castka_celkem' && f !== 'variabilni_symbol');
      if (mismatches.length) {
        data.poznamka_extrakce = [data.poznamka_extrakce, `QR opravilo: ${mismatches.join('; ')}`]
          .filter(Boolean).join(' · ');
      }
    }

    const doc = {
      id: crypto.randomUUID(),
      imagePath: req.file.path,
      imageUrl: `/uploads/${path.basename(req.file.path)}`,
      period: periodKey(data.datum_vystaveni),
      reviewed: false,
      createdAt: new Date().toISOString(),
      data,
    };
    addDocument(doc);
    res.status(201).json(doc);
  } catch (err) {
    console.error('Extrakce selhala:', err);
    res.status(500).json({ error: 'Extrakce selhala', detail: String(err.message || err) });
  }
});

// PATCH /api/documents/:id — ulož opravy z kontrolní obrazovky
router.patch('/:id', (req, res) => {
  const patch = {};
  if (req.body.data) patch.data = req.body.data;
  if (req.body.reviewed != null) patch.reviewed = req.body.reviewed;
  // období se může změnit, pokud uživatel opravil datum
  if (req.body.data?.datum_vystaveni) patch.period = periodKey(req.body.data.datum_vystaveni);

  const doc = updateDocument(req.params.id, patch);
  if (!doc) return res.status(404).json({ error: 'Doklad nenalezen.' });
  res.json(doc);
});

// GET /api/documents/:id
router.get('/:id', (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Doklad nenalezen.' });
  res.json(doc);
});

export default router;
