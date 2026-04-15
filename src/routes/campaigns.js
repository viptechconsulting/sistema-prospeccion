import express from 'express';
import { db } from '../db/index.js';
import { runActor, normalizeLead } from '../services/apify.js';

export const campaigns = express.Router();

campaigns.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all();
  res.json(rows);
});

campaigns.post('/', async (req, res) => {
  const { platform, niche, location, keywords, maxLeads = 25, language = 'auto', serviceOffered = '', mainBenefit = '', keyDifferential = '' } = req.body;
  if (!platform) return res.status(400).json({ error: 'platform requerida' });

  const campaignId = db.prepare(
    'INSERT INTO campaigns (platform, niche, location, keywords, max_leads, language, service_offered, main_benefit, key_differential, status) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(platform, niche, location, keywords, maxLeads, language, serviceOffered, mainBenefit, keyDifferential, 'running').lastInsertRowid;

  res.json({ id: campaignId, status: 'running' });

  (async () => {
    try {
      const items = await runActor(platform, { niche, location, keywords, maxLeads });
      const insert = db.prepare(`INSERT OR IGNORE INTO leads
        (campaign_id, platform, name, company, profile_url, email, phone, raw_data)
        VALUES (?,?,?,?,?,?,?,?)`);
      const tx = db.transaction((arr) => {
        for (const r of arr) {
          const n = normalizeLead(platform, r);
          if (!n?.profile_url && !n?.email) continue;
          insert.run(campaignId, platform, n.name, n.company, n.profile_url, n.email, n.phone, JSON.stringify(r));
        }
      });
      tx(items);
      db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run('done', campaignId);
    } catch (err) {
      console.error('campaign failed', err);
      db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run(`error: ${err.message}`.slice(0, 200), campaignId);
    }
  })();
});

campaigns.get('/:id/leads', (req, res) => {
  const rows = db.prepare('SELECT * FROM leads WHERE campaign_id = ? ORDER BY score DESC NULLS LAST, id DESC').all(req.params.id);
  res.json(rows);
});
