import { client } from './anthropic.js';
import { db, getSetting } from '../db/index.js';
import { getReviewsForLead } from './enrichment.js';

const MODEL = 'claude-haiku-4-5-20251001';

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
    else if (c === '}') { depth--; if (depth === 0) return JSON.parse(text.slice(first, i + 1)); }
  }
  throw new Error('JSON incompleto');
}

function parseRawData(lead) {
  try { return typeof lead.raw_data === 'string' ? JSON.parse(lead.raw_data) : (lead.raw_data || {}); }
  catch { return {}; }
}

function buildLeadContext(lead, campaign = {}) {
  const reviews = getReviewsForLead(lead);
  const rawObj = parseRawData(lead);
  const reviewsSummary = reviews.length
    ? reviews.slice(0, 15).map(r => `- [${r.rating || '?'}★] ${r.text.slice(0, 150)}`).join('\n')
    : 'Sin reviews disponibles';

  const serp = rawObj.serp;
  let serpInfo = 'Sin datos SERP';
  if (serp) {
    serpInfo = serp.domain_found
      ? `Aparece en Google (posiciones: ${serp.domain_positions?.map(p => p.position).join(', ')})`
      : `No aparece en primeros resultados de Google`;
  }

  const ads = rawObj.meta_ads;
  let adsInfo = 'Sin datos de ads';
  if (ads) {
    adsInfo = ads.total_ads_found > 0
      ? `${ads.total_ads_found} ads encontrados (${ads.ads_active} activos)`
      : 'No tiene ads activos';
  }

  return {
    business_name: lead.company || lead.name || 'N/A',
    industry: campaign.niche || 'no especificada',
    city: campaign.location || 'no especificada',
    reviews: lead.review_count || 0,
    rating: lead.rating || 'sin datos',
    service: campaign.service_offered || getSetting('my_company_info') || '',
    website: lead.website || 'sin website',
    phone: lead.phone || '',
    instagram: lead.instagram_url || '',
    gmb_url: lead.gmb_url || '',
    top_positive: lead.top_positive || '',
    top_negative: lead.top_negative || '',
    serp: serpInfo,
    ads: adsInfo,
    reviews_text: reviewsSummary,
    score: lead.score,
    status: lead.status,
    additional_context: [
      lead.has_ads ? `Inversión ads: ${lead.has_ads}` : '',
      lead.seo_audit ? `SEO: ${lead.seo_audit}` : ''
    ].filter(Boolean).join('. ')
  };
}

