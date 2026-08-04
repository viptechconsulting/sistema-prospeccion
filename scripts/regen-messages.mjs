// Re-genera SOLO suggested_message de cada lead con el gatekeeper actual (rieles por canal).
// NO toca score ni status. scoreLead() no escribe DB por sí mismo; el único write es el UPDATE de abajo.
// Correr dentro del contenedor: node scripts/regen-messages.mjs
import { db } from '../src/db/index.js';
import { scoreLead } from '../src/services/scoring.js';

const leads = db.prepare('SELECT * FROM leads ORDER BY id').all();
const campStmt = db.prepare('SELECT * FROM campaigns WHERE id = ?');
const upd = db.prepare('UPDATE leads SET suggested_message = ? WHERE id = ?');

let ok = 0, skip = 0, fail = 0, review = 0;
for (const lead of leads) {
  try {
    const campaign = lead.campaign_id ? campStmt.get(lead.campaign_id) : {};
    const r = await scoreLead(lead, campaign);
    if (r.messages && Object.keys(r.messages).length) {
      upd.run(JSON.stringify(r.messages), lead.id);   // solo suggested_message
      ok++;
      const gk = r.validation?.passed ? 'pass' : 'REVIEW ' + JSON.stringify(r.validation?.byChannel || {});
      if (!r.validation?.passed) review++;
      console.log(`#${lead.id} ${(lead.company || lead.name || '').slice(0, 30)} · gatekeeper:${gk}`);
    } else {
      skip++;
      console.log(`#${lead.id} sin mensajes (score ${r.score}) → intacto`);
    }
  } catch (e) {
    fail++;
    console.log(`#${lead.id} ERROR ${e.message}`);
  }
}
console.log(`\n== regenerados:${ok}  intactos:${skip}  errores:${fail}  need_review:${review} ==`);
