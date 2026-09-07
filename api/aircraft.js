/**
 * Vercel Serverless Function - Aircraft proxy
 * Sources: airplanes.live + adsb.lol + OpenSky Network (ultra-resilient fallback)
 */
import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';

const M_TO_FT = 3.28084;
const MS_TO_KT = 1.94384;
const MS_TO_FTMIN = 196.8504;
const NM_TO_KM = 1.852;

const OPENSKY_AUTH_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const OPENSKY_CLIENT_ID = process.env.OPENSKY_CLIENT_ID || '';
const OPENSKY_CLIENT_SECRET = process.env.OPENSKY_CLIENT_SECRET || '';
const OPENSKY_USERNAME = process.env.OPENSKY_USERNAME || '';
const OPENSKY_PASSWORD = process.env.OPENSKY_PASSWORD || '';

let openSkyTokenCache = { token: null, expires: 0 };
let openSkyCircuit = { failedAt: 0, cooldownMs: 60_000, consecutiveFails: 0 };

function validateCoordinates(lat, lon, radius) {
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  const radiusNum = parseFloat(radius) || 100;

  if (isNaN(latNum) || latNum < -90 || latNum > 90) {
    return { valid: false, error: 'Invalid latitude. Must be between -90 and 90.' };
  }
  if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
    return { valid: false, error: 'Invalid longitude. Must be between -180 and 180.' };
  }
  if (radiusNum < 1 || radiusNum > 500) {
    return { valid: false, error: 'Invalid radius. Must be between 1 and 500 nm.' };
  }

  return { valid: true, values: { lat: latNum, lon: lonNum, radius: radiusNum } };
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function bboxFromRadius(lat, lon, radiusNm) {
  const radiusKm = radiusNm * NM_TO_KM;
  const dLat = radiusKm / 111;
  const cosLat = Math.max(0.01, Math.cos(lat * Math.PI / 180));
  const dLon = Math.min(90, radiusKm / (111 * cosLat));
  return {
    lamin: Math.max(-90, lat - dLat),
    lamax: Math.min(90, lat + dLat),
    lomin: Math.max(-180, lon - dLon),
    lomax: Math.min(180, lon + dLon)
  };
}

async function fetchAdsbLive(lat, lon, radius) {
  const urls = [
    `https://api.airplanes.live/v2/point/${lat}/${lon}/${radius}`,
    `https://api.adsb.lol/v2/point/${lat}/${lon}/${radius}`
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'koreasurveillance/1.0 (+https://www.koreasurveillance.com)'
        },
        signal: AbortSignal.timeout(3000)
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data?.ac) && data.ac.length > 0) {
          return { ok: true, ac: data.ac, source: url.includes('airplanes.live') ? 'airplanes.live' : 'adsb.lol' };
        }
      }
    } catch (e) {
      // try next url
    }
  }

  return { ok: false, ac: [] };
}

async function getOpenSkyToken() {
  if (!OPENSKY_CLIENT_ID || !OPENSKY_CLIENT_SECRET) return null;
  if (openSkyTokenCache.token && openSkyTokenCache.expires > Date.now()) {
    return openSkyTokenCache.token;
  }
  try {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: OPENSKY_CLIENT_ID,
      client_secret: OPENSKY_CLIENT_SECRET
    });
    const res = await fetch(OPENSKY_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(2500)
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.access_token) return null;
    openSkyTokenCache = {
      token: json.access_token,
      expires: Date.now() + (json.expires_in - 60) * 1000
    };
    return json.access_token;
  } catch (e) {
    return null;
  }
}

function openSkyStateToAircraft(s) {
  if (!Array.isArray(s) || s.length < 11) return null;
  const [icao24, callsign, , , , lon, lat, baroAltM, onGround, velMs, track, vrMs, , geoAltM, squawk] = s;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  const altBaroFt = typeof baroAltM === 'number' ? Math.round(baroAltM * M_TO_FT) : null;
  const altGeomFt = typeof geoAltM === 'number' ? Math.round(geoAltM * M_TO_FT) : null;

  return {
    hex: typeof icao24 === 'string' ? icao24.toLowerCase().trim() : '',
    type: 'opensky',
    flight: typeof callsign === 'string' ? callsign.trim() : '',
    lat,
    lon,
    alt_baro: onGround ? 'ground' : (altBaroFt ?? altGeomFt ?? 0),
    alt_geom: altGeomFt ?? altBaroFt ?? 0,
    gs: typeof velMs === 'number' ? +(velMs * MS_TO_KT).toFixed(1) : 0,
    track: typeof track === 'number' ? +track.toFixed(2) : 0,
    baro_rate: typeof vrMs === 'number' ? Math.round(vrMs * MS_TO_FTMIN) : 0,
    geom_rate: typeof vrMs === 'number' ? Math.round(vrMs * MS_TO_FTMIN) : 0,
    squawk: typeof squawk === 'string' ? squawk : '',
    on_ground: !!onGround,
    seen: 0,
    seen_pos: 0,
    _src: 'opensky'
  };
}

