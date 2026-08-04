// Self-check: node --test src/services/message-quality.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularSegmento } from './segmentation.js';
import { validarMensaje, validateMessages } from './gatekeeper.js';

const serp = (found, pos) => ({ serp: { domain_found: found, domain_positions: found ? [{ position: pos }] : [] } });

test('segmentación: premium_establecido (1226 reviews, 5★, web, SERP 18)', () => {
  const r = calcularSegmento({ review_count: 1226, rating: 5, website: 'x.com', raw_data: serp(true, 18) });
  assert.equal(r.segment, 'premium_establecido');
});

test('segmentación: sin_datos (0 reviews, sin rating ni web)', () => {
  assert.equal(calcularSegmento({ review_count: 0, rating: 0, website: null }).segment, 'sin_datos');
});

test('segmentación: premium_visible ES ALCANZABLE (bug del playbook corregido)', () => {
  // 300 reviews (<500 → no premium_establecido), pero total≥70 y reviews≥200.
  const r = calcularSegmento({ review_count: 300, rating: 5, website: 'x.com', raw_data: serp(true, 10) });
  assert.equal(r.segment, 'premium_visible');
});

test('gatekeeper R1: rechaza pregunta investigativa (mensaje real del 0/21)', () => {
  const { passed, errors } = validarMensaje('Hola, rápida pregunta: ¿cuántos mensajes de WhatsApp recibes al mes?');
  assert.equal(passed, false);
  assert.ok(errors.some(e => e.code === 'INTERNAL_OPS_QUESTION'));
});

test('gatekeeper R2: rechaza suposición del prompt viejo ("Apuesto a que pierdes...")', () => {
  const { passed, errors } = validarMensaje('Noté tu web. Apuesto a que pierdes 2-3 consultas diarias por eso.');
  assert.equal(passed, false);
  assert.ok(errors.some(e => e.code === 'UNVERIFIABLE_ASSUMPTION'));
});

test('gatekeeper: aprueba mensaje limpio en español', () => {
  const msg = 'Hola Aromas, vi tus 674 reseñas en Miami — reputación sólida. Ayudamos a Medical Spas a ' +
    'responder más rápido en WhatsApp sin agregar personal. ¿Vale la pena una llamada de 15 min esta semana?';
  assert.equal(validarMensaje(msg).passed, true);
});

test('gatekeeper: aprueba mensaje limpio en inglés (R4/R5 bilingüe)', () => {
  const msg = 'Hi Ana, saw your 600 reviews. We help medspas respond faster on WhatsApp without adding staff. Worth a quick 15 min call?';
  assert.equal(validarMensaje(msg).passed, true);
});

test('validateMessages: loom_script largo NO dispara R3; whatsapp inválido sí falla', () => {
  const messages = {
    whatsapp: 'Hola, ¿cuántos leads pierdes?',                 // R1
    loom_script: Array(500).fill('palabra').join(' '),          // >200 pero exento
  };
  const v = validateMessages(messages);
  assert.equal(v.passed, false);
  assert.ok(v.byChannel.whatsapp);
  assert.equal(v.byChannel.loom_script, undefined);
});

test('riel de canal: WhatsApp >120 palabras falla aunque pase el gatekeeper global', () => {
  // Mensaje limpio (pasa las 7 reglas) pero de 130 palabras: OK global, largo para WA.
  const clean = 'Vi que tienen una reputación sólida en Google. Ayudamos a clínicas a responder más rápido sin sumar personal. ';
  const wa = clean + Array(130).fill('palabra').join(' ') + ' ¿Vale la pena una llamada de 15 min?';
  assert.equal(validarMensaje(wa).passed, true);                // gatekeeper global no lo frena... salvo 200 palabras
  const v = validateMessages({ whatsapp: wa });
  assert.equal(v.passed, false);
  assert.ok(v.byChannel.whatsapp.some(e => e.code === 'CHANNEL_TOO_LONG'));
});

test('riel de canal: Instagram DM >300 chars falla', () => {
  const ig = 'Vi su perfil. ' + 'x'.repeat(320);
  const v = validateMessages({ instagram_dm: ig });
  assert.ok(v.byChannel.instagram_dm?.some(e => e.code === 'CHANNEL_TOO_LONG'));
});

test('REVIEWS_REQUIRED (bug Dolce): lead con 1226 reseñas y mensaje que no las cita falla', () => {
  const wa = 'Hi Dolce — saw your 5★ profile. We help medspas respond in <2 min, 24/7, no code. Worth a 15 min call this week?';
  const v = validateMessages({ whatsapp: wa }, { review_count: 1226 });
  assert.equal(v.passed, false);
  assert.ok(v.byChannel.whatsapp.some(e => e.code === 'NO_REVIEW_COUNT'));
});

test('REVIEWS_REQUIRED: pasa si cita el número (con o sin coma de miles)', () => {
  const wa = 'Hi Dolce — saw your 5★ with 1,226 reviews. We help medspas respond in <2 min, 24/7, no code. Worth a 15 min call this week?';
  assert.equal(validateMessages({ whatsapp: wa }, { review_count: 1226 }).passed, true);
});

test('REVIEWS_REQUIRED: no dispara con ≤50 reseñas ni sin lead', () => {
  const wa = 'Hi — saw your 5★ profile. We help medspas respond in <2 min, 24/7, no code. Worth a 15 min call this week?';
  assert.equal(validateMessages({ whatsapp: wa }, { review_count: 40 }).passed, true);
  assert.equal(validateMessages({ whatsapp: wa }).passed, true); // sin lead → backward compat
});
