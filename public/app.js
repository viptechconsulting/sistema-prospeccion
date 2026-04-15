const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const STATUS_LABELS = {
  por_contactar: 'Por contactar',
  mensaje_enviado: 'Mensaje enviado',
  followup_pendiente: 'Follow-up pendiente',
  reunion_agendada: 'Reunión agendada',
  descartado: 'Descartado',
  respondio: 'Respondió'
};
const PLATFORM_LABELS = { google_maps: 'Google Maps', linkedin: 'LinkedIn', instagram: 'Instagram' };

const state = { leads: [], filters: {} };

function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('err', err);
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2500);
}

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function loadMetrics() {
  const m = await api('/api/leads/metrics');
  $('#metrics').innerHTML = `
    <div class="metric"><div class="v">${m.total}</div><div class="l">Total leads</div></div>
    <div class="metric"><div class="v">${m.contacted}</div><div class="l">Contactados</div></div>
    <div class="metric"><div class="v">${(m.responseRate * 100).toFixed(1)}%</div><div class="l">Tasa respuesta</div></div>
    <div class="metric"><div class="v">${m.meetings}</div><div class="l">Reuniones</div></div>
  `;
}

async function loadLeads() {
  const q = new URLSearchParams();
  if (state.filters.platform) q.set('platform', state.filters.platform);
  if (state.filters.status) q.set('status', state.filters.status);
  if (state.filters.minScore) q.set('minScore', state.filters.minScore);
  state.leads = await api('/api/leads?' + q);
  renderKanban();
  renderTable();
}

function leadCard(l) {
  const scoreCls = (l.score || 0) >= 7 ? '' : 'low';
  return `<div class="card-lead" data-id="${l.id}">
    <div><span class="score ${scoreCls}">${l.score ?? '?'}</span><span class="t">${escapeHtml(l.name || '—')}</span></div>
    <div class="s">${escapeHtml(l.company || '')} · ${PLATFORM_LABELS[l.platform] || l.platform}</div>
  </div>`;
}

