import Anthropic from '@anthropic-ai/sdk';
import { db, getSetting } from '../db/index.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const OUTREACH_SYSTEM = `Eres un experto en ventas consultivas B2B con foco en outreach en frío.

REGLAS GENERALES (se aplican a todos los mensajes):
- Tono consultivo y estratégico, nunca agresivo ni desesperado.
- No mencionar precios ni hacer promesas exageradas.
- Cada mensaje personalizado, que no suene a plantilla.
- NUNCA usar frases cliché: "espero que estés bien", "me pongo en contacto para...", "quería presentarme".
- Cada mensaje debe leerse de forma independiente (el lead puede ver solo uno).
- El objetivo es despertar curiosidad y generar conversación, no cerrar la venta.
- Devuelve SOLO JSON válido sin texto adicional.`;

function channelSpecs(lang) {
  return `
- email: objeto {subject, body}. Body máx. 120 palabras. Abrir con observación ESPECÍFICA y verificable del negocio (ej: "sus 483 reseñas", "tu ubicación en Brickell", "el servicio de PRP que ofrecen"). No halagos genéricos tipo "vi que están fuertes". CTA suave al final.
- whatsapp: string máx. 60 palabras. Humano, directo, sin formalismos. OBLIGATORIO incluir un dato concreto y verificable del negocio en la primera frase. Cierra con pregunta abierta.
- instagram_dm: string máx. 40 palabras. Muy casual, empático. OBLIGATORIO mencionar un detalle concreto del negocio (nombre, ubicación específica, número de reseñas/followers, servicio que ofrecen, algo de su bio). Prohibido genérico tipo "están fuertes" o "tienen buena presencia". Sin links, máximo 1 emoji.
- loom_script: string con el guion completo para un video Loom personalizado de 3-5 minutos (aprox. 450-700 palabras). Estructura OBLIGATORIA con estos bloques marcados: "[HOOK 0:00-0:15]" (saludo + nombre del lead + un detalle ultra-específico que vio sobre su negocio, gancho de curiosidad), "[OBSERVACIÓN 0:15-1:00]" (qué notó concreto en su presencia digital/negocio que podría estar limitándolos), "[PROPUESTA 1:00-3:00]" (cómo el servicio resuelve eso, con un mini-ejemplo o resultado plausible, sin prometer cifras exactas), "[CTA 3:00-4:00]" (invitar a 15 min de llamada o responder el video, bajo compromiso), "[CIERRE 4:00-5:00]" (agradecer, personal, mencionar de nuevo algo del negocio). Tono conversacional, natural (como hablarle a un amigo dueño de negocio), NO leído de guion. Sin jerga corporativa.
Idioma de TODOS los mensajes: ${lang}.`;
}

function leadSummary(lead, campaign) {
  return `DATOS DEL SERVICIO (mío):
- Servicio ofrecido: ${campaign.service_offered || getSetting('my_company_info')}
- Beneficio principal: ${campaign.main_benefit || 'definido por el contexto'}
- Diferencial clave: ${campaign.key_differential || 'definido por el contexto'}

DATOS DEL LEAD:
- Nombre contacto: ${lead.name || 'N/A'}
- Negocio: ${lead.company || lead.name || 'N/A'}
- Plataforma: ${lead.platform}
- URL/perfil: ${lead.profile_url || 'N/A'}
- Resumen del negocio (datos crudos scrapeados): ${(lead.raw_data || '').slice(0, 1800)}`;
}

function resolveLang(campaign) {
  if (campaign.language === 'es') return 'Español';
  if (campaign.language === 'en') return 'Inglés';
  return 'detectá el idioma según el nombre del negocio y su ubicación; en Miami podés elegir Español o Inglés según lo que parezca más natural al lead';
}

export async function scoreLead(lead, campaign = {}) {
  const criteria = getSetting('qualification_criteria');
  const lang = resolveLang(campaign);

  const user = `${leadSummary(lead, campaign)}

CRITERIO DE LEAD IDEAL (para calificar): ${criteria}

TAREA:
1) Calificá el lead del 1 al 10 evaluando: presencia digital activa, tamaño de empresa, señales de necesidad del servicio, señales de presupuesto. Una línea de justificación.
2) Generá el MENSAJE 1 — Día 1 (primer contacto) en 3 canales.

