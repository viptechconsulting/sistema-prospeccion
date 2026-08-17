const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const STATUS_LABELS = {
  nuevo: 'Nuevo',
  analizado: 'Analizado',
  estrategia_lista: 'Estrategia lista',
  mensaje_listo: 'Mensaje listo',
  contactado: 'Contactado',
  respondio: 'Respondió',
  interesado: 'Interesado',
  objecion: 'Objeción',
  demo_propuesta: 'Demo propuesta',
  demo_agendada: 'Demo agendada',
  propuesta_enviada: 'Propuesta enviada',
  cerrado_ganado: 'Cerrado ganado',
  cerrado_perdido: 'Cerrado perdido',
  reactivar_despues: 'Reactivar después',
  // backward compat
  por_contactar: 'Nuevo',
  mensaje_enviado: 'Contactado',
  followup_pendiente: 'Seguimiento pendiente',
  reunion_agendada: 'Demo agendada',
  descartado: 'Cerrado perdido'
};

const STATUS_GROUPS = [
  { key: 'discovery', label: 'Descubrimiento', statuses: ['nuevo', 'analizado', 'estrategia_lista', 'mensaje_listo', 'por_contactar'] },
  { key: 'outreach', label: 'Contacto', statuses: ['contactado', 'mensaje_enviado', 'followup_pendiente'] },
  { key: 'engaged', label: 'En conversación', statuses: ['respondio', 'interesado', 'objecion'] },
  { key: 'demo', label: 'Demo / Propuesta', statuses: ['demo_propuesta', 'demo_agendada', 'propuesta_enviada', 'reunion_agendada'] },
  { key: 'closed', label: 'Cierre', statuses: ['cerrado_ganado', 'cerrado_perdido', 'descartado'] },
  { key: 'parked', label: 'Reactivar', statuses: ['reactivar_despues'] }
];

const STATUS_COLORS = {
  nuevo: '#888', analizado: '#6699cc', estrategia_lista: '#9966cc', mensaje_listo: '#cc9933',
  contactado: '#00ff88', respondio: '#33ccff', interesado: '#00ff88', objecion: '#ff9966',
  demo_propuesta: '#cc66ff', demo_agendada: '#66ffcc', propuesta_enviada: '#ffcc33',
  cerrado_ganado: '#00ff88', cerrado_perdido: '#ff4444', reactivar_despues: '#ffaa33'
};

const PLATFORM_LABELS = { google_maps: 'Google Maps', linkedin: 'LinkedIn', instagram: 'Instagram', meta_ads: 'Meta Ads', google_serp: 'Google SERP' };
const ANGLES = ['Demanda no captada', 'Ventaja desaprovechada', 'Oportunidad oculta', 'Comparación con competidores', 'Conversaciones mal convertidas', 'Leads existentes mal aprovechados'];
const TONES = ['Consultivo', 'Directo', 'Curioso', 'Relajado', 'Profesional', 'Suave'];
const STYLES = ['Más corto', 'Más directo', 'Más suave', 'Más curioso', 'Más premium', 'Más personalizado', 'Más consultivo'];

const state = { leads: [], filters: {} };

function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('err', err);
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), err ? 12000 : 2500);
}

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) {
    const body = await res.text();
    let msg = body;
    try { msg = JSON.parse(body).error || body; } catch {}   // unwrap {error: "..."}
    const m = /"message":\s*"((?:[^"\\]|\\.)*)"/.exec(msg);   // dig out nested API reason if present
    if (m) msg = m[1].replace(/\\"/g, '"');
    throw new Error(msg);
  }
  return res.json();
}

async function loadMetrics() {
  const m = await api('/api/leads/metrics');
  $('#metrics').innerHTML = `
    <div class="metric"><div class="v">${m.total}</div><div class="l">Oportunidades</div></div>
    <div class="metric"><div class="v">${m.strategies || 0}</div><div class="l">Estrategias</div></div>
    <div class="metric"><div class="v">${m.contacted}</div><div class="l">Contactados</div></div>
    <div class="metric"><div class="v">${(m.responseRate * 100).toFixed(1)}%</div><div class="l">Tasa respuesta</div></div>
    <div class="metric"><div class="v">${m.interested || 0}</div><div class="l">Interesados</div></div>
    <div class="metric"><div class="v">${m.demosScheduled || 0}</div><div class="l">Demos</div></div>
    <div class="metric"><div class="v">${m.won || 0}</div><div class="l">Cerrados</div></div>
    <div class="metric"><div class="v">${m.followupsPending || 0}</div><div class="l">Seguimientos</div></div>
  `;
}

async function loadLeads() {
  const q = new URLSearchParams();
  if (state.filters.platform) q.set('platform', state.filters.platform);
  if (state.filters.status) q.set('status', state.filters.status);
  if (state.filters.minScore) q.set('minScore', state.filters.minScore);
  if (state.filters.campaignId) q.set('campaignId', state.filters.campaignId);
  if (state.filters.hasWebsite) q.set('hasWebsite', state.filters.hasWebsite);
  state.leads = await api('/api/leads?' + q);
  renderKanban();
  renderTable();
}

async function loadCampaigns() {
  const c = await api('/api/campaigns');
  state.campaigns = c;
  const sel = $('#f-campaign');
  const current = sel.value;
  sel.innerHTML = '<option value="">Todas las oportunidades</option>' + c.map(x => `<option value="${x.id}">${escapeHtml(x.niche || 'búsqueda ' + x.id)} · ${PLATFORM_LABELS[x.platform] || x.platform}</option>`).join('');
  sel.value = current;
  $('#campaigns-tbody').innerHTML = c.map(x => `
    <tr>
      <td>${escapeHtml(x.niche || '—')}</td>
      <td>${PLATFORM_LABELS[x.platform] || x.platform}</td>
      <td>${escapeHtml(x.location || '')}</td>
      <td>${escapeHtml(x.service_offered || '').slice(0, 60)}</td>
      <td>${state.leads.filter(l => l.campaign_id === x.id).length}</td>
      <td>${escapeHtml((x.status || '').slice(0, 40))}</td>
      <td>${new Date(x.created_at).toLocaleDateString()}</td>
      <td><button class="btn-dup-camp" data-id="${x.id}">Duplicar</button> <button class="btn-del-camp" data-id="${x.id}" style="background:#3a1a1a;border-color:#552">Borrar</button></td>
    </tr>`).join('');
}

function leadCard(l) {
  const scoreCls = (l.score || 0) >= 7 ? '' : 'low';
  const warn = !l.website ? '<span title="Sin web" style="color:#ff6666">!</span>' : '';
  const rating = l.rating != null ? `<span style="color:${l.rating <= 4.3 ? '#ff6666' : '#888'};font-size:11px">${l.rating}★</span>` : '';
  const statusColor = STATUS_COLORS[l.status] || '#888';
  const statusLabel = STATUS_LABELS[l.status] || l.status;
  return `<div class="card-lead" data-id="${l.id}">
    <div><span class="score ${scoreCls}">${l.score ?? '?'}</span><span class="t">${escapeHtml(l.name || '—')}</span> ${warn}</div>
    <div class="s">${escapeHtml(l.company || '')} · ${PLATFORM_LABELS[l.platform] || l.platform} ${rating ? '· ' + rating : ''}</div>
    <div class="s"><span class="status-dot" style="background:${statusColor}"></span> ${statusLabel}</div>
  </div>`;
}

