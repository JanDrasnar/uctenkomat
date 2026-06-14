import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import documentsRouter from './routes/documents.js';
import periodsRouter from './routes/periods.js';
import { UPLOADS_DIR, EXPORTS_DIR } from './store.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Statické soubory: originály dokladů a vygenerované exporty
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/exports', express.static(EXPORTS_DIR));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'uctenkomat-backend' }));

app.use('/api/documents', documentsRouter);
app.use('/api/periods', periodsRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Účtenkomat backend běží na http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠  ANTHROPIC_API_KEY není nastaven — extrakce nebude fungovat.');
  }
});
