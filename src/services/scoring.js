import Anthropic from '@anthropic-ai/sdk';
import { db, getSetting } from '../db/index.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `Eres un SDR experto. Calificás leads B2B del 1 al 10 y generás un primer mensaje breve, natural y personalizado (2-3 frases, sin precio, sin sonar a plantilla). Respondé SOLO JSON válido: {"score": number, "reason": string, "message": string}.`;

export async function scoreLead(lead, campaign = {}) {
  const criteria = getSetting('qualification_criteria');
  const myCompany = getSetting('my_company_info');
  const template = getSetting('base_template');
  const langMap = { es: 'Español', en: 'Inglés', auto: 'detectá el idioma del lead según su ubicación y datos (Miami → Español o Inglés según el nombre/contenido)' };
  const lang = langMap[campaign.language] || langMap.auto;
  const service = campaign.service_offered ? `SERVICIO ESPECÍFICO A OFRECER EN ESTA CAMPAÑA: ${campaign.service_offered}` : '';

  const user = `MI EMPRESA: ${myCompany}
${service}
CRITERIO DE LEAD IDEAL: ${criteria}
PLANTILLA BASE (guía de tono): ${template}
IDIOMA DEL MENSAJE: ${lang}

LEAD:
- Nombre: ${lead.name || 'N/A'}
- Empresa: ${lead.company || 'N/A'}
- Plataforma: ${lead.platform}
- URL: ${lead.profile_url || 'N/A'}
- Email: ${lead.email || 'N/A'}
- Datos: ${(lead.raw_data || '').slice(0, 1500)}

Evaluá:
1) ¿Presencia digital activa?
2) ¿Tamaño de empresa coincide?
3) ¿Actividad reciente sugiere que necesitan el servicio?
4) ¿Señales de presupuesto?

Devolvé JSON estricto.`;

  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: SYSTEM,
    messages: [{ role: 'user', content: user }]
  });

  const text = resp.content.find(c => c.type === 'text')?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude no devolvió JSON');
  const parsed = JSON.parse(match[0]);
  return {
    score: Math.max(1, Math.min(10, Number(parsed.score) || 0)),
    reason: String(parsed.reason || ''),
    message: String(parsed.message || '')
  };
}

export async function scoreAllPending(limit = 50) {
  const minScore = Number(getSetting('min_score')) || 4;
  const leads = db.prepare('SELECT * FROM leads WHERE score IS NULL LIMIT ?').all(limit);
  const upd = db.prepare(`UPDATE leads SET score = ?, score_reason = ?, suggested_message = ?, status = ? WHERE id = ?`);
  const campStmt = db.prepare('SELECT * FROM campaigns WHERE id = ?');
  let done = 0, failed = 0;
  for (const lead of leads) {
    try {
      const campaign = lead.campaign_id ? campStmt.get(lead.campaign_id) : {};
      const r = await scoreLead(lead, campaign);
      const status = r.score < minScore ? 'descartado' : lead.status;
      upd.run(r.score, r.reason, r.message, status, lead.id);
      done++;
    } catch (e) {
      console.error('score failed', lead.id, e.message);
      failed++;
    }
  }
  return { done, failed, remaining: db.prepare('SELECT COUNT(*) AS n FROM leads WHERE score IS NULL').get().n };
}

export async function generateFollowup(lead) {
  const myCompany = getSetting('my_company_info');
  const prior = db.prepare('SELECT content FROM messages WHERE lead_id = ? ORDER BY id ASC').all(lead.id).map(m => m.content).join('\n---\n');

  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: 'Generás follow-ups breves (1-2 frases), amigables, nunca insistentes. Devolvé SOLO el texto del mensaje, sin comillas.',
    messages: [{ role: 'user', content: `Mi empresa: ${myCompany}\nLead: ${lead.name} (${lead.company})\nMensajes previos:\n${prior}\n\nEscribí un follow-up suave diferente al anterior.` }]
  });
  return resp.content.find(c => c.type === 'text')?.text?.trim() || '';
}
