import Anthropic from '@anthropic-ai/sdk';
import { db, getSetting } from '../db/index.js';
import { getReviewsForLead } from './enrichment.js';
import { calcularSegmento } from './segmentation.js';
import { validateMessages } from './gatekeeper.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Ángulo + tono sugeridos por segmento (Playbook §3.3/§3.4). Guía la generación.
const SEGMENT_BRIEF = {
  premium_establecido: 'Ángulo: demanda no captada / ventaja desaprovechada. Tono: consultivo o profesional. Reconocé su volumen y reputación como un hecho verificable, no lo cuestiones.',
  premium_visible:     'Ángulo: capturar más demanda que ya llega. Tono: consultivo o directo. Su presencia es sólida; el gap es de conversión, no de reputación.',
  mediano_solido:      'Ángulo: oportunidad oculta / mejora de conversión concreta. Tono: consultivo o relajado.',
  mediano_general:     'Ángulo: oportunidad de crecimiento con datos verificables. Tono: relajado o directo, cercano.',
  pequeno_local:       'Ángulo: calidad humana, ayuda concreta y accesible. Tono: relajado o suave, sin grandilocuencia.',
  sin_datos:           'Datos públicos insuficientes. Tono: suave. No inventes señales; apoyate solo en lo que exista.',
};

// Principios inviolables (Playbook §2). Son la corrección de raíz del 0/21:
// el mensaje debe pasar el gatekeeper o se regenera.
const HARD_PRINCIPLES = `PRINCIPIOS DUROS (obligatorios — un mensaje que los viole se rechaza, EN CUALQUIER IDIOMA):
1. Observación > pregunta. Afirmá lo que ves ("vi que…"), no interrogues ("¿cuántos…?"). PROHIBIDO: ¿cuántos/cuánto/cuánta…?, ¿cuánto tiempo tardas? / EN inglés igual de prohibido: "how many messages do you get", "how long does it take", "how much".
2. Solo datos verificables públicamente (rating, reviews, web, redes, SERP reales). PROHIBIDO suponer sobre su operación interna: "apuesto a que…", "probablemente…", "seguramente no respondés…" / EN: "you're probably losing…", "most spas lose bookings", "I bet you…". PROHIBIDO inventar cifras del negocio.
3. Valor antes de pedir: reconocimiento → insight verificable → propuesta concreta → CTA chico.
4. Máximo 1 pregunta, siempre sobre el interés del prospecto ("¿vale la pena una llamada de 15 min?").
5. Tono consistente (elegí UNO del brief del segmento). Sin críticas acumuladas al negocio.
6. Cada mensaje debe poder firmarse con el nombre de un humano real.`;

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
✅ "Vi que tu página no tiene formulario de contacto visible — con el volumen de reseñas que tenés, cerrar ese hueco convierte más de las visitas que ya llegan" (observación verificable, SIN suponer cifras: nunca "apuesto a que pierdes X")

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
✅ "¿Vale la pena una llamada de 15 min esta semana para ver si aplica a tu caso?"
✅ "¿Tiene sentido explorar esto en una conversación corta?"
CTA prohibido (investigativo): NUNCA preguntes "¿cuántos…?", "¿cuánto tiempo tardas?", ni pidas datos internos del negocio.

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

REGLA DE VERACIDAD: No inventes hechos sobre el lead que no estén en los datos. Evitá cifras del sector inventadas ("30-40% pierden leads"): preferí SIEMPRE una observación verificable del propio lead (sus reseñas, su web, su SERP real). Si necesitás un dato de industria, que sea genérico y no cuantificado.

${HARD_PRINCIPLES}

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

function parseRawData(lead) {
  try { return typeof lead.raw_data === 'string' ? JSON.parse(lead.raw_data) : (lead.raw_data || {}); }
  catch { return {}; }
}

