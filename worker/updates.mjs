import site from '../site.config.mjs';
import snapshot from '../data/updates.json' with { type: 'json' };
import { UPDATE_SOURCE, feedFromObservatory, readUpdateFeed, updateFeedIsStale } from '../public/updates-data.js';

const inFlight = new Map();
const MAX_BYTES = 128 * 1024;
const reply = (data, state) => Response.json({ version: 1, state, data }, {
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});

async function readSource(response) {
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json') || Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Source unavailable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = '';
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BYTES) throw new Error('Source response too large');
      body += decoder.decode(part.value, { stream: true });
    }
    body += decoder.decode();
    return JSON.parse(body);
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
}
async function fetchFeed(username) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(UPDATE_SOURCE.endpoint, {
      headers: { Accept: 'application/json' }, redirect: 'error', signal: controller.signal,
      cf: { cacheEverything: true, cacheTtl: UPDATE_SOURCE.interval / 1000 }
    });
    return feedFromObservatory(await readSource(response), username);
  } finally { clearTimeout(timeout); }
}

export async function handleUpdates(request, context) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  if (request.method === 'HEAD') return new Response(null, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  const username = site.updates.username;
  const url = new URL(request.url);
  const key = new Request(`${url.origin}/__bitdrift_updates_v1/${username}`);
  let cache;
  let saved;
  try {
    cache = caches.default;
    const response = await cache.match(key);
    if (response) saved = readUpdateFeed(await response.json(), username);
  } catch { /* 缓存不可用时仍可读取公开来源和随部署保存的记录。 */ }
  if (saved && Date.now() - Date.parse(saved.fetchedAt) < UPDATE_SOURCE.interval) return reply(saved, updateFeedIsStale(saved) ? 'stale' : 'cache');

  const flightKey = key.url;
  try {
    if (!inFlight.has(flightKey)) inFlight.set(flightKey, fetchFeed(username).finally(() => inFlight.delete(flightKey)));
    const data = await inFlight.get(flightKey);
    if (saved && Date.parse(data.sourceCheckedAt) < Date.parse(saved.sourceCheckedAt)) return reply(saved, 'stale');
    // 只缓存校验后的公开记录；保留一天供上游失败时回退，新鲜度仍按十分钟判断。
    if (cache) context.waitUntil(cache.put(key, Response.json(data, { headers: { 'Cache-Control': 'public, max-age=86400' } })).catch(() => {}));
    return reply(data, updateFeedIsStale(data) ? 'stale' : 'live');
  } catch {
    if (saved) return reply(saved, 'stale');
    try { return reply(readUpdateFeed(snapshot, username), 'snapshot'); }
    catch { return Response.json({ version: 1, state: 'unavailable', error: 'source_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
  }
}