${channelSpecs(lang)}

Devuelve JSON estricto con esta forma:
{"score": number, "reason": string, "messages": {"email": {"subject": string, "body": string}, "whatsapp": string, "instagram_dm": string, "loom_script": string}}`;

  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: OUTREACH_SYSTEM,
    messages: [{ role: 'user', content: user }]
  });

  const text = resp.content.find(c => c.type === 'text')?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude no devolvió JSON');
  const parsed = JSON.parse(match[0]);
  return {
    score: Math.max(1, Math.min(10, Number(parsed.score) || 0)),
    reason: String(parsed.reason || ''),
    messages: parsed.messages || {}
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
      upd.run(r.score, r.reason, JSON.stringify(r.messages), status, lead.id);
      done++;
    } catch (e) {
      console.error('score failed', lead.id, e.message);
      failed++;
    }
  }
  return { done, failed, remaining: db.prepare('SELECT COUNT(*) AS n FROM leads WHERE score IS NULL').get().n };
}

const FOLLOWUP_OBJECTIVES = [
  { n: 1, day: 3, title: 'FOLLOW UP 1 — Día 3 (Quizás no lo vieron)', goal: 'Confirmar que llegó el mensaje, sin presionar.', limits: 'EMAIL: máx 80 palabras, como respuesta al hilo anterior, reafirma idea principal en una oración. WHATSAPP: máx 40 palabras, muy breve. INSTAGRAM_DM: máx 25 palabras, recordatorio amable. LOOM_SCRIPT: guion corto de 1-2 min (~150-250 palabras) con bloques [HOOK][RECORDATORIO][CTA], tono ultra casual.' },
  { n: 2, day: 7, title: 'FOLLOW UP 2 — Día 7 (Agregar valor nuevo)', goal: 'Dar una razón nueva para responder. Simulá haber hecho un hallazgo concreto plausible sobre su negocio basado en el resumen del lead y el servicio.', limits: 'EMAIL: máx 100 palabras, menciona el hallazgo específico, CTA a mostrar el hallazgo. WHATSAPP: máx 50 palabras, directo al hallazgo + pregunta de 5 min. INSTAGRAM_DM: máx 30 palabras, hallazgo + pregunta. LOOM_SCRIPT: guion de 2-3 min (~300-450 palabras) con bloques [HOOK][HALLAZGO CONCRETO][IMPACTO][CTA].' },
  { n: 3, day: 14, title: 'FOLLOW UP 3 — Día 14 (Cierre elegante)', goal: 'Cerrar el ciclo sin quemar el puente. Dejar puerta abierta.', limits: 'EMAIL: máx 80 palabras, cálido, indica que es el último mensaje, sin presión. WHATSAPP: máx 35 palabras, cordial sin drama. INSTAGRAM_DM: máx 20 palabras, una frase de cierre amigable. LOOM_SCRIPT: guion corto de 1 min (~120-180 palabras), cierre cálido sin presión, puerta abierta.' }
];

export async function generateFollowup(lead, campaign = {}) {
  const priorMsgs = db.prepare('SELECT kind, content FROM messages WHERE lead_id = ? ORDER BY id ASC').all(lead.id);
  const step = FOLLOWUP_OBJECTIVES[Math.min(lead.followup_count || 0, FOLLOWUP_OBJECTIVES.length - 1)];
  const lang = resolveLang(campaign);
  const priorText = priorMsgs.map(m => `[${m.kind}] ${m.content}`).join('\n---\n') || '(sin mensajes previos)';

  const user = `${leadSummary(lead, campaign)}

MENSAJES PREVIOS ENVIADOS A ESTE LEAD:
${priorText}

TAREA: Generá el ${step.title}.
OBJETIVO: ${step.goal}
LÍMITES POR CANAL: ${step.limits}
Idioma: ${lang}.

Devuelve JSON estricto:
{"messages": {"email": {"subject": string, "body": string}, "whatsapp": string, "instagram_dm": string, "loom_script": string}}`;

  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    system: OUTREACH_SYSTEM,
    messages: [{ role: 'user', content: user }]
  });
  const text = resp.content.find(c => c.type === 'text')?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude no devolvió JSON');
  return JSON.parse(match[0]).messages || {};
}
