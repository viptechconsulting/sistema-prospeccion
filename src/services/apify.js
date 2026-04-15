const BASE = 'https://api.apify.com/v2';

const ACTORS = {
  google_maps: 'compass~crawler-google-places',
  linkedin: 'bebity~linkedin-premium-actor',
  instagram: 'apify~instagram-scraper',
  meta_ads: 'curious_coder~facebook-ads-library-scraper'
};

function buildInput(platform, { niche, location, keywords, maxLeads }) {
  const search = [niche, keywords].filter(Boolean).join(' ');
  switch (platform) {
    case 'google_maps':
      return {
        searchStringsArray: [search],
        locationQuery: location,
        maxCrawledPlacesPerSearch: maxLeads,
        language: 'es',
        scrapeContacts: true,
        scrapePlaceDetailPage: true
      };
    case 'linkedin':
      return {
        keywords: search,
        location,
        maxResults: maxLeads
      };
    case 'instagram':
      return {
        search: [search, location].filter(Boolean).join(' '),
        searchType: 'user',
        searchLimit: maxLeads,
        resultsType: 'details',
        resultsLimit: maxLeads,
        addParentData: false
      };
    case 'meta_ads':
      return {
        urls: [{ url: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=${encodeURIComponent(search)}&search_type=keyword_unordered&media_type=all` }],
        count: maxLeads,
        scrapeAdDetails: true,
        scrapePageAds: { activeStatus: 'all' },
        period: ''
      };
    default:
      throw new Error('platform desconocida');
  }
}

export async function runActor(platform, params) {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN vacío');
  const actorId = ACTORS[platform];
  if (!actorId) throw new Error(`actor desconocido: ${platform}`);

  const input = buildInput(platform, params);
  const res = await fetch(`${BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!res.ok) throw new Error(`Apify ${res.status}: ${await res.text()}`);
  return res.json();
}

export function normalizeLead(platform, raw) {
  switch (platform) {
    case 'google_maps': {
      const emails = raw.emails || raw.contactDetails?.emails || raw.additionalInfo?.emails;
      const phones = raw.phones || raw.contactDetails?.phones;
      const instagrams = raw.instagrams || raw.contactDetails?.instagrams;
      return {
        name: raw.title || raw.name,
        company: raw.title,
        profile_url: raw.url || raw.placeId,
        website: raw.website,
        gmb_url: raw.url,
        instagram_url: Array.isArray(instagrams) ? instagrams[0] : instagrams,
        email: Array.isArray(emails) ? emails[0] : (emails || raw.email),
        phone: raw.phone || raw.phoneUnformatted || (Array.isArray(phones) ? phones[0] : null)
      };
    }
    case 'linkedin':
      return {
        name: raw.fullName || raw.name,
        company: raw.companyName || raw.currentCompany,
        contact_person: raw.fullName,
        profile_url: raw.profileUrl || raw.url,
        website: raw.website,
        email: raw.email,
        phone: raw.phone
      };
    case 'instagram':
      return {
        name: raw.fullName || raw.username,
        company: raw.businessCategoryName || raw.category,
        profile_url: raw.url || `https://instagram.com/${raw.username}`,
        instagram_url: raw.url || `https://instagram.com/${raw.username}`,
        website: raw.externalUrl || raw.website,
        email: raw.businessEmail || raw.publicEmail,
        phone: raw.businessPhoneNumber
      };
    case 'meta_ads': {
      const pageName = raw.page_name || raw.pageName || raw.advertiser_name || raw.advertiserName;
      const pageId = raw.page_id || raw.pageId;
      const cta = raw.cta_type || raw.ctaType || raw.cta_text;
      const body = raw.ad_creative_body || raw.body || raw.snapshot?.body?.text || '';
      const link = raw.link_url || raw.linkUrl || raw.snapshot?.link_url;
      return {
        name: pageName,
        company: pageName,
        profile_url: pageId ? `https://www.facebook.com/${pageId}` : (raw.permalink_url || raw.url),
        website: link,
        email: null,
        phone: null,
        // Keep ad details inside raw_data for scoring prompt
      };
    }
  }
}
