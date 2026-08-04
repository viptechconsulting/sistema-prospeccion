33 / 33
Lynkro · Copiloto Comercial
Sistema de Generación de Mensajes de Cold Outreach
Playbook + Spec Técnica + Quick Start + Reference Card
Consolidado v2.0
4 de agosto 2026
21 leads — 0 respuestas — 0% tasaCausa raíz identificadaSistema completo listo
Proyecciones internas validadas contra benchmarks Belkins 2025–2026 e Instantly 2026.
No son SLA hasta tener A/B test real en producción. Documento vivo — actualizable según métricas reales.
Índice General
Diagnóstico del Problema Actual
1.1 Contexto
1.2 Métricas observadas
1.3 Cinco causas raíz
1.4 Impacto en el negocio
Seis Principios Fundamentales del Sistema
Arquitectura del Sistema de Generación
3.1 Pipeline lógico
3.2 Inputs mínimos por lead
3.3 Catálogo cerrado de ángulos (6)
3.4 Catálogo cerrado de tonos (6)
Arquitectura Técnica del Sistema
4.1 Stack tecnológico canónico
4.2 Principios arquitectónicos no negociables
4.3 Diagrama: capas del sistema
4.4 Diagrama: pipeline de 6 pasos
Módulo de Segmentación — Código Completo
5.1 Subscores y pesos
5.2 Clasificación segmento ↔ umbral
5.3 segmentation.js
5.4 Tests unitarios sugeridos
Gatekeeper — 7 Reglas Duras — Código Completo
6.1 Las 7 reglas en tabla
6.2 gatekeeper.js + Python equivalente
6.3 Test cases del gatekeeper
Template Engine — Estructura y Placeholders
7.1 Estructura interna de cada template
7.2 Placeholders canónicos
7.3 templates.js (premium_establecido + premium_visible)
Prompts para LLM — Verbatim
8.1 SYSTEM prompt
8.2 USER prompt template
8.3 Post-procesado
8.4 Multi-canal
Pipeline — Orquestación Completa
9.1 Diagrama del pipeline
9.2 pipeline.js
9.3 Diagrama flow end-to-end
Modelos de Datos — SQL Completo
10.1 Migración SQL
10.2 Schema Prisma equivalente
API Endpoints — Express Completo
11.1 Cuatro endpoints
11.2 routes/messages.js
11.3 useGenerarMensaje.ts (React)
Telemetría y A/B Testing — Métricas de Éxito
12.1 Diagrama telemetría
12.2 Cuatro KPIs principales
12.3 Convenciones de medición
12.4 Benchmarks externos verificados
Seis Plantillas por Segmento — Completas
13.A Premium Establecido
13.B Premium Visible
13.C Visibilidad Baja
13.D Mediano Sólido
13.E Mediano General
13.F Pequeño Local
Reescritura Completa de los 21 Mensajes (Caso Real)
Guía por Canal (WhatsApp · Email · Instagram · Loom)
15.1 WhatsApp
15.2 Email
15.3 Instagram DM
15.4 Loom Script
Testing Rápido (A/B Testing)
16.1 Diseño del A/B
16.2 Variables a controlar
16.3 Variables a testear
16.4 Tabla de seguimiento
16.5 Métricas a calcular
16.6 Expectativas semanales
16.7 Reglas del A/B test
Checklist Pre-Envío y Anti-Patrones
17.1 Checklist automática
17.2 Checklist humana
17.3 Checklist de canal
17.4 Top 10 anti-patrones
Reference Card Completa (Texto Plano)
Apéndice A — Estructura de Archivos
Apéndice B — Costos LLM Verificados
Apéndice C — Anti-Patrones de Implementación
Apéndice D — Roadmap de Implementación
Apéndice E — Glosario de Términos
Apéndice F — FAQs
Apéndice G — Changelog
Apéndice H — Referencias Externas
Notas de Uso y Contacto
Sección 1 · Diagnóstico del Problema Actual
1.1 Contexto
Lynkro es el copiloto comercial para generación de leads vía cold outreach. La campaña activa al momento de este diagnóstico apunta a medical spas en Miami (zonas: Miami, Coral Gables, Brickell, Aventura, Doral, Hallandale Beach, Hollywood, Sunny Isle Beach) capturados desde Google Maps.

Servicio que se ofrece: Chatbots inteligentes para WhatsApp e Instagram.

1.2 Métricas observadas (snapshot 2026-08-03)
Métrica    Valor actual    Estado
Leads descubiertos    21    —
Leads contactados    21    100% del pipeline inicial
Respuestas recibidas    0    🔴 Crítico
Tasa de respuesta    0,0%    🔴 Crítico
Deals cerrados (ganados)    0    🔴 Crítico
Deals cerrados (perdidos)    1 (Premier Med Spa)    🟡 Único dato
Deals en demo    0    🔴 Crítico
Conclusión operativa
21 mensajes enviados = 0 respuestas. El problema NO es de volumen ni de targeting. Es de diseño del mensaje.

1.3 Cinco causas raíz identificadas
Inspeccionando los 21 leads del pipeline, se identifican cinco patrones que destruyen la respuesta:

Causa #1 — Preguntas investigativas
Ejemplos textuales literales del pipeline:

"¿cuántos mensajes de WhatsApp recibes al mes?" (Aromas MedSpa)
"Rápida pregunta: ¿cuántos mensajes de WhatsApp recibes al mes?"
"¿cuánto tiempo tardas en responder consultas?"
"Una pregunta: cuando los leads escriben por WhatsApp…"
"¿Cuántas personas preguntan sobre Morpheus8?" (Vital MedSpa)
Por qué destruye la respuesta: un desconocido pidiéndote datos internos activa el modo defensivo del receptor. Interpretación intuitiva del prospecto: "¿Quién es este y por qué quiere mis números?"

Causa #2 — Suposiciones genéricas sobre problemas no verificables
"Pierden leads en horarios nocturnos"
"WhatsApp probablemente lo atienden solo horario comercial"
"Pierden consultas en horarios pico"
"tardás horas responder"
Riesgo: si el prospecto ya resolvió ese problema (compite con ChatGPT, tiene recepcionista, usa otra herramienta), el mensaje queda inválido y se lee como spam genérico.

Causa #3 — Falta de propuesta clara de valor
Casi todos los mensajes terminan en una pregunta, no en una propuesta. No hay "te ofrezco X a cambio de Y". No hay razón suficiente para responder.

Causa #4 — Tonos inconsistentes
Mezcla casual ("Hola 👋", "Vi que reciben muchas consultas") con tono profesional en el mismo batch. Esa inconsistencia es firma de automatización genérica y dispara el radar de spam.

Causa #5 — Cero personalización por segmento
El mismo esqueleto se aplica a Dolce (1226 reviews, premium) que a "7 Med Spa" (24 reviews, sin web). Ambos reciben "vi que tienes reviews + pregunta sobre horarios".

1.4 Impacto en el negocio
100% del trabajo comercial gastado sin retorno.
El activo de mayor valor (la reputación "social proof" de Google Maps del prospecto) se está usando EN CONTRA.
La base de datos se contamina: si más adelante se reactivan, ya tienen marca de "spam tried".
Sección 2 · Seis Principios Fundamentales del Sistema
Estos 6 principios son inviolables. Cualquier mensaje que los rompa debe ser rechazado por el gatekeeper (ver Sección 6).

Principio 1 — Observación > Pregunta
Sustituir "¿cuánto X tienes?" por "vi que X es alto/bajo/estable". La observación no requiere respuesta; la pregunta sí. Y solo el receptor decide responder.

Principio 2 — Solo datos verificables públicamente
Fuentes permitidas:

Google Maps (rating, número de reviews, horarios, fotos)
Website del negocio (servicios, promos, blog)
Redes públicas (Instagram, LinkedIn, Meta Ads Library)
Agregadores (Fresha, Booksy, Mindbody)
Fuentes prohibidas: inferencias sobre operaciones internas, "apuesto a que…", "probablemente…", cualquier dato que un humano promedio prudente no firmaría como cierto.

Principio 3 — Valor antes de pedir
Estructura obligatoria por párrafo:

Reconocimiento (1 frase)
Insight (1–2 frases, basado en datos públicos)
Propuesta de valor concreta (1 frase)
CTA pequeño (1 frase)
Nunca: pedir primero y luego quizá entregar valor.

Principio 4 — Máximo 1 pregunta, y siempre sobre el interés del prospecto
Única pregunta permitida (cuando hay): "¿Vale la pena una llamada breve para ver si aplica?", "¿Te interesaría explorar esto?", "¿Es buen momento?".

Prohibidas: ¿Cuántos…?, ¿Cuánto…?, ¿Cuándo…?, ¿Quién…?

Principio 5 — Tono consistente: profesional-consultivo, humano
Profesional: respetuoso del tiempo del receptor, sin emojis casuales, sin signos de exclamación forzados.
Consultivo: propone diagnóstico antes de soluciones.
Humano: usa español/inglés natural del prospecto detectado por idioma de sus reseñas/descripción.
Principio 6 — El mensaje debe poder ser enviado palabra-por-palabra
Si Lynkro no se sentiría cómodo firmando cada mensaje con el nombre de un humano real, el mensaje está mal diseñado.

Sección 3 · Arquitectura del Sistema de Generación
3.1 Pipeline lógico

        Input del Lead (datos crudos) ↓ Normalización de datos (web, Google Maps, redes) ↓ Segmentación automática
        (premium / pequeño / baja-visibilidad) ↓ Selección de ángulo (catálogo cerrado: 6 ángulos) ↓ Selección de tono
        (catálogo cerrado: 6 tonos) ↓ Generación de borrador (LLM con prompt blindado) ↓ Gatekeeper (7 reglas duras) ↓
        [SI aprueba] → Entrega al usuario [SI rechaza] → Regenera con diff específico
      
3.2 Inputs mínimos por lead
Antes de generar, el sistema DEBE tener:

Campo    Fuente    Obligatorio
Nombre del negocio    Google Maps    Sí
Nombre del contacto    Inferido o sitio web    Sí (placeholder si falta)
Ciudad/zona    Google Maps    Sí
Rating    Google Maps    Sí
Número de reviews    Google Maps    Sí
Tiene website    Google Maps    Sí
Categoría secundaria (services)    Google Maps + web    Sí
Idioma detectado    Reviews/perfil    Sí
Tiene agregador (Fresha/Booksy)    Web + búsqueda    Nice-to-have
Inversión en Ads    Meta Ads Library    Nice-to-have
Visibilidad SERP    Búsqueda local    Nice-to-have
Si un campo obligatorio falta, NO generar mensaje. Pedir al usuario que lo complete o proveer heurística segura.

3.3 Catálogo cerrado de ángulos (máximo 6)
#    Ángulo    Cuándo aplicarlo    Cuándo NO aplicarlo
1    Demanda no captada    Muchos reviews + rating alto + web con promos    Negocio pequeño con poco volumen
2    Ventaja desaprovechada    Negocio con elementos Premium visibles (varias sedes, equipo, equipo médico nombrado)    Negocio pequeño local sin signos de escala
3    Oportunidad oculta    Baja visibilidad SERP pese a tener web y reviews sólidas    Sin web o perfil nuevo (< 50 reviews)
4    Comparación con competidores    Nicho saturado con competidores visibles de mejor desempeño    Nicho único o testimonial base inexistente
5    Conversaciones mal convertidas    Presencia activa en redes con respuesta demorada    Cuenta inactiva o solo presencia informativa
6    Leads existentes mal aprovechados    Tiene agregador público (Fresha/Booksy) con volumen    Sin agregador
3.4 Catálogo cerrado de tonos (máximo 6)
Tono    Cuándo usarlo    Firmas prohibidas
Consultivo    Default, medical spas premium    Emojis, exclamaciones, "súper", "mega"
Directo    Prospección rápida con CTA firme    Muletillas ("apuesto", "probablemente")
Curioso    Solo si el lead tiene elemento públicamente interesante (caso de éxito, founder visible)    Cualquier afirmación inventada
Relajado    Medical spas pequeños, estética local "calidad humana"    Información falsa o grandilocuente
Profesional    Cuentas corporativas, spas con marketing maduro    Tono coloquial incorrecto
Suave    Prospectos recién publicados, vulnerables a presión    Lenguaje pasivo-agresivo o condescendiente
Sección 4 · Arquitectura Técnica del Sistema
4.1 Stack tecnológico canónico
Capa    Tecnología    Versión    Justificación
Backend runtime    Node.js    20 LTS    Estabilidad + soporte async/await moderno
Framework HTTP    Express    4.x    Familiar al equipo; middleware rico
Base de datos    PostgreSQL    15    JSONB nativo + vistas materializadas
ORM    Prisma o Drizzle    última    Compatibilidad Node 20
LLM principal    OpenAI gpt-4o-mini    latest    Costo-efectividad ($0.15/M input)
LLM premium (opt)    OpenAI gpt-4o    latest    Validación compleja / casos premium
Queue asíncrona    Bull + Redis    latest    Reintentos y throttling de jobs
Frontend    React    18    Ya en uso en la plataforma actual
Tests    Jest    29+    Ecosistema estándar Node
4.2 Principios arquitectónicos no negociables
Ningún mensaje llega al usuario sin pasar por el Gatekeeper. Toda generación debe terminar en validarMensaje(message) === { passed: true }.
Idempotencia por leadId + tone + channel. Re-generar el mismo mensaje no debe crear duplicados en message_validations más allá de los retries intencionales.
Trazabilidad completa. Cada generación (exitosa o fallida) queda registrada con segment, tone, angle, retries, model_used, prompt_tokens, completion_tokens.
Abierto a extensión. Las 7 reglas del Gatekeeper son un catálogo inmutable en runtime; agregar/quitar reglas requiere cambiar validation_rules_version en campaigns.
4.3 Diagrama Mermaid — Arquitectura de componentes

        flowchart TB subgraph UI["Capa UI - React 18"] H1[useGenerarMensaje] H2[useValidarMensaje] H3[BadgeAutoValidado]
        end subgraph API["Capa API - Express"] E1[/POST /messages/generate/] E2[/POST /messages/validate/] E3[/POST
        /messages/segment/] E4[/GET /messages/ab-metrics/] end subgraph ORQ["Capa Orquestación"] P1[pipeline.js
generarMensaje]
        end subgraph SVC["Capa Servicios"] S1[segmentation.js] S2[templates.js] S3[prompts.js] S4[gatekeeper.js]
        S5[openaiClient.js] end subgraph DATA["Capa Datos"] D1[(PostgreSQL)] D2[(Redis/Queue)] D3[(v_ab_metrics)] end H1
        --> E1 H2 --> E2 H1 --> E3 H1 --> E4 E1 --> P1 P1 --> S1 P1 --> S2 P1 --> S3 P1 --> S5 P1 --> S4 S5 -.async
        job.-> D2 S1 --> D1 S4 --> D1 E4 --> D3 P1 --> D1 H3 -.lee audit.-> D1
      