function renderKanban() {
  const board = $('#kanban-board');
  board.innerHTML = STATUS_GROUPS.map(group => {
    const items = state.leads.filter(l => group.statuses.includes(l.status));
    return `<div class="col" data-group="${group.key}">
      <h3>${group.label} <span class="n">${items.length}</span></h3>
      <div class="items">${items.map(leadCard).join('')}</div>
    </div>`;
  }).join('');
}

function previewMsg(raw) {
  const p = parseMessages(raw);
  if (p) return p.whatsapp || p.instagram_dm || p.email?.body || '';
  return raw || '';
}

function renderTable() {
  $('#view-table tbody').innerHTML = state.leads.map(l => `
    <tr data-id="${l.id}">
      <td>${escapeHtml(l.name || '—')}</td>
      <td>${escapeHtml(l.company || '')}</td>
      <td>${PLATFORM_LABELS[l.platform] || l.platform}</td>
      <td><span class="score ${(l.score||0)>=7?'':'low'}">${l.score ?? '?'}</span></td>
      <td><span class="status-dot" style="background:${STATUS_COLORS[l.status] || '#888'}"></span> ${STATUS_LABELS[l.status] || l.status}</td>
      <td>${l.contacted_at ? new Date(l.contacted_at).toLocaleDateString() : '—'}</td>
      <td class="msg">${escapeHtml(previewMsg(l.suggested_message))}</td>
      <td>→</td>
    </tr>`).join('');
}

function parseMessages(raw) {
  if (!raw) return null;
  try { const o = JSON.parse(raw); if (o && typeof o === 'object' && (o.email || o.whatsapp || o.instagram_dm || o.loom_script)) return o; } catch {}
  return null;
}

async function openLead(id) {
  let lead, messages, strategy = null, timeline = [];
  try {
    const base = await api(`/api/leads/${id}`);
    lead = base.lead; messages = base.messages;
  } catch (e) { toast('Error cargando lead', true); return; }
  try { strategy = (await api(`/api/leads/${id}/strategy`)).strategy; } catch {}
  try { timeline = (await api(`/api/conversations/${id}/timeline`)).timeline || []; } catch {}
  let auditData = { audit: null, chat: [] };
  try { auditData = await api(`/api/leads/${id}/audit`); } catch {}

  const parsed = parseMessages(lead.suggested_message);
  const wa = parsed?.whatsapp || '';
  const emailBody = parsed?.email?.body || '';
  const emailSubject = parsed?.email?.subject || '';
  const ig = parsed?.instagram_dm || '';
  const loom = parsed?.loom_script || '';
  const legacy = parsed ? '' : (lead.suggested_message || '');
  const statusColor = STATUS_COLORS[lead.status] || '#888';

  const detail = $('.lead-detail');
  detail.innerHTML = `
    <h2>${escapeHtml(lead.name || '—')} <button class="close">✕</button></h2>
    <div class="meta">${escapeHtml(lead.company || '')} · ${PLATFORM_LABELS[lead.platform] || lead.platform} · <span class="status-dot" style="background:${statusColor}"></span> <strong>${STATUS_LABELS[lead.status] || lead.status}</strong></div>

    <!-- 1. BUSINESS SNAPSHOT -->
    <div class="accordion-section open">
      <h3 class="accordion-header">Datos del negocio</h3>
      <div class="accordion-body">
        ${buildBusinessSnapshot(lead)}
      </div>
    </div>

    <!-- 1b. AUDITORÍA DEL SITIO + IA -->
    <div class="accordion-section open">
      <h3 class="accordion-header">Auditoría del sitio + IA</h3>
      <div class="accordion-body" id="lead-audit-section"></div>
    </div>

    <!-- 2. OPPORTUNITY INSIGHT -->
    <div class="accordion-section open">
      <h3 class="accordion-header">Oportunidad detectada</h3>
      <div class="accordion-body">
        ${buildOpportunityInsight(lead, strategy)}
      </div>
    </div>

    <!-- 3. STRATEGY LAYER -->
    <div class="accordion-section open">
      <h3 class="accordion-header">Estrategia</h3>
      <div class="accordion-body" id="strategy-section">
        ${buildStrategySection(lead, strategy)}
      </div>
    </div>

    <!-- 4. OUTREACH MESSAGE -->
    <div class="accordion-section open">
      <h3 class="accordion-header">Mensaje</h3>
      <div class="accordion-body" id="message-section">
        <div class="safe-mode-notice">Modo seguro manual — El sistema genera y mejora mensajes, pero tú decides cuándo enviarlos. Esto ayuda a mantener control, personalización y reducir riesgos.</div>
        ${buildMessageSection(lead, strategy, parsed, legacy, wa, emailSubject, emailBody, ig, loom)}
      </div>
    </div>

    <!-- 5. CONVERSATION INTELLIGENCE -->
    <div class="accordion-section">
      <h3 class="accordion-header">Conversación</h3>
      <div class="accordion-body" id="conversation-section">
        ${buildConversationSection(lead, timeline)}
      </div>
    </div>

    <!-- 6. FOLLOW-UP TIMELINE -->
    <div class="accordion-section">
      <h3 class="accordion-header">Seguimiento</h3>
      <div class="accordion-body" id="followup-section">
        ${buildFollowUpSection(lead, timeline)}
      </div>
    </div>

    <!-- 7. ACTIVITY HISTORY -->
    <div class="accordion-section">
      <h3 class="accordion-header">Historial de actividad</h3>
      <div class="accordion-body">
        ${buildActivityHistory(messages, timeline)}
      </div>
    </div>

    <!-- ACTIONS -->
    <div class="lead-actions">
      <label>Notas<textarea id="d-notes">${escapeHtml(lead.notes || '')}</textarea></label>
      <label>Estado<select id="d-status">${Object.entries(STATUS_LABELS).filter(([k]) => !['por_contactar','mensaje_enviado','followup_pendiente','reunion_agendada','descartado'].includes(k)).map(([v,t])=>`<option value="${v}" ${v===lead.status?'selected':''}>${t}</option>`).join('')}</select></label>
      <div class="row">
        <button id="d-save">Guardar cambios</button>
        <button id="d-translate-es">ES</button>
        <button id="d-translate-en">EN</button>
        <button id="d-delete" style="background:#3a1a1a;border-color:#552">Borrar</button>
      </div>
    </div>
  `;

  $('#modal-lead').classList.remove('hidden');
  bindLeadDetailEvents(id, lead, strategy, parsed, wa, emailSubject, emailBody, ig, loom, legacy);
  renderLeadAudit(id, lead, auditData);
}

