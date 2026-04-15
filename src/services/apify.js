const BASE = 'https://api.apify.com/v2';

const ACTORS = {
  google_maps: 'compass~crawler-google-places',
  linkedin: 'bebity~linkedin-premium-actor',
  instagram: 'apify~instagram-scraper'
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
  }
}
