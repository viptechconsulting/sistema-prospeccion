import Anthropic from '@anthropic-ai/sdk';
import { db, getSetting } from '../db/index.js';
import { getReviewsForLead } from './enrichment.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const OUTREACH_SYSTEM = `Eres un experto en ventas consultivas B2B con foco en outreach en frío.

REGLA #1 (INQUEBRANTABLE) — VERACIDAD:
- SOLO podés mencionar hechos explícitamente presentes en los DATOS DEL LEAD que te paso.
- PROHIBIDO inventar: campañas que no están listadas, CTAs que no figuran, porcentajes inventados ("30-40% de inquiries"), volúmenes ("X pacientes"), features específicas ("Book now clicks"), canales que no aparecen en los datos.
- Si no tenés un dato concreto, usá observaciones generales y verificables del sector/rubro en vez de inventar cifras.
- Si el rating, reviews, patrón positivo/negativo, CTA o ads no están en los datos: NO los menciones como si los conocieras.
- Mejor un mensaje corto y honesto que uno largo y fabricado.

REGLAS GENERALES:
- Tono consultivo y estratégico, nunca agresivo ni desesperado.
- No mencionar precios ni hacer promesas exageradas (nada de "60 días o refund", "reducción del 35%", "<5 segundos 24/7" a menos que esté literalmente en los datos del servicio que me das).
- NUNCA frases cliché: "espero que estés bien", "me pongo en contacto para...", "quería presentarme".
- El objetivo es curiosidad + conversación, no cerrar venta.
- Devuelve SOLO JSON válido sin texto adicional.`;

function channelSpecs(lang) {
  return `
- email: objeto {subject, body}. Body máx. 120 palabras. Abrir con observación ESPECÍFICA y verificable del negocio (ej: "sus 483 reseñas", "tu ubicación en Brickell", "el servicio de PRP que ofrecen"). No halagos genéricos tipo "vi que están fuertes". CTA suave al final.
- whatsapp: string máx. 60 palabras. Humano, directo, sin formalismos. OBLIGATORIO incluir un dato concreto y verificable del negocio en la primera frase. Cierra con pregunta abierta.
- instagram_dm: string máx. 4-5 líneas. La primera línea DEBE demostrar que investigaste su negocio (algo específico, no genérico). Mencioná el dolor de forma elegante — NUNCA reveles la solución, el suspenso genera curiosidad. Cerrá con pregunta suave que invite a conversar, no a comprar. Tono humano, cercano, profesional. PROHIBIDO usar: "quiero presentarte", "somos una agencia", "te ofrezco", "solución innovadora", "¿tienes 15 minutos?", links, precios. Máximo 1 emoji solo si aporta naturalidad. El mensaje debe funcionar aunque lo lea un asistente o community manager — tan bueno que quieran pasárselo al dueño.
- loom_script: string con el guion completo para un video Loom personalizado de 3-5 minutos (aprox. 450-700 palabras). Estructura OBLIGATORIA con estos bloques marcados: "[HOOK 0:00-0:15]" (saludo + nombre del lead + un detalle ultra-específico que vio sobre su negocio, gancho de curiosidad), "[OBSERVACIÓN 0:15-1:00]" (qué notó concreto en su presencia digital/negocio que podría estar limitándolos), "[PROPUESTA 1:00-3:00]" (cómo el servicio resuelve eso, con un mini-ejemplo o resultado plausible, sin prometer cifras exactas), "[CTA 3:00-4:00]" (invitar a 15 min de llamada o responder el video, bajo compromiso), "[CIERRE 4:00-5:00]" (agradecer, personal, mencionar de nuevo algo del negocio). Tono conversacional, natural (como hablarle a un amigo dueño de negocio), NO leído de guion. Sin jerga corporativa.
Idioma de TODOS los mensajes: ${lang}.`;
}

function leadSummary(lead, campaign) {
  const reviews = getReviewsForLead(lead);
  const reviewsSummary = reviews.length ? `\nREVIEWS (${reviews.length}):\n${reviews.slice(0, 20).map(r => `- [${r.rating || '?'}★] ${r.text.slice(0, 200)}`).join('\n')}` : '';
  const ratingInfo = lead.rating ? `- Rating Google: ${lead.rating}★ (${lead.review_count || 0} reviews)${lead.rating <= 4.3 ? ' [RATING BAJO]' : ''}` : '';
  const topPos = lead.top_positive ? `- Patrón positivo recurrente: ${lead.top_positive}` : '';
  const topNeg = lead.top_negative ? `- Queja recurrente: ${lead.top_negative}` : '';

  return `DATOS DEL SERVICIO (mío):
