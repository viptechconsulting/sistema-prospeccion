// src/services/audit.js — Auditoría del sitio web del lead + chat con IA para
// corregir/refinar el análisis. Portado desde el módulo de chat.lynkro.io:
// señales por fetch+regex (sin headless) → Claude nombra 3 problemas concretos,
// y un chat deja al usuario corregir cuando la detección automática se equivoca.
import { client } from './anthropic.js';
import { db } from '../db/index.js';

const MODEL = 'claude-haiku-4-5-20251001';
const VIEWPORT_RE = /<meta[^>]+name=["']viewport["']/i;
const FORM_RE = /<form[\s>]/i;
const BOOKING_OR_CHAT_RE = /calendly\.com|wa\.me\/|api\.whatsapp\.com|tidio|intercom|crisp\.chat|livechat|zendesk|freshchat|drift\.com|book(?:ing)?\s*online|reserva[sn]?\s*online|acuity|square\s*appointments|calendar\.google/i;

async function auditWebsite(url) {
  const start = Date.now();
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    const html = await res.text();
    return {
      reachable: res.ok ? 1 : 0,
      load_time_ms: Date.now() - start,
      mobile_friendly: VIEWPORT_RE.test(html) ? 1 : 0,
      has_form: FORM_RE.test(html) ? 1 : 0,
      has_booking_or_chat: BOOKING_OR_CHAT_RE.test(html) ? 1 : 0
    };
  } catch (err) {
    return { reachable: 0, load_time_ms: null, mobile_friendly: 0, has_form: 0, has_booking_or_chat: 0, error: err.message };
  }
}

function signalsSummary(lead, s) {
  if (!lead.website) return 'El negocio no tiene sitio web (o su único enlace público es Instagram/Google).';
  if (!s.reachable) return `El sitio (${lead.website}) no cargó al intentar auditarlo (${s.error || 'sin respuesta'}).`;
  return [
    `Tiempo de carga: ${s.load_time_ms}ms.`,
    s.mobile_friendly ? 'Tiene meta viewport (adaptado a celular).' : 'NO tiene meta viewport — probablemente no se ve bien en celular.',
    s.has_form ? 'Tiene al menos un formulario.' : 'No tiene ningún formulario de contacto.',
    s.has_booking_or_chat ? 'Tiene señales de reservas online o chat.' : 'No tiene reservas online ni chat visible.'
  ].join(' ');
}

async function generateIssues(lead, s) {
  const resp = await client().messages.create({
    model: MODEL,
    max_tokens: 400,
    system: 'Eres un consultor que audita negocios locales para venderles un asistente/sitio con IA. Escribes en español neutro, directo, sin jerga técnica ni relleno. Cada problema debe sonar a algo que el dueño del negocio puede notar él mismo (no una métrica técnica).',
    messages: [{
      role: 'user',
      content: `Negocio: ${lead.company || lead.name} (${lead.segment || 'sin categoría'}).\nSeñales encontradas: ${signalsSummary(lead, s)}\n\nEscribe EXACTAMENTE 3 problemas concretos, cortos (una línea cada uno), que le estén costando clientes a este negocio HOY. Devuelve solo la lista, un problema por línea, sin numeración ni viñetas.`
    }]
  });
  const text = resp.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  return text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 3);
}

export async function runAudit(leadId) {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
  if (!lead) throw new Error('Lead no encontrado');
  const signals = lead.website
    ? await auditWebsite(lead.website)
    : { reachable: 0, load_time_ms: null, mobile_friendly: 0, has_form: 0, has_booking_or_chat: 0 };
  const issues = await generateIssues(lead, signals);
  const info = db.prepare(`
    INSERT INTO lead_audits (lead_id, load_time_ms, mobile_friendly, has_form, has_booking_or_chat, reachable, issues_json)
    VALUES (?,?,?,?,?,?,?)
  `).run(leadId, signals.load_time_ms, signals.mobile_friendly, signals.has_form, signals.has_booking_or_chat, signals.reachable, JSON.stringify(issues));
  return db.prepare('SELECT * FROM lead_audits WHERE id = ?').get(info.lastInsertRowid);
}

export function getAudit(leadId) {
  const audit = db.prepare('SELECT * FROM lead_audits WHERE lead_id = ? ORDER BY id DESC LIMIT 1').get(leadId);
  const chat = db.prepare('SELECT role, content, created_at FROM lead_audit_chat WHERE lead_id = ? ORDER BY id ASC').all(leadId);
  return { audit: audit || null, chat };
}

export async function sendAuditChat(leadId, message) {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
  if (!lead) throw new Error('Lead no encontrado');
  const audit = db.prepare('SELECT * FROM lead_audits WHERE lead_id = ? ORDER BY id DESC LIMIT 1').get(leadId);
  const issues = audit ? JSON.parse(audit.issues_json || '[]') : [];
  const history = db.prepare('SELECT role, content FROM lead_audit_chat WHERE lead_id = ? ORDER BY id ASC').all(leadId);

  const auditContext = audit
    ? `Auditoría automática del sitio de ${lead.company || lead.name}${lead.website ? ' (' + lead.website + ')' : ''}:
- Tiempo de carga: ${audit.load_time_ms ?? 'n/d'} ms
- Meta viewport (móvil): ${audit.mobile_friendly ? 'sí' : 'no'}
- Formulario de contacto: ${audit.has_form ? 'sí' : 'no'}
- Reservas online / chat: ${audit.has_booking_or_chat ? 'sí' : 'no'}
Problemas detectados:
${issues.map((x, i) => `${i + 1}. ${x}`).join('\n') || '(ninguno)'}`
    : 'Todavía no se ha corrido una auditoría de este lead.';

  const system = `Eres un consultor experto que ayuda a revisar y CORREGIR auditorías de negocios locales (el objetivo es venderles un asistente/sitio con IA).
La auditoría automática se basa en señales simples (un fetch del HTML + regex), así que PUEDE equivocarse: por ejemplo marcar que no hay reservas online cuando sí las hay, no detectar un chat embebido, o juzgar mal la velocidad.
Tu trabajo: responder al usuario, ADMITIR cuando el análisis automático pudo estar mal, corregirlo con criterio, y dar un análisis más preciso y accionable. Sé concreto, honesto y breve, en español neutro, sin relleno.

DATOS DEL NEGOCIO: ${lead.company || lead.name} · ${lead.segment || 'sin categoría'} · rating ${lead.rating ?? 'n/d'} (${lead.review_count ?? 0} reseñas).

${auditContext}`;

  const messages = [...history.map(h => ({ role: h.role, content: h.content })), { role: 'user', content: message }];
  const resp = await client().messages.create({ model: MODEL, max_tokens: 800, system, messages });
  const reply = resp.content.filter(b => b.type === 'text').map(b => b.text).join('').trim() || '(sin respuesta)';

  const ins = db.prepare('INSERT INTO lead_audit_chat (lead_id, role, content) VALUES (?,?,?)');
  ins.run(leadId, 'user', message);
  ins.run(leadId, 'assistant', reply);
  return { reply };
}

export function clearAuditChat(leadId) {
  db.prepare('DELETE FROM lead_audit_chat WHERE lead_id = ?').run(leadId);
}
