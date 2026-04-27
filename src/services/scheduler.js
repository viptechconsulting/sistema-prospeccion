import cron from 'node-cron';
import { db, getSetting } from '../db/index.js';
import { generateFollowup } from './scoring.js';
import { generateSmartFollowUp } from './strategy.js';

async function tick() {
  const days = [
    Number(getSetting('followup_days_1')) || 3,
    Number(getSetting('followup_days_2')) || 7,
    Number(getSetting('followup_days_3')) || 14
  ];
  const maxF = Number(getSetting('max_followups')) || 3;

  const all = db.prepare(`SELECT * FROM leads WHERE status IN ('contactado', 'mensaje_enviado') AND contacted_at IS NOT NULL AND followup_count < ?`).all(maxF);
  const now = Date.now();
  const candidates = all.filter(l => {
    const idx = l.followup_count || 0;
    const waitDays = days[idx];
    const from = new Date(l.last_followup_at || l.contacted_at).getTime();
    return now - from >= waitDays * 86400000;
  });

  for (const lead of candidates) {
    try {
      const hasStrategy = db.prepare('SELECT id FROM lead_strategies WHERE lead_id = ? LIMIT 1').get(lead.id);
      if (hasStrategy) {
        await generateSmartFollowUp(lead.id);
        console.log(`[scheduler] smart follow-up lead ${lead.id}`);
      } else {
        const campaign = lead.campaign_id ? db.prepare('SELECT * FROM campaigns WHERE id = ?').get(lead.campaign_id) : {};
        const messages = await generateFollowup(lead, campaign);
        db.prepare(`UPDATE leads SET status = 'followup_pendiente', suggested_message = ? WHERE id = ?`).run(JSON.stringify(messages), lead.id);
        console.log(`[scheduler] classic follow-up lead ${lead.id}`);
      }
    } catch (e) {
      console.error(`[scheduler] fallo lead ${lead.id}:`, e.message);
    }
  }

  db.prepare(`
    UPDATE leads SET status = 'cerrado_perdido'
    WHERE status IN ('contactado','mensaje_enviado','followup_pendiente')
      AND followup_count >= ?
      AND datetime(COALESCE(last_followup_at, contacted_at), '+' || ? || ' days') <= datetime('now')
  `).run(maxF, days[days.length - 1]);
}

export function startScheduler() {
  cron.schedule('5 * * * *', () => tick().catch(e => console.error('scheduler tick', e)));
  console.log('[scheduler] running (hourly)');
}
