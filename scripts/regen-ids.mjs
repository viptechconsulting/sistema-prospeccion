// Re-genera SOLO los leads cuyos IDs se pasan por CLI. Igual que regen-messages pero filtrado.
// Uso: node scripts/regen-ids.mjs 44 48 49 50 51 52 53 54 55
import { db } from '../src/db/index.js';
import { scoreLead } from '../src/services/scoring.js';

const ids = process.argv.slice(2).map(Number).filter(Boolean);
if (!ids.length) { console.log('sin IDs'); process.exit(0); }

const campStmt = db.prepare('SELECT * FROM campaigns WHERE id = ?');
const upd = db.prepare('UPDATE leads SET suggested_message = ? WHERE id = ?');
let ok = 0, fail = 0, review = 0;
for (const id of ids) {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  if (!lead) { console.log(`#${id} no existe`); continue; }
  try {
    const campaign = lead.campaign_id ? campStmt.get(lead.campaign_id) : {};
    const r = await scoreLead(lead, campaign);
    if (r.messages && Object.keys(r.messages).length) {
      upd.run(JSON.stringify(r.messages), id);
      ok++;
      const gk = r.validation?.passed ? 'pass' : 'REVIEW ' + JSON.stringify(r.validation?.byChannel || {});
      if (!r.validation?.passed) review++;
      console.log(`#${id} ${(lead.company || lead.name || '').slice(0, 28)} · gatekeeper:${gk}`);
    } else { console.log(`#${id} sin mensajes (score ${r.score}) → intacto`); }
  } catch (e) { fail++; console.log(`#${id} ERROR ${e.message}`); }
}
console.log(`\n== ok:${ok} review:${review} errores:${fail} ==`);
