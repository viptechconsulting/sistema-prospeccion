import express from 'express';
import { db } from '../db/index.js';
import { scoreAllPending, generateFollowup, translateMessages } from '../services/scoring.js';
import { enrichFromGoogleMaps, enrichLead } from '../services/enrichment.js';
import { generateStrategy, generateOutreachMessage, rewriteMessageTone, analyzeProspectReply, generateSmartFollowUp, logEvent, updateLeadStatus } from '../services/strategy.js';
import { runAudit, getAudit, sendAuditChat, clearAuditChat } from '../services/audit.js';

export const leads = express.Router();

// ── Auditoría del sitio + chat con IA para corregirla ──────────────────
leads.get('/:id/audit', (req, res) => {
  try { res.json(getAudit(req.params.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
leads.post('/:id/audit', async (req, res) => {
  try { res.json({ audit: await runAudit(req.params.id) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
leads.post('/:id/audit-chat', async (req, res) => {
  const message = String(req.body?.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Escribe un mensaje' });
  try { res.json(await sendAuditChat(req.params.id, message)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
leads.delete('/:id/audit-chat', (req, res) => {
  clearAuditChat(req.params.id);
  res.json({ ok: true });
});

leads.get('/', (req, res) => {
  const { platform, status, minScore, campaignId, hasWebsite } = req.query;
  const where = [], args = [];
  if (platform) { where.push('platform = ?'); args.push(platform); }
  if (status) { where.push('status = ?'); args.push(status); }
  if (minScore) { where.push('score >= ?'); args.push(Number(minScore)); }
  if (campaignId) { where.push('campaign_id = ?'); args.push(Number(campaignId)); }
  if (hasWebsite === 'yes') where.push("website IS NOT NULL AND website != ''");
  if (hasWebsite === 'no') where.push("(website IS NULL OR website = '')");
  const sql = `SELECT * FROM leads ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY score DESC NULLS LAST, id DESC LIMIT 500`;
  res.json(db.prepare(sql).all(...args));
});

leads.post('/:id/enrich', async (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'not found' });
  try {
    const campaign = lead.campaign_id ? db.prepare('SELECT * FROM campaigns WHERE id = ?').get(lead.campaign_id) : {};
    let gmaps = null;
    if (!lead.rating) {
      gmaps = await enrichFromGoogleMaps(lead, campaign);
    }
    const r = await enrichLead(lead, campaign);
    res.json({ ok: true, gmaps, ...r });
  } catch (e) {
    console.error(`[enrich] lead ${lead.id} failed:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

leads.post('/enrich-all', async (_req, res) => {
  const pending = db.prepare('SELECT l.*, c.location FROM leads l LEFT JOIN campaigns c ON l.campaign_id = c.id WHERE l.score IS NULL').all();
  res.json({ started: true, total: pending.length });
  (async () => {
    for (const lead of pending) {
      try {
        const campaign = lead.campaign_id ? db.prepare('SELECT * FROM campaigns WHERE id = ?').get(lead.campaign_id) : {};
        await enrichLead(lead, campaign);
        console.log(`[enrich-all] lead ${lead.id} done`);
      } catch (e) { console.error(`[enrich-all] lead ${lead.id} failed:`, e.message); }
    }
    console.log(`[enrich-all] finished ${pending.length} leads`);
  })();
});

leads.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM messages WHERE lead_id = ?').run(req.params.id);
  db.prepare('DELETE FROM lead_audits WHERE lead_id = ?').run(req.params.id);
  db.prepare('DELETE FROM lead_audit_chat WHERE lead_id = ?').run(req.params.id);
  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

leads.get('/metrics', (_req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS n FROM leads').get().n;
  const byStatus = db.prepare('SELECT status, COUNT(*) AS n FROM leads GROUP BY status').all();
  const contacted = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE contacted_at IS NOT NULL").get().n;
  const meetings = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE status IN ('demo_agendada','reunion_agendada')").get().n;
  const responded = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE status IN ('demo_agendada','reunion_agendada','respondio','interesado')").get().n;
  const responseRate = contacted ? (responded / contacted) : 0;
  const strategies = db.prepare('SELECT COUNT(*) AS n FROM lead_strategies').get().n;
  const messagesGenerated = db.prepare("SELECT COUNT(*) AS n FROM conversation_events WHERE event_type = 'message_generated'").get().n;
  const repliesReceived = db.prepare("SELECT COUNT(*) AS n FROM conversation_events WHERE event_type = 'reply_analyzed'").get().n;
  const demosProposed = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE status = 'demo_propuesta'").get().n;
  const demosScheduled = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE status IN ('demo_agendada','reunion_agendada')").get().n;
  const followupsPending = db.prepare("SELECT COUNT(*) AS n FROM follow_up_recommendations WHERE status = 'pending'").get().n;
  const interested = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE status = 'interesado'").get().n;
  const won = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE status = 'cerrado_ganado'").get().n;
  const toReactivate = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE status = 'reactivar_despues'").get().n;
  res.json({ total, contacted, meetings, responseRate, byStatus, strategies, messagesGenerated, repliesReceived, demosProposed, demosScheduled, followupsPending, interested, won, toReactivate });
});

leads.get('/:id', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'not found' });
  const messages = db.prepare('SELECT * FROM messages WHERE lead_id = ? ORDER BY id ASC').all(req.params.id);
  res.json({ lead, messages });
});

leads.patch('/:id', (req, res) => {
  const fields = ['status', 'notes', 'suggested_message'].filter(k => k in req.body);
  if (!fields.length) return res.json({ ok: true });
  const sql = `UPDATE leads SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`;
  db.prepare(sql).run(...fields.map(f => req.body[f]), req.params.id);
  res.json({ ok: true });
});

leads.post('/score-pending', async (_req, res) => {
  const r = await scoreAllPending(50);
  res.json(r);
});

leads.post('/:id/mark-sent', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'not found' });
  const { channel = 'whatsapp', content = '' } = req.body;
  const isFollowup = ['followup_pendiente', 'contactado'].includes(lead.status) && (lead.followup_count || 0) > 0;
  const kind = isFollowup ? `followup_${lead.followup_count + 1}_${channel}` : `initial_${channel}`;
  db.prepare('INSERT INTO messages (lead_id, kind, content) VALUES (?,?,?)').run(lead.id, kind, content);
  if (isFollowup) {
    db.prepare("UPDATE leads SET status = 'contactado', last_followup_at = CURRENT_TIMESTAMP, followup_count = followup_count + 1 WHERE id = ?").run(lead.id);
  } else {
    db.prepare("UPDATE leads SET status = 'contactado', contacted_at = CURRENT_TIMESTAMP WHERE id = ?").run(lead.id);
  }
  logEvent(lead.id, 'message_sent', { channel, direction: 'outbound', content: content.slice(0, 200), statusAfter: 'contactado' });
  res.json({ ok: true });
});

leads.post('/:id/translate', async (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'not found' });
  const target = req.body.target === 'en' ? 'en' : 'es';
  let current;
  try { current = JSON.parse(lead.suggested_message); } catch { current = { whatsapp: lead.suggested_message || '' }; }
  const translated = await translateMessages(current, target);
  db.prepare('UPDATE leads SET suggested_message = ? WHERE id = ?').run(JSON.stringify(translated), lead.id);
  res.json({ ok: true, messages: translated });
});

leads.post('/:id/followup', async (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'not found' });
  try {
    const result = await generateSmartFollowUp(lead.id);
    res.json({ ok: true, ...result });
  } catch (e) {
    const campaign = lead.campaign_id ? db.prepare('SELECT * FROM campaigns WHERE id = ?').get(lead.campaign_id) : {};
    const messages = await generateFollowup(lead, campaign);
    db.prepare("UPDATE leads SET suggested_message = ?, status = 'followup_pendiente' WHERE id = ?").run(JSON.stringify(messages), lead.id);
    res.json({ ok: true, messages });
  }
});

leads.get('/:id/strategy', (req, res) => {
  const strategy = db.prepare('SELECT * FROM lead_strategies WHERE lead_id = ? ORDER BY id DESC LIMIT 1').get(req.params.id);
  res.json({ strategy: strategy || null });
});

leads.post('/:id/strategy', async (req, res) => {
  try {
    const { angle, tone } = req.body || {};
    const result = await generateStrategy(Number(req.params.id), { angle, tone });
    res.json({ ok: true, strategy: result });
  } catch (e) {
    console.error('[strategy]', e.message);
    res.status(500).json({ error: e.message });
  }
});

leads.post('/:id/outreach-message', async (req, res) => {
  try {
    const { channel, tone } = req.body || {};
    const result = await generateOutreachMessage(Number(req.params.id), { channel, tone });
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[outreach-message]', e.message);
    res.status(500).json({ error: e.message });
  }
});

leads.post('/:id/rewrite-tone', async (req, res) => {
  try {
    const { style } = req.body || {};
    if (!style) return res.status(400).json({ error: 'style required' });
    const result = await rewriteMessageTone(Number(req.params.id), style);
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[rewrite-tone]', e.message);
    res.status(500).json({ error: e.message });
  }
});

leads.post('/:id/analyze-reply', async (req, res) => {
  try {
    const { reply_text, channel } = req.body || {};
    if (!reply_text) return res.status(400).json({ error: 'reply_text required' });
    const result = await analyzeProspectReply(Number(req.params.id), reply_text, channel);
    res.json({ ok: true, analysis: result });
  } catch (e) {
    console.error('[analyze-reply]', e.message);
    res.status(500).json({ error: e.message });
  }
});
