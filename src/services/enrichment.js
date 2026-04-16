import { runActor } from './apify.js';
import { db } from '../db/index.js';

function extractReviewTexts(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const reviews = data.reviews || data.reviewsSample || [];
    return reviews.slice(0, 30).map(r => ({
      text: r.text || r.textTranslated || r.reviewText || '',
      rating: r.stars || r.rating || r.reviewRating || null
    })).filter(r => r.text);
  } catch { return []; }
}

export async function enrichFromGoogleMaps(lead) {
  const query = [lead.company || lead.name, 'Miami'].filter(Boolean).join(' ');
  const items = await runActor('google_maps', { niche: query, location: 'Miami, FL', maxLeads: 1 });
  const match = items[0];
  if (!match) throw new Error('No se encontró en Google Maps');
  const reviews = extractReviewTexts(match);
  const update = {
    rating: match.totalScore || match.rating || null,
    review_count: match.reviewsCount || match.reviewCount || null,
    website: match.website || lead.website,
    gmb_url: match.url || null,
    phone: lead.phone || match.phone || match.phoneUnformatted || null,
    email: lead.email || (Array.isArray(match.emails) ? match.emails[0] : null),
    raw_data: JSON.stringify({ ...JSON.parse(lead.raw_data || '{}'), google_maps: match })
  };
  db.prepare(`UPDATE leads SET rating = ?, review_count = ?, website = COALESCE(website, ?), gmb_url = COALESCE(gmb_url, ?), phone = COALESCE(phone, ?), email = COALESCE(email, ?), raw_data = ? WHERE id = ?`)
    .run(update.rating, update.review_count, update.website, update.gmb_url, update.phone, update.email, update.raw_data, lead.id);
  return { ...update, reviews };
}

export function getReviewsForLead(lead) {
  return extractReviewTexts(lead.raw_data);
}
