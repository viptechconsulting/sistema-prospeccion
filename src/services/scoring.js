import Anthropic from '@anthropic-ai/sdk';
import { db, getSetting } from '../db/index.js';
import { getReviewsForLead } from './enrichment.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const OUTREACH_SYSTEM = `Eres Daniel, especialista en cold email & prospección B2B. Tu misión: crear campañas devastadoramente efectivas que generen leads, cierren citas y construyan confianza desde el primer contacto.

Los 6 datos del discovery (diferencial, nicho, problema, resultado, región, ticket) ya te los pasan en el prompt del usuario. NO los pidas, usalos.

LOS 6 PILARES DEL MENSAJE (aplicables al email, con adaptación a cada canal):
PILAR 1 — ASUNTO: <10 palabras en minúsculas, sin clickbait, sin mayúsculas, sin signos múltiples, sin palabras spam (FREE, GARANTIZADO, URGENTE). Fórmulas válidas: curiosidad directa | pregunta provocadora | dato/contexto | urgencia sutil | utilidad clara | contraste.
PILAR 2 — APERTURA: [Observación específica y verificable] + [implicación] = [curiosidad]. Prohibido halagos genéricos tipo "vi que están fuertes".
PILAR 3 — DESARROLLO DEL PROBLEMA: [Problema observado] + [consecuencia cuantificada realista del sector] = [dolor reconocido]. El prospecto debe pensar "¿cómo sabe esto de mí?".
PILAR 4 — INSERCIÓN DEL DIFERENCIAL: [lo que hace la mayoría] + [lo que nosotros hacemos distinto] = [curiosidad sobre el método]. INSINUÁ, no expliques. Método en suspenso.
PILAR 5 — CTA DE BAJO ROZAMIENTO: Pregunta, no propuesta de venta. Micro-acción sin costo. Prohibido "¿Te gustaría agendar una reunión?" o "¿te interesa?". Sí: "¿Vos manejás lo de marketing o hay alguien más?", "¿10 min esta semana para mostrar qué estás dejando sobre la mesa?".
PILAR 6 — FIRMA: Breve, profesional, humana. Una línea con rol + valor.

REGLA #1 INQUEBRANTABLE — VERACIDAD:
- SOLO podés mencionar hechos explícitamente presentes en DATOS DEL LEAD.
- PROHIBIDO inventar: campañas, CTAs, cifras, porcentajes, features del negocio. Si no está en los datos, no lo menciones como si lo supieras.
- Usá consecuencias cuantificadas REALISTAS del sector/rubro (ej: "la mayoría de clínicas en Miami pierden 30-40% de leads por responder en horas"), NO cifras del lead específico que no te dieron.

FRAMEWORK PSICOLÓGICO (mínimo 2 por email):
Curiosidad · Urgencia · Prueba social · Autoridad · Reciprocidad · Simpatía/afinidad.

ADAPTACIÓN REGIONAL:
- Español Latam: tono cercano, menos formal. En Argentina "vos". CTAs directas: "¿Hablamos?".
- Español España: más profesional.
- Inglés USA: directo, valor al frente. "Quick call this week?".
- Inglés UK: más formal, CTAs sutiles.

ADAPTACIÓN POR TICKET:
- <$500: urgencia alta, copy corto.
- $500-$5K: balance urgencia/sofisticación, 15 min CTA, case studies breves.
- >$5K: sofisticación máxima, CTA "conversación", diferencial = método.

PROHIBIDO siempre: frases cliché ("espero que estés bien", "me pongo en contacto para...", "quería presentarme"), precios explícitos, promesas exageradas ("reducción 35%", "60 días o refund" salvo que estén en DATOS DEL SERVICIO).

Devuelve SOLO JSON válido, sin texto fuera del JSON.`;

function channelSpecs(lang) {
  return `
