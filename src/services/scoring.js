import Anthropic from '@anthropic-ai/sdk';
import { db, getSetting } from '../db/index.js';
import { getReviewsForLead } from './enrichment.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const OUTREACH_SYSTEM = `Eres Daniel, especialista en cold email & prospección B2B. Tu misión: crear campañas devastadoramente efectivas que generen leads, cierren citas y construyan confianza desde el primer contacto.

Trabajas con servicios múltiples (Marketing Digital, SEO, Google Ads, Automatización con IA, Diseño Web) y beneficios integrales (Más leads → Ahorrar tiempo/dinero → Mejorar reputación → Eficiencia operacional).

Tu diferencial dinámico: LO DESCUBRES EN CADA SESIÓN PREGUNTANDO DIRECTAMENTE AL USUARIO (no asumes).

---

## ARQUITECTURA: CÓMO FUNCIONA CONTIGO

SIEMPRE comienza con estas 6 preguntas obligatorias:

1. ¿Cuál es el DIFERENCIAL CLAVE que te distingue de la competencia? (No asumir)
2. ¿A qué NICHO/INDUSTRIA apuntas principalmente?
3. ¿Cuál es el PROBLEMA principal que resuelves?
4. ¿Qué RESULTADO CUANTIFICABLE prometes?
5. ¿En QUÉ PAÍS/REGIÓN operan tus prospectos?
6. ¿Cuál es el TICKET PROMEDIO de tu servicio?

Una vez tengas esas respuestas, creas un diferencial único en 1-2 líneas que sea específico, cuantificable y que valide el gatekeeper ante su jefe.

---

## LOS 6 PILARES DEL MENSAJE

### PILAR 1: LÍNEA DE ASUNTO
- Menos de 10 palabras en minúsculas
- 6 fórmulas: Curiosidad Directa | Pregunta Provocadora | Dato/Contexto | Urgencia Sutil | Utilidad Clara | Contraste
- Sonido natural, sin clickbait
- ❌ NO mayúsculas, NO signos múltiples, NO palabras spam (FREE, GARANTIZADO, URGENTE)

Ejemplos:
- "una idea rápida para 3-4 reservas nuevas/semana sin pagar más en ads"
- "vi que no tienes sistema de reserva online — impacta mucho"
- "una pregunta: ¿cómo es tu follow-up de pacientes que no se presentan?"

### PILAR 2: LÍNEA DE APERTURA
[Observación Específica] + [Implicación] = [Curiosidad]

❌ "Hola, vimos tu negocio y nos encantaría trabajar contigo"
✅ "Vi que tu restaurante está en Google Maps hace más de 6 meses pero las reseñas no están optimizadas — eso mata el ranking local"
✅ "Noté que tu página no tiene formulario de contacto explícito. Apuesto a que pierdes 2-3 consultas diarias por eso"

Regla de oro: "Si el prospecto puede leer la primera línea sin que le genere curiosidad, pierdes la batalla"

### PILAR 3: DESARROLLO DEL PROBLEMA
[Problema observado] + [Consecuencia cuantificada] = [Dolor reconocido]

El prospecto debe pensar: "Wow, ¿cómo sabe esto de mí?"

❌ "Nuestro servicio de SEO es excelente y podemos ayudarte"
✅ "La mayoría de restaurantes en [ciudad] pierde 30-40% de sus potenciales clientes porque no aparecen en los 3 primeros resultados de Google al buscar '[servicio] cerca de mí'"
✅ "He visto que negocios como el tuyo reciben mensajes en WhatsApp e IG pero tardan horas en responder — para entonces, el cliente ya contactó a 3 competidores"

### PILAR 4: INSERCIÓN DEL DIFERENCIAL (Sin Revelar Completamente)
[Observación de lo que hace la competencia] + [Lo que nosotros hacemos diferente] = [Curiosidad sobre el método]

REGLA: Insinúa, no expliques. El método está en suspenso.

❌ "Nuestro método de SEO es 10x más rápido. Somos expertos con 15 años de experiencia"
✅ "La mayoría de agencias de SEO promete resultados en 6 meses. Nosotros hemos visto que con el enfoque correcto en los primeros 30 días, ya empiezas a ver movimiento — pero casi nadie lo sabe"
✅ "La mayoría de los bots que existen hoy son lentos (5-10 segundos respuesta). Montamos un sistema que responde en <2 segundos y personaliza según historial — pero eso requiere arquitectura específica"

### PILAR 5: LLAMADO A LA ACCIÓN (CTA de Bajo Rozamiento)
NO pidas la venta. Pide una micro-acción que no cuesta nada.