function logEvent(leadId, eventType, opts = {}) {
  const lead = db.prepare('SELECT status FROM leads WHERE id = ?').get(leadId);
  db.prepare(`INSERT INTO conversation_events (lead_id, event_type, channel, direction, content, metadata, status_before, status_after, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
    leadId, eventType, opts.channel || null, opts.direction || 'system',
    opts.content || null, opts.metadata ? JSON.stringify(opts.metadata) : null,
    lead?.status || null, opts.statusAfter || lead?.status || null
  );
}

function updateLeadStatus(leadId, newStatus) {
  const lead = db.prepare('SELECT status FROM leads WHERE id = ?').get(leadId);
  if (!lead || lead.status === newStatus) return;
  db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(newStatus, leadId);
  logEvent(leadId, 'status_changed', { statusAfter: newStatus, content: `${lead.status} → ${newStatus}` });
}

export async function generateStrategy(leadId, options = {}) {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
  if (!lead) throw new Error('Lead no encontrado');
  const campaign = lead.campaign_id ? db.prepare('SELECT * FROM campaigns WHERE id = ?').get(lead.campaign_id) : {};
  const ctx = buildLeadContext(lead, campaign);

  const angle = options.angle || '';
  const tone = options.tone || 'consultivo';

  const prompt = `Eres un experto en ventas B2B para negocios locales.

Analiza este negocio y define la mejor estrategia de acercamiento.

Contexto:
- Negocio: ${ctx.business_name}
- Industria: ${ctx.industry}
- Ciudad: ${ctx.city}
- Reviews: ${ctx.reviews}
- Rating: ${ctx.rating}
- Servicio detectado: ${ctx.service}
- Website: ${ctx.website}
- Información adicional: ${ctx.additional_context}
- Top positivo reviews: ${ctx.top_positive || 'N/A'}
- Top negativo reviews: ${ctx.top_negative || 'N/A'}
- SERP: ${ctx.serp}
- Ads: ${ctx.ads}
- Reviews reales: ${ctx.reviews_text}
${angle ? `\nÁngulo solicitado: ${angle}` : ''}
Tono recomendado: ${tone}

Devuelve en JSON:

{
  "angle": "",
  "non_obvious_problem": "",
  "commercial_implication": "",
  "hook": "",
  "message_goal": "",
  "recommended_tone": "",
  "why_this_angle": ""
}

Reglas:
- No sonar como agencia de marketing.
- No vender SEO genérico.
- No mencionar IA, automatización, scraping ni software.
- Enfocarse en oportunidad comercial real.
- Ser específico al negocio.
- Evitar exageraciones.
- No prometer resultados.

Ángulos permitidos:
- Demanda no captada
- Ventaja desaprovechada
- Oportunidad oculta
- Comparación con competidores
- Conversaciones mal convertidas
- Leads existentes mal aprovechados

Devuelve SOLO JSON válido, sin texto fuera del JSON.`;

  const resp = await client().messages.create({
    model: MODEL, max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = resp.content.find(c => c.type === 'text')?.text || '';
  const parsed = safeJSON(text);

  const stmt = db.prepare(`INSERT INTO lead_strategies (lead_id, angle, non_obvious_problem, commercial_implication, hook, message_goal, recommended_tone, why_this_angle, full_strategy)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  stmt.run(leadId, parsed.angle, parsed.non_obvious_problem, parsed.commercial_implication,
    parsed.hook, parsed.message_goal, parsed.recommended_tone || tone, parsed.why_this_angle, JSON.stringify(parsed));

  logEvent(leadId, 'strategy_generated', { content: `Ángulo: ${parsed.angle}`, metadata: { angle: parsed.angle, tone } });
  updateLeadStatus(leadId, 'estrategia_lista');

  return parsed;
}

export async function generateOutreachMessage(leadId, options = {}) {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
  if (!lead) throw new Error('Lead no encontrado');
  const strategy = db.prepare('SELECT * FROM lead_strategies WHERE lead_id = ? ORDER BY id DESC LIMIT 1').get(leadId);
  if (!strategy) throw new Error('Genera una estrategia primero');
  const campaign = lead.campaign_id ? db.prepare('SELECT * FROM campaigns WHERE id = ?').get(lead.campaign_id) : {};
  const ctx = buildLeadContext(lead, campaign);
  const channel = options.channel || 'whatsapp';

  const prompt = `Eres un experto en ventas consultivas para negocios locales.

Tu tarea NO es vender.
Tu tarea es iniciar una conversación generando curiosidad basada en un insight real.

IMPORTANTE:
Los mensajes deben parecer escritos por una persona observadora, no por una agencia ni por un sistema.

==================================================
OBJETIVO DEL MENSAJE
==================================================

- Generar curiosidad específica
- Señalar una anomalía real
- Hacer que el prospecto piense "esto es interesante"
- Conseguir permiso para mostrar más (mini demo o explicación)

NO debes:
- vender
- explicar la solución
- cerrar
- educar
- sonar experto técnico

==================================================
REGLAS CRÍTICAS (OBLIGATORIAS)
==================================================

NO hacer:
- No usar números inventados (ej: "10-15 pacientes perdidos")
- No afirmar pérdidas económicas
- No exagerar impacto
- No vender servicios (SEO, automatización, marketing, IA)
- No mencionar IA, automatización, software, sistema, algoritmo
- No explicar múltiples problemas a la vez
- No escribir párrafos largos
- No sonar como agencia
- No usar lenguaje técnico
- No sonar agresivo
- No hacer claims definitivos

NO estructura:
- Problema + solución + CTA
- Diagnóstico completo
- Pitch de venta

==================================================
ENFOQUE CORRECTO (OBLIGATORIO)
==================================================

El mensaje debe seguir este patrón:

1. Observación específica real (basada en datos del lead)
2. Anomalía o inconsistencia (algo "raro")
3. Intriga ligera (sin explicar todo)
4. Pregunta simple

==================================================
ESTILO
==================================================

- Natural
- Conversacional
- Corto
- Humano
- Curioso
- No perfecto (ligeramente informal está bien)
- Como si fuera un mensaje pensado, no generado

==================================================
ESTRUCTURA RECOMENDADA
==================================================

Línea 1: Observación fuerte (reviews, presencia, etc)
Línea 2: Anomalía o inconsistencia
Línea 3: Insight incompleto (sin cerrar la idea)
Línea 4: Pregunta simple

==================================================
EJEMPLO DE ESTILO (REFERENCIA)
==================================================

"Vi que tienen 769 reseñas (muy fuerte), pero hay algo raro:

cuando alguien busca el negocio en Google, no aparecen como deberían.

Eso normalmente pasa por un detalle que casi nadie revisa.

¿Te lo muestro?"

==================================================
INPUT
==================================================

Estrategia:
${strategy.full_strategy}

Contexto del lead:
- Negocio: ${ctx.business_name}
- Industria: ${ctx.industry}
- Ciudad: ${ctx.city}
- Rating: ${ctx.rating} (${ctx.reviews} reviews)
- Website: ${ctx.website}
- SERP: ${ctx.serp}
- Ads: ${ctx.ads}
- Top positivo reviews: ${ctx.top_positive || 'N/A'}
- Top negativo reviews: ${ctx.top_negative || 'N/A'}
- Información adicional: ${ctx.additional_context}

Canal: ${channel}

==================================================
REGLAS FINALES
==================================================

- Máximo 4 líneas
- Cada línea corta
- Evitar párrafos largos
- Terminar SIEMPRE con pregunta simple
- No explicar todo
- No cerrar la venta
- Dejar espacio mental al prospecto

El mensaje debe hacer que el usuario piense:
"¿Qué vio esta persona que yo no estoy viendo?"

Devuelve SOLO JSON válido:

{
  "message": "",
  "message_style": "curiosity_based",
  "angle_used": "",
  "notes": ""
}`;

  const resp = await client().messages.create({
    model: MODEL, max_tokens: 800,
    messages: [{ role: 'user', content: prompt }]
  });

  const parsed = safeJSON(resp.content.find(c => c.type === 'text')?.text || '');

  db.prepare('UPDATE leads SET suggested_message = ? WHERE id = ?').run(
    JSON.stringify({
      whatsapp: parsed.message,
      email: { subject: strategy.hook || '', body: parsed.message },
      instagram_dm: parsed.message,
      loom_script: '',
      message_style: parsed.message_style || 'curiosity_based',
      angle_used: parsed.angle_used || '',
      notes: parsed.notes || ''
    }),
    leadId
  );

  logEvent(leadId, 'message_generated', { channel, content: parsed.message?.slice(0, 100) });
  updateLeadStatus(leadId, 'mensaje_listo');

  return parsed;
}

export async function rewriteMessageTone(leadId, style) {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
  if (!lead) throw new Error('Lead no encontrado');
  const campaign = lead.campaign_id ? db.prepare('SELECT * FROM campaigns WHERE id = ?').get(lead.campaign_id) : {};
  const ctx = buildLeadContext(lead, campaign);

  let currentMsg = '';
  try {
    const parsed = JSON.parse(lead.suggested_message);
    currentMsg = parsed.whatsapp || parsed.email?.body || '';
  } catch {
    currentMsg = lead.suggested_message || '';
  }
  if (!currentMsg) throw new Error('No hay mensaje para reescribir');

  const prompt = `Reescribe el siguiente mensaje con el estilo solicitado.

Mensaje original:
${currentMsg}

Estilo solicitado:
${style}

Contexto del lead:
- Negocio: ${ctx.business_name}
- Industria: ${ctx.industry}
- Ciudad: ${ctx.city}

Reglas:
- Mantener la idea central.
- No hacerlo más largo.
- No sonar robótico.
- No sonar como agencia.
- No usar palabras técnicas.
- Mantener máximo 4 líneas.
- Terminar con una pregunta simple si aplica.

Devuelve JSON:

{
  "message": ""
}

Devuelve SOLO JSON válido.`;

  const resp = await client().messages.create({
    model: MODEL, max_tokens: 600,
    messages: [{ role: 'user', content: prompt }]
  });

  const parsed = safeJSON(resp.content.find(c => c.type === 'text')?.text || '');
  const newMsg = parsed.message || currentMsg;

  let existing = {};
  try { existing = JSON.parse(lead.suggested_message); } catch {}
  existing.whatsapp = newMsg;
  if (existing.email) existing.email.body = newMsg;
  existing.instagram_dm = newMsg;
  db.prepare('UPDATE leads SET suggested_message = ? WHERE id = ?').run(JSON.stringify(existing), leadId);

  logEvent(leadId, 'tone_rewrite', { content: `Estilo: ${style}`, metadata: { style } });

  return { message: newMsg };
}

export async function analyzeProspectReply(leadId, replyText, channel = 'whatsapp') {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
  if (!lead) throw new Error('Lead no encontrado');
  const campaign = lead.campaign_id ? db.prepare('SELECT * FROM campaigns WHERE id = ?').get(lead.campaign_id) : {};
  const ctx = buildLeadContext(lead, campaign);

  const priorMessages = db.prepare('SELECT kind, content, sent_at FROM messages WHERE lead_id = ? ORDER BY id ASC').all(leadId);
  const priorEvents = db.prepare("SELECT event_type, content, created_at FROM conversation_events WHERE lead_id = ? AND direction IN ('outbound','inbound') ORDER BY created_at ASC").all(leadId);

  let initialMessage = '';
  try {
    const parsed = JSON.parse(lead.suggested_message);
    initialMessage = parsed.whatsapp || parsed.email?.body || '';
  } catch { initialMessage = lead.suggested_message || ''; }

  const history = [
    ...priorMessages.map(m => `[Enviado - ${m.kind}] ${m.content}`),
    ...priorEvents.filter(e => e.content).map(e => `[${e.event_type}] ${e.content}`)
  ].join('\n') || '(sin historial previo)';

  // Fallback logic first
  const fallback = detectIntentFallback(replyText);

  const prompt = `Eres un experto en ventas conversacionales para negocios locales.

Analiza la respuesta de un prospecto y define la mejor siguiente acción.

Contexto del lead:
- Negocio: ${ctx.business_name}
- Industria: ${ctx.industry}
- Ciudad: ${ctx.city}
- Rating: ${ctx.rating}

Mensaje inicial enviado:
${initialMessage}

Historial de conversación:
${history}

Última respuesta del prospecto:
${replyText}

Objetivo:
Avanzar la conversación sin sonar agresivo, robótico ni genérico.
Cuando tenga sentido, llevar hacia una mini demo de 5 minutos.
Si el prospecto rechaza claramente, respetar y cerrar suavemente.

No mencionar IA, automatización, software, scraping ni tecnología.
No vender marketing genérico.
No sobreexplicar.

Devuelve JSON:

{
  "lead_status": "",
  "response_type": "",
  "objection": "",
  "intent_level": "",
  "recommended_action": "",
  "suggested_reply": "",
  "recommended_timing": "",
  "strategic_reason": ""
}

Valores permitidos para lead_status: Respondió, Interesado, Objeción, Demo propuesta, Demo agendada, No interesado, Reactivar después, Cerrado ganado, Cerrado perdido
Valores permitidos para response_type: Interesado, Mándame info, No tengo tiempo, No me interesa, Ya tengo alguien, Cuánto cuesta, Ambigua, Pide llamada, Pide propuesta, Sin respuesta
Valores permitidos para objection: Precio, Tiempo, Confianza, No prioridad, Ya tiene proveedor, Falta de claridad, No ve valor, Miedo al cambio, Ninguna
Valores permitidos para intent_level: Alta, Media, Baja, Negativa, Desconocida
Valores permitidos para recommended_action: Agendar demo, Pedir permiso para mostrar, Reencuadrar, Reducir fricción, Hacer pregunta aclaratoria, Enviar prueba específica, Programar follow-up, Cerrar conversación, Reactivar después, Enviar propuesta
Valores permitidos para recommended_timing: Enviar ahora, Esperar 24 horas, Esperar 48 horas, Esperar 3-5 días, No insistir

Reglas para suggested_reply:
- Máximo 2-3 líneas.
- Natural.
- Claro.
- No presionar.
- No explicar demasiado.
- Mantener curiosidad.
- Personalizado al contexto si es posible.

Devuelve SOLO JSON válido.`;

  let analysis;
  try {
    const resp = await client().messages.create({
      model: MODEL, max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }]
    });
    analysis = safeJSON(resp.content.find(c => c.type === 'text')?.text || '');
  } catch {
    analysis = fallback;
  }

  const stmt = db.prepare(`INSERT INTO conversation_analyses (lead_id, reply_text, channel, lead_status, response_type, objection, intent_level, recommended_action, suggested_reply, recommended_timing, strategic_reason, full_analysis)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  stmt.run(leadId, replyText, channel,
    analysis.lead_status, analysis.response_type, analysis.objection, analysis.intent_level,
    analysis.recommended_action, analysis.suggested_reply, analysis.recommended_timing,
    analysis.strategic_reason, JSON.stringify(analysis));

  logEvent(leadId, 'reply_pasted', { channel, direction: 'inbound', content: replyText.slice(0, 200) });
  logEvent(leadId, 'reply_analyzed', { channel, content: `Tipo: ${analysis.response_type} | Intención: ${analysis.intent_level}`, metadata: analysis });

  const statusMap = {
    'Interesado': 'interesado',
    'Objeción': 'objecion',
    'Demo propuesta': 'demo_propuesta',
    'Demo agendada': 'demo_agendada',
    'No interesado': 'cerrado_perdido',
    'Reactivar después': 'reactivar_despues',
    'Cerrado ganado': 'cerrado_ganado',
    'Cerrado perdido': 'cerrado_perdido',
    'Respondió': 'respondio'
  };
  const newStatus = statusMap[analysis.lead_status] || 'respondio';
  updateLeadStatus(leadId, newStatus);

  return analysis;
}

function detectIntentFallback(text) {
  const t = (text || '').toLowerCase();
  if (!t.trim()) return { lead_status: 'Respondió', response_type: 'Sin respuesta', objection: 'Ninguna', intent_level: 'Desconocida', recommended_action: 'Programar follow-up', suggested_reply: '', recommended_timing: 'Esperar 24 horas', strategic_reason: 'Sin respuesta, dar tiempo.' };
  if (/s[ií]|yes|interested|me interesa|dale|claro|vamos/.test(t)) return { lead_status: 'Interesado', response_type: 'Interesado', objection: 'Ninguna', intent_level: 'Alta', recommended_action: 'Agendar demo', suggested_reply: 'Perfecto. Es más fácil mostrarlo que explicarlo. ¿Te viene mejor hoy o mañana para verlo en 5 minutos?', recommended_timing: 'Enviar ahora', strategic_reason: 'El prospecto mostró interés directo.' };
  if (/info|details|send me|m[áa]ndame|env[ií]ame/.test(t)) return { lead_status: 'Respondió', response_type: 'Mándame info', objection: 'Falta de claridad', intent_level: 'Media', recommended_action: 'Pedir permiso para mostrar', suggested_reply: 'Te podría mandar algo general, pero en tu caso lo interesante es específico del negocio. Prefiero enseñarte exactamente lo que vi en 5 minutos y si no tiene sentido lo dejamos ahí.', recommended_timing: 'Enviar ahora', strategic_reason: 'Pide info genérica — mejor redirigir a demo personalizada.' };
  if (/price|cost|cu[áa]nto|precio|tarifa/.test(t)) return { lead_status: 'Respondió', response_type: 'Cuánto cuesta', objection: 'Precio', intent_level: 'Media', recommended_action: 'Reencuadrar', suggested_reply: 'Depende del caso, porque lo adaptamos a cada negocio. Antes de hablar de precio, tiene más sentido ver si realmente hay algo que mejorar en tu caso.', recommended_timing: 'Enviar ahora', strategic_reason: 'Pregunta de precio temprana — reencuadrar antes de anclar.' };
  if (/no me interesa|not interested|no gracias|no thanks/.test(t)) return { lead_status: 'No interesado', response_type: 'No me interesa', objection: 'No ve valor', intent_level: 'Negativa', recommended_action: 'Cerrar conversación', suggested_reply: 'Entendido, sin problema. Si en algún momento quieres echarle un ojo, acá estoy.', recommended_timing: 'No insistir', strategic_reason: 'Rechazo claro — respetar decisión.' };
  if (/ya tengo|already have|agency|agencia/.test(t)) return { lead_status: 'Objeción', response_type: 'Ya tengo alguien', objection: 'Ya tiene proveedor', intent_level: 'Baja', recommended_action: 'Reencuadrar', suggested_reply: 'Perfecto, entonces esto puede hacer incluso más sentido. No es reemplazar lo que ya tienes, sino detectar oportunidades que a veces no se ven aunque ya haya marketing activo.', recommended_timing: 'Enviar ahora', strategic_reason: 'Tiene proveedor — posicionarse como complemento.' };
  if (/busy|no time|no tengo tiempo|ocupado/.test(t)) return { lead_status: 'Objeción', response_type: 'No tengo tiempo', objection: 'Tiempo', intent_level: 'Baja', recommended_action: 'Reducir fricción', suggested_reply: 'Total, justo por eso lo planteo rápido. Si en 5 minutos no ves algo útil para tu negocio, lo dejamos ahí sin problema.', recommended_timing: 'Enviar ahora', strategic_reason: 'Objeción de tiempo — minimizar fricción.' };
  if (/llam|call|habla/.test(t)) return { lead_status: 'Interesado', response_type: 'Pide llamada', objection: 'Ninguna', intent_level: 'Alta', recommended_action: 'Agendar demo', suggested_reply: '', recommended_timing: 'Enviar ahora', strategic_reason: 'Pide llamada — señal de interés alto.' };
  if (/propuesta|proposal|cotizaci/.test(t)) return { lead_status: 'Interesado', response_type: 'Pide propuesta', objection: 'Ninguna', intent_level: 'Alta', recommended_action: 'Enviar propuesta', suggested_reply: '', recommended_timing: 'Enviar ahora', strategic_reason: 'Pide propuesta — avanzar.' };
  return { lead_status: 'Respondió', response_type: 'Ambigua', objection: 'Ninguna', intent_level: 'Desconocida', recommended_action: 'Hacer pregunta aclaratoria', suggested_reply: '', recommended_timing: 'Enviar ahora', strategic_reason: 'Respuesta ambigua — aclarar intención.' };
}

export async function generateSmartFollowUp(leadId) {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
  if (!lead) throw new Error('Lead no encontrado');
  const campaign = lead.campaign_id ? db.prepare('SELECT * FROM campaigns WHERE id = ?').get(lead.campaign_id) : {};
  const ctx = buildLeadContext(lead, campaign);
  const strategy = db.prepare('SELECT * FROM lead_strategies WHERE lead_id = ? ORDER BY id DESC LIMIT 1').get(leadId);
  const priorMessages = db.prepare('SELECT kind, content FROM messages WHERE lead_id = ? ORDER BY id ASC').all(leadId);
  const lastAnalysis = db.prepare('SELECT * FROM conversation_analyses WHERE lead_id = ? ORDER BY id DESC LIMIT 1').get(leadId);

  const FOLLOWUP_TEMPLATES = {
    sin_respuesta: { type: 'sin_respuesta', message: 'Hey, sé que vas a mil — solo quería saber si esto tiene sentido verlo rápido o lo dejamos para más adelante sin problema.', timing: '24-48 horas', objective: 'Reactivar sin presión' },
    segundo_followup: { type: 'segundo_followup', message: 'Cierro esto por mi lado para no molestarte. Si en algún momento quieres ver la oportunidad que vi en tu negocio, me dices y te lo enseño rápido.', timing: '3-5 días', objective: 'Cerrar ciclo sin quemar puente' },
    mandame_info: { type: 'mandame_info', message: 'Te podría mandar algo general, pero en tu caso lo interesante es específico del negocio. Prefiero enseñarte exactamente lo que vi en 5 minutos y si no tiene sentido lo dejamos ahí.', timing: 'Ahora', objective: 'Redirigir a demo' },
    no_tengo_tiempo: { type: 'no_tengo_tiempo', message: 'Total, justo por eso lo planteo rápido. Si en 5 minutos no ves algo útil para tu negocio, lo dejamos ahí sin problema.', timing: 'Ahora', objective: 'Reducir fricción' },
    ya_tengo_alguien: { type: 'ya_tengo_alguien', message: 'Perfecto, entonces esto puede hacer incluso más sentido. No es reemplazar lo que ya tienes, sino detectar oportunidades que a veces no se ven aunque ya haya marketing activo.', timing: 'Ahora', objective: 'Posicionarse como complemento' },
    cuanto_cuesta: { type: 'cuanto_cuesta', message: 'Depende del caso, porque lo adaptamos a cada negocio. Antes de hablar de precio, tiene más sentido ver si realmente hay algo que mejorar en tu caso.', timing: 'Ahora', objective: 'Reencuadrar antes de precio' },
    interesado: { type: 'interesado', message: 'Perfecto. Es más fácil mostrarlo que explicarlo. ¿Te viene mejor hoy o mañana para verlo en 5 minutos?', timing: 'Ahora', objective: 'Agendar demo' }
  };

  let template;
  if (lastAnalysis) {
    const rt = lastAnalysis.response_type?.toLowerCase() || '';
    if (rt.includes('info')) template = FOLLOWUP_TEMPLATES.mandame_info;
    else if (rt.includes('tiempo')) template = FOLLOWUP_TEMPLATES.no_tengo_tiempo;
    else if (rt.includes('tengo alguien')) template = FOLLOWUP_TEMPLATES.ya_tengo_alguien;
    else if (rt.includes('cuesta') || rt.includes('precio')) template = FOLLOWUP_TEMPLATES.cuanto_cuesta;
    else if (rt.includes('interesado')) template = FOLLOWUP_TEMPLATES.interesado;
    else template = FOLLOWUP_TEMPLATES.sin_respuesta;
  } else {
    const fc = lead.followup_count || 0;
    template = fc >= 1 ? FOLLOWUP_TEMPLATES.segundo_followup : FOLLOWUP_TEMPLATES.sin_respuesta;
  }

  let finalMessage = template.message;
  let strategicReason = template.objective;

  if (strategy) {
    try {
      const prompt = `Genera un mensaje de follow-up para este prospecto.

Contexto:
- Negocio: ${ctx.business_name}
- Estrategia usada: ${strategy.angle} - ${strategy.hook}
- Mensajes previos: ${priorMessages.map(m => m.content).join(' | ').slice(0, 300) || 'ninguno'}
- Última respuesta analizada: ${lastAnalysis?.response_type || 'sin respuesta'}
- Tipo de follow-up: ${template.type}
- Objetivo: ${template.objective}

Reglas:
- Máximo 2-3 líneas.
- Natural, humano.
- No mencionar IA, automatización, software.
- No presionar.
- Basarse en el contexto real del negocio.

Devuelve JSON: { "message": "", "strategic_reason": "" }`;

      const resp = await client().messages.create({ model: MODEL, max_tokens: 500, messages: [{ role: 'user', content: prompt }] });
      const parsed = safeJSON(resp.content.find(c => c.type === 'text')?.text || '');
      if (parsed.message) finalMessage = parsed.message;
      if (parsed.strategic_reason) strategicReason = parsed.strategic_reason;
    } catch {}
  }

  const now = new Date();
  let suggestedDate = new Date(now);
  if (template.timing.includes('24')) suggestedDate.setHours(suggestedDate.getHours() + 24);
  else if (template.timing.includes('48')) suggestedDate.setHours(suggestedDate.getHours() + 48);
  else if (template.timing.includes('3-5')) suggestedDate.setDate(suggestedDate.getDate() + 3);

  db.prepare(`INSERT INTO follow_up_recommendations (lead_id, followup_type, suggested_date, message, objective, strategic_reason, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')`).run(
    leadId, template.type, suggestedDate.toISOString(), finalMessage, template.objective, strategicReason
  );

  logEvent(leadId, 'followup_generated', { content: `Tipo: ${template.type} | ${template.objective}` });

  return { type: template.type, message: finalMessage, timing: template.timing, objective: template.objective, strategic_reason: strategicReason, suggested_date: suggestedDate.toISOString() };
}

export { logEvent, updateLeadStatus };
