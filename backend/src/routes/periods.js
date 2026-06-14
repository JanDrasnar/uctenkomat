import { Router } from 'express';
import path from 'node:path';
import { listPeriods, listByPeriod, markPeriodSent, EXPORTS_DIR } from '../store/index.js';
import { generatePeriodPdf } from '../services/pdf.js';
import { generateCsv } from '../services/csv.js';
import { periodLabel } from '../services/period.js';
import { sendToAccountant } from '../services/email.js';

const router = Router();

// GET /api/periods — přehled období (počet, součet, odesláno)
router.get('/', async (_req, res) => {
  res.json(await listPeriods());
});

// GET /api/periods/:period — doklady v období
router.get('/:period', async (req, res) => {
  res.json({
    period: req.params.period,
    label: periodLabel(req.params.period),
    documents: await listByPeriod(req.params.period),
  });
});

// POST /api/periods/:period/send — vygeneruj PDF + CSV a (volitelně) pošli e-mailem
router.post('/:period/send', async (req, res) => {
  const period = req.params.period;
  const docs = await listByPeriod(period);
  if (docs.length === 0) {
    return res.status(400).json({ error: 'V tomto období nejsou žádné doklady.' });
  }

  const pdfPath = path.join(EXPORTS_DIR, `uctenkomat-${period}.pdf`);
  const csvPath = path.join(EXPORTS_DIR, `uctenkomat-${period}.csv`);

  const plmajor = {
    nazev: req.body?.platce?.nazev,
    ico: req.body?.platce?.ico,
    dic: req.body?.platce?.dic,
    dnes: new Date().toLocaleDateString('cs-CZ'),
  };

  try {
    await generatePeriodPdf(pdfPath, period, docs, plmajor);
    generateCsv(csvPath, docs);

    const email = await sendToAccountant({ period, pdfPath, csvPath, to: req.body?.accountantEmail });
    await markPeriodSent(period);

    res.json({
      ok: true,
      period,
      documents: docs.length,
      pdfUrl: `/exports/${path.basename(pdfPath)}`,
      csvUrl: `/exports/${path.basename(csvPath)}`,
      email, // { sent: true } nebo { sent: false, reason: 'SMTP nenastaveno' }
    });
  } catch (err) {
    console.error('Odeslání selhalo:', err);
    res.status(500).json({ error: 'Odeslání selhalo', detail: String(err.message || err) });
  }
});

export default router;