4.4 Diagrama Mermaid — Pipeline de 6 pasos (sequenceDiagram)

        sequenceDiagram autonumber participant UI as React Hook participant API as Express Route participant PIPE as
        pipeline.js participant SEG as segmentation.js participant TPL as templates.js participant LLM as openaiClient +
        gpt-4o-mini participant GK as gatekeeper.js participant DB as PostgreSQL UI->>API: POST /messages/generate
        {leadId, tone, angle, channel} API->>PIPE: generarMensaje(lead, tone, angle, channel, campaign) PIPE->>SEG:
        calcularSegmento(lead) SEG-->>PIPE: {segment, score, breakdown} PIPE->>TPL: obtenerTemplate(segment, tone,
        channel) TPL-->>PIPE: template base PIPE->>PIPE: buildPrompts(...) PIPE->>LLM: callOpenAI(system, user,
        maxTokens=350, T=0.7) LLM-->>PIPE: rawMessage PIPE->>GK: validarMensaje(rawMessage) GK-->>PIPE: {passed, errors}
        alt passed=true PIPE->>DB: saveAuditLog(SUCCESS, ...) PIPE-->>API: {status: OK, message, validado: true}
        API-->>UI: mensaje validado + badge ✓ else passed=false y retries<3 PIPE->>PIPE: reintenta con errorContext
        inyectado else passed=false y retries=3 PIPE->>DB: saveAuditLog(GATEKEEPER_FAILED) PIPE-->>API: {status: ERROR,
        errors} API-->>UI: 422 con detalle de reglas violadas end
      
Sección 5 · Módulo de Segmentación — Código Completo
5.1 Subscores y pesos
El módulo pondera cuatro dimensiones públicas del negocio (no requiere datos sensibles ni acceso a cuentas privadas):

Subscore    Rango    Cálculo    Peso
reviewScore    0–100    Buckets sobre reviewCount (>1000=100, 500–1000=80, 200–500=60, 50–200=40, 1–50=20, 0=0)    25%
ratingScore    0–100    (rating / 5.0) * 100 (rating es 0 cuando null/0)    20%
webScore    0–100    tieneWeb ? 100 : 0    30%
visibilityScore    0–100    SERP pos ≤15 → 100; pos 16–30 → 50; pos >30 o null → 0    25%
Fórmula del score total (ponderada, resultado 0–100):

totalScore = reviewScore * 0.25
           + ratingScore * 0.20
           + webScore    * 0.30
           + visibilityScore * 0.25
5.2 Clasificación segmento ↔ umbral
Segmento    Condiciones de entrada
premium_establecido    totalScore ≥ 80 AND reviewCount ≥ 500 AND tieneWeb
premium_visible    totalScore ≥ 70 AND reviewCount ≥ 200
mediano_solido    totalScore ≥ 55 AND tieneWeb
mediano_general    totalScore ≥ 40
pequeno_local    totalScore ≥ 20
sin_datos    totalScore < 20
Nota de diseño
Los umbrales están calibrados para casos B2C locales en sectores como medical spas, dentistas, abogados. Sectores distintos podrían requerir recalibración (ver Sección 10, Fase 4).

5.3 Archivo message_generation/segmentation.js
// message_generation/segmentation.js

/**
 * Calcula el segmento de un lead basado en sus datos públicos.
 * @param {Object} lead - Datos del lead
 * @returns {{ segment: string, score: number, breakdown: Object }}
 */
function calcularSegmento(lead) {
  const {
    reviewCount = 0,
    rating = 0,
    tieneWeb = false,
    visibilidadSERP = null, // posición numérica o null
  } = lead;

  // --- Subscores ---
  let reviewScore = 0;
  if (reviewCount > 1000) reviewScore = 100;
  else if (reviewCount > 500) reviewScore = 80;
  else if (reviewCount > 200) reviewScore = 60;
  else if (reviewCount > 50) reviewScore = 40;
  else if (reviewCount > 0) reviewScore = 20;

  const ratingScore = rating > 0 ? (rating / 5.0) * 100 : 0;

  const webScore = tieneWeb ? 100 : 0;

  let visibilityScore = 0;
  if (visibilidadSERP !== null) {
    if (visibilidadSERP <= 15) visibilityScore = 100;
    else if (visibilidadSERP <= 30) visibilityScore = 50;
    else visibilityScore = 0;
  }

  // --- Score total ponderado ---
  const totalScore =
    reviewScore * 0.25 +
    ratingScore * 0.20 +
    webScore    * 0.30 +
    visibilityScore * 0.25;

  // --- Clasificación ---
  let segment;
  if (totalScore >= 80 && reviewCount >= 500 && tieneWeb) {
    segment = 'premium_establecido';
  } else if (totalScore >= 70 && reviewCount >= 200) {
    segment = 'premium_establecido';
  } else if (totalScore >= 70 && reviewCount >= 200) {
    segment = 'premium_visible';
  } else if (totalScore >= 55 && tieneWeb) {
    segment = 'mediano_solido';
  } else if (totalScore >= 40) {
    segment = 'mediano_general';
  } else if (totalScore >= 20) {
    segment = 'pequeno_local';
  } else {
    segment = 'sin_datos';
  }

  return {
    segment,
    score: Math.round(totalScore),
    breakdown: { reviewScore, ratingScore, webScore, visibilityScore },
  };
}

module.exports = { calcularSegmento };
5.4 Tests unitarios sugeridos
Lead con 1226 reviews / 5★ / con web / SERP pos 18 → premium_establecido
Lead con 0 reviews / 0★ / sin web / SERP null → sin_datos
Lead en frontera (totalScore = 79, reviews = 499) → no entra a premium_establecido por la condición conjunta, debe caer a premium_visible
Lead con webScore=100 pero reviewScore=0 → cae a mediano_general si total ≥ 40
Sección 6 · Gatekeeper — 7 Reglas Duras — Código Completo
6.1 Las 7 reglas en tabla
#    Regla    Condición de rechazo    Código de error    Acción
R1    Sin preguntas sobre operaciones internas    Contiene patrones del tipo ¿cuántos clientes/leads/mensajes/consultas?, ¿cuánto tiempo tardas?, ¿cuántos pierdes?    INTERNAL_OPS_QUESTION    Regenerar
R2    Sin suposiciones no verificables    Frases del tipo probablemente pierdes, seguramente no respondes, apuesto que    UNVERIFIABLE_ASSUMPTION    Regenerar
R3    Longitud máxima 200 palabras    wordCount(message) > 200    MSG_TOO_LONG    Regenerar con instrucción de acortar
R4    Debe contener propuesta de valor    Falta cualquiera de: podemos, te ayudamos, nuestra solución, lo que hacemos, automatizar, responder más rápido, sin agregar personal, en menos de    NO_VALUE_PROP    Regenerar
R5    CTA específico requerido    Falta cualquiera de: llamada, conversación, 15 min, ¿te interesa?, ¿tiene sentido?, vale la pena explorar    NO_SPECIFIC_CTA    Regenerar
R6    Máximo 2 preguntas por mensaje    Conteo de ? (incluyendo ¿) > 2    TOO_MANY_QUESTIONS    Regenerar reduciendo
R7    Sin múltiples críticas al negocio    ≥2 ocurrencias de pierdes/tardas/no respondes/fallas/descuidas    MULTIPLE_CRITICISMS    Regenerar con instrucción de suavizar
6.2 Código: gatekeeper.js (JavaScript) + equivalente Python
Versión Python (original)
# gatekeeper.py — referencia original
import re