// ── Auditoría del sitio + chat con IA (portado de chat.lynkro.io) ───────
let _auditLead = null;
function renderLeadAudit(id, lead, data) {
  const box = document.getElementById('lead-audit-section');
  if (!box) return;
  _auditLead = lead;
  const a = data && data.audit;
  const chat = (data && data.chat) || [];
  const yn = v => v ? '<span style="color:#00ff88">sí</span>' : '<span style="color:#ff6666">no</span>';
  const signals = a ? `
    <div class="contact-card" style="margin-bottom:8px">
      <div class="cc-row"><span class="cc-k">Carga</span><span>${a.load_time_ms != null ? a.load_time_ms + ' ms' : 'n/d'}</span></div>
      <div class="cc-row"><span class="cc-k">Apto móvil</span><span>${yn(a.mobile_friendly)}</span></div>
      <div class="cc-row"><span class="cc-k">Formulario</span><span>${yn(a.has_form)}</span></div>
      <div class="cc-row"><span class="cc-k">Reservas / chat</span><span>${yn(a.has_booking_or_chat)}</span></div>
    </div>
    ${(() => { let iss = []; try { iss = JSON.parse(a.issues_json || '[]'); } catch {} return iss.length ? '<ul style="margin:6px 0 0;padding-left:18px">' + iss.map(i => `<li>${escapeHtml(i)}</li>`).join('') + '</ul>' : ''; })()}
  ` : `<div class="s" style="color:#888">Sin auditoría todavía${lead.website ? '' : ' · este lead no tiene website'}.</div>`;

  box.innerHTML = `
    ${signals}
    <button class="secondary" id="btn-run-audit" style="margin-top:8px">${a ? 'Re-auditar sitio' : 'Auditar sitio'}</button>

    <div style="margin-top:14px;border-top:1px solid #2a2a2a;padding-top:12px">
      <div style="font-size:12px;font-weight:600;color:#aaa;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">💬 Revisar con IA</div>
      <div style="color:#888;font-size:12px;margin-bottom:8px">¿La auditoría se equivocó o le falta contexto? Corrígela — la IA ajusta el análisis.</div>
      <div id="audit-chat-log" style="max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:10px"></div>
      <div style="display:flex;gap:8px;align-items:flex-end">
        <textarea id="audit-chat-input" rows="2" placeholder="Ej: el sitio sí tiene reservas por Instagram, corrige eso" style="flex:1"></textarea>
        <button class="primary" id="btn-audit-chat-send">Enviar</button>
      </div>
      <div style="margin-top:6px"><span id="btn-audit-chat-clear" style="cursor:pointer;text-decoration:underline;color:#888;font-size:12px">Limpiar conversación</span></div>
    </div>`;

  renderAuditChat(chat);
  document.getElementById('btn-run-audit').onclick = () => runLeadAudit(id);
  document.getElementById('btn-audit-chat-send').onclick = () => sendLeadAuditChat(id);
  document.getElementById('btn-audit-chat-clear').onclick = () => clearLeadAuditChat(id);
}

function auditChatBubble(role, text) {
  const div = document.createElement('div');
  div.style.cssText = 'max-width:90%;padding:9px 12px;border-radius:12px;font-size:13px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word;' +
    (role === 'user' ? 'align-self:flex-end;background:#0f3d2a;color:#c9ffe6' : 'align-self:flex-start;background:#161616;border:1px solid #2a2a2a;color:#e0e0e0');
  div.textContent = text;
  return div;
}
function renderAuditChat(list) {
  const log = document.getElementById('audit-chat-log');
  if (!log) return;
  log.innerHTML = '';
  if (!list || !list.length) { log.innerHTML = '<div style="color:#888;font-size:12px">Aún no has chateado sobre esta auditoría.</div>'; return; }
  list.forEach(m => log.appendChild(auditChatBubble(m.role, m.content)));
  log.scrollTop = log.scrollHeight;
}
async function runLeadAudit(id) {
  const btn = document.getElementById('btn-run-audit');
  if (btn) { btn.disabled = true; btn.textContent = 'Auditando…'; }
  try {
    await api(`/api/leads/${id}/audit`, { method: 'POST' });
    const data = await api(`/api/leads/${id}/audit`);
    renderLeadAudit(id, _auditLead || {}, data);
    toast('Auditoría lista');
  } catch (e) { toast('Error: ' + e.message, true); if (btn) { btn.disabled = false; btn.textContent = 'Auditar sitio'; } }
}
async function sendLeadAuditChat(id) {
  const input = document.getElementById('audit-chat-input');
  const msg = (input && input.value || '').trim();
  if (!msg) return;
  const log = document.getElementById('audit-chat-log');
  const send = document.getElementById('btn-audit-chat-send');
  if (log.querySelector('div[style*="color:#888"]')) log.innerHTML = '';
  log.appendChild(auditChatBubble('user', msg));
  input.value = '';
  const thinking = auditChatBubble('assistant', 'Pensando…'); thinking.style.opacity = '.6';
  log.appendChild(thinking); log.scrollTop = log.scrollHeight;
  if (send) send.disabled = true;
  try {
    const { reply } = await api(`/api/leads/${id}/audit-chat`, { method: 'POST', body: JSON.stringify({ message: msg }) });
    thinking.style.opacity = '1'; thinking.textContent = reply;
  } catch (e) {
    thinking.style.opacity = '1'; thinking.textContent = 'Error: ' + e.message;
  } finally { if (send) send.disabled = false; log.scrollTop = log.scrollHeight; }
}
async function clearLeadAuditChat(id) {
  if (!confirm('¿Limpiar toda la conversación de esta auditoría?')) return;
  try { await api(`/api/leads/${id}/audit-chat`, { method: 'DELETE' }); renderAuditChat([]); }
  catch (e) { toast('Error: ' + e.message, true); }
}

function buildBusinessSnapshot(lead) {
  const ratingLow = lead.rating != null && lead.rating <= 4.3;
  return `<div class="contact-card">
    <div class="cc-row"><span class="cc-k">Negocio</span><span>${escapeHtml(lead.company || lead.name || '—')}</span></div>
    <div class="cc-row"><span class="cc-k">Contacto</span><span>${escapeHtml(lead.contact_person || '—')}</span></div>
    <div class="cc-row"><span class="cc-k">Teléfono</span><span>${lead.phone ? escapeHtml(lead.phone) : 'No disponible'}</span></div>
    <div class="cc-row"><span class="cc-k">Email</span><span>${lead.email ? escapeHtml(lead.email) : 'No disponible'}</span></div>
    <div class="cc-row"><span class="cc-k">Website</span><span>${lead.website ? `<a href="${escapeHtml(lead.website)}" target="_blank" style="color:#00ff88">${escapeHtml(lead.website)}</a>` : '<span style="color:#ff6666">Sin website</span>'}</span></div>
    <div class="cc-row"><span class="cc-k">Rating</span><span>${lead.rating != null ? `<span style="color:${ratingLow ? '#ff6666' : '#00ff88'};font-weight:600">${lead.rating}★</span> · ${lead.review_count || 0} reviews` : `<button class="btn-enrich" data-id="${lead.id}" style="background:#1f1f1f;padding:3px 8px;font-size:11px">Buscar en Google</button>`}</span></div>
    ${lead.top_positive ? `<div class="cc-row"><span class="cc-k">Positivo</span><span style="color:#00ff88">${escapeHtml(lead.top_positive)}</span></div>` : ''}
    ${lead.top_negative ? `<div class="cc-row"><span class="cc-k">Quejas</span><span style="color:#ff9966">${escapeHtml(lead.top_negative)}</span></div>` : ''}
    <div class="cc-row"><span class="cc-k">Inversión en Ads</span><span style="color:${lead.has_ads && !lead.has_ads.includes('Sin') ? '#00ff88' : '#888'}">${escapeHtml(lead.has_ads || 'Sin datos')}</span></div>
    ${lead.seo_audit ? `<div class="cc-row"><span class="cc-k">Visibilidad</span><span style="font-size:11px">${escapeHtml(lead.seo_audit)}</span></div>` : ''}
    ${lead.instagram_url ? `<div class="cc-row"><span class="cc-k">Instagram</span><span><a href="${escapeHtml(lead.instagram_url)}" target="_blank" style="color:#00ff88">${escapeHtml(lead.instagram_url)}</a></span></div>` : ''}
    ${lead.gmb_url ? `<div class="cc-row"><span class="cc-k">Google Business</span><span><a href="${escapeHtml(lead.gmb_url)}" target="_blank" style="color:#00ff88">Ver perfil</a></span></div>` : ''}
    <div class="cc-row"><span class="cc-k">Puntuación</span><span class="score ${(lead.score||0)>=7?'':'low'}">${lead.score ?? '?'}</span></div>
  </div>
  ${lead.score_reason ? `<div class="reason">${escapeHtml(lead.score_reason)}</div>` : ''}
  ${buildPipelineHtml(lead.qualification_pipeline)}`;
}

