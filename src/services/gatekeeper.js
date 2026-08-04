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
    test: (m) => !/(podemos|te\s+ayudamos|ayudamos|ayudo\b|nuestra\s+soluci[oó]n|lo\s+que\s+hacemos|automatiza(r|mos|ci[oó]n)|responder\s+m[aá]s\s+r[aá]pido|sin\s+(agregar|sumar)\s+personal|en\s+menos\s+de|we\s+(help|work\s+with)|helping\s+(them|you|businesses)|our\s+solution|what\s+we\s+do|automate|respond(ing)?\s+(faster|within|in\s+(under\s+)?\d)|without\s+adding|24\s*[\/x]?\s*7)/i.test(m),
  },
  {
    code: 'NO_SPECIFIC_CTA',
    description: 'Sin call-to-action específico de bajo rozamiento',
    test: (m) => !/(llamada|conversaci[oó]n|\d+\s*min|¿\s*te\s+interesa|¿\s*tiene\s+sentido|vale\s+la\s+pena\s+explorar|¿\s*agendamos|¿\s*charlamos|¿\s*hablamos|quick\s+(call|chat)|does\s+it\s+make\s+sense|worth\s+(a\s+|exploring)|interested)/i.test(m),
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

/**
 * Valida el objeto de mensajes multi-canal generado por scoring.js.
 * loom_script queda exento (es un guion largo, no un mensaje corto de outreach).
 * @param {object} messages - { email:{subject,body}, whatsapp, instagram_dm, loom_script }
 * @returns {{ passed: boolean, byChannel: Record<string, Array> }}
 */
export function validateMessages(messages = {}) {
  const byChannel = {};
  const targets = {
    whatsapp: messages.whatsapp,
    instagram_dm: messages.instagram_dm,
    email: messages.email?.body,
  };
  for (const [channel, text] of Object.entries(targets)) {
    if (!text) continue;
    const { passed, errors } = validarMensaje(text);
    if (!passed) byChannel[channel] = errors;
  }
  return { passed: Object.keys(byChannel).length === 0, byChannel };
}

export { RULES };
