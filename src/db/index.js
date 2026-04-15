import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../../data/prospeccion.db');
const schemaPath = path.resolve(__dirname, './schema.sql');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(schemaPath, 'utf8'));

const defaults = {
  delay_min_seconds: '30',
  delay_max_seconds: '90',
  followup_days_1: '3',
  followup_days_2: '7',
  max_followups: '2',
  min_score: '4',
  base_template: 'Hola {nombre}, vi {empresa} y me pareció interesante...',
  qualification_criteria: 'Busco owners/founders de clínicas, spas y agencias en Miami con 5-20 empleados y presencia digital activa.',
  my_company_info: 'Lynkro.io — agencia de automatizaciones con IA (WhatsApp + Instagram).'
};
const setStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(defaults)) setStmt.run(k, v);

export const getSetting = (key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
export const setSetting = (key, value) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