function buildOpportunityInsight(lead, strategy) {
  if (!strategy && !lead.score_reason) return '<div class="s" style="color:#888">Genera una estrategia para ver el análisis de oportunidad.</div>';
  if (!strategy) return `<div class="insight-card">
    <div class="insight-row"><span class="insight-k">Oportunidad detectada</span><span>${escapeHtml(lead.score_reason || '')}</span></div>
    ${lead.top_negative ? `<div class="insight-row"><span class="insight-k">Por qué importa</span><span>Hay señales de fricción: ${escapeHtml(lead.top_negative)}</span></div>` : ''}
    <div class="insight-row"><span class="insight-k">Nivel</span><span style="color:${(lead.score||0) >= 7 ? '#00ff88' : '#ffaa33'}">${(lead.score||0) >= 7 ? 'Alta oportunidad' : 'Oportunidad moderada'}</span></div>
  </div>`;
  return `<div class="insight-card">
    <div class="insight-row"><span class="insight-k">Oportunidad detectada</span><span>${escapeHtml(strategy.non_obvious_problem || strategy.angle || '')}</span></div>
    <div class="insight-row"><span class="insight-k">Por qué importa</span><span>${escapeHtml(strategy.commercial_implication || '')}</span></div>
    <div class="insight-row"><span class="insight-k">Implicación comercial</span><span>${escapeHtml(strategy.why_this_angle || '')}</span></div>
    <div class="insight-row"><span class="insight-k">Nivel</span><span style="color:${(lead.score||0) >= 7 ? '#00ff88' : '#ffaa33'}">${(lead.score||0) >= 7 ? 'Alta oportunidad' : 'Oportunidad moderada'}</span></div>
  </div>`;
}

function buildStrategySection(lead, strategy) {
  const angleOptions = ANGLES.map(a => `<option value="${a}">${a}</option>`).join('');
  const toneOptions = TONES.map(t => `<option value="${t}">${t}</option>`).join('');

  if (!strategy) return `
    <div class="strategy-empty">
      <p style="color:#888">Sin estrategia generada. Define el ángulo de acercamiento antes de crear un mensaje.</p>
      <div class="strategy-controls">
        <select id="str-angle"><option value="">Ángulo (auto)</option>${angleOptions}</select>
        <select id="str-tone"><option value="Consultivo">Tono: Consultivo</option>${toneOptions}</select>
        <button id="btn-gen-strategy" class="primary">Generar estrategia</button>
      </div>
    </div>`;

  return `
    <div class="strategy-card">
      <div class="str-row"><span class="str-k">Ángulo</span><span class="str-v">${escapeHtml(strategy.angle || '')}</span></div>
      <div class="str-row"><span class="str-k">Problema no obvio</span><span class="str-v">${escapeHtml(strategy.non_obvious_problem || '')}</span></div>
      <div class="str-row"><span class="str-k">Implicación comercial</span><span class="str-v">${escapeHtml(strategy.commercial_implication || '')}</span></div>
      <div class="str-row"><span class="str-k">Hook sugerido</span><span class="str-v" style="color:#00ff88">${escapeHtml(strategy.hook || '')}</span></div>
      <div class="str-row"><span class="str-k">Objetivo del mensaje</span><span class="str-v">${escapeHtml(strategy.message_goal || '')}</span></div>
      <div class="str-row"><span class="str-k">Tono</span><span class="str-v">${escapeHtml(strategy.recommended_tone || '')}</span></div>
      <div class="str-row"><span class="str-k">Razón del ángulo</span><span class="str-v">${escapeHtml(strategy.why_this_angle || '')}</span></div>
    </div>
    <div class="strategy-controls" style="margin-top:10px">
      <select id="str-angle"><option value="">Ángulo (auto)</option>${angleOptions}</select>
      <select id="str-tone"><option value="Consultivo">Tono: Consultivo</option>${toneOptions}</select>
      <button id="btn-gen-strategy">Regenerar estrategia</button>
    </div>`;
}

function buildMessageSection(lead, strategy, parsed, legacy, wa, emailSubject, emailBody, ig, loom) {
  const hasMsg = wa || emailBody || ig || legacy;
  const genBtnLabel = strategy ? 'Generar mensaje desde estrategia' : 'Generar mensaje con estrategia';
  const genBtn = `<button id="btn-gen-message" class="primary" style="margin-bottom:10px;width:100%">${genBtnLabel}</button>`;
  const styleButtons = STYLES.map(s => `<button class="btn-style secondary" data-style="${s}">${s}</button>`).join('');

  let msgContent = '';
  if (parsed) {
    msgContent = `
    <div class="tabs">
      <button class="tab active" data-ch="whatsapp">WhatsApp</button>
      <button class="tab" data-ch="email">Email</button>
      <button class="tab" data-ch="instagram_dm">Instagram</button>
      <button class="tab" data-ch="loom_script">Loom Script</button>
    </div>
    <div id="ch-whatsapp" class="ch-panel active"><textarea id="t-whatsapp">${escapeHtml(wa)}</textarea><button class="secondary cp-btn" data-cp="t-whatsapp">Copiar WhatsApp</button></div>
    <div id="ch-email" class="ch-panel"><input id="t-email-subject" placeholder="Asunto" value="${escapeHtml(emailSubject)}"/><textarea id="t-email">${escapeHtml(emailBody)}</textarea><button class="secondary cp-btn" data-cp="email">Copiar Email</button></div>
    <div id="ch-instagram_dm" class="ch-panel"><textarea id="t-instagram_dm">${escapeHtml(ig)}</textarea><button class="secondary cp-btn" data-cp="t-instagram_dm">Copiar Instagram</button></div>
    <div id="ch-loom_script" class="ch-panel"><textarea id="t-loom_script" style="min-height:300px">${escapeHtml(loom)}</textarea><button class="secondary cp-btn" data-cp="t-loom_script">Copiar Loom</button></div>`;
  } else if (legacy) {
    msgContent = `<label>Mensaje sugerido<textarea id="t-whatsapp">${escapeHtml(legacy)}</textarea></label>`;
  } else {
    msgContent = `<div class="s" style="color:#888;padding:8px 0">Sin mensaje generado aun. Genera una estrategia y luego un mensaje, o usa el boton de arriba.</div>`;
  }

  return `${genBtn}${msgContent}
    ${hasMsg ? `<div class="tone-controls">${styleButtons}</div>` : ''}
    <div class="row" style="margin-top:8px">
      ${hasMsg ? `<button id="d-copy">Copiar canal activo</button>` : ''}
      ${lead.profile_url ? `<button id="d-open" class="primary">Abrir perfil + copiar</button>` : ''}
      ${hasMsg ? `<button id="d-sent">Marcar como enviado</button>` : ''}
      <button id="d-followup">Sugerir seguimiento</button>
    </div>`;
}