def gatekeeper(message: dict, lead: dict) -> tuple[bool, list[str]]:
    """Devuelve (aprobado, [motivos_rechazo]). Aplica en orden."""
        rejections = []
        text = message["body"]

        # Regla 1: Sin preguntas investigativas
        investigativa_patterns = [
            r"¿cu[aá]nt[oa]s?\b",     # cuántos / cuántas
            r"¿cu[aá]nto\b",            # cuánto
            r"¿cu[aá]nta\b",            # cuánta
            r"¿cu[aá]ndo\b",            # cuándo
            r"¿qui[eé]n\b",             # quién
        ]
        for pat in investigativa_patterns:
            if re.search(pat, text, re.IGNORECASE):
                rejections.append("R1: pregunta investigativa detectada")

        # Regla 2: Sin suposiciones no verificables
        suposiciones = [r"apuesto a que", r"probablemente", r"seguro (que)?\b",
                        r"creo que pierdes", r"debe ser", r"imagino que", r"supongo que"]
        for pat in suposiciones:
            if re.search(pat, text, re.IGNORECASE):
                rejections.append(f"R2: suposición no verificable: '{pat}'")

        # Regla 3: Máximo 200 palabras
        word_count = len(text.split())
        if word_count > 200:
            rejections.append(f"R3: mensaje largo ({word_count} palabras, máx 200)")

        # Regla 4: CTA específico
        cta_vaguedades = [r"¿tienes tiempo\??", r"¿podemos hablar\??",
                          r"¿qu[eé] tal\??", r"¿alg[uú]n inter[eé]s\??"]
        for pat in cta_vaguedades:
            if re.search(pat, text, re.IGNORECASE):
                rejections.append(f"R4: CTA vago o agresivo: '{pat}'")

        # Regla 5: Tono consistente
        import re
        has_emoji = bool(re.search(r"[\\U0001F600-\\U0001F64F\\U0001F300-\\U0001F5FF"
                                   r"\\U0001F680-\\U0001F6FF\\u2600-\\u26FF\\u2700-\\u27BF]", text))
        is_professional = message.get("tone") in ("profesional", "consultivo", "directo")
        if has_emoji and is_professional:
            rejections.append("R5: emoji detectado en tono profesional")

        # Regla 6: Propuesta antes de pedir
        
if"?"in text:
            proposal_indicators = ["trabajo con", "ayudamos", "propuesta",
                                   "lo que hacemos", "lo que se puede hacer"]
            if not any(ind in text.lower() for ind in proposal_indicators):
                rejections.append("R6: pregunta sin propuesta previa")

        # Regla 7: Basado en datos del lead
        lead_signals = [lead.get("name", "").lower(),
                        str(lead.get("review_count", "")),
                        str(lead.get("rating", "")),
                        lead.get("city", "").lower()]
        lead_mentioned = sum(1for s in lead_signals
                             if s and s != "none"and s in text.lower())
        if lead_mentioned == 0:
            rejections.append("R7: mensaje no personalizado al lead")

        return (len(rejections) == 0, rejections)
Versión JavaScript (producción)
// message_generation/gatekeeper.js

const RULES = [
  {
    code: 'INTERNAL_OPS_QUESTION',
    description: 'Pregunta sobre operaciones internas',
    test: (msg) => /¿?(cuántos?\s+(clientes|leads|mensajes|consultas)|cuánto\s+tiempo\s+tard[aá]s?|cuántos?\s+pier[de]?)/i.test(msg),
  },
  {
    code: 'UNVERIFIABLE_ASSUMPTION',
    description: 'Suposición no verificable',
    test: (msg) => /(probablemente\s+pier|seguramente\s+no\s+respond|apuesto\s+que\s+pier|seguro\s+que\s+pier)/i.test(msg),
  },
  {
    code: 'MSG_TOO_LONG',
    description: 'Mensaje supera 200 palabras',
    test: (msg) => msg.trim().split(/\s+/).length > 200,
  },
  {
    code: 'NO_VALUE_PROP',
    description: 'No contiene propuesta de valor',
    test: (msg) => !/(podemos|te\s+ayudamos|nuestra\s+solución|lo\s+que\s+hacemos|automatizar|responder\s+más\s+rápido|sin\s+agregar\s+personal|en\s+menos\s+de)/i.test(msg),
  },
  {
    code: 'NO_SPECIFIC_CTA',
    description: 'Sin call-to-action específico',
    test: (msg) => !/(llamada|conversación|15\s*min|¿te\s+interesa|¿tiene\s+sentido|vale\s+la\s+pena\s+explorar)/i.test(msg),
  },
  {
    code: 'UNVERIFIABLE_ASSUMPTION',
    description: 'Suposición no verificable',
    test: (msg) => /(probablemente\s+pier|seguramente\s+no\s+respond|apuesto\s+que\s+pier|seguro\s+que\s+pier)/i.test(msg),
  },
  {
    code: 'MSG_TOO_LONG',
    description: 'Mensaje supera 200 palabras',
    test: (msg) => msg.trim().split(/\s+/).length > 200,
  },
  {
    code: 'NO_VALUE_PROP',
    description: 'No contiene propuesta de valor',
    test: (msg) => !/(podemos|te\s+ayudamos|nuestra\s+solución|lo\s+que\s+hacemos|automatizar|responder\s+más\s+rápido|sin\s+agregar\s+personal|en\s+menos\s+de)/i.test(msg),
  },
  {
    code: 'NO_SPECIFIC_CTA',
    description: 'Sin call-to-action específico',
    test: (msg) => !/(llamada|conversación|15\s*min|¿te\s+interesa|¿tiene\s+sentido|vale\s+la\s+pena\s+explorar)/i.test(msg),
  },
  {
    code: 'TOO_MANY_QUESTIONS',
    description: 'Demasiadas preguntas (>2)',
    test: (msg) => (msg.match(/\?/g) || []).length > 2,
  },
  {
    code: 'MULTIPLE_CRITICISMS',
    description: 'Múltiples críticas al negocio',
    test: (msg) => {
      const negativePhrases = msg.match(/(pierdes|tardas|no\s+respond[eé]s?|fallas|descuidas)/gi) || [];
      return negativePhrases.length >= 2;
    },
  },
];

/**
 * Valida un mensaje contra las 7 reglas del gatekeeper.
 * @param {string} mensaje
 * @returns {{ passed: boolean, errors: Array<{code: string, description: string}> }}
 */functionvalidarMensaje(mensaje) {
  const errors = RULES
    .filter((rule) => rule.test(mensaje))
    .map(({ code, description }) => ({ code, description }));
  return { passed: errors.length === 0, errors };
}

module.exports = { validarMensaje, RULES };
6.3 Test cases del gatekeeper
Caso    Mensaje    Resultado esperado
TC-01    "Hola, ¿cuántos mensajes recibes en WhatsApp?"    ❌ R1
TC-02    "Hola, apuesto que pierdes leads de noche."    ❌ R2
TC-03    [Mensaje de 220 palabras con contenido válido]    ❌ R3
TC-04    "Hola, ¿tienes tiempo?"    ❌ R4
TC-05    "Hola 👋, te escribo porque tengo una propuesta." (tono=profesional)    ❌ R5
TC-06    "¿Te interesa?" (sin propuesta anterior)    ❌ R6
TC-07    "Hola, ayudamos a optimizar tu atención al cliente."    ❌ R7 (no personalizado)
TC-08    "Hola Aromas, vi tus 674 reviews. ¿Vale una llamada?" (cumple todo)    ✅ Aprobado
Archivo de tests Jest: __tests__/gatekeeper.test.js
// __tests__/gatekeeper.test.js
const { validarMensaje } = require('../message_generation/gatekeeper');