function buildSerpSection(rawObj) {
  const serp = rawObj.serp;
  if (!serp) return '- SERP: No se corrió búsqueda Google (sin datos)';
  if (!serp.domain_found) return `- SERP: Buscamos "${serp.query_used}" — el dominio del lead NO aparece en los primeros ${serp.total_results} resultados. Competidores que SÍ aparecen:\n${serp.top_competitors.map(c => `  * Pos ${c.position}: ${c.title} (${c.url})`).join('\n')}`;
  return `- SERP: Buscamos "${serp.query_used}" — el dominio SÍ aparece:\n${serp.domain_positions.map(p => `  * Pos ${p.position}: ${p.title}`).join('\n')}\n  Competidores cercanos:\n${serp.top_competitors.map(c => `  * Pos ${c.position}: ${c.title} (${c.url})`).join('\n')}`;
}

function buildAdsSection(rawObj) {
  const ads = rawObj.meta_ads;
  if (!ads) return '- Meta Ads: No se corrió búsqueda de ads (sin datos)';
  if (ads.total_ads_found === 0) return '- Meta Ads: Se buscó en Facebook Ads Library — NO se encontraron ads activos para este negocio';
  const platforms = ads.platforms_detected.length ? ads.platforms_detected.join(', ') : 'no especificadas';
  let section = `- Meta Ads: ${ads.total_ads_found} ads encontrados (${ads.ads_active} activos). Plataformas: ${platforms}`;
  if (ads.ads_sample?.length) {
    section += '\n  Muestra de ads:';
    for (const ad of ads.ads_sample) {
      section += `\n  * "${ad.body.slice(0, 100)}${ad.body.length > 100 ? '...' : ''}" | CTA: ${ad.cta || 'N/A'} | Link: ${ad.link || 'N/A'}`;
    }
  }
  return section;
}