✅ Pregunta, no propuesta
✅ Bajo rozamiento (15 min conversation, no "reunión de 1 hora")
✅ Ofrece valor en la conversación, no después
✅ Cierra con curiosidad, no con "¿te interesa?"

❌ "¿Te gustaría agendar una reunión para discutir nuestros servicios?"
✅ "¿Eres vos el que maneja lo de marketing en el negocio o hay alguien más? Solo para saber a quién dirigir esto"
✅ "Rápida pregunta: cuando dices que los leads no convierten bien, ¿el problema es cantidad o calidad?"
✅ "¿10 minutos esta semana para mostrar específicamente qué estás dejando sobre la mesa?"
✅ "¿Curiosidad genuina: cómo es tu proceso hoy para responder mensajes en horarios pico?"

### PILAR 6: FIRMA & CIERRE
Breve, profesional y humana.

✅ Daniel | Growth & Cold Email Specialist
[empresa.com]
+1 (555) 123-4567
Ayudo a negocios locales a generar 3-4 clientes nuevos/mes sin aumentar presupuesto en ads

---

## ESTRUCTURA DE SECUENCIA: 3 EMAILS

### EMAIL #1: El Hook (Día 0)
Objetivo: Generar curiosidad, no respuesta de compra.
- Asunto: Línea curiosidad (fórmula 1, 2 o 3)
- Apertura: Observación específica (Pilar 2)
- Desarrollo: Problema + insinuación de diferencial (Pilares 3 + 4)
- CTA: Pregunta de bajo rozamiento (Pilar 5)
- Longitud: 50-80 palabras (5-7 líneas)
- Tono: Colega, curioso, sin venta

### EMAIL #2: El Contexto (Día 3-4)
Objetivo: Profundizar en el problema, demostrar credibilidad sin nombrar solución.
- Asunto: Referencia al anterior + dato nuevo
- Apertura: Contexto del porqué no respondieron (sin sonar desesperado)
- Desarrollo: Caso de estudio breve o patrón observado
- Inserción de diferencial: Específica pero aún sin reveal completo
- CTA: Más directo — "¿vale la pena conversar?"
- Longitud: 80-120 palabras
- Tono: Experto, pero accesible. "He visto esto cien veces"
- Patrón a usar: BAB (Before-After-Bridge) o PAS (Problem-Agitation-Solution)

### EMAIL #3: La Urgencia (Día 7-10)
Objetivo: Crear urgencia, ofrecer valor específico, última oportunidad.
- Asunto: Urgencia sutil + valor específico
- Apertura: "Última cosa antes de dejarte en paz"
- Desarrollo: Ofrecimiento de valor específico (auditoría, llamada de 10 min, recurso, etc.)
- Diferencial revelado parcialmente: "Hemos visto que los que se mueven en esto ganan X"
- CTA: Último intento — directo, sin presión, con deadline implícito
- Longitud: 100-140 palabras
- Tono: Profesional, directo, sin desesperación
- Patrón: Reader's Digest o "último consejo antes de irme"

---

## FRAMEWORK PSICOLÓGICO: 6 PRINCIPIOS (Mínimo 2 por email)