async function fetchOpenSky(lat, lon, radius) {
  const now = Date.now();
  if (openSkyCircuit.failedAt > 0 && now - openSkyCircuit.failedAt < openSkyCircuit.cooldownMs) {
    return { ac: [], diag: { auth: 'skipped', error: 'circuit_open' } };
  }

  const { lamin, lamax, lomin, lomax } = bboxFromRadius(lat, lon, radius);
  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'KoreanSurveillance/1.0 (+https://www.koreasurveillance.com)'
  };
  const token = await getOpenSkyToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (OPENSKY_USERNAME && OPENSKY_PASSWORD) {
    const basic = Buffer.from(`${OPENSKY_USERNAME}:${OPENSKY_PASSWORD}`).toString('base64');
    headers['Authorization'] = `Basic ${basic}`;
  }

  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      openSkyCircuit.failedAt = Date.now();
      return { ac: [], diag: { status: res.status } };
    }
    const data = await res.json();
    const states = Array.isArray(data?.states) ? data.states : [];
    const ac = states.map(openSkyStateToAircraft).filter(Boolean);
    openSkyCircuit = { failedAt: 0, cooldownMs: 60_000, consecutiveFails: 0 };
    return { ac, diag: { status: 200, count: ac.length } };
  } catch (e) {
    openSkyCircuit.failedAt = Date.now();
    return { ac: [], diag: { error: e.message } };
  }
}

function mergeAndFilter(primary, secondary, lat, lon, radiusNm) {
  const radiusKm = radiusNm * NM_TO_KM;
  const seen = new Set();
  const out = [];

  for (const ac of primary) {
    if (!ac || typeof ac.lat !== 'number' || typeof ac.lon !== 'number') continue;
    const hex = (ac.hex || '').toLowerCase();
    if (hex && seen.has(hex)) continue;
    if (hex) seen.add(hex);
    out.push(ac);
  }

  for (const ac of secondary) {
    if (!ac || typeof ac.lat !== 'number' || typeof ac.lon !== 'number') continue;
    const hex = (ac.hex || '').toLowerCase();
    if (hex && seen.has(hex)) continue;
    if (haversineKm(lat, lon, ac.lat, ac.lon) > radiusKm) continue;
    if (hex) seen.add(hex);
    out.push(ac);
  }

  return out;
}

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;
  if (await checkRateLimit(req, res)) return;

  const parsedUrl = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
  const hasLat = parsedUrl.searchParams.has('lat') || (req.query && req.query.lat !== undefined);
  const hasLon = parsedUrl.searchParams.has('lon') || (req.query && req.query.lon !== undefined);

  if (!hasLat || !hasLon) {
    return res.status(400).json({ error: 'lat and lon are required parameters', ac: [] });
  }

  const queryLat = parsedUrl.searchParams.get('lat') || req.query?.lat;
  const queryLon = parsedUrl.searchParams.get('lon') || req.query?.lon;
  const queryRadius = parsedUrl.searchParams.get('radius') || req.query?.radius || '250';

  const validation = validateCoordinates(queryLat, queryLon, queryRadius);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error, ac: [] });
  }
  const { lat: validLat, lon: validLon, radius: r } = validation.values;

  const [adsbResult, osResult] = await Promise.all([
    fetchAdsbLive(validLat, validLon, r),
    fetchOpenSky(validLat, validLon, r)
  ]);
  const osList = osResult.ac || [];

  const merged = mergeAndFilter(adsbResult.ac || [], osList, validLat, validLon, r);

  return res.status(200).json({
    ac: merged,
    msg: 'No error',
    now: Date.now(),
    total: merged.length,
    sources: {
      adsb: adsbResult.ac?.length || 0,
      adsb_src: adsbResult.source || 'none',
      opensky: osList.length,
      merged: merged.length
    }
  });
}
