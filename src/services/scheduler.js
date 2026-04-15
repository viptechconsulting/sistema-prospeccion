import cron from 'node-cron';
import { db, getSetting } from '../db/index.js';
import { generateFollowup } from './scoring.js';

async function tick() {
  const days1 = Number(getSetting('followup_days_1')) || 3;
  const days2 = Number(getSetting('followup_days_2')) || 7;
  const maxF = Number(getSetting('max_followups')) || 2;

  const candidates = db.prepare(`
    SELECT * FROM leads
    WHERE status = 'mensaje_enviado'
      AND contacted_at IS NOT NULL
      AND followup_count < ?
      AND (
        (followup_count = 0 AND datetime(contacted_at, '+' || ? || ' days') <= datetime('now'))
        OR
        (followup_count >= 1 AND last_followup_at IS NOT NULL AND datetime(last_followup_at, '+' || ? || ' days') <= datetime('now'))
      )
  `).all(maxF, days1, days2);

  for (const lead of candidates) {
    try {
      const message = await generateFollowup(lead);
      db.prepare('INSERT INTO messages (lead_id, kind, content) VALUES (?,?,?)').run(lead.id, 'followup_pending', message);
      db.prepare(`UPDATE leads SET status = 'followup_pendiente', suggested_message = ? WHERE id = ?`).run(message, lead.id);
      console.log(`[scheduler] follow-up generado lead ${lead.id}`);
    } catch (e) {
      console.error(`[scheduler] fallo lead ${lead.id}:`, e.message);
    }
  }

  db.prepare(`
    UPDATE leads SET status = 'descartado'
    WHERE status IN ('mensaje_enviado','followup_pendiente')
      AND followup_count >= ?
      AND datetime(COALESCE(last_followup_at, contacted_at), '+' || ? || ' days') <= datetime('now')
  `).run(maxF, days2);
}

export function startScheduler() {
  cron.schedule('5 * * * *', () => tick().catch(e => console.error('scheduler tick', e)));
  console.log('[scheduler] running (hourly)');
}
