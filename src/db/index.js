import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../../data/prospeccion.db');
const schemaPath = path.resolve(__dirname, './schema.sql');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(schemaPath, 'utf8'));

for (const col of [['language', "TEXT DEFAULT 'auto'"], ['service_offered', 'TEXT'], ['main_benefit', 'TEXT'], ['key_differential', 'TEXT']]) {
  try { db.prepare(`ALTER TABLE campaigns ADD COLUMN ${col[0]} ${col[1]}`).run(); } catch {}
}
for (const col of [['name_campaign', 'TEXT']]) {
  try { db.prepare(`ALTER TABLE campaigns ADD COLUMN ${col[0]} ${col[1]}`).run(); } catch {}
}
for (const col of [['contact_person', 'TEXT'], ['website', 'TEXT'], ['instagram_url', 'TEXT'], ['gmb_url', 'TEXT'], ['rating', 'REAL'], ['review_count', 'INTEGER'], ['top_positive', 'TEXT'], ['top_negative', 'TEXT'], ['has_ads', 'TEXT'], ['seo_audit', 'TEXT'], ['qualification_pipeline', 'TEXT']]) {
  try { db.prepare(`ALTER TABLE leads ADD COLUMN ${col[0]} ${col[1]}`).run(); } catch {}
}

const defaults = {
  delay_min_seconds: '30',
  delay_max_seconds: '90',
  followup_days_1: '3',
  followup_days_2: '7',
  followup_days_3: '14',
  max_followups: '3',
  min_score: '4',
  base_template: 'Hola {nombre}, vi {empresa} y me pareció interesante...',
  qualification_criteria: 'Busco owners/founders de clínicas, spas y agencias en Miami con 5-20 empleados y presencia digital activa.',
  my_company_info: 'Lynkro.io — agencia de automatizaciones con IA (WhatsApp + Instagram).',
  presets_service_offered: JSON.stringify(['Automatizaciones con IA para seguimiento de clientes', 'Diseño web y landing pages de alta conversión', 'Google Ads + SEO local', 'Chatbots inteligentes para WhatsApp e Instagram']),
  presets_main_benefit: JSON.stringify(['Ahorra 5 horas semanales en tareas repetitivas', 'Genera 3-4 clientes nuevos al mes sin aumentar presupuesto', 'Responde leads en menos de 2 minutos 24/7', 'Aumenta tu visibilidad local en Google']),
  presets_key_differential: JSON.stringify(['Implementación en menos de 2 semanas, sin código', 'Solo trabajamos con negocios locales — entendemos tu mercado', 'Garantía de resultados en 30 días o devolvemos tu inversión', 'Sistema llave en mano: no necesitás equipo técnico'])
};
const setStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(defaults)) setStmt.run(k, v);

export const getSetting = (key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
export const setSetting = (key, value) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