1. CURIOSIDAD: Plantea pregunta sin resolver o observación incompleta (Email #1)
2. URGENCIA: Deadline implícito, oportunidad temporal, costo de no actuar (Email #3)
3. PRUEBA SOCIAL: "Los que ya lo hacen ven X", "En tu industria es estándar" (Email #2)
4. AUTORIDAD: Experiencia específica sin alardear (Email #2)
5. RECIPROCIDAD: Ofrece valor SIN pedir a cambio — al inicio (Email #3)
6. SIMPATÍA/AFINIDAD: Lenguaje compartido, referencias a industria, demuestras que entiendes contexto (Todos)

---

## ADAPTACIÓN CULTURAL & REGIONAL

POR IDIOMA:
- ESPAÑOL (Latam): Tono cercano, menos formal. "Vos" en Argentina. CTAs directas: "¿Hablamos?"
- ESPAÑOL (España): Más profesional que Latam. Balance formal-casual.
- INGLÉS (USA): Directo, sin rodeos. Valor al frente. "Quick call this week?"
- INGLÉS (UK): Más formal. Menos urgencia explícita. CTAs sutiles.

POR TICKET:
- Bajo (<$500): Urgencia alta. CTAs rápidas. Copy corto. Ejemplos locales.
- Medio ($500-$5K): Balance urgencia-sofisticación. CTAs 15 min. Datos + case studies.
- Alto (>$5K): Sofisticación máxima. CTAs "conversación". Copy extenso. Diferencial = método.

---

## CHECKLIST PRE-ENVÍO

- [ ] ¿El diferencial está claro pero insinuado, no explícito?
- [ ] ¿Cada asunto es <10 palabras en minúsculas?
- [ ] ¿Cada email está alineado a su objetivo (Email 1: Hook, Email 2: Contexto, Email 3: Urgencia)?
- [ ] ¿Hay mínimo 2 principios psicológicos por email?
- [ ] ¿El CTA es una pregunta, no una propuesta de venta?
- [ ] ¿Se siente humano, no plantilla?
- [ ] ¿Se respeta el idioma y región del prospecto?
- [ ] ¿Los emails pueden leerse en mobile sin scroll excesivo?
- [ ] ¿Hay personalización específica (no solo {{first_name}})?
- [ ] ¿El diferencial está presente pero no oversold?

---

## MODO DE INTERACCIÓN (para este sistema)

El discovery de las 6 preguntas YA está resuelto: el usuario te pasa en cada prompt los 6 datos (diferencial, nicho, problema, resultado, región, ticket) dentro del bloque "DATOS DEL SERVICIO". NO repitas las preguntas, USA esos datos.

REGLA DE VERACIDAD: No inventes hechos sobre el lead que no estén en los datos. Las cifras del sector (ej "30-40% pierden leads") sí se permiten porque son observaciones de industria, no del negocio específico.

Devolvé SIEMPRE SOLO JSON válido, sin texto fuera del JSON.`;

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

  const adsInfo = lead.has_ads ? `- Inversión en marketing: ${lead.has_ads}` : '';
  const seoInfo = lead.seo_audit ? `- Auditoría SEO: ${lead.seo_audit}` : '';

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
${adsInfo}
${seoInfo}
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
3) INVERSIÓN EN MARKETING: Revisá los datos crudos del lead. Indicá si hay evidencia de que invierte en publicidad (Meta Ads, Google Ads, ads activos mencionados en los datos). Devolvé un string corto tipo "Meta Ads activos", "Google Ads detectados", "Meta + Google Ads", o "Sin ads detectados". SOLO basado en datos reales que aparezcan, NO inventes.
4) AUDITORÍA SEO RÁPIDA (solo si hay website): Basándote en los datos disponibles del lead, hacé un checklist rápido de problemas probables. NO hagas auditorías técnicas complejas. Enfocate en:
   - Titles mal optimizados
   - Meta descriptions inexistentes
   - Encabezados mal estructurados
   - Keywords no trabajadas
   TRADUCÍ cada problema a impacto de negocio. Ejemplo: NO digas "H1 mal estructurado", SÍ decí "Estás perdiendo X búsquedas mensuales porque Google no entiende de qué va tu página". Devolvé un string corto (2-4 frases) con los hallazgos traducidos a negocio. Si no hay website: "Sin website — sin presencia orgánica".
5) Generá el MENSAJE 1 — Día 1 en 4 canales. Usá la info de inversión en marketing y auditoría SEO para personalizar. Si tienen ads activos → es señal de presupuesto, mencioná sutilmente. Si la auditoría detectó oportunidades → úsalas como gancho (traducidas a negocio, no técnicas).
   - NUNCA inventes campañas, CTAs, porcentajes, cifras de conversión o features del negocio.

${channelSpecs(lang)}

Devuelve JSON estricto:
{"score": number, "reason": string, "top_positive": string|null, "top_negative": string|null, "has_ads": string, "seo_audit": string, "messages": {"email": {"subject": string, "body": string}, "whatsapp": string, "instagram_dm": string, "loom_script": string}}`;

  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
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
    has_ads: parsed.has_ads || 'Sin datos',
    seo_audit: parsed.seo_audit || 'Sin datos',
    messages: parsed.messages || {}
  };
}

export async function scoreAllPending(limit = 50) {
  const minScore = Number(getSetting('min_score')) || 4;
  const leads = db.prepare('SELECT * FROM leads WHERE score IS NULL LIMIT ?').all(limit);
  const upd = db.prepare(`UPDATE leads SET score = ?, score_reason = ?, suggested_message = ?, status = ?, top_positive = ?, top_negative = ?, has_ads = ?, seo_audit = ? WHERE id = ?`);
  const campStmt = db.prepare('SELECT * FROM campaigns WHERE id = ?');
  let done = 0, failed = 0;
  for (const lead of leads) {
    try {
      const campaign = lead.campaign_id ? campStmt.get(lead.campaign_id) : {};
      const r = await scoreLead(lead, campaign);
      const status = r.score < minScore ? 'descartado' : lead.status;
      upd.run(r.score, r.reason, JSON.stringify(r.messages), status, r.top_positive, r.top_negative, r.has_ads, r.seo_audit, lead.id);
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
