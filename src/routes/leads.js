import express from 'express';
import { db } from '../db/index.js';
import { scoreAllPending, generateFollowup } from '../services/scoring.js';

export const leads = express.Router();

leads.get('/', (req, res) => {
  const { platform, status, minScore, campaignId } = req.query;
  const where = [], args = [];
  if (platform) { where.push('platform = ?'); args.push(platform); }
  if (status) { where.push('status = ?'); args.push(status); }
  if (minScore) { where.push('score >= ?'); args.push(Number(minScore)); }
  if (campaignId) { where.push('campaign_id = ?'); args.push(Number(campaignId)); }
  const sql = `SELECT * FROM leads ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY score DESC NULLS LAST, id DESC LIMIT 500`;
  res.json(db.prepare(sql).all(...args));
});

leads.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM messages WHERE lead_id = ?').run(req.params.id);
  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

leads.get('/metrics', (_req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS n FROM leads').get().n;
  const byStatus = db.prepare('SELECT status, COUNT(*) AS n FROM leads GROUP BY status').all();
  const contacted = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE contacted_at IS NOT NULL").get().n;
  const meetings = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE status = 'reunion_agendada'").get().n;
  const responded = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE status IN ('reunion_agendada','respondio')").get().n;
  const responseRate = contacted ? (responded / contacted) : 0;
  res.json({ total, contacted, meetings, responseRate, byStatus });
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
  const isFollowup = lead.status === 'followup_pendiente' || (lead.followup_count || 0) > 0;
  const kind = isFollowup ? `followup_${lead.followup_count + 1}_${channel}` : `initial_${channel}`;
  db.prepare('INSERT INTO messages (lead_id, kind, content) VALUES (?,?,?)').run(lead.id, kind, content);
  if (isFollowup) {
    db.prepare("UPDATE leads SET status = 'mensaje_enviado', last_followup_at = CURRENT_TIMESTAMP, followup_count = followup_count + 1 WHERE id = ?").run(lead.id);
  } else {
    db.prepare("UPDATE leads SET status = 'mensaje_enviado', contacted_at = CURRENT_TIMESTAMP WHERE id = ?").run(lead.id);
  }
  res.json({ ok: true });
});

leads.post('/:id/followup', async (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'not found' });
  const campaign = lead.campaign_id ? db.prepare('SELECT * FROM campaigns WHERE id = ?').get(lead.campaign_id) : {};
  const messages = await generateFollowup(lead, campaign);
  db.prepare("UPDATE leads SET suggested_message = ?, status = 'followup_pendiente' WHERE id = ?").run(JSON.stringify(messages), lead.id);
  res.json({ ok: true, messages });
});
