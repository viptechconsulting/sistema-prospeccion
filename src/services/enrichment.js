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

function getRawObj(lead) {
  try { return typeof lead.raw_data === 'string' ? JSON.parse(lead.raw_data) : (lead.raw_data || {}); }
  catch { return {}; }
}

export async function enrichFromGoogleMaps(lead, campaign = {}) {
  const loc = campaign.location || 'Miami, FL';
  const firstLoc = loc.split(',')[0].trim();
  const query = [lead.company || lead.name, firstLoc].filter(Boolean).join(' ');
  const items = await runActor('google_maps', { niche: query, location: firstLoc, maxLeads: 1 });
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
    raw_data: JSON.stringify({ ...getRawObj(lead), google_maps: match })
  };
  db.prepare(`UPDATE leads SET rating = ?, review_count = ?, website = COALESCE(website, ?), gmb_url = COALESCE(gmb_url, ?), phone = COALESCE(phone, ?), email = COALESCE(email, ?), raw_data = ? WHERE id = ?`)
    .run(update.rating, update.review_count, update.website, update.gmb_url, update.phone, update.email, update.raw_data, lead.id);
  return { ...update, reviews };
}

export async function enrichSERP(lead, campaign = {}) {
  const name = lead.company || lead.name;
  const location = campaign.location || 'Miami';
  if (!name) return null;

  const queries = [
    `${name} ${location}`,
    `${lead.website ? new URL(lead.website).hostname : name}`
  ].filter(Boolean);

  try {
    const items = await runActor('google_serp', {
      niche: queries[0],
      location,
      maxLeads: 10
    });

    const allResults = [];
    for (const page of items) {
      const organic = page.organicResults || page.results || [];
      allResults.push(...organic);
    }

    const domain = lead.website ? new URL(lead.website).hostname.replace('www.', '') : null;
    const domainResults = domain
      ? allResults.filter(r => r.url && r.url.includes(domain))
      : [];

    const serpData = {
      total_results: allResults.length,
      domain_found: domainResults.length > 0,
      domain_positions: domainResults.map(r => ({ position: r.position, title: r.title, url: r.url })),
      top_competitors: allResults.slice(0, 5).map(r => ({ position: r.position, title: r.title, url: r.url })),
      query_used: queries[0]
    };

    const rawObj = getRawObj(lead);
    rawObj.serp = serpData;
    db.prepare('UPDATE leads SET raw_data = ? WHERE id = ?').run(JSON.stringify(rawObj), lead.id);
    return serpData;
  } catch (e) {
    console.error(`[enrichSERP] lead ${lead.id}:`, e.message);
    return null;
  }
}

export async function enrichMetaAds(lead) {
  const name = lead.company || lead.name;
  if (!name) return null;

  try {
    const items = await runActor('meta_ads', {
      niche: name,
      maxLeads: 5
    });

    const ads = (items || []).slice(0, 10).map(ad => ({
      page_name: ad.page_name || ad.pageName || ad.advertiser_name,
      status: ad.ad_delivery_start_time ? 'active' : 'unknown',
      start_date: ad.ad_delivery_start_time || null,
      platforms: ad.publisher_platforms || [],
      body: (ad.ad_creative_body || ad.body || ad.snapshot?.body?.text || '').slice(0, 200),
      link: ad.link_url || ad.linkUrl || ad.snapshot?.link_url || null,
      cta: ad.cta_type || ad.ctaType || null
    }));

    const adsData = {
      total_ads_found: ads.length,
      ads_active: ads.filter(a => a.status === 'active').length,
      ads_sample: ads.slice(0, 5),
      platforms_detected: [...new Set(ads.flatMap(a => a.platforms))]
    };

    const rawObj = getRawObj(lead);
    rawObj.meta_ads = adsData;
    db.prepare('UPDATE leads SET raw_data = ? WHERE id = ?').run(JSON.stringify(rawObj), lead.id);
    return adsData;
  } catch (e) {
    console.error(`[enrichMetaAds] lead ${lead.id}:`, e.message);
    return null;
  }
}

export async function enrichLead(lead, campaign = {}) {
  const results = { serp: null, meta_ads: null };
  const promises = [];

  if (lead.website) {
    promises.push(enrichSERP(lead, campaign).then(r => { results.serp = r; }));
  }

  promises.push(enrichMetaAds(lead).then(r => { results.meta_ads = r; }));

  await Promise.all(promises);
  return results;
}

export function getReviewsForLead(lead) {
  return extractReviewTexts(lead.raw_data);
}