describe('Gatekeeper — 7 reglas', () => {
  test('R1: rechaza pregunta sobre operaciones internas', () => {
    const msg = 'Hola, ¿cuántos clientes pierdes por semana en horarios nocturnos?';
    const { passed, errors } = validarMensaje(msg);
    expect(passed).toBe(false);
    expect(errors.some(e => e.code === 'INTERNAL_OPS_QUESTION')).toBe(true);
  });

  test('R2: rechaza suposición no verificable', () => {
    const msg = 'Probablemente pierdes leads en las noches y no respondes rápido.';
    const { passed, errors } = validarMensaje(msg);
    expect(passed).toBe(false);
    expect(errors.some(e => e.code === 'UNVERIFIABLE_ASSUMPTION')).toBe(true);
  });

  test('R3: rechaza mensaje de más de 200 palabras', () => {
    const msg = Array(205).fill('palabra').join(' ');
    const { passed, errors } = validarMensaje(msg);
    expect(passed).toBe(false);
    expect(passed).toBe(false);
    expect(errors.some(e => e.code === 'INTERNAL_OPS_QUESTION')).toBe(true);
  });

  test('R2: rechaza suposición no verificable', () => {
    const msg = 'Probablemente pierdes leads en las noches y no respondes rápido.';
    const { passed, errors } = validarMensaje(msg);
    expect(passed).toBe(false);
    expect(errors.some(e => e.code === 'UNVERIFIABLE_ASSUMPTION')).toBe(true);
  });

  test('R3: rechaza mensaje de más de 200 palabras', () => {
    const msg = Array(205).fill('palabra').join(' ');
    const { passed, errors } = validarMensaje(msg);
    expect(passed).toBe(false);
    expect(errors.some(e => e.code === 'MSG_TOO_LONG')).toBe(true);
  });

  test('R4: rechaza mensaje sin propuesta de valor', () => {
    const msg = 'Hola, vi tu perfil en Google Maps. Tienes 500 reseñas. ¿Te interesa hablar 15 min?';
    const { passed, errors } = validarMensaje(msg);
    expect(passed).toBe(false);
    expect(errors.some(e => e.code === 'NO_VALUE_PROP')).toBe(true);
  });

  test('R5: rechaza mensaje sin CTA específico', () => {
    const msg = 'Hola, podemos ayudarte a responder más rápido en WhatsApp con automatizaciones.';
    const { passed, errors } = validarMensaje(msg);
    expect(passed).toBe(false);
    expect(errors.some(e => e.code === 'NO_SPECIFIC_CTA')).toBe(true);
  });

  test('R6: rechaza mensaje con más de 2 preguntas', () => {
    const msg = '¿Te interesa? ¿Cuándo podemos hablar? ¿Tienes 15 min? ¿Vale la pena explorar?';
    const { passed, errors } = validarMensaje(msg);
    expect(passed).toBe(false);
    expect(errors.some(e => e.code === 'TOO_MANY_QUESTIONS')).toBe(true);
  });

  test('R7: rechaza mensaje con múltiples críticas', () => {
    const msg = 'Hola, notamos que tardas en responder y pierdes leads. Podemos ayudarte. ¿Te interesa 15 min?';
    const { passed, errors } = validarMensaje(msg);
    expect(passed).toBe(false);
    expect(errors.some(e => e.code === 'MULTIPLE_CRITICISMS')).toBe(true);
  });

  test('EDGE: mensaje válido pasa todas las reglas', () => {
    const msg = 'Hola [Nombre], revisé tu perfil en Google Maps — 674 reseñas en Miami es un logro real. ' +
                'Trabajo con Medical Spas ayudándoles a responder consultas en WhatsApp de 
forma más rápida ' +
                'sin agregar personal. Si tiene sentido para tu operación, ¿agendamos una llamada de 15 min ' +
                'esta semana?';
    const { passed } = validarMensaje(msg);
    expect(passed).toBe(true);
  });
});
Sección 7 · Template Engine — Estructura y Placeholders
7.1 Estructura interna de cada template
Cada combinación segmento × tono produce 4 variantes (uno por canal: whatsapp, email, instagram, loom). Cada variante tiene internamente cuatro secciones:

Sección    Función    Ejemplo de placeholder
opening    Observación verificable del negocio    {{datosVerificables}}, {{nombre}}
bridge    Conexión observación → beneficio    {{beneficio}}
value    Explicación concreta de lo que se ofrece    {{servicio}}
cta    Acción pequeña y específica    15 min, llamada, conversación corta
7.2 Placeholders canónicos
{{nombre}}            — Nombre del negocio o contacto
{{ciudad}}            — Ciudad principal del lead
{{industria}}         — Medical Spa | Dental | Law Firm | etc.
{{datosVerificables}} — Reviews, rating, año de fundación, web
{{servicio}}          — Servicio ofrecido por quien envía
{{beneficio}}         — Beneficio principal del servicio
{{diferencial}}       — Diferencial clave vs competencia
{{remitente}}         — Nombre de quien envía
7.3 Archivo message_generation/templates.js (premium_establecido + premium_visible)
// message_generation/templates.js

