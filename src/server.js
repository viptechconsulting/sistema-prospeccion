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
import { conversations } from './routes/conversations.js';
import { startScheduler } from './services/scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Basic Auth
const AUTH_USER = process.env.AUTH_USER || 'lynkroio_admin';
const AUTH_PASS = process.env.AUTH_PASS || '3$mer@ldA$';
app.use((req, res, next) => {
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString();
    const colon = decoded.indexOf(':');
    const user = decoded.slice(0, colon);
    const pass = decoded.slice(colon + 1);
    if (user === AUTH_USER && pass === AUTH_PASS) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Lynkro Copiloto"');
  res.status(401).send('Acceso no autorizado');
});

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.resolve(__dirname, '../public')));

app.get('/api/health', (_req, res) => {
  const count = db.prepare('SELECT COUNT(*) AS n FROM leads').get().n;
  res.json({ ok: true, leads: count });
});
app.use((req, res, next) => {
  const orig = res.json.bind(res);
  next();
});
process.on('unhandledRejection', (err) => console.error('UNHANDLED', err));
process.on('uncaughtException', (err) => console.error('UNCAUGHT', err));

app.use('/api/campaigns', campaigns);
app.use('/api/leads', leads);
app.use('/api/settings', settings);
app.use('/api/automation', automation);
app.use('/api/conversations', conversations);

app.use((err, req, res, next) => {
  console.error('API error', err);
  res.status(500).json({ error: err.message });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Prospeccion CRM → http://localhost:${port}`);
  startScheduler();
});
