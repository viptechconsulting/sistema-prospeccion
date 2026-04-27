import express from 'express';
import { db } from '../db/index.js';
import { logEvent, updateLeadStatus } from '../services/strategy.js';

export const conversations = express.Router();

conversations.post('/:leadId/events', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.leadId);
  if (!lead) return res.status(404).json({ error: 'not found' });
  const { event_type, channel, direction, content, metadata } = req.body;
  if (!event_type) return res.status(400).json({ error: 'event_type required' });
  logEvent(lead.id, event_type, { channel, direction: direction || 'system', content, metadata });
  res.json({ ok: true });
});

conversations.get('/:leadId/timeline', (req, res) => {
  const leadId = req.params.leadId;
  const events = db.prepare('SELECT id, event_type as type, channel, direction, content, metadata, status_before, status_after, created_at FROM conversation_events WHERE lead_id = ? ORDER BY created_at ASC').all(leadId);
  const messages = db.prepare('SELECT id, kind, content, sent_at as created_at FROM messages WHERE lead_id = ? ORDER BY sent_at ASC').all(leadId);
  const analyses = db.prepare('SELECT id, reply_text, channel, lead_status, response_type, objection, intent_level, recommended_action, suggested_reply, recommended_timing, strategic_reason, created_at FROM conversation_analyses WHERE lead_id = ? ORDER BY created_at ASC').all(leadId);
  const followups = db.prepare('SELECT id, followup_type, suggested_date, message, objective, strategic_reason, copied, marked_as_sent, status, created_at FROM follow_up_recommendations WHERE lead_id = ? ORDER BY created_at ASC').all(leadId);

  const timeline = [
    ...events.map(e => ({ ...e, source: 'event' })),
    ...messages.map(m => ({ ...m, source: 'message', direction: 'outbound' })),
    ...analyses.map(a => ({ ...a, source: 'analysis', type: 'reply_analyzed', direction: 'inbound' })),
    ...followups.map(f => ({ ...f, source: 'followup', type: 'followup_recommendation' }))
  ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  res.json({ timeline, summary: { events: events.length, messages: messages.length, analyses: analyses.length, followups: followups.length } });
});

conversations.patch('/:leadId/status', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.leadId);
  if (!lead) return res.status(404).json({ error: 'not found' });
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });
  updateLeadStatus(lead.id, status);
  res.json({ ok: true });
});

conversations.patch('/:leadId/followup/:fid', (req, res) => {
  const { status, copied, marked_as_sent } = req.body;
  const sets = [];
  const args = [];
  if (status) { sets.push('status = ?'); args.push(status); }
  if (copied !== undefined) { sets.push('copied = ?'); args.push(copied ? 1 : 0); }
  if (marked_as_sent !== undefined) { sets.push('marked_as_sent = ?'); args.push(marked_as_sent ? 1 : 0); }
  if (!sets.length) return res.json({ ok: true });
  args.push(req.params.fid, req.params.leadId);
  db.prepare(`UPDATE follow_up_recommendations SET ${sets.join(', ')} WHERE id = ? AND lead_id = ?`).run(...args);
  if (marked_as_sent) {
    logEvent(Number(req.params.leadId), 'followup_sent', { content: 'Follow-up marcado como enviado' });
  }
  res.json({ ok: true });
});
