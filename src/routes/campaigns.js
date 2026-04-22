import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db/index.js';
import { runActor, normalizeLead } from '../services/apify.js';
import { enrichLead } from '../services/enrichment.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const campaigns = express.Router();

campaigns.post('/prompt', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: 'prompt requerido' });

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: `Eres un parser de búsquedas de prospección. El usuario describe en lenguaje natural qué tipo de negocios/profesionales quiere buscar. Tu trabajo es extraer los parámetros estructurados para lanzar una búsqueda.

Responde SOLO con JSON válido, sin markdown ni explicaciones:
{
  "platform": "google_maps|linkedin|instagram|google_serp",
  "niche": "tipo de negocio/profesional",
  "location": "ciudad, estado/país",
  "keywords": "palabras clave adicionales o vacío",
  "maxLeads": número (default 25 si no se especifica),
  "language": "es|en|auto"
}

Reglas:
- Si menciona Google Maps, estrellas, reseñas, calificación, teléfono, dirección → platform = "google_maps"
- Si menciona LinkedIn, perfiles profesionales, empresas B2B → platform = "linkedin"
- Si menciona Instagram, perfiles sociales → platform = "instagram"
- Si menciona posicionamiento web, SEO, resultados de Google → platform = "google_serp"
- Si no especifica plataforma pero pide datos locales (teléfono, dirección, reseñas) → platform = "google_maps"
- Si no especifica cantidad, usa 25
- Detecta el idioma del prompt para "language"
- "niche" debe ser conciso: "dentistas", "spas", "agencias de marketing"
- "location": si el usuario menciona VARIAS ciudades, devolvé TODAS separadas por coma. Ejemplo: "Miami, Orlando, Tampa". Si es una sola, devolvé solo esa.`,
      messages: [{ role: 'user', content: prompt }]
    });

    let text = response.content[0].text.trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(text);

    if (!parsed.platform || !parsed.niche) {
      return res.status(400).json({ error: 'No se pudo extraer plataforma o nicho del prompt' });
    }

    res.json(parsed);
  } catch (err) {
    console.error('prompt parse failed', err);
    res.status(500).json({ error: 'Error parseando prompt: ' + err.message });
  }
});

campaigns.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all();
  res.json(rows);
});

campaigns.post('/', async (req, res) => {
  const { platform, niche, location, keywords, maxLeads = 25, language = 'auto', serviceOffered = '', mainBenefit = '', keyDifferential = '', serpStartPosition = 15 } = req.body;
  if (!platform) return res.status(400).json({ error: 'platform requerida' });

  const campaignId = db.prepare(
    'INSERT INTO campaigns (platform, niche, location, keywords, max_leads, language, service_offered, main_benefit, key_differential, status) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(platform, niche, location, keywords, maxLeads, language, serviceOffered, mainBenefit, keyDifferential, 'running').lastInsertRowid;

  res.json({ id: campaignId, status: 'running' });

  (async () => {
    try {
      const locations = location ? location.split(',').map(l => l.trim()).filter(Boolean) : [''];
      const perCity = Math.ceil(maxLeads / (locations.length || 1));
      let items = [];
      for (const loc of locations) {
        console.log(`[campaign ${campaignId}] scraping ${loc || 'sin ubicación'}…`);
        const cityItems = await runActor(platform, { niche, location: loc, keywords, maxLeads: perCity });
        items.push(...cityItems);
      }
      if (platform === 'google_serp') {
        const all = [];
        for (const page of items) {
          const organic = page.organicResults || page.results || [];
          all.push(...organic);
        }
        items = all.filter(r => (r.position || 0) >= Number(serpStartPosition)).slice(0, maxLeads);
      }
      const insert = db.prepare(`INSERT OR IGNORE INTO leads
        (campaign_id, platform, name, company, contact_person, profile_url, website, instagram_url, gmb_url, email, phone, rating, review_count, raw_data)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      const tx = db.transaction((arr) => {
        for (const r of arr) {
          const n = normalizeLead(platform, r);
          if (!n?.profile_url && !n?.email) continue;
          insert.run(campaignId, platform, n.name, n.company, n.contact_person, n.profile_url, n.website, n.instagram_url, n.gmb_url, n.email, n.phone, n.rating, n.review_count, JSON.stringify(r));
        }
      });
      tx(items);

      const insertedLeads = db.prepare('SELECT * FROM leads WHERE campaign_id = ? AND score IS NULL').all(campaignId);
      const campaignRow = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
      db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run('enriching', campaignId);

      let enriched = 0;
      for (const lead of insertedLeads) {
        try {
          await enrichLead(lead, campaignRow);
          enriched++;
          console.log(`[enrich] lead ${lead.id} (${lead.name}) done (${enriched}/${insertedLeads.length})`);
        } catch (e) {
          console.error(`[enrich] lead ${lead.id} failed:`, e.message);
        }
      }
      console.log(`[enrich] campaign ${campaignId}: ${enriched}/${insertedLeads.length} leads enriched`);
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

campaigns.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM messages WHERE lead_id IN (SELECT id FROM leads WHERE campaign_id = ?)').run(req.params.id);
  db.prepare('DELETE FROM leads WHERE campaign_id = ?').run(req.params.id);
  db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
