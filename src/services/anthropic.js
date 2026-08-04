import Anthropic from '@anthropic-ai/sdk';

// ponytail: construir el cliente por-llamada (memoizado por key) para que un key
// cambiado en runtime desde Ajustes se use sin reiniciar. Antes el key quedaba
// congelado al importar el módulo, así que cargarlo en Ajustes no tenía efecto.
let _client, _key;
export function client() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!_client || _key !== key) { _client = new Anthropic({ apiKey: key }); _key = key; }
  return _client;
}