function renderKanban() {
  const cols = ['por_contactar', 'mensaje_enviado', 'followup_pendiente', 'reunion_agendada'];
  cols.forEach(s => {
    const items = state.leads.filter(l => l.status === s);
    const col = $(`.col[data-status="${s}"]`);
    $('.n', col).textContent = items.length;
    $('.items', col).innerHTML = items.map(leadCard).join('');
  });
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
      <td>${STATUS_LABELS[l.status] || l.status}</td>
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
  const { lead, messages } = await api(`/api/leads/${id}`);
  const msgHtml = messages.map(m => `<div class="msg-row"><div class="k">${m.kind} · ${new Date(m.sent_at).toLocaleString()}</div>${escapeHtml(m.content)}</div>`).join('') || '<div class="s">Sin mensajes aún</div>';
  const parsed = parseMessages(lead.suggested_message);
  const emailBody = parsed?.email?.body || '';
  const emailSubject = parsed?.email?.subject || '';
  const wa = parsed?.whatsapp || '';
  const ig = parsed?.instagram_dm || '';
  const loom = parsed?.loom_script || '';
  const legacy = parsed ? '' : (lead.suggested_message || '');

  $('.lead-detail').innerHTML = `
    <h2>${escapeHtml(lead.name || '—')} <button class="close">✕</button></h2>
    <div class="meta">${escapeHtml(lead.company || '')} · ${PLATFORM_LABELS[lead.platform]} · ${lead.profile_url ? `<a href="${lead.profile_url}" target="_blank" style="color:#00ff88">perfil ↗</a>` : ''} ${lead.email ? `· ✉ ${escapeHtml(lead.email)}` : ''} ${lead.phone ? `· ☎ ${escapeHtml(lead.phone)}` : ''}</div>
    <div><span class="score">${lead.score ?? '?'}</span> · <strong>${STATUS_LABELS[lead.status]}</strong> · Follow-ups: ${lead.followup_count || 0}</div>
    ${lead.score_reason ? `<div class="reason">${escapeHtml(lead.score_reason)}</div>` : ''}

    ${parsed ? `
    <div class="tabs">
      <button class="tab active" data-ch="whatsapp">WhatsApp</button>
      <button class="tab" data-ch="email">Email</button>
      <button class="tab" data-ch="instagram_dm">Instagram</button>
      <button class="tab" data-ch="loom_script">Loom Script</button>
    </div>
    <div id="ch-whatsapp" class="ch-panel active"><textarea id="t-whatsapp">${escapeHtml(wa)}</textarea></div>
    <div id="ch-email" class="ch-panel"><input id="t-email-subject" placeholder="Asunto" value="${escapeHtml(emailSubject)}"/><textarea id="t-email">${escapeHtml(emailBody)}</textarea></div>
    <div id="ch-instagram_dm" class="ch-panel"><textarea id="t-instagram_dm">${escapeHtml(ig)}</textarea></div>
    <div id="ch-loom_script" class="ch-panel"><textarea id="t-loom_script" style="min-height:300px">${escapeHtml(loom)}</textarea></div>
    ` : `<label>Mensaje sugerido<textarea id="t-whatsapp">${escapeHtml(legacy)}</textarea></label>`}

    <label>Notas<textarea id="d-notes">${escapeHtml(lead.notes || '')}</textarea></label>
    <label>Estado<select id="d-status">${Object.entries(STATUS_LABELS).map(([v,t])=>`<option value="${v}" ${v===lead.status?'selected':''}>${t}</option>`).join('')}</select></label>
    <div class="row">
      <button id="d-copy">Copiar canal activo</button>
      ${lead.profile_url ? `<button id="d-open" class="primary">Abrir perfil + copiar</button>` : ''}
      <button id="d-sent">Marcar enviado</button>
      <button id="d-followup">Generar follow-up</button>
      <button id="d-save">Guardar cambios</button>
    </div>
    <div class="history"><h3 style="color:#aaa;font-size:12px;text-transform:uppercase;margin-top:16px">Historial</h3>${msgHtml}</div>
  `;
  $('#modal-lead').classList.remove('hidden');

  let activeCh = 'whatsapp';
  $$('.tab').forEach(t => t.onclick = () => {
    $$('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    activeCh = t.dataset.ch;
    $$('.ch-panel').forEach(p => p.classList.remove('active'));
    $('#ch-' + activeCh).classList.add('active');
  });

  const getChannelContent = () => {
    if (activeCh === 'email') return `Asunto: ${$('#t-email-subject').value}\n\n${$('#t-email').value}`;
    return $('#t-' + activeCh).value;
  };
  const buildMessagesJSON = () => JSON.stringify({
    email: { subject: $('#t-email-subject')?.value || emailSubject, body: $('#t-email')?.value || emailBody },
    whatsapp: $('#t-whatsapp')?.value || wa,
    instagram_dm: $('#t-instagram_dm')?.value || ig,
    loom_script: $('#t-loom_script')?.value || loom
  });

  $('.close').onclick = () => $('#modal-lead').classList.add('hidden');
  $('#d-save').onclick = async () => {
    await api(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ suggested_message: parsed ? buildMessagesJSON() : $('#t-whatsapp').value, notes: $('#d-notes').value, status: $('#d-status').value }) });
    toast('Guardado'); $('#modal-lead').classList.add('hidden'); loadAll();
  };
  $('#d-copy').onclick = async () => { await navigator.clipboard.writeText(getChannelContent()); toast(`Copiado (${activeCh})`); };
  if ($('#d-open')) $('#d-open').onclick = async () => {
    try {
      await navigator.clipboard.writeText(getChannelContent());
      window.open(lead.profile_url, '_blank');
      toast('Copiado · pegá con Ctrl+V');
    } catch (e) { toast('Error: ' + e.message, true); }
  };
  $('#d-sent').onclick = async () => {
    await api(`/api/leads/${id}/mark-sent`, { method: 'POST', body: JSON.stringify({ channel: activeCh, content: getChannelContent() }) });
    toast('Marcado como enviado'); $('#modal-lead').classList.add('hidden'); loadAll();
  };
  $('#d-followup').onclick = async () => {
    toast('Generando follow-up…');
    await api(`/api/leads/${id}/followup`, { method: 'POST' });
    toast('Follow-up generado');
    openLead(id);
  };
}