function buildConversationSection(lead, timeline) {
  const analyses = timeline.filter(t => t.source === 'analysis');
  const lastAnalysis = analyses.length ? analyses[analyses.length - 1] : null;

  let analysisHtml = '';
  if (lastAnalysis) {
    const intentColor = { Alta: '#00ff88', Media: '#ffaa33', Baja: '#ff6666', Negativa: '#ff4444', Desconocida: '#888' };
    analysisHtml = `<div class="analysis-result">
      <div class="analysis-row"><span class="analysis-k">Estado</span><span>${escapeHtml(lastAnalysis.lead_status || '')}</span></div>
      <div class="analysis-row"><span class="analysis-k">Tipo de respuesta</span><span>${escapeHtml(lastAnalysis.response_type || '')}</span></div>
      <div class="analysis-row"><span class="analysis-k">Objeción</span><span>${escapeHtml(lastAnalysis.objection || 'Ninguna')}</span></div>
      <div class="analysis-row"><span class="analysis-k">Nivel de intención</span><span style="color:${intentColor[lastAnalysis.intent_level] || '#888'};font-weight:600">${escapeHtml(lastAnalysis.intent_level || '')}</span></div>
      <div class="analysis-row"><span class="analysis-k">Acción recomendada</span><span style="color:#00ff88">${escapeHtml(lastAnalysis.recommended_action || '')}</span></div>
      <div class="analysis-row"><span class="analysis-k">Timing</span><span>${escapeHtml(lastAnalysis.recommended_timing || '')}</span></div>
      <div class="analysis-row"><span class="analysis-k">Razón</span><span>${escapeHtml(lastAnalysis.strategic_reason || '')}</span></div>
      ${lastAnalysis.suggested_reply ? `<div class="suggested-reply"><div class="sr-label">Respuesta sugerida</div><div class="sr-text">${escapeHtml(lastAnalysis.suggested_reply)}</div><button class="btn-copy-reply secondary">Copiar respuesta</button></div>` : ''}
    </div>`;
  }

  return `
    <div class="conv-input">
      <label style="margin-bottom:8px">Pegar respuesta del prospecto
        <select id="conv-channel" style="width:auto;display:inline-block;margin-left:8px">
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
          <option value="instagram">Instagram</option>
          <option value="llamada">Llamada</option>
          <option value="otro">Otro</option>
        </select>
      </label>
      <textarea id="conv-reply" placeholder="Pega aquí la respuesta del prospecto..." rows="3"></textarea>
      <button id="btn-analyze-reply" class="primary" style="margin-top:8px;width:100%">Analizar respuesta</button>
    </div>
    ${analysisHtml}`;
}

function buildFollowUpSection(lead, timeline) {
  const followups = timeline.filter(t => t.source === 'followup');
  if (!followups.length) return `<div class="s" style="color:#888;padding:8px 0">Sin seguimientos programados.</div>
    <button id="btn-gen-followup" class="primary" style="width:100%">Generar recomendación de seguimiento</button>`;

  const items = followups.map(f => {
    const statusBadge = f.status === 'pending' ? '<span class="fu-badge pending">Pendiente</span>' : f.status === 'sent' ? '<span class="fu-badge sent">Enviado</span>' : '<span class="fu-badge dismissed">Descartado</span>';
    const date = f.suggested_date ? new Date(f.suggested_date).toLocaleDateString() : '';
    return `<div class="fu-item" data-fid="${f.id}">
      <div class="fu-header">${statusBadge} <span class="fu-type">${escapeHtml(f.followup_type || f.objective || '')}</span> ${date ? `<span class="fu-date">${date}</span>` : ''}</div>
      <div class="fu-message">${escapeHtml(f.message || '')}</div>
      ${f.strategic_reason ? `<div class="fu-reason">${escapeHtml(f.strategic_reason)}</div>` : ''}
      ${f.status === 'pending' ? `<div class="fu-actions"><button class="btn-fu-copy" data-msg="${escapeHtml(f.message || '')}">Copiar</button><button class="btn-fu-sent" data-fid="${f.id}">Marcar enviado</button><button class="btn-fu-dismiss" data-fid="${f.id}">Descartar</button></div>` : ''}
    </div>`;
  }).join('');

  return `${items}<button id="btn-gen-followup" class="primary" style="width:100%;margin-top:10px">Generar nueva recomendación</button>`;
}

