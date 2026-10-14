/**
 * Vercel Serverless Function - Aircraft trail history (self-hosted)
 * Source: Supabase table `aircraft_positions` (NAS ADS-B feed → S3 + Supabase).
 * Returns airplanes.live-style path for a single aircraft so the frontend can
 * seed a trail immediately when it first sees the aircraft.
 *
 * Replaces the broken /api/aircraft-trace (adsb.lol /v2/hex/ returns a single
 * current position, never a `trace` array → trails never seeded). See
 * docs/OVERHAUL_PLAN_v1.md §4, §11.
 *
 * Response: { hex, path: [{ time, lat, lon, altitude_ft, altitude_m, track, on_ground }], source }
 * Graceful: if Supabase env is unset, returns 200 { path: [], source: 'unconfigured' }.
 */
import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const M_TO_FT = 3.28084;
const REQUEST_TIMEOUT_MS = 8000;

function validateHex(hex) {
  if (typeof hex !== 'string') return null;
  const h = hex.trim().toLowerCase();
  return /^[0-9a-f]{6}$/.test(h) ? h : null;
}

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;
  if (await checkRateLimit(req, res)) return;

  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');

  const hex = validateHex(req.query.hex);
  if (!hex) {
    return res.status(400).json({ error: 'valid 6-char hex parameter is required', path: [] });
  }

  // 조회 구간(분). 기본 60분, 1~360 제한.
  let minutes = parseInt(req.query.minutes, 10);
  if (!Number.isFinite(minutes) || minutes < 1) minutes = 60;
  if (minutes > 360) minutes = 360;

  // Supabase 미설정 시 조용히 빈 경로 (프런트는 라이브 누적으로 폴백)
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(200).json({ hex, path: [], source: 'unconfigured' });
  }

  const sinceIso = new Date(Date.now() - minutes * 60_000).toISOString();
  const url =
    `${SUPABASE_URL}/rest/v1/aircraft_positions` +
    `?hex=eq.${hex}` +
    `&ts=gte.${encodeURIComponent(sinceIso)}` +
    `&order=ts.asc` +
    `&select=ts,lat,lon,alt_ft,track,on_ground` +
    `&limit=2000`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!r.ok) {
      return res.status(200).json({ hex, path: [], source: 'supabase-error', status: r.status });
    }
    const rows = await r.json();
    const path = (Array.isArray(rows) ? rows : [])
      .map((row) => {
        const lat = Number(row.lat);
        const lon = Number(row.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const altFt = Number.isFinite(Number(row.alt_ft)) ? Number(row.alt_ft) : 0;
        return {
          time: Math.floor(new Date(row.ts).getTime() / 1000),
          lat,
          lon,
          altitude_ft: altFt,
          altitude_m: altFt / M_TO_FT,
          track: Number.isFinite(Number(row.track)) ? Number(row.track) : 0,
          on_ground: !!row.on_ground,
        };
      })
      .filter(Boolean);

    // 하위호환: 기존 프런트 파서가 기대하는 airplanes.live 스타일 `ac[0].trace`
    // ([ts_sec, lat, lon, alt_ft]) 형식도 함께 반환 → 프런트 파서 수정 불필요.
    const ac = [{ hex, trace: path.map((p) => [p.time, p.lat, p.lon, p.altitude_ft]) }];
    return res.status(200).json({ hex, path, ac, source: 'supabase', totalPoints: path.length });
  } catch (e) {
    clearTimeout(timer);
    return res.status(200).json({ hex, path: [], source: 'exception', error: e?.name === 'AbortError' ? 'timeout' : 'fetch_failed' });
  }
}
