/**
 * Vercel Serverless Function - CelesTrak TLE proxy
 * CelesTrak sends no CORS headers to browsers and throttles repeated downloads per IP, so the
 * satellite layer reads one combined, CDN-cached TLE file from here instead of hitting it per group.
 * GET /api/tle            -> stations + weather + resource + sarsat + geo, concatenated
 * GET /api/tle?group=geo  -> a single group
 */
import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';

const DEFAULT_GROUPS = ['stations', 'weather', 'resource', 'sarsat', 'geo'];
const GROUPS = new Set([...DEFAULT_GROUPS, 'gnss', 'starlink']);
const TTL_MS = 6 * 60 * 60 * 1000; // TLEs are refreshed a few times a day upstream
const cache = new Map(); // group -> { at, text }

async function fetchGroup(group) {
  const hit = cache.get(group);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.text;
  try {
    const r = await fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'koreasurveillance/1.0 (+https://koreasurveillance.com)' },
    });
    const text = await r.text();
    if (!r.ok || !/^1 /m.test(text)) {
      console.error(`[tle] ${group}: HTTP ${r.status} ${text.slice(0, 120).replace(/\s+/g, ' ')}`);
      return hit?.text || '';
    }
    cache.set(group, { at: Date.now(), text });
    return text;
  } catch (err) {
    console.error(`[tle] ${group}: ${err?.message}`);
    return hit?.text || '';                         // stale beats nothing
  }
}

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;
  if (await checkRateLimit(req, res)) return;

  const one = req.query.group ? String(req.query.group) : null;
  if (one && !GROUPS.has(one)) return res.status(400).json({ error: `Invalid group. Use: ${[...GROUPS].join(', ')}` });

  const groups = one ? [one] : DEFAULT_GROUPS;
  const parts = [];
  for (const g of groups) parts.push(await fetchGroup(g));   // sequential: CelesTrak dislikes bursts
  const text = parts.filter(Boolean).join('\n').trim();
  if (!text) return res.status(502).json({ error: 'TLE upstream unavailable' });

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
  return res.status(200).send(text + '\n');
}