function leadSummary(lead, campaign) {
  const reviews = getReviewsForLead(lead);
  const rawObj = parseRawData(lead);
  const reviewsSummary = reviews.length ? `\nREVIEWS REALES (${reviews.length}):\n${reviews.slice(0, 20).map(r => `- [${r.rating || '?'}★] ${r.text.slice(0, 200)}`).join('\n')}` : '\nREVIEWS: No hay reviews en los datos.';
  const ratingInfo = lead.rating ? `- Rating Google: ${lead.rating}★ (${lead.review_count || 0} reviews)${lead.rating <= 4.3 ? ' [RATING BAJO]' : ''}` : '- Rating: Sin datos';
  const topPos = lead.top_positive ? `- Patrón positivo recurrente (previo): ${lead.top_positive}` : '';
  const topNeg = lead.top_negative ? `- Queja recurrente (previa): ${lead.top_negative}` : '';

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
${topNeg}

DATOS DE ENRICHMENT (obtenidos por scraping real — FIABLES):
${buildSerpSection(rawObj)}
${buildAdsSection(rawObj)}
${reviewsSummary}`;
}

function resolveLang(campaign) {
  if (campaign.language === 'es') return 'Español';
  if (campaign.language === 'en') return 'Inglés';
  return 'detectá el idioma según el nombre del negocio y su ubicación; en Miami podés elegir Español o Inglés según lo que parezca más natural al lead';
}

export async function scoreLead(lead, campaign = {}) {
  const criteria = getSetting('qualification_criteria');
  const lang = resolveLang(campaign);
  const seg = calcularSegmento(lead);

  const user = `${leadSummary(lead, campaign)}

SEGMENTO DEL LEAD: ${seg.segment} (score huella pública ${seg.score}/100).
${SEGMENT_BRIEF[seg.segment]}

CRITERIO DE LEAD IDEAL (referencia): ${criteria}

REGLA CRÍTICA DE VERACIDAD:
- Los "DATOS DE ENRICHMENT" fueron obtenidos por scraping real. USÁLOS tal cual.
- Si un dato dice "No se corrió búsqueda" o "sin datos", usá "Sin datos disponibles".
- NUNCA inventes posiciones de Google, títulos de ads, porcentajes, cifras de conversión, ni features que no estén en los datos.
- Para reviews: solo analizá las que aparecen en "REVIEWS REALES". Menos de 3 → null.

═══════════════════════════════════════════
PIPELINE DE CALIFICACIÓN — 7 PASOS
═══════════════════════════════════════════

Evaluá cada paso secuencialmente. Cada paso devuelve pass (true/false) y reason (1 frase corta).

PASO 1 — ¿ES UN NEGOCIO LOCAL REAL?
- ¿Tiene nombre de negocio, dirección/ubicación o perfil verificable?
- ¿Es un negocio que atiende clientes en una zona geográfica específica?
- Descartá: freelancers sin negocio, páginas personales, directorios, agregadores.

PASO 2 — ¿ESTÁ ACTIVO?
- ¿Tiene señales de actividad reciente? (reviews recientes, posts en redes, website actualizado, ads corriendo)
- ¿El negocio parece estar operando actualmente?
- Descartá: negocios cerrados, perfiles abandonados, sin actividad visible.

PASO 3 — ¿PARECE COMERCIALMENTE SÓLIDO?
- ¿Tiene indicadores de madurez? (años operando, volumen de reviews, múltiples ubicaciones, empleados)
- ¿Parece tener capacidad de inversión? (no es ultra-micro ni recién abierto sin tracción)
- No necesita ser grande — necesita ser estable y con ingresos.

PASO 4 — ¿DEPENDE DEL CANAL DIGITAL?
- ¿Su modelo de negocio requiere captar clientes por internet? (reservas online, e-commerce, leads digitales)
- ¿Ya tiene presencia digital? (website, Google Maps, redes sociales activas, ads)
- Señales fuertes: tiene website + redes + Google Maps. Señal débil: solo tiene un listing básico.

PASO 5 — ¿TIENE INTENCIÓN CLARA DE CAPTAR CLIENTES?
- ¿Invierte en marketing? (Meta Ads activos, Google Ads, SEO, contenido en redes)
- ¿Tiene CTAs visibles? (formularios, botones de reserva, WhatsApp Business)
- ¿Publica ofertas, promociones o contenido orientado a captar?
- Si NO invierte en nada → probablemente no está listo para comprar servicios de marketing.

PASO 6 — ¿HAY FRICCIÓN O MEJORA POSIBLE EN CONVERSIÓN?
- ¿Su website tiene problemas obvios? (sin formulario, sin CTA claro, no mobile-friendly, lento)
- ¿Tiene reviews negativas que revelan problemas operativos? (mala atención, demoras, falta de respuesta)
- ¿No aparece bien posicionado en Google pese a tener competidores que sí?
- ¿Sus ads no tienen landing pages optimizadas?
- ¿Hay gap entre su inversión en captar y su capacidad de convertir?
- Si todo está perfecto → el lead es menos prioritario (no necesita ayuda).

PASO 7 — SCORE FINAL Y PRIORIDAD
Basándote en los 6 pasos anteriores:
- Falla paso 1, 2 o 3 → score ≤ 3 (descartar)
- Pasa 1-3 pero falla 4 y 5 → score 4-5 (bajo potencial digital)
- Pasa 1-5 pero no hay mejora posible (paso 6) → score 5-6 (ya está optimizado)
- Pasa 1-5 Y hay mejoras claras (paso 6) → score 7-10 según magnitud de la oportunidad
- Score 9-10: oportunidad perfecta (invierte, necesita ayuda, tiene presupuesto)

═══════════════════════════════════════════
DATOS ADICIONALES A EXTRAER
═══════════════════════════════════════════

- top_positive / top_negative: si hay 3+ reviews reales, patrón positivo y queja más repetidos (≤12 palabras). Menos de 3 → null.
- has_ads: resumen de Meta Ads (cantidad, plataformas, CTA) o "Sin ads detectados" o "Sin datos disponibles".
- seo_audit: posición en SERP + competidores, o "No aparece en primeros X resultados", o "Sin datos disponibles".

═══════════════════════════════════════════
GENERACIÓN DE MENSAJES (solo si score ≥ 4)
═══════════════════════════════════════════

Si el score es ≥ 4, generá MENSAJE 1 — Día 1 en 4 canales. Personalizá con datos REALES:
- Si tiene ads activos → mencioná como señal de que ya invierte.
- Si no aparece en Google → usá como gancho.
- Si tiene reviews negativas → usá la queja real como pain point.
- Usá las fricciones detectadas en paso 6 como ángulo de entrada.
Si score < 4, devolvé messages como null.

${channelSpecs(lang)}

Devuelve JSON estricto:
{
  "pipeline": [
    {"step": 1, "name": "negocio_local_real", "pass": boolean, "reason": string},
    {"step": 2, "name": "activo", "pass": boolean, "reason": string},
    {"step": 3, "name": "comercialmente_solido", "pass": boolean, "reason": string},
    {"step": 4, "name": "depende_digital", "pass": boolean, "reason": string},
    {"step": 5, "name": "intencion_captar", "pass": boolean, "reason": string},
    {"step": 6, "name": "friccion_conversion", "pass": boolean, "reason": string},
    {"step": 7, "name": "score_final", "pass": true, "reason": string}
  ],
  "score": number,
  "reason": string,
  "top_positive": string|null,
  "top_negative": string|null,
  "has_ads": string,
  "seo_audit": string,
  "messages": {"email": {"subject": string, "body": string}, "whatsapp": string, "instagram_dm": string, "loom_script": string} | null
}`;

  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    system: OUTREACH_SYSTEM,
    messages: [{ role: 'user', content: user }]
  });

  const text = resp.content.find(c => c.type === 'text')?.text || '';
  const parsed = safeJSON(text);

  // Gatekeeper: ningún mensaje llega al usuario sin validarse. Un regenerate si falla.
  let messages = parsed.messages || {};
  let validation = validateMessages(messages);
  if (messages && Object.keys(messages).length && !validation.passed) {
    messages = await regenerateMessages(user, messages, validation.byChannel, lang);
    validation = validateMessages(messages);
  }

  return {
    score: Math.max(1, Math.min(10, Number(parsed.score) || 0)),
    reason: String(parsed.reason || ''),
    pipeline: parsed.pipeline || [],
    segment: seg.segment,
    top_positive: parsed.top_positive || null,
    top_negative: parsed.top_negative || null,
    has_ads: parsed.has_ads || 'Sin datos',
    seo_audit: parsed.seo_audit || 'Sin datos',
    messages,
    validation
  };
}

// Regenera SOLO los mensajes que violaron el gatekeeper, inyectando el detalle del error.
async function regenerateMessages(userContext, prevMessages, byChannel, lang) {
  const errores = Object.entries(byChannel)
    .map(([ch, errs]) => `- ${ch}: ${errs.map(e => e.description).join('; ')}`)
    .join('\n');
  const user = `${userContext}

MENSAJES GENERADOS PREVIAMENTE (violaron reglas duras):
${JSON.stringify(prevMessages, null, 2)}

REGLAS VIOLADAS POR CANAL:
${errores}

TAREA: reescribí TODOS los mensajes cumpliendo estrictamente los PRINCIPIOS DUROS. Corregí exactamente las reglas violadas sin introducir otras. Idioma: ${lang}.
Devolvé JSON estricto: {"messages": {"email": {"subject": string, "body": string}, "whatsapp": string, "instagram_dm": string, "loom_script": string}}`;

  try {
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: OUTREACH_SYSTEM,
      messages: [{ role: 'user', content: user }]
    });
    const text = resp.content.find(c => c.type === 'text')?.text || '';
    return safeJSON(text).messages || prevMessages;
  } catch (e) {
    console.error('regenerateMessages failed', e.message);
    return prevMessages; // mejor esfuerzo; validation.passed=false marca revisión manual
  }
}

export async function scoreAllPending(limit = 50) {
  const minScore = Number(getSetting('min_score')) || 4;
  const leads = db.prepare('SELECT * FROM leads WHERE score IS NULL LIMIT ?').all(limit);
  const upd = db.prepare(`UPDATE leads SET score = ?, score_reason = ?, suggested_message = ?, status = ?, top_positive = ?, top_negative = ?, has_ads = ?, seo_audit = ?, qualification_pipeline = ?, segment = ? WHERE id = ?`);
  const campStmt = db.prepare('SELECT * FROM campaigns WHERE id = ?');
  let done = 0, failed = 0;
  for (const lead of leads) {
    try {
      const campaign = lead.campaign_id ? campStmt.get(lead.campaign_id) : {};
      const r = await scoreLead(lead, campaign);
      const status = r.score < minScore ? 'descartado' : lead.status;
      upd.run(r.score, r.reason, JSON.stringify(r.messages || {}), status, r.top_positive, r.top_negative, r.has_ads, r.seo_audit, JSON.stringify(r.pipeline), r.segment || null, lead.id);
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