const TEMPLATES = {
  premium_establecido: {
    consultivo: {
      whatsapp: `Hola {{nombre}},

Revisé tu perfil en Google Maps — {{datosVerificables}} en {{ciudad}} habla por sí solo.

Trabajo con Medical Spas ayudándoles a atender más consultas en WhatsApp sin agregar personal al equipo. La idea es que tu equipo se enfoque en tratamientos, no en responder mensajes repetitivos.

¿Tiene sentido explorar esto en una llamada de 15 min?`,
      email: {
        subject: `{{nombre}} — una idea para tu equipo de atención`,
        body: `Hola,

Vi {{datosVerificables}} en Google Maps — es una señal de que la demanda está ahí.

Lo que hacemos: ayudamos a Medical Spas en {{ciudad}} a responder consultas de WhatsApp de forma automática e inteligente, sin que el equipo pierda control del trato personalizado.

Si vale la pena explorarlo, ¿agendamos una llamada corta (15 min) esta semana?

Saludos,
{{remitente}}`,
      },
      instagram: `Hola {{nombre}} 👋 Vi tu perfil — {{datosVerificables}} es impresionante. Trabajo con Medical Spas ayudándoles a atender más consultas en WhatsApp sin agregar personal. ¿Tiene sentido explorar en 15 min?`,
    },
    directo: {
      whatsapp: `Hola {{nombre}},

{{datosVerificables}} en Google Maps — sólido.

Trabajamos con Medical Spas en {{ciudad}} automatizando respuestas en WhatsApp. Sin agregar personal, más consultas atendidas.

¿Agendamos 15 min esta semana?`,
      email: {
        subject: `{{nombre}} — automatización WhatsApp para tu spa`,
        body: `Hola,

{{datosVerificables}} en Maps. Sin comentarios — están haciendo las cosas bien.

Lo que hacemos: automatizaciones de WhatsApp para Medical Spas. Más consultas atendidas, mismo equipo.

¿15 min esta semana?

{{remitente}}`,
      },
      instagram: `Hola {{nombre}}, {{datosVerificables}} — bien hecho. Automatizamos WhatsApp para Medical Spas. ¿15 min?`,
    },
    curioso: {
      whatsapp: `Hola {{nombre}}, revisé {{datosVerificables}}. Hay algo interesante en cómo presentás ese volumen de demanda en redes — algo que la mayoría de Medical Spas en Miami no aprovecha del todo. ¿Lo exploramos en una llamada de 15 min?`,
      email: {
        subject: `{{nombre}} — un ángulo que vale la pena mirar`,
        body: `Hola,

{{datosVerificables}} en Google Maps. No escribo para venderte nada específico — escribo porque noté un ángulo en tu presencia digital que pocos Medical Spas en {{ciudad}} están explotando.

Trabajo con spas premium ayudándoles a identificar ese tipo de ángulos y convertirlos en más consultas vía WhatsApp.

¿Tiene sentido explorar en 15 min?`,
      },
      instagram: `Hola {{nombre}}, revisé {{datosVerificables}} — algo interesante aparece si se mira de cerca. ¿15 min para explorarlo?`,
    },
    relajado: {
      whatsapp: `Hola {{nombre}}! Vi {{datosVerificables}} en Maps — bien por ahí. Te escribo porque trabajo con spas parecidos y quería comentarte algo corto. Si te interesa una llamada de 15 min esta semana, me decís.`,
      email: {
        subject: `Una idea rápida para {{nombre}}`,
        body: `Hola {{nombre}},

Vi tu perfil en Google Maps — {{datosVerificables}} se nota que está bien atendido.

Te paso una idea corta: ayudamos a spas como el tuyo a responder consultas en WhatsApp de forma más rápida, sin sumar personal. Si alguna vez te interesa mirar cómo sería, hablamos en 15 min cuando quieras.

Un saludo,
{{remitente}}`,
      },
      instagram: `Hey {{nombre}}, vi tu spa en Maps. Te paso una idea corta sobre WhatsApp — ¿hablamos 15 min?`,
    },
    profesional: {
      whatsapp: `Estimado {{nombre}},

Revisé su perfil en Google Maps — {{datosVerificables}} confirma una posición sólida en el segmento.

Trabajo con Medical Spas en {{ciudad}} ofreciendo servicios de automatización de atención vía WhatsApp. Quedo a su disposición para una breve reunión de 15 minutos en caso de que desee evaluar la posibilidad.

Cordialmente,
{{remitente}}`,
      email: {
        subject: `{{nombre}} — propuesta de automatización de atención`,
        body: `Estimado equipo de {{nombre}},

{{datosVerificables}} en Google Maps refleja una reputación sólida. Nuestra propuesta se enfoca en automatizar la atención inicial de consultas por WhatsApp para Medical Spas con alto volumen, sin afectar el trato personalizado.

De tener interés, puedo agendar una llamada de 15 minutos para revisar el alcance.

Cordialmente,
{{remitente}}`,
      },
      instagram: `Hola {{nombre}}, soy {{remitente}}. Trabajo con Medical Spas en automatizar atención WhatsApp. ¿Conversamos?`,
    },
    suave: {
      whatsapp: `Hola {{nombre}}, vi tu perfil en Maps y me pareció interesante compartirte algo. Trabajo con spas parecidos en {{ciudad}} ayudándoles con respuestas automáticas en WhatsApp — sin presión, solo si te resuena, hablamos en 15 min.`,
      email: {
        subject: `Hola {{nombre}} — una idea para tu spa`,
        body: `Hola {{nombre}},

Vi {{datosVerificables}} y me pareció que valía la pena escribirte. Ayudo a spas como el tuyo con respuestas automáticas para WhatsApp, sin agregar personal.

No tengo ninguna urgencia — solo si en algún momento te resuena, conversamos brevemente.

Un saludo,
{{remitente}}`,
      },
      instagram: `Hola {{nombre}} 😊, sin compromiso. Vi tu spa en Maps. Si alguna vez quieres explorar respuestas automáticas para WhatsApp, hablamos.`,
    },
  },

  premium_visible: {
    consultivo: {
      whatsapp: `Hola {{nombre}},

Vi tu presencia en Google Maps — {{datosVerificables}} muestra que hay demanda real.

Trabajo con Medical Spas ayudándoles a captar más de esa demanda respondiendo en WhatsApp más rápido sin agregar al equipo.

¿Vale la pena explorar esto en 15 min?`,
      email: {
        subject: `Capturar más demanda en {{ciudad}}`,
        body: `Hola {{nombre}},

{{datosVerificables}} en Google Maps sugiere demanda que probablemente no estás capturando del todo.

Lo que hacemos: ayudar a Medical Spas en {{ciudad}} a responder más rápido las consultas que llegan por WhatsApp, sin sumar personal.

Una llamada de 15 min podría servir para entender si vale la pena explorarlo juntos.

Saludos,
{{remitente}}`,
      },
      instagram: `Hola {{nombre}}, viendo {{datosVerificables}}, creo que hay demanda sin captar todavía. ¿Hablamos 15 min?`,
    },
    directo: {
      whatsapp: `Hola {{nombre}},

{{datosVerificables}} en Google Maps y posición firme. La demanda está llegando.

Lo que ofrecemos: capturar más de esa demanda en WhatsApp sin sumar personal al spa.

¿15 min esta semana?`,
      email: {
        subject: `{{nombre}} — convertir demanda en citas`,
        body: `Hola,

{{datosVerificables}} en Maps implica tráfico real del cual una parte se pierde entre el primer contacto y la cita.

Solución: respuestas inmediatas por WhatsApp, sin personal extra. Conversión medida en 30 días.

¿Agendamos 15 min esta semana?

{{remitente}}`,
      },
      instagram: `Hola {{nombre}}, {{datosVerificables}} posicionados. ¿Sumamos una conversación de 15 min?`,
    },
    curioso: {
      whatsapp: `Hola {{nombre}}, hay un patrón interesante en cómo medspas visibles como {{datosVerificables}} terminan perdiendo consultas técnicas específicas. Te lo cuento en 15 min si te interesa.`,
      email: {
        subject: `{{nombre}} — un detalle de tu embudo`,
        body: `Hola {{nombre}},

Mirando {{datosVerificables}}, escribo porque noté algo en cómo las consultas de servicios como los suyos circulan — entre la búsqueda y la cita pasa algo que podría afinarse.

Trabajo con perfiles similares ayudándoles a revisar ese tramo del embudo. Te lo cuento en 15 min sin compromiso.

Saludos,
{{remitente}}`,
      },
      instagram: `Hola {{nombre}} 👀, vi tu perfil. Un detalle del embudo que pocos medspas afinan. ¿15 min?`,
    },
    relajado: {
      whatsapp: `Hola {{nombre}}! Vi {{datosVerificables}} en Google Maps. Trabajo con medspas de tu zona y tengo una idea corta para captar más de las consultas que hoy se pierden. ¿Charlamos 15 min si te pinta?`,
      email: {
        subject: `Una idea para {{nombre}}`,
        body: `Hola {{nombre}},

Vi {{datosVerificables}} en Maps. Te paso algo breve: ayudo a medspas como el tuyo a convertir más de las consultas que llegan por WhatsApp, sin sumar personal.

Si te interesa mirar cómo se aplicaría a tu caso, 15 min alcanzan.

Abrazo,
{{remitente}}`,
      },
      instagram: `Hola {{nombre}} 👋 Vi tu perfil — {{datosVerificables}} es impresionante. Trabajo con Medical Spas ayudándoles a atender más consultas en WhatsApp sin agregar personal. ¿Tiene sentido explorar en 15 min?`,
    },
    directo: {
      whatsapp: `Hola {{nombre}},

{{datosVerificables}} en Google Maps — sólido.

Trabajamos con Medical Spas en {{ciudad}} automatizando respuestas en WhatsApp. Sin agregar personal, más consultas atendidas.

¿Agendamos 15 min esta semana?`,
      email: {
        subject: `{{nombre}} — automatización WhatsApp para tu spa`,
        body: `Hola,

{{datosVerificables}} en Maps. Sin comentarios — están haciendo las cosas bien.

Lo que hacemos: automatizaciones de WhatsApp para Medical Spas. Más consultas atendidas, mismo equipo.

¿15 min esta semana?

{{remitente}}`,
      },
      instagram: `Hola {{nombre}}, {{datosVerificables}} — bien hecho. Automatizamos WhatsApp para Medical Spas. ¿15 min?`,
    },
    curioso: {
      whatsapp: `Hola {{nombre}}, revisé {{datosVerificables}}. Hay algo interesante en cómo presentás ese volumen de demanda en redes — algo que la mayoría de Medical Spas en Miami no aprovecha del todo. ¿Lo exploramos en una llamada de 15 min?`,
      email: {
        subject: `{{nombre}} — un ángulo que vale la pena mirar`,
        body: `Hola,

{{datosVerificables}} en Google Maps. No escribo para venderte nada específico — escribo porque noté un ángulo en tu presencia digital que pocos Medical Spas en {{ciudad}} están explotando.

Trabajo con spas premium ayudándoles a identificar ese tipo de ángulos y convertirlos en más consultas vía WhatsApp.

¿Tiene sentido explorar en 15 min?`,
      },
      instagram: `Hola {{nombre}}, revisé {{datosVerificables}} — algo interesante aparece si se mira de cerca. ¿15 min para explorarlo?`,
    },
    relajado: {
      whatsapp: `Hola {{nombre}}! Vi {{datosVerificables}} en Maps — bien por ahí. Te escribo porque trabajo con spas parecidos y quería comentarte algo corto. Si te interesa una llamada de 15 min esta semana, me decís.`,
      email: {
        subject: `{{nombre}} — una idea para tu equipo de atención`,
        body: `Hola,

Vi {{datosVerificables}} en Google Maps — es una señal de que la demanda está ahí.

Lo que hacemos: ayudamos a Medical Spas en {{ciudad}} a responder consultas de WhatsApp de forma automática e inteligente, sin que el equipo pierda control del trato personalizado.

Si vale la pena explorarlo, ¿agendamos una llamada corta (15 min) esta semana?

Saludos,
{{remitente}}`,
      },
      instagram: `Hola {{nombre}} 👋 Vi tu perfil — {{datosVerificables}} es impresionante. Trabajo con Medical Spas ayudándoles a atender más consultas en WhatsApp sin agregar personal. ¿Tiene sentido explorar en 15 min?`,
    },
    directo: {
      whatsapp: `Hola {{nombre}},

{{datosVerificables}} en Google Maps — sólido.

Trabajamos con Medical Spas en {{ciudad}} automatizando respuestas en WhatsApp. Sin agregar personal, más consultas atendidas.

¿Agendamos 15 min esta semana?`,
      email: {
        subject: `{{nombre}} — automatización WhatsApp para tu spa`,
        body: `Hola,

{{datosVerificables}} en Maps. Sin comentarios — están haciendo las cosas bien.

Lo que hacemos: automatizaciones de WhatsApp para Medical Spas. Más consultas atendidas, mismo equipo.

¿15 min esta semana?

{{remitente}}`,
      },
      instagram: `Hola {{nombre}}, {{datosVerificables}} — bien hecho. Automatizamos WhatsApp para Medical Spas. ¿15 min?`,
    },
    curioso: {
      whatsapp: `Hola {{nombre}}, revisé {{datosVerificables}}. Hay algo interesante en cómo presentás ese volumen de demanda en redes — algo que la mayoría de Medical Spas en Miami no aprovecha del todo. ¿Lo exploramos en una llamada de 15 min?`,
      email: {
        subject: `{{nombre}} — un ángulo que vale la pena mirar`,
        body: `Hola,

{{datosVerificables}} en Google Maps. No escribo para venderte nada específico — escribo porque noté un ángulo en tu presencia digital que pocos Medical Spas en {{ciudad}} están explotando.

Trabajo con spas premium ayudándoles a identificar ese tipo de ángulos y convertirlos en más consultas vía WhatsApp.

¿Tiene sentido explorar en 15 min?`,
      },
      instagram: `Hola {{nombre}}, revisé {{datosVerificables}} — algo interesante aparece si se mira de cerca. ¿15 min para explorarlo?`,
    },
    relajado: {
      whatsapp: `Hola {{nombre}}! Vi {{datosVerificables}} en Maps — bien por ahí. Te escribo porque trabajo con spas parecidos y quería comentarte algo corto. Si te interesa una llamada de 15 min esta semana, me decís.`,
      email: {
        subject: `Una idea rápida para {{nombre}}`,
        body: `Hola {{nombre}},

Vi tu perfil en Google Maps — {{datosVerificables}} se nota que está bien atendido.

Te paso una idea corta: ayudamos a spas como el tuyo a responder consultas en WhatsApp de forma más rápida, sin sumar personal. Si alguna vez te interesa mirar cómo sería, hablamos en 15 min cuando quieras.

Un saludo,
{{remitente}}`,
      },
      instagram: `Hey {{nombre}}, vi tu spa en Maps. Te paso una idea corta sobre WhatsApp — ¿hablamos 15 min?`,
    },
    profesional: {
      whatsapp: `Estimado {{nombre}},

Revisé su perfil en Google Maps — {{datosVerificables}} confirma una posición sólida en el segmento.

Trabajo con Medical Spas en {{ciudad}} ofreciendo servicios de automatización de atención vía WhatsApp. Quedo a su disposición para una breve reunión de 15 minutos en caso de que desee evaluar la posibilidad.

Cordialmente,
{{remitente}}`,
      email: {
        subject: `{{nombre}} — propuesta de automatización de atención`,
        body: `Estimado equipo de {{nombre}},

{{datosVerificables}} en Google Maps refleja una reputación sólida. Nuestra propuesta se enfoca en automatizar la atención inicial de consultas por WhatsApp para Medical Spas con alto volumen, sin afectar el trato personalizado.

De tener interés, puedo agendar una llamada de 15 minutos para revisar el alcance.

Cordialmente,
{{remitente}}`,
      },
      instagram: `Hola {{nombre}}, soy {{remitente}}. Trabajo con Medical Spas en automatizar atención WhatsApp. ¿Conversamos?`,
    },
    suave: {
      whatsapp: `Hola {{nombre}}, vi tu perfil en Maps y me pareció interesante compartirt‑
e algo. Trabajo con spas parecidos en {{ciudad}} ayudándoles con respuestas automáticas en WhatsApp — sin presión, solo si te resuena, hablamos en 15 min.`,
      email: {
        subject: `Hola {{nombre}} — una idea para tu spa`,
        body: `Hola {{nombre}},

Vi {{datosVerificables}} y me pareció que valía la pena escribirte. Ayudo a spas como el tuyo con respuestas automáticas para WhatsApp, sin agregar personal.

No tengo ninguna urgencia — solo si en algún momento te resuena, conversamos brevemente.

Un saludo,
{{remitente}}`,
      },
      instagram: `Hola {{nombre}} 😊, sin compromiso. Vi tu spa en Maps. Si alguna vez quieres explorar respuestas automáticas para WhatsApp, hablamos.`,
    },
  },

  premium_visible: {
    consultivo: {
      whatsapp: `Hola {{nombre}},

Vi tu presencia en Google Maps — {{datosVerificables}} muestra que hay demanda real.

Trabajo con Medical Spas ayudándoles a captar más de esa demanda respondiendo en WhatsApp más rápido sin agregar al equipo.

¿Vale la pena explorar esto en 15 min?`,
      email: {
        subject: `Capturar más demanda en {{ciudad}}`,
        body: `Hola {{nombre}},

{{datosVerificables}} en Google Maps sugiere demanda que probablemente no estás capturando del todo.

Lo que hacemos: ayudar a Medical Spas en {{ciudad}} a responder más rápido las consultas que llegan por WhatsApp, sin sumar personal.

Una llamada de 15 min podría servir para entender si vale la pena explorarlo juntos.

Saludos,
{{remitente}}`,
      },
      instagram: `Hola {{nombre}}, viendo {{datosVerificables}}, creo que hay demanda sin captar todavía. ¿Hablamos 15 min?`,
    },
    directo: {
      whatsapp: `Hola {{nombre}},

{{datosVerificables}} en Google Maps y posición firme. La demanda está llegando.

Lo que ofrecemos: capturar más de esa demanda en WhatsApp sin sumar personal al spa.

¿15 min esta semana?`,
      email: {
        subject: `{{nombre}} — una idea para tu equipo de atención`,
        body: `Hola,

Vi {{datosVerificables}} en Google Maps — es una señal de que la demanda está ahí.

Lo que hacemos: ayudamos a Medical Spas en {{ciudad}} a responder consultas de WhatsApp de forma automática e inteligente, sin que el equipo pierda control del trato personalizado.

Si vale la pena explorarlo, ¿agendamos una llamada corta (15 min) esta semana?

Saludos,
{{remitente}}`,
      },
      instagram: `Hola {{nombre}} 👋 Vi tu perfil — {{datosVerificables}} es impresionante. Trabajo con Medical Spas ayudándoles a atender más consultas en WhatsApp sin agregar personal. ¿Tiene sentido explorar en 15 min?`,
    },
    directo: {
      whatsapp: `Hola {{nombre}},

{{datosVerificables}} en Google Maps — sólido.

Trabajamos con Medical Spas en {{ciudad}} automatizando respuestas en WhatsApp. Sin agregar personal, más consultas atendidas.

¿Agendamos 15 min esta semana?`,
      email: {
        subject: `{{nombre}} — automatización WhatsApp para tu spa`,
        body: `Hola,

{{datosVerificables}} en Maps. Sin comentarios — están haciendo las cosas bien.

Lo que hacemos: automatizaciones de WhatsApp para Medical Spas. Más consultas atendidas, mismo equipo.

¿15 min esta semana?

{{remitente}}`,
      },
      instagram: `Hola {{nombre}}, {{datosVerificables}} — bien hecho. Automatizamos WhatsApp para Medical Spas. ¿15 min?`,
    },
    curioso: {
      whatsapp: `Hola {{nombre}}, revisé {{datosVerificables}}. Hay algo interesante en cómo presentás ese volumen de demanda en redes — algo que la mayoría de Medical Spas en Miami no aprovecha del todo. ¿Lo exploramos en una llamada de 15 min?`,
      email: {
        subject: `{{nombre}} — un ángulo que vale la pena mirar`,
        body: `Hola,

{{datosVerificables}} en Google Maps. No escribo para venderte nada específico — escribo porque noté un ángulo en tu presencia digital que pocos Medical Spas en {{ciudad}} están explotando.

Trabajo con spas premium ayudándoles a identificar ese tipo de ángulos y convertirlos en 
más consultas vía WhatsApp.

¿Tiene sentido explorar en 15 min?`,
      },
      instagram: `Hola {{nombre}}, revisé {{datosVerificables}} — algo interesante aparece si se mira de cerca. ¿15 min para explorarlo?`,
    },
    relajado: {
      whatsapp: `Hola {{nombre}}! Vi {{datosVerificables}} en Maps — bien por ahí. Te escribo porque trabajo con spas parecidos y quería comentarte algo corto. Si te interesa una llamada de 15 min esta semana, me decís.`,
      email: {
        subject: `Una idea rápida para {{nombre}}`,
        body: `Hola {{nombre}},

Vi tu perfil en Google Maps — {{datosVerificables}} se nota que está bien atendido.

Te paso una idea corta: ayudamos a spas como el tuyo a responder consultas en WhatsApp de forma más rápida, sin sumar personal. Si alguna vez te interesa mirar cómo sería, hablamos en 15 min cuando quieras.

Un saludo,
{{remitente}}`,
      },
      instagram: `Hey {{nombre}}, vi tu spa en Maps. Te paso una idea corta sobre WhatsApp — ¿hablamos 15 min?`,
    },
    profesional: {
      whatsapp: `Estimado {{nombre}},

Revisé su perfil en Google Maps — {{datosVerificables}} confirma una posición sólida en el segmento.

Trabajo con Medical Spas en {{ciudad}} ofreciendo servicios de automatización de atención vía WhatsApp. Quedo a su disposición para una breve reunión de 15 minutos en caso de que desee evaluar la posibilidad.

Cordialmente,
{{remitente}}`,
      email: {
        subject: `{{nombre}} — propuesta de automatización de atención`,
        body: `Estimado equipo de {{nombre}},

{{datosVerificables}} en Google Maps refleja una reputación sólida. Nuestra propuesta se enfoca en automatizar la atención inicial de consultas por WhatsApp para Medical Spas con alto volumen, sin afectar el trato personalizado.

De tener interés, puedo agendar una llamada de 15 minutos para revisar el alcance.

Cordialmente,
{{remitente}}`,
      },
      instagram: `Hola {{nombre}}, soy {{remitente}}. Trabajo con Medical Spas en automatizar atención WhatsApp. ¿Conversamos?`,
    },

---

# Apéndice I — Patch multilingüe v2.1

**4 de agosto 2026.** Corrección de raíz al gatekeeper: las reglas de anti-patrón eran solo-español y dejaban colar/rechazar mensajes en inglés (campañas Miami). Verificado con ejecución real (`test/gatekeeper.test.js`) y desplegado a producción (imagen `latest-fix6`).

## I.1 Diagnóstico (corrige el §6 original)

El §6 afirmaba que el gatekeeper aprobaba spam en inglés falsamente. La causa real, medida:

| Regla | Estado antes | Efecto real |
|---|---|---|
| R1 `INTERNAL_OPS_QUESTION` | solo ES (`¿cuántos?`) | "how many messages do you get" **colaba** |
| R2 `UNVERIFIABLE_ASSUMPTION` | solo ES (`apuesto/probablemente`) | "most spas lose bookings" **colaba** |
| R4 `NO_VALUE_PROP` | EN estrecho (`we help`, `without adding staff`) | mensajes buenos ("we work with", "within minutes") **se rechazaban** → regeneración inútil |
| R7 `MULTIPLE_CRITICISMS` | solo ES | críticas acumuladas en inglés no se contaban |
| R3, R5, R6 | ya bilingües / neutrales | ok |

Hallazgo adicional: **producción (`fix5`) no corría ningún gatekeeper** — el `scoring.js` desplegado era anterior al feature. El deploy `fix6` activó por primera vez el pipeline de 7 pasos + segmentación + gatekeeper en producción.

## I.2 Reglas bilingües (estado real en `src/services/gatekeeper.js`)

```javascript
// R1 — pregunta investigativa (ES + EN)
/¿\s*cu[aá]nt[oa]s?\b/i.test(m) || /\bhow\s+(many|much|long|often)\b/i.test(m)

// R2 — suposición no verificable (ES + EN)
/(apuesto\s+(a\s+)?que|probablemente|seguramente|...)/i.test(m)
|| /\b(probably|likely|i\s+bet|i'?m\s+guessing|chances\s+are|i\s+(imagine|assume|suppose)|most\s+\w+\s+(lose|miss|lack|struggle|are\s+losing))\b/i.test(m)

// R4 — propuesta de valor (ES + EN ampliado)
// ...|we\s+(help|work\s+with)|helping\s+(them|you|businesses)|respond(ing)?\s+(faster|within|in\s+(under\s+)?\d)|without\s+adding|24\s*[\/x]?\s*7...

// R7 — críticas acumuladas ≥2 (ES + EN)
/(pierdes|...|losing|missing\s+out|unanswered|(don'?t|not|aren'?t)\s+respond(ing)?|slow\s+to\s+respond)/gi
```

## I.3 System prompt bilingüe (`scoring.js` → `HARD_PRINCIPLES`)

Los PROHIBIDO §1/§2 ahora dan el equivalente en inglés, para que el modelo evite el anti-patrón antes del gatekeeper (menos regeneraciones):

```
§1 EN prohibido: "how many messages do you get", "how long does it take", "how much".
§2 EN prohibido: "you're probably losing…", "most spas lose bookings", "I bet you…".
```

## I.4 Nota sobre cifras (Reference Card)

Cualquier cifra de resultado en un mensaje ("20–30% más consultas en 6 semanas") es **placeholder**. Antes de enviar a un prospecto real: reemplazar por una cifra propia verificable o quitarla. Las proyecciones de este doc no son SLA hasta tener A/B test en producción.

## I.5 Verificación

`npm test` (`node --test`, sin dependencias) — 6 casos: EN colado ahora se rechaza, EN válido pasa, regresión ES intacta. Todos en verde.
