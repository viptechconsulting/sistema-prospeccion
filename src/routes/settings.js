import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db, getSetting, setSetting } from '../db/index.js';

export const settings = express.Router();

const ENV_PATH = path.resolve(process.cwd(), '.env');
const MASKED = new Set(['apify_token_tail', 'anthropic_key_tail']);

function readEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const out = {};
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
function writeEnv(obj) {
  const lines = Object.entries(obj).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n');
}
const tail = (v) => v && v.length > 8 ? '••••' + v.slice(-4) : (v || '');

settings.get('/', (_req, res) => {
  const all = db.prepare('SELECT key, value FROM settings').all();
  const obj = Object.fromEntries(all.map(r => [r.key, r.value]));
  const env = readEnv();
  obj.apify_token_tail = tail(env.APIFY_TOKEN);
  obj.anthropic_key_tail = tail(env.ANTHROPIC_API_KEY);
  res.json(obj);
});

settings.post('/', (req, res) => {
  const env = readEnv();
  let envChanged = false;
  for (const [k, v] of Object.entries(req.body)) {
    if (k === 'apify_token_tail' && v) { env.APIFY_TOKEN = v; process.env.APIFY_TOKEN = v; envChanged = true; continue; }
    if (k === 'anthropic_key_tail' && v) { env.ANTHROPIC_API_KEY = v; process.env.ANTHROPIC_API_KEY = v; envChanged = true; continue; }
    if (MASKED.has(k)) continue;
    setSetting(k, String(v ?? ''));
  }
  if (envChanged) writeEnv(env);
  res.json({ ok: true });
});