function buildActivityHistory(messages, timeline) {
  const allEvents = [
    ...messages.map(m => ({ type: 'message', content: m.content, kind: m.kind, created_at: m.created_at, direction: 'outbound' })),
    ...timeline.filter(t => t.source === 'event').map(e => ({ type: e.type || e.event_type, content: e.content, direction: e.direction, channel: e.channel, status_after: e.status_after, created_at: e.created_at }))
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (!allEvents.length) return '<div class="s" style="color:#888">Sin actividad registrada.</div>';

  const EVENT_ICONS = {
    strategy_generated: '◆', message_generated: '✎', message_sent: '→', reply_pasted: '←',
    reply_analyzed: '◎', followup_generated: '↻', tone_rewrite: '♪', status_changed: '●', message: '→'
  };

  return `<div class="timeline">${allEvents.slice(0, 50).map(e => {
    const icon = EVENT_ICONS[e.type] || '·';
    const dirClass = e.direction === 'inbound' ? 'tl-inbound' : e.direction === 'outbound' ? 'tl-outbound' : 'tl-system';
    const date = new Date(e.created_at).toLocaleString();
    const label = e.kind || e.type || '';
    return `<div class="tl-event ${dirClass}">
      <span class="tl-icon">${icon}</span>
      <div class="tl-body">
        <div class="tl-meta">${escapeHtml(label)} ${e.channel ? '· ' + e.channel : ''} · ${date}</div>
        ${e.content ? `<div class="tl-content">${escapeHtml(String(e.content).slice(0, 200))}</div>` : ''}
        ${e.status_after ? `<div class="tl-status">→ ${STATUS_LABELS[e.status_after] || e.status_after}</div>` : ''}
      </div>
    </div>`;
  }).join('')}</div>`;
}

function bindLeadDetailEvents(id, lead, strategy, parsed, wa, emailSubject, emailBody, ig, loom, legacy) {
  // Accordion
  $$('.accordion-header').forEach(h => h.onclick = () => h.parentElement.classList.toggle('open'));

  // Close
  $('.close').onclick = () => $('#modal-lead').classList.add('hidden');

  // Enrich
  const enrichBtn = $('.btn-enrich');
  if (enrichBtn) enrichBtn.onclick = async () => {
    enrichBtn.disabled = true; enrichBtn.textContent = 'Buscando…';
    try { await api(`/api/leads/${id}/enrich`, { method: 'POST' }); toast('Datos actualizados'); openLead(id); }
    catch (e) { toast('Error: ' + e.message.slice(0,80), true); enrichBtn.disabled = false; enrichBtn.textContent = 'Buscar en Google'; }
  };

  // Strategy generation
  const btnStrat = $('#btn-gen-strategy');
  if (btnStrat) btnStrat.onclick = async () => {
    btnStrat.disabled = true; btnStrat.textContent = 'Generando…';
    try {
      const angle = $('#str-angle')?.value || '';
      const tone = $('#str-tone')?.value || 'Consultivo';
      await api(`/api/leads/${id}/strategy`, { method: 'POST', body: JSON.stringify({ angle, tone }) });
      toast('Estrategia generada');
      openLead(id);
    } catch (e) { toast('Error: ' + e.message.slice(0,80), true); btnStrat.disabled = false; btnStrat.textContent = 'Generar estrategia'; }
  };

  // Message generation (auto-generates strategy if needed)
  const btnMsg = $('#btn-gen-message');
  if (btnMsg) btnMsg.onclick = async () => {
    btnMsg.disabled = true; btnMsg.textContent = 'Generando…';
    try {
      if (!strategy) {
        btnMsg.textContent = 'Generando estrategia…';
        await api(`/api/leads/${id}/strategy`, { method: 'POST', body: JSON.stringify({}) });
      }
      btnMsg.textContent = 'Generando mensaje…';
      await api(`/api/leads/${id}/outreach-message`, { method: 'POST', body: JSON.stringify({}) });
      toast('Estrategia y mensaje generados');
      openLead(id);
    } catch (e) { toast('Error: ' + e.message.slice(0,80), true); btnMsg.disabled = false; btnMsg.textContent = 'Generar mensaje con estrategia'; }
  };

  // Tabs
  let activeCh = 'whatsapp';
  $$('.tab').forEach(t => t.onclick = () => {
    $$('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    activeCh = t.dataset.ch;
    $$('.ch-panel').forEach(p => p.classList.remove('active'));
    const panel = $('#ch-' + activeCh);
    if (panel) panel.classList.add('active');
  });

  // Copy buttons
  $$('.cp-btn').forEach(b => b.onclick = async () => {
    const key = b.dataset.cp;
    let text;
    if (key === 'email') text = `Asunto: ${$('#t-email-subject')?.value || ''}\n\n${$('#t-email')?.value || ''}`;
    else text = $('#' + key)?.value || '';
    await navigator.clipboard.writeText(text);
    toast('Copiado');
    try { await api(`/api/conversations/${id}/events`, { method: 'POST', body: JSON.stringify({ event_type: 'message_copied', channel: activeCh, direction: 'outbound', content: text.slice(0, 100) }) }); } catch {}
  });

  const getChannelContent = () => {
    if (activeCh === 'email') return `Asunto: ${$('#t-email-subject')?.value || ''}\n\n${$('#t-email')?.value || ''}`;
    return $('#t-' + activeCh)?.value || '';
  };
  const buildMessagesJSON = () => JSON.stringify({
    email: { subject: $('#t-email-subject')?.value || emailSubject, body: $('#t-email')?.value || emailBody },
    whatsapp: $('#t-whatsapp')?.value || wa,
    instagram_dm: $('#t-instagram_dm')?.value || ig,
    loom_script: $('#t-loom_script')?.value || loom
  });

  // Tone style buttons
  $$('.btn-style').forEach(b => b.onclick = async () => {
    b.disabled = true; const orig = b.textContent; b.textContent = '…';
    try {
      const r = await api(`/api/leads/${id}/rewrite-tone`, { method: 'POST', body: JSON.stringify({ style: b.dataset.style }) });
      toast('Mensaje ajustado');
      openLead(id);
    } catch (e) { toast('Error: ' + e.message.slice(0,80), true); b.disabled = false; b.textContent = orig; }
  });

  // Copy active channel
  const dCopy = $('#d-copy');
  if (dCopy) dCopy.onclick = async () => {
    await navigator.clipboard.writeText(getChannelContent());
    toast(`Copiado (${activeCh})`);
    try { await api(`/api/conversations/${id}/events`, { method: 'POST', body: JSON.stringify({ event_type: 'message_copied', channel: activeCh, direction: 'outbound' }) }); } catch {}
  };

  // Open profile
  const dOpen = $('#d-open');
  if (dOpen) dOpen.onclick = async () => {
    try {
      await navigator.clipboard.writeText(getChannelContent());
      window.open(lead.profile_url, '_blank');
      toast('Copiado · pega con Ctrl+V');
    } catch (e) { toast('Error: ' + e.message, true); }
  };

  // Mark sent
  const dSent = $('#d-sent');
  if (dSent) dSent.onclick = async () => {
    await api(`/api/leads/${id}/mark-sent`, { method: 'POST', body: JSON.stringify({ channel: activeCh, content: getChannelContent() }) });
    toast('Marcado como enviado');
    $('#modal-lead').classList.add('hidden');
    loadAll();
  };

  // Follow-up
  const dFollowup = $('#d-followup');
  if (dFollowup) dFollowup.onclick = async () => {
    toast('Generando sugerencia…');
    try {
      await api(`/api/leads/${id}/followup`, { method: 'POST' });
      toast('Seguimiento sugerido');
      openLead(id);
    } catch (e) { toast('Error: ' + e.message.slice(0,80), true); }
  };

  // Generate followup button (in section)
  const btnFu = $('#btn-gen-followup');
  if (btnFu) btnFu.onclick = async () => {
    btnFu.disabled = true; btnFu.textContent = 'Generando…';
    try {
      await api(`/api/leads/${id}/followup`, { method: 'POST' });
      toast('Seguimiento sugerido');
      openLead(id);
    } catch (e) { toast('Error: ' + e.message.slice(0,80), true); btnFu.disabled = false; btnFu.textContent = 'Generar recomendación'; }
  };

  // Analyze reply
  const btnAnalyze = $('#btn-analyze-reply');
  if (btnAnalyze) btnAnalyze.onclick = async () => {
    const replyText = $('#conv-reply')?.value?.trim();
    if (!replyText) return toast('Pega la respuesta del prospecto', true);
    const channel = $('#conv-channel')?.value || 'whatsapp';
    btnAnalyze.disabled = true; btnAnalyze.textContent = 'Analizando…';
    try {
      await api(`/api/leads/${id}/analyze-reply`, { method: 'POST', body: JSON.stringify({ reply_text: replyText, channel }) });
      toast('Respuesta analizada');
      openLead(id);
    } catch (e) { toast('Error: ' + e.message.slice(0,80), true); btnAnalyze.disabled = false; btnAnalyze.textContent = 'Analizar respuesta'; }
  };

  // Copy suggested reply
  const btnCopyReply = $('.btn-copy-reply');
  if (btnCopyReply) btnCopyReply.onclick = async () => {
    const text = $('.sr-text')?.textContent || '';
    await navigator.clipboard.writeText(text);
    toast('Respuesta copiada');
  };

  // Follow-up item actions
  $$('.btn-fu-copy').forEach(b => b.onclick = async () => {
    await navigator.clipboard.writeText(b.dataset.msg);
    toast('Copiado');
  });
  $$('.btn-fu-sent').forEach(b => b.onclick = async () => {
    await api(`/api/conversations/${id}/followup/${b.dataset.fid}`, { method: 'PATCH', body: JSON.stringify({ marked_as_sent: true, status: 'sent' }) });
    toast('Seguimiento marcado como enviado');
    openLead(id);
  });
  $$('.btn-fu-dismiss').forEach(b => b.onclick = async () => {
    await api(`/api/conversations/${id}/followup/${b.dataset.fid}`, { method: 'PATCH', body: JSON.stringify({ status: 'dismissed' }) });
    toast('Descartado');
    openLead(id);
  });

  // Save
  $('#d-save').onclick = async () => {
    const body = { notes: $('#d-notes').value, status: $('#d-status').value };
    if (parsed) body.suggested_message = buildMessagesJSON();
    else body.suggested_message = $('#t-whatsapp')?.value || '';
    await api(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    if (body.status !== lead.status) {
      try { await api(`/api/conversations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: body.status }) }); } catch {}
    }
    toast('Guardado');
    $('#modal-lead').classList.add('hidden');
    loadAll();
  };

  // Delete
  $('#d-delete').onclick = async () => {
    if (!confirm('¿Borrar este lead?')) return;
    await api(`/api/leads/${id}`, { method: 'DELETE' });
    toast('Lead borrado');
    $('#modal-lead').classList.add('hidden');
    loadAll();
  };

  // Translate
  const doTranslate = async (target) => {
    toast('Traduciendo…');
    await api(`/api/leads/${id}/translate`, { method: 'POST', body: JSON.stringify({ target }) });
    toast(target === 'en' ? 'Traducido a inglés' : 'Traducido a español');
    openLead(id);
  };
  $('#d-translate-es').onclick = () => doTranslate('es');
  $('#d-translate-en').onclick = () => doTranslate('en');
}

function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

const PIPELINE_LABELS = {
  negocio_local_real: 'Negocio local real',
  activo: 'Activo',
  comercialmente_solido: 'Comercialmente sólido',
  depende_digital: 'Depende del digital',
  intencion_captar: 'Intención de captar',
  friccion_conversion: 'Fricción/mejora en conversión',
  score_final: 'Puntuación final'
};

function buildPipelineHtml(raw) {
  if (!raw) return '';
  let steps;
  try { steps = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return ''; }
  if (!Array.isArray(steps) || !steps.length) return '';
  const rows = steps.map(s => {
    const icon = s.step === 7 ? '◆' : (s.pass ? '✓' : '✗');
    const iconCls = s.step === 7 ? 'pipe-final' : (s.pass ? 'pipe-pass' : 'pipe-fail');
    const label = PIPELINE_LABELS[s.name] || s.name;
    return `<div class="pipe-step"><span class="pipe-icon ${iconCls}">${icon}</span><span class="pipe-label">${escapeHtml(label)}</span><span class="pipe-reason">${escapeHtml(s.reason || '')}</span></div>`;
  }).join('');
  return `<div class="pipeline"><h3 style="color:#aaa;font-size:12px;text-transform:uppercase;margin:12px 0 6px">Pipeline de calificación</h3>${rows}</div>`;
}

// Settings
async function loadSettings() {
  const s = await api('/api/settings');
  const fields = [
    ['apify_token_tail', 'Token de acceso', 'input', true],
    ['anthropic_key_tail', 'Clave del copiloto', 'input', true],
    ['delay_min_seconds', 'Delay mínimo entre mensajes (seg)', 'input'],
    ['delay_max_seconds', 'Delay máximo (seg)', 'input'],
    ['followup_days_1', 'Días hasta 1er seguimiento', 'input'],
    ['followup_days_2', 'Días hasta 2do seguimiento', 'input'],
    ['max_followups', 'Máximo seguimientos por lead', 'input'],
    ['min_score', 'Puntuacion minima', 'input'],
    ['base_template', 'Mensaje de presentación base', 'textarea'],
    ['qualification_criteria', 'Criterios de oportunidad ideal', 'textarea'],
    ['my_company_info', 'Info de mi servicio', 'textarea']
  ];
  const presetSections = [
    ['presets_service_offered', 'Servicios ofrecidos'],
    ['presets_main_benefit', 'Beneficios principales'],
    ['presets_key_differential', 'Diferenciales clave']
  ];
  const presetsHtml = presetSections.map(([key, label]) => {
    let items = [];
    try { items = JSON.parse(s[key] || '[]'); } catch {}
    const itemsHtml = items.map((v, i) => `<div class="preset-item" data-key="${key}" data-idx="${i}"><span>${escapeHtml(v)}</span><button type="button" class="preset-del" data-key="${key}" data-idx="${i}">✕</button></div>`).join('') || '<div style="color:#555;font-size:11px">Sin opciones guardadas</div>';
    return `<div class="preset-section"><h3 style="color:#00ff88;font-size:13px;margin:16px 0 8px">${label}</h3>${itemsHtml}<div class="preset-add-row"><input class="preset-new-input" data-key="${key}" placeholder="Agregar nuevo…"/><button type="button" class="btn-add-preset-settings primary" data-key="${key}">+</button></div></div>`;
  }).join('');

  $('#settings-form').innerHTML = fields.map(([k, label, type, masked]) => {
    const val = s[k] || '';
    if (type === 'textarea') return `<label>${label}<textarea name="${k}">${escapeHtml(val)}</textarea></label>`;
    return `<label>${label}<input name="${k}" value="${escapeHtml(masked ? maskToken(val) : val)}" ${masked?'data-masked="1"':''}/></label>`;
  }).join('') + `<hr style="border-color:#2a2a2a;margin:20px 0"><h2 style="font-size:15px;color:#ccc;margin-bottom:4px">Presets de búsqueda</h2><p style="color:#555;font-size:11px;margin:0 0 10px">Estas opciones aparecen precargadas al crear una nueva búsqueda.</p>${presetsHtml}<hr style="border-color:#2a2a2a;margin:20px 0"><button class="primary" type="submit">Guardar configuración</button>`;
}
function maskToken(v) { return v && v.length > 8 ? '••••' + v.slice(-4) : v; }

$('#settings-form').addEventListener('click', async (e) => {
  const del = e.target.closest('.preset-del');
  if (del) {
    const key = del.dataset.key;
    const idx = Number(del.dataset.idx);
    const s = await api('/api/settings');
    let items = [];
    try { items = JSON.parse(s[key] || '[]'); } catch {}
    items.splice(idx, 1);
    await api('/api/settings', { method: 'POST', body: JSON.stringify({ [key]: JSON.stringify(items) }) });
    toast('Eliminado');
    loadSettings();
    loadPresets();
    return;
  }
  const add = e.target.closest('.btn-add-preset-settings');
  if (add) {
    const key = add.dataset.key;
    const input = $(`.preset-new-input[data-key="${key}"]`);
    const val = input?.value?.trim();
    if (!val) return toast('Escribe un valor', true);
    const s = await api('/api/settings');
    let items = [];
    try { items = JSON.parse(s[key] || '[]'); } catch {}
    if (items.includes(val)) return toast('Ya existe');
    items.push(val);
    await api('/api/settings', { method: 'POST', body: JSON.stringify({ [key]: JSON.stringify(items) }) });
    toast('Agregado');
    loadSettings();
    loadPresets();
  }
});

$('#settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {};
  [...e.target.elements].forEach(el => {
    if (!el.name) return;
    if (el.dataset.masked === '1' && el.value.startsWith('••••')) return;
    data[el.name] = el.value;
  });
  await api('/api/settings', { method: 'POST', body: JSON.stringify(data) });
  toast('Configuración guardada'); loadSettings();
});

// Nav
$$('nav button[data-view]').forEach(b => b.onclick = () => {
  $$('nav button[data-view]').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  $$('.view').forEach(v => v.classList.remove('active'));
  $('#view-' + b.dataset.view).classList.add('active');
  if (b.dataset.view === 'settings') loadSettings();
});

// Filters
['f-platform', 'f-status', 'f-score', 'f-campaign', 'f-web'].forEach(id => $('#' + id).addEventListener('change', () => {
  state.filters = { platform: $('#f-platform').value, status: $('#f-status').value, minScore: $('#f-score').value, campaignId: $('#f-campaign').value, hasWebsite: $('#f-web').value };
  loadLeads();
}));
$('#btn-refresh').onclick = loadAll;
$('#btn-export').onclick = () => {
  const q = new URLSearchParams();
  const f = state.filters || {};
  if (f.platform) q.set('platform', f.platform);
  if (f.status) q.set('status', f.status);
  if (f.minScore) q.set('minScore', f.minScore);
  if (f.campaignId) q.set('campaignId', f.campaignId);
  if (f.hasWebsite) q.set('hasWebsite', f.hasWebsite);
  window.location = '/api/leads/export.csv?' + q;
};
$('#btn-score').onclick = async () => {
  toast('Analizando…');
  const r = await api('/api/leads/score-pending', { method: 'POST' });
  toast(`${r.done} analizados · ${r.failed} fallos · ${r.remaining} pendientes`);
  loadAll();
};

// Prompt parsing
$('#btn-parse-prompt').onclick = async () => {
  const prompt = $('#campaign-prompt').value.trim();
  if (!prompt) return toast('Escribe qué quieres buscar', true);
  const status = $('#prompt-status');
  const btn = $('#btn-parse-prompt');
  btn.disabled = true;
  btn.textContent = 'Analizando...';
  status.textContent = 'Interpretando tu búsqueda...';
  status.style.color = '#888';
  try {
    const parsed = await api('/api/campaigns/prompt', { method: 'POST', body: JSON.stringify({ prompt }) });
    const form = $('#modal-campaign form');
    if (parsed.platform) form.elements.platform.value = parsed.platform;
    if (parsed.niche) form.elements.niche.value = parsed.niche;
    if (parsed.location) form.elements.location.value = parsed.location;
    if (parsed.keywords) form.elements.keywords.value = parsed.keywords;
    if (parsed.language) form.elements.language.value = parsed.language;
    if (parsed.maxLeads) form.elements.maxLeads.value = parsed.maxLeads;
    status.textContent = `Detectado: ${parsed.niche} en ${parsed.location || 'sin ubicación'} → ${PLATFORM_LABELS[parsed.platform] || parsed.platform} (${parsed.maxLeads} leads)`;
    status.style.color = '#00ff88';
    toast('Campos completados — revisa y lanza');
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
    status.style.color = '#ff6666';
    toast('No se pudo interpretar la búsqueda', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Analizar búsqueda';
  }
};

// Presets
const PRESET_KEYS = {
  serviceOffered: 'presets_service_offered',
  mainBenefit: 'presets_main_benefit',
  keyDifferential: 'presets_key_differential'
};
let presetsCache = {};

async function loadPresets() {
  const s = await api('/api/settings');
  for (const [field, key] of Object.entries(PRESET_KEYS)) {
    try { presetsCache[field] = JSON.parse(s[key] || '[]'); } catch { presetsCache[field] = []; }
  }
  populatePresetSelects();
}

function populatePresetSelects() {
  for (const [field, items] of Object.entries(presetsCache)) {
    const sel = $(`.preset-select[data-target="${field}"]`);
    if (!sel) continue;
    const current = sel.value;
    sel.innerHTML = '<option value="">-- Seleccionar guardado --</option>' +
      items.map((v, i) => `<option value="${i}">${escapeHtml(v.length > 60 ? v.slice(0, 57) + '...' : v)}</option>`).join('');
    sel.value = current;
  }
}

document.addEventListener('change', (e) => {
  const sel = e.target.closest('.preset-select');
  if (!sel) return;
  const field = sel.dataset.target;
  const idx = sel.value;
  if (idx === '' || !presetsCache[field]) return;
  const form = $('#modal-campaign form');
  if (form.elements[field]) form.elements[field].value = presetsCache[field][idx];
});

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-add-preset');
  if (!btn) return;
  const field = btn.dataset.field;
  const form = $('#modal-campaign form');
  const val = form.elements[field]?.value?.trim();
  if (!val) return toast('Escribe un valor primero', true);
  if (!presetsCache[field]) presetsCache[field] = [];
  if (presetsCache[field].includes(val)) return toast('Ya existe');
  presetsCache[field].push(val);
  const settingsKey = PRESET_KEYS[field];
  await api('/api/settings', { method: 'POST', body: JSON.stringify({ [settingsKey]: JSON.stringify(presetsCache[field]) }) });
  populatePresetSelects();
  toast('Guardado');
});

loadPresets();

// New campaign
$('#btn-new').onclick = () => openCampaignModal();
$('#modal-campaign .cancel').onclick = () => $('#modal-campaign').classList.add('hidden');
$('#modal-campaign form').onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd);
  data.maxLeads = Number(data.maxLeads);
  try {
    await api('/api/campaigns', { method: 'POST', body: JSON.stringify(data) });
    toast('Búsqueda lanzada — se ejecuta en segundo plano');
    $('#modal-campaign').classList.add('hidden');
    loadAll();
  } catch (err) { toast(err.message, true); }
};

// Click leads
document.addEventListener('click', (e) => {
  if (e.target.closest('.modal .card')) return;
  const el = e.target.closest('[data-id]');
  if (el && (el.classList.contains('card-lead') || el.tagName === 'TR')) openLead(el.dataset.id);
});

// Campaign actions
document.addEventListener('click', async (e) => {
  const del = e.target.closest('.btn-del-camp');
  if (del) {
    e.stopPropagation();
    if (!confirm('¿Borrar busqueda y todos sus leads?')) return;
    await api('/api/campaigns/' + del.dataset.id, { method: 'DELETE' });
    toast('Búsqueda borrada'); loadAll();
    return;
  }
  const dup = e.target.closest('.btn-dup-camp');
  if (dup) {
    e.stopPropagation();
    const src = (state.campaigns || []).find(c => c.id == dup.dataset.id);
    if (!src) return;
    openCampaignModal(src);
  }
});

function openCampaignModal(prefill = {}) {
  const form = $('#modal-campaign form');
  form.reset();
  const map = { platform:'platform', niche:'niche', location:'location', keywords:'keywords', language:'language', service_offered:'serviceOffered', main_benefit:'mainBenefit', key_differential:'keyDifferential', max_leads:'maxLeads' };
  for (const [src, field] of Object.entries(map)) {
    if (prefill[src] != null && form.elements[field]) form.elements[field].value = prefill[src];
  }
  if (!prefill.service_offered && presetsCache.serviceOffered?.[0]) form.elements.serviceOffered.value = presetsCache.serviceOffered[0];
  if (!prefill.main_benefit && presetsCache.mainBenefit?.[0]) form.elements.mainBenefit.value = presetsCache.mainBenefit[0];
  if (!prefill.key_differential && presetsCache.keyDifferential?.[0]) form.elements.keyDifferential.value = presetsCache.keyDifferential[0];
  $('#modal-campaign').classList.remove('hidden');
}

function anyRunning() { return (state.campaigns || []).some(c => c.status === 'running' || c.status === 'enriching'); }
setInterval(() => { anyRunning() ? loadAll() : loadMetrics(); }, 4000);

async function loadAll() {
  await Promise.all([loadMetrics(), loadLeads()]);
  await loadCampaigns();
}
loadAll();