async function loadSettings() {
  const s = await api('/api/settings');
  const fields = [
    ['apify_token_tail', 'Apify token', 'input', true],
    ['anthropic_key_tail', 'Anthropic API key', 'input', true],
    ['delay_min_seconds', 'Delay mínimo entre mensajes (seg)', 'input'],
    ['delay_max_seconds', 'Delay máximo (seg)', 'input'],
    ['followup_days_1', 'Días hasta 1er follow-up', 'input'],
    ['followup_days_2', 'Días hasta 2do follow-up', 'input'],
    ['max_followups', 'Máximo follow-ups por lead', 'input'],
    ['min_score', 'Score mínimo para no descartar', 'input'],
    ['base_template', 'Mensaje de presentación base', 'textarea'],
    ['qualification_criteria', 'Criterios de lead ideal', 'textarea'],
    ['my_company_info', 'Info de mi empresa/servicio', 'textarea']
  ];
  $('#settings-form').innerHTML = fields.map(([k, label, type, masked]) => {
    const val = s[k] || '';
    if (type === 'textarea') return `<label>${label}<textarea name="${k}">${escapeHtml(val)}</textarea></label>`;
    return `<label>${label}<input name="${k}" value="${escapeHtml(masked ? maskToken(val) : val)}" ${masked?'data-masked="1"':''}/></label>`;
  }).join('') + `<button class="primary" type="submit">Guardar</button>`;
}
function maskToken(v) { return v && v.length > 8 ? '••••' + v.slice(-4) : v; }

$('#settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {};
  [...e.target.elements].forEach(el => {
    if (!el.name) return;
    if (el.dataset.masked === '1' && el.value.startsWith('••••')) return;
    data[el.name] = el.value;
  });
  await api('/api/settings', { method: 'POST', body: JSON.stringify(data) });
  toast('Settings guardadas'); loadSettings();
});

// nav
$$('nav button[data-view]').forEach(b => b.onclick = () => {
  $$('nav button[data-view]').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  $$('.view').forEach(v => v.classList.remove('active'));
  $('#view-' + b.dataset.view).classList.add('active');
  if (b.dataset.view === 'settings') loadSettings();
});

// filters
['f-platform', 'f-status', 'f-score'].forEach(id => $('#' + id).addEventListener('change', () => {
  state.filters = { platform: $('#f-platform').value, status: $('#f-status').value, minScore: $('#f-score').value };
  loadLeads();
}));
$('#btn-refresh').onclick = loadAll;
$('#btn-score').onclick = async () => {
  toast('Calificando…');
  const r = await api('/api/leads/score-pending', { method: 'POST' });
  toast(`${r.done} calificados · ${r.failed} fallos · ${r.remaining} pendientes`);
  loadAll();
};

// new campaign
$('#btn-new').onclick = () => $('#modal-campaign').classList.remove('hidden');
$('#modal-campaign .cancel').onclick = () => $('#modal-campaign').classList.add('hidden');
$('#modal-campaign form').onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd);
  data.maxLeads = Number(data.maxLeads);
  try {
    await api('/api/campaigns', { method: 'POST', body: JSON.stringify(data) });
    toast('Campaña lanzada · se ejecuta en background');
    $('#modal-campaign').classList.add('hidden');
    setTimeout(loadAll, 2000);
  } catch (err) { toast(err.message, true); }
};

// click leads
document.addEventListener('click', (e) => {
  if (e.target.closest('.modal .card')) return;
  const el = e.target.closest('[data-id]');
  if (el && (el.classList.contains('card-lead') || el.tagName === 'TR')) openLead(el.dataset.id);
});

function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function loadAll() { await Promise.all([loadMetrics(), loadLeads()]); }
loadAll();
setInterval(loadMetrics, 15000);