- Servicio ofrecido: ${campaign.service_offered || getSetting('my_company_info')}
- Beneficio principal: ${campaign.main_benefit || 'definido por el contexto'}
- Diferencial clave: ${campaign.key_differential || 'definido por el contexto'}

DATOS DEL LEAD:
- Nombre contacto: ${lead.name || 'N/A'}
- Negocio: ${lead.company || lead.name || 'N/A'}
- Plataforma origen: ${lead.platform}
- URL/perfil: ${lead.profile_url || 'N/A'}
- Website: ${lead.website || 'SIN WEBSITE'}
${ratingInfo}
${topPos}
${topNeg}${reviewsSummary}
- Resumen crudo: ${(lead.raw_data || '').slice(0, 1200)}`;
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
1) Calificá el lead del 1 al 10 (presencia digital, tamaño, señales de necesidad, presupuesto).
2) Si hay 3+ reviews en los datos: identificá EL patrón positivo más repetido y LA queja más repetida (frases cortas ≤12 palabras). Si hay menos de 3 reviews: devolvé null en esos campos.
3) Generá el MENSAJE 1 — Día 1 en 4 canales. REGLAS CLAVE para este lead:
   - Primera frase: SOLO datos verificables (nombre del negocio, rating real, # reviews reales, website o falta de ella, ubicación, servicios listados). NADA inventado.
   - Si hay queja recurrente real → tejela con delicadeza como observación.
   - Si rating real ≤4.3 → mencioná con tacto.
   - Si NO hay website → mencioná como oportunidad.
   - Si NO hay reviews ni ads data específica → usá observación genérica del sector/ubicación SIN inventar cifras ni detalles.
   - NUNCA inventes campañas, CTAs, porcentajes, cifras de conversión o features del negocio.

${channelSpecs(lang)}

Devuelve JSON estricto:
{"score": number, "reason": string, "top_positive": string|null, "top_negative": string|null, "messages": {"email": {"subject": string, "body": string}, "whatsapp": string, "instagram_dm": string, "loom_script": string}}`;

  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: OUTREACH_SYSTEM,
    messages: [{ role: 'user', content: user }]
  });

  const text = resp.content.find(c => c.type === 'text')?.text || '';
  const parsed = safeJSON(text);
  return {
    score: Math.max(1, Math.min(10, Number(parsed.score) || 0)),
    reason: String(parsed.reason || ''),
    top_positive: parsed.top_positive || null,
    top_negative: parsed.top_negative || null,
    messages: parsed.messages || {}
  };
}

export async function scoreAllPending(limit = 50) {
  const minScore = Number(getSetting('min_score')) || 4;
  const leads = db.prepare('SELECT * FROM leads WHERE score IS NULL LIMIT ?').all(limit);
  const upd = db.prepare(`UPDATE leads SET score = ?, score_reason = ?, suggested_message = ?, status = ?, top_positive = ?, top_negative = ? WHERE id = ?`);
  const campStmt = db.prepare('SELECT * FROM campaigns WHERE id = ?');
  let done = 0, failed = 0;
  for (const lead of leads) {
    try {
      const campaign = lead.campaign_id ? campStmt.get(lead.campaign_id) : {};
      const r = await scoreLead(lead, campaign);
      const status = r.score < minScore ? 'descartado' : lead.status;
      upd.run(r.score, r.reason, JSON.stringify(r.messages), status, r.top_positive, r.top_negative, lead.id);
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

export async function translateMessages(messages, targetLang) {
  const langName = targetLang === 'en' ? 'Inglés' : 'Español';
  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: `Traducís mensajes de outreach B2B manteniendo el tono consultivo, natural y casual. Mantenés nombres propios y marcadores como [HOOK 0:00-0:15]. Devolvés SOLO JSON con la misma estructura.`,
    messages: [{ role: 'user', content: `Traducí los siguientes mensajes a ${langName}. Mantené la estructura JSON exacta:\n\n${JSON.stringify(messages, null, 2)}` }]
  });
  const text = resp.content.find(c => c.type === 'text')?.text || '';
  return safeJSON(text);
}

function safeJSON(text) {
  const fenced = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch {} }
  const first = text.indexOf('{');
  if (first < 0) throw new Error('Claude no devolvió JSON');
  let depth = 0, inStr = false, esc = false;
  for (let i = first; i < text.length; i++) {
    const c = text[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { return JSON.parse(text.slice(first, i + 1)); } }
  }
  throw new Error('JSON incompleto');
}

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
  return safeJSON(text).messages || {};
}
