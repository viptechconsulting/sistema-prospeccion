// Segmentación de leads por datos públicos (Google Maps + SERP).
// Devuelve el segmento que decide ángulo/tono del mensaje. Lógica pura, testeable.

// Extrae la mejor posición SERP del raw_data del lead (o null si no se corrió/no aparece).
function serpPosition(rawData) {
  let raw = rawData;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { return null; } }
  const serp = raw?.serp;
  if (!serp) return null;                         // no se corrió búsqueda
  if (!serp.domain_found) return 999;             // se buscó y NO aparece -> visibilidad nula
  const positions = (serp.domain_positions || []).map(p => p.position).filter(Number.isFinite);
  return positions.length ? Math.min(...positions) : 999;
}

/**
 * Clasifica un lead en uno de 6 segmentos según su huella pública.
 * Acepta el shape real del lead (snake_case) del schema del proyecto.
 * @param {{review_count?:number, rating?:number, website?:string, raw_data?:any}} lead
 * @returns {{ segment: string, score: number, breakdown: object }}
 */
export function calcularSegmento(lead = {}) {
  const reviewCount = Number(lead.review_count) || 0;
  const rating = Number(lead.rating) || 0;
  const tieneWeb = Boolean(lead.website);
  const serpPos = serpPosition(lead.raw_data);

  let reviewScore = 0;
  if (reviewCount > 1000) reviewScore = 100;
  else if (reviewCount >= 500) reviewScore = 80;
  else if (reviewCount >= 200) reviewScore = 60;
  else if (reviewCount >= 50) reviewScore = 40;
  else if (reviewCount > 0) reviewScore = 20;

  const ratingScore = rating > 0 ? (rating / 5.0) * 100 : 0;
  const webScore = tieneWeb ? 100 : 0;

  let visibilityScore = 0;
  if (serpPos !== null) {
    if (serpPos <= 15) visibilityScore = 100;
    else if (serpPos <= 30) visibilityScore = 50;
    else visibilityScore = 0;
  }

  const totalScore =
    reviewScore * 0.25 +
    ratingScore * 0.20 +
    webScore * 0.30 +
    visibilityScore * 0.25;

  // Clasificación en cascada. Orden importa: la primera condición verdadera gana.
  // (El playbook original tenía una rama premium_visible inalcanzable; aquí se corrige.)
  let segment;
  if (totalScore >= 80 && reviewCount >= 500 && tieneWeb) segment = 'premium_establecido';
  else if (totalScore >= 70 && reviewCount >= 200) segment = 'premium_visible';
  else if (totalScore >= 55 && tieneWeb) segment = 'mediano_solido';
  else if (totalScore >= 40) segment = 'mediano_general';
  else if (totalScore >= 20) segment = 'pequeno_local';
  else segment = 'sin_datos';

  return {
    segment,
    score: Math.round(totalScore),
    breakdown: { reviewScore, ratingScore, webScore, visibilityScore },
  };
}
