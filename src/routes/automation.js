import express from 'express';
import { db } from '../db/index.js';

export const automation = express.Router();

automation.post('/open/:id', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true, url: lead.profile_url, message: lead.suggested_message, platform: lead.platform });
});
