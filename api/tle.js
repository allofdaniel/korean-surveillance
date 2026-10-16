/**
 * Vercel Serverless Function - CelesTrak TLE proxy
 * CelesTrak no longer serves CORS headers to browsers, so the satellite layer reads TLEs through here.
 * GET /api/tle?group=stations|weather|resource|sarsat|geo
 */
import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';

const GROUPS = new Set(['stations', 'weather', 'resource', 'sarsat', 'geo', 'gnss', 'starlink']);
const TTL_MS = 6 * 60 * 60 * 1000; // TLEs are refreshed a few times a day upstream
const cache = new Map(); // group -> { at, text }

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;
  if (await checkRateLimit(req, res)) return;

  const group = String(req.query.group || 'stations');
  if (!GROUPS.has(group)) return res.status(400).json({ error: `Invalid group. Use: ${[...GROUPS].join(', ')}` });

  const hit = cache.get(group);
  if (hit && Date.now() - hit.at < TTL_MS) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).send(hit.text);
  }
  try {
    const r = await fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'koreasurveillance/1.0 (+https://koreasurveillance.com)' },
    });
    const text = await r.text();
    if (!r.ok || !/^1 /m.test(text)) throw new Error(`CelesTrak ${r.status}`);
    cache.set(group, { at: Date.now(), text });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).send(text);
  } catch {
    if (hit) { // serve stale rather than nothing
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(hit.text);
    }
    return res.status(502).json({ error: 'TLE upstream unavailable' });
  }
}
