// functions/api/planes/[[path]].js
//
// Live aircraft positions for the Planes app, passed through from adsb.lol.
// adsb.lol sends no CORS header, so a browser on this site can't call it
// directly; there is no key and no secret. Only the six lookups the app
// uses get through, so this can't be used as an open relay. In dev, Vite
// proxies the same path straight to adsb.lol (vite.config.ts). The `apis`
// skill, adsb.md.
const UPSTREAM = 'https://api.adsb.lol/';
const NUMBER = '-?\\d{1,3}(?:\\.\\d{1,4})?';
const ALLOWED = new RegExp(`^v2/(?:point/${NUMBER}/${NUMBER}/\\d{1,3}|(?:callsign|reg|type|hex)/[A-Za-z0-9-]{2,10}|mil)$`);

const json = (body, status, extra = {}) => new Response(body, {
  status,
  headers: { 'Content-Type': 'application/json', ...extra },
});

export async function onRequestGet({ params, request, waitUntil }) {
  const path = [].concat(params.path ?? []).join('/');
  if (!ALLOWED.test(path)) return json('{"error":"Not a planes lookup"}', 404);

  // Cloudflare keeps each good reply for its five seconds, so several visitors
  // over one city (or one card of Spotter's Picks) cost adsb.lol one call
  const cache = typeof caches === 'undefined' ? null : caches.default;
  const kept = await cache?.match(request);
  if (kept) return kept;

  try {
    const upstream = await fetch(UPSTREAM + path, {
      headers: { 'User-Agent': 'macos-1999-planes/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) return json('{"error":"The plane data service refused"}', upstream.status === 429 ? 429 : 502);
    const reply = json(upstream.body, 200, { 'Cache-Control': 'public, max-age=5' });
    if (cache) waitUntil(cache.put(request, reply.clone()));
    return reply;
  } catch {
    return json('{"error":"The plane data service did not answer"}', 504);
  }
}
