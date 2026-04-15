import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db/index.js';
import { campaigns } from './routes/campaigns.js';
import { leads } from './routes/leads.js';
import { settings } from './routes/settings.js';
import { automation } from './routes/automation.js';
import { startScheduler } from './services/scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.resolve(__dirname, '../public')));

app.get('/api/health', (_req, res) => {
  const count = db.prepare('SELECT COUNT(*) AS n FROM leads').get().n;
  res.json({ ok: true, leads: count });
});
app.use('/api/campaigns', campaigns);
app.use('/api/leads', leads);
app.use('/api/settings', settings);
app.use('/api/automation', automation);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Prospeccion CRM → http://localhost:${port}`);
  startScheduler();
});
