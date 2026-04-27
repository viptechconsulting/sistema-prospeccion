import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { db } from './db/index.js';
import { campaigns } from './routes/campaigns.js';
import { leads } from './routes/leads.js';
import { settings } from './routes/settings.js';
import { automation } from './routes/automation.js';
import { conversations } from './routes/conversations.js';
import { startScheduler } from './services/scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Auth config
const AUTH_USER = process.env.AUTH_USER || 'lynkroio_admin';
const AUTH_PASS = process.env.AUTH_PASS || '3$mer@ldA$';
const SESSION_TOKEN = crypto.randomBytes(32).toString('hex');
const COOKIE_NAME = 'lynkro_session';

function parseCookies(req) {
  const raw = req.headers['cookie'] || '';
  return Object.fromEntries(raw.split(';').map(c => c.trim().split('=').map(decodeURIComponent)));
}

function isAuthenticated(req) {
  return parseCookies(req)[COOKIE_NAME] === SESSION_TOKEN;
}

app.use(express.json({ limit: '2mb' }));

// Login endpoint — public
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === AUTH_USER && password === AUTH_PASS) {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${SESSION_TOKEN}; Path=/; HttpOnly; SameSite=Lax`);
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Credenciales incorrectas' });
});

// Logout endpoint — public
app.post('/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`);
  res.json({ ok: true });
});

// Auth guard — runs before static files and API routes
app.use((req, res, next) => {
  // Allow login page and login endpoint
  if (req.path === '/login.html' || req.path.startsWith('/auth/')) return next();
  if (isAuthenticated(req)) return next();
  // API calls get 401 JSON
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'No autenticado' });
  // Everything else → redirect to login
  res.redirect('/login.html');
});

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