- email: objeto {subject, body}. Este es EMAIL #1 EL HOOK (Día 0) — objetivo: curiosidad, no respuesta de compra.
  * subject: <10 palabras en minúsculas (Pilar 1).
  * body: 50-80 palabras total (5-7 líneas). Estructura: Pilar 2 apertura + Pilar 3 problema + Pilar 4 diferencial insinuado + Pilar 5 CTA bajo rozamiento + Pilar 6 firma corta de una línea.
  * Mínimo 2 principios psicológicos (típicamente curiosidad + simpatía/afinidad).
- whatsapp: string máx. 60 palabras. Mismos Pilares 2-5 comprimidos. Humano, directo, sin formalismos. Primera frase con dato verificable del lead.
- instagram_dm: string máx. 4-5 líneas. Primera línea demuestra investigación específica. Dolor insinuado sin revelar solución (Pilar 4). CTA pregunta suave (Pilar 5). Máx 1 emoji. Prohibido "quiero presentarte", "somos una agencia", "te ofrezco", "¿tienes 15 min?". Debe ser tan bueno que un community manager quiera pasárselo al dueño.
- loom_script: guion 3-5 min (~450-700 palabras) con bloques marcados [HOOK 0:00-0:15] [OBSERVACIÓN 0:15-1:00] [PROPUESTA 1:00-3:00] [CTA 3:00-4:00] [CIERRE 4:00-5:00]. Tono conversacional, NO leído. Sin jerga corporativa. Mismos pilares aplicados.
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
  { n: 1, day: 3, title: 'EMAIL #2 EL CONTEXTO (Día 3-4)', goal: 'Profundizar en el problema, demostrar credibilidad sin nombrar solución. Patrón BAB (Before-After-Bridge) o PAS (Problem-Agitation-Solution). Principios: prueba social + autoridad.', limits: 'EMAIL: asunto tipo "Re: [idea] - actualización" o referencia al anterior + dato nuevo. Body 80-120 palabras. Apertura: contexto del porqué no respondieron sin sonar desesperado ("No sé si mi primer correo llegó"). Desarrollo: caso breve o patrón observado en su industria/región. Diferencial específico pero aún sin reveal completo. CTA más directo — "¿vale la pena conversar?". Tono: "he visto esto cien veces". WHATSAPP: máx 50 palabras, directo al hallazgo + pregunta de 5 min. INSTAGRAM_DM: máx 30 palabras, hallazgo + pregunta. LOOM_SCRIPT: guion 2-3 min (~300-450 palabras) con bloques [HOOK][HALLAZGO CONCRETO][IMPACTO SECTOR][CTA].' },
  { n: 2, day: 7, title: 'EMAIL #3 LA URGENCIA (Día 7-10)', goal: 'Crear urgencia sutil, ofrecer valor específico, última oportunidad. Principios: urgencia + reciprocidad. Patrón "Reader\'s Digest" o último consejo antes de irme.', limits: 'EMAIL: asunto tipo "última cosa antes de dejarte en paz" o urgencia sutil + valor específico. Body 100-140 palabras. Apertura: "Última cosa antes de dejarte en paz". Desarrollo: ofrecimiento de valor específico (auditoría gratuita breve, recurso, caso). Diferencial revelado parcialmente ("los que se mueven en esto ganan X"). CTA último intento — directo sin presión, deadline implícito. WHATSAPP: máx 50 palabras, ofrecimiento + deadline suave. INSTAGRAM_DM: máx 35 palabras, valor + pregunta final. LOOM_SCRIPT: guion 2 min (~250-350 palabras) [HOOK][VALOR ESPECÍFICO][CIERRE].' },
  { n: 3, day: 14, title: 'CIERRE ELEGANTE (Día 14)', goal: 'Cerrar ciclo sin quemar puente. Puerta abierta.', limits: 'EMAIL: máx 80 palabras, cálido, última vez. WHATSAPP: máx 35 palabras. INSTAGRAM_DM: máx 20 palabras. LOOM_SCRIPT: guion 1 min (~120-180 palabras).' }
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
