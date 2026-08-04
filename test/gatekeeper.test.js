// Corre con: node --test  (Node 22, sin dependencias)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarMensaje } from '../src/services/gatekeeper.js';

const codes = (m) => validarMensaje(m).errors.map(e => e.code);

// --- Inglés: anti-patrones que antes colaban (R1/R2/R7 eran solo-ES) ---
test('R1 EN: rechaza "how many"', () => {
  assert.ok(codes('We help medspas respond faster. How many messages do you get on weekends? Worth a quick call?').includes('INTERNAL_OPS_QUESTION'));
});

test('R2 EN: rechaza suposición "most spas lose"', () => {
  assert.ok(codes('We help medspas respond faster. Most spas lose bookings on weekends. Worth a quick call?').includes('UNVERIFIABLE_ASSUMPTION'));
});

test('caso Aromas colado: value+CTA pero viola R1 y R2 → ya NO pasa', () => {
  const sneaky = 'Hi Aromas team, we help Miami medspas respond to WhatsApp faster. Quick question: how many messages do you get on weekends? Most spas lose bookings there. Worth a quick call this week?';
  assert.equal(validarMensaje(sneaky).passed, false);
});

// --- Inglés: mensaje bueno que antes fallaba R4 (value prop estrecha) ---
test('EN válido pasa (we work with / within minutes / worth a call)', () => {
  const good = 'Hi Aromas team, saw Aromas Medspa has 674 reviews on Google Maps with 4.8 stars — solid foundation in Doral. We work with Miami medspas helping them respond to WhatsApp within minutes, even on weekends, without adding front-desk hours. Worth a 15-minute call this week?';
  assert.equal(validarMensaje(good).passed, true);
});

// --- Regresión español: lo que ya funcionaba sigue funcionando ---
test('ES: rechaza "¿cuántos?"', () => {
  assert.ok(codes('¿Cuántos mensajes recibes por semana? Podemos ayudarte.').includes('INTERNAL_OPS_QUESTION'));
});

test('ES válido pasa', () => {
  const good = 'Vi que tenés 4.8★ con 300 reseñas — sólido. Ayudamos a clínicas de Miami a responder WhatsApp en menos de 2 min sin sumar personal. ¿Vale la pena una llamada de 15 min esta semana?';
  assert.equal(validarMensaje(good).passed, true);
});
