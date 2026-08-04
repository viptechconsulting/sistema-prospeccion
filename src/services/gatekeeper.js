// Gatekeeper: 7 reglas duras que ningún mensaje de outreach debe violar.
// Origen: Playbook Copiloto Comercial v2.0 §6. Deduplicado (el playbook repetía reglas)
// y bilingüe ES+EN en todas las reglas de anti-patrón: las campañas de Miami generan
// en inglés y las regex solo-español dejaban colar spam ("how many…", "most spas lose…")
// y rechazaban mensajes buenos ("we work with…"). Ver test/gatekeeper.test.js.

const RULES = [
  {
    code: 'INTERNAL_OPS_QUESTION',
    description: 'Pregunta investigativa sobre operaciones internas (¿cuántos/cuánto…?)',
    // "¿cuántos mensajes recibes?", "¿cuánto tiempo tardas?", "how many messages…", "how long do you…"
    test: (m) => /¿\s*cu[aá]nt[oa]s?\b/i.test(m) || /\bhow\s+(many|much|long|often)\b/i.test(m),
  },
  {
    code: 'UNVERIFIABLE_ASSUMPTION',
    description: 'Suposición no verificable sobre el negocio',
    // ES: "apuesto a que…", "probablemente…". EN: "you're probably losing…", "most spas lose…", "i bet…"
    test: (m) => /(apuesto\s+(a\s+)?que|probablemente|seguramente|seguro\s+que|imagino\s+que|supongo\s+que|me\s+imagino|debe\s+de?\s*estar)/i.test(m)
      || /\b(probably|likely|i\s+bet|i'?m\s+guessing|chances\s+are|i\s+(imagine|assume|suppose)|most\s+\w+\s+(lose|miss|lack|struggle|are\s+losing))\b/i.test(m),
  },
  {
    code: 'MSG_TOO_LONG',
    description: 'Mensaje supera 200 palabras',
    test: (m) => m.trim().split(/\s+/).filter(Boolean).length > 200,
  },
  {
    code: 'NO_VALUE_PROP',
    description: 'No contiene propuesta de valor concreta',
    // Reconoce también el valor implícito por velocidad/tecnología que estos mensajes usan
    // ("<2 min", "instant", "real-time", "no code", "no hiring"), no solo el pitch explícito.
    test: (m) => !/(podemos|te\s+ayudamos|ayudamos|ayudo\b|nuestra\s+soluci[oó]n|lo\s+que\s+hacemos|automatiza(r|mos|ci[oó]n)|responder\s+m[aá]s\s+r[aá]pido|sin\s+(agregar|sumar)\s+personal|en\s+menos\s+de|we\s+(help|work\s+with)|helping\s+(them|you|businesses)|our\s+solution|what\s+we\s+do|automate|respond(s|ing)?\s+(faster|instantly|to|in|within)|<\s*\d+\s*min|instant(ly|-message)?|real[-\s]?time|no[-\s]?cod(e|ing)|no\s+hiring|without\s+(adding|hiring|extra)|24\s*[\/x]?\s*7)/i.test(m),
  },
  {
    code: 'NO_SPECIFIC_CTA',
    description: 'Sin call-to-action específico de bajo rozamiento',
    // "15-min" (guion), "make sense", "worth exploring/10 min", "sounds relevant" también son CTAs válidos.
    test: (m) => !/(llamada|conversaci[oó]n|\d+\s*-?\s*min|¿\s*te\s+interesa|¿\s*tiene\s+sentido|vale\s+la\s+pena|agendamos|charlamos|hablamos|quick\s+(call|chat|conversation)|makes?\s+sense|worth\s+\w+|to\s+explore|sounds?\s+(relevant|good)|does\s+(this|that|it)\s+(apply|interest|matter)|interested)/i.test(m),
  },
  {
    code: 'TOO_MANY_QUESTIONS',
    description: 'Demasiadas preguntas (>2)',
    // Cuenta signos de cierre "?" — uno por pregunta en ES y EN.
    test: (m) => (m.match(/\?/g) || []).length > 2,
  },
  {
    code: 'MULTIPLE_CRITICISMS',
    description: 'Múltiples críticas al negocio (tono acusatorio)',
    test: (m) => ((m.match(/(pierdes|est[aá]s\s+perdiendo|tardas|tard[aá]s|no\s+respond[eé]s?|fallas|descuidas|losing|missing\s+out|unanswered|(don'?t|not|aren'?t)\s+respond(ing)?|slow\s+to\s+respond)/gi) || []).length >= 2),
  },
];

/**
 * Valida un texto contra las 7 reglas.
 * @param {string} mensaje
 * @returns {{ passed: boolean, errors: Array<{code:string, description:string}> }}
 */
export function validarMensaje(mensaje) {
  const text = String(mensaje || '');
  const errors = RULES.filter(r => r.test(text)).map(({ code, description }) => ({ code, description }));
  return { passed: errors.length === 0, errors };
}

// Rieles de longitud por canal. El prompt pide targets más estrictos (WA ~60 palabras,
// IG 4-5 líneas); estos son ceilings generosos para atrapar solo excesos claros que el
// gatekeeper global (200 palabras) deja pasar. Violarlos dispara el mismo regenerate loop.
const CHANNEL_LIMITS = {
  whatsapp:     { maxWords: 120, label: 'WhatsApp' },
  instagram_dm: { maxChars: 300, label: 'Instagram DM' },
};

/**
 * Valida el objeto de mensajes multi-canal generado por scoring.js.
 * loom_script queda exento (es un guion largo, no un mensaje corto de outreach).
 * @param {object} messages - { email:{subject,body}, whatsapp, instagram_dm, loom_script }
 * @returns {{ passed: boolean, byChannel: Record<string, Array> }}
 */
// Variantes con separador de miles para buscar el número de reseñas en el texto
// (1226 puede aparecer como "1226", "1,226" o "1.226").
function reviewVariants(n) {
  const s = String(n);
  return [s, s.replace(/\B(?=(\d{3})+(?!\d))/g, ','), s.replace(/\B(?=(\d{3})+(?!\d))/g, '.')];
}

export function validateMessages(messages = {}, lead = {}) {
  const byChannel = {};
  const targets = {
    whatsapp: messages.whatsapp,
    instagram_dm: messages.instagram_dm,
    email: messages.email?.body,
  };
  // REVIEWS_REQUIRED (bug Dolce): si el lead tiene >50 reseñas, el número es el dato
  // verificable más fuerte y DEBE aparecer. Omitirlo desperdicia la personalización.
  const reviewN = Number(lead.review_count) || 0;
  const variants = reviewN > 50 ? reviewVariants(reviewN) : [];
  for (const [channel, text] of Object.entries(targets)) {
    if (!text) continue;
    const { errors } = validarMensaje(text);
    const limit = CHANNEL_LIMITS[channel];
    if (limit?.maxWords && String(text).trim().split(/\s+/).filter(Boolean).length > limit.maxWords)
      errors.push({ code: 'CHANNEL_TOO_LONG', description: `Excede ${limit.maxWords} palabras para ${limit.label}` });
    if (limit?.maxChars && String(text).length > limit.maxChars)
      errors.push({ code: 'CHANNEL_TOO_LONG', description: `Excede ${limit.maxChars} caracteres para ${limit.label}` });
    if (variants.length && !variants.some(v => String(text).includes(v)))
      errors.push({ code: 'NO_REVIEW_COUNT', description: `Lead tiene ${reviewN} reseñas y el mensaje no cita el número` });
    if (errors.length) byChannel[channel] = errors;
  }
  return { passed: Object.keys(byChannel).length === 0, byChannel };
}

export { RULES };
