/* global AbortController */

/**
 * Vercel Serverless Function - OpenSky Flight Track API
 * DO-278A: SRS-API-003
 */
import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';

const OPENSKY_API_URL = 'https://opensky-network.org/api';
const OPENSKY_AUTH_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const OPENSKY_CLIENT_ID = process.env.OPENSKY_CLIENT_ID || '';
const OPENSKY_CLIENT_SECRET = process.env.OPENSKY_CLIENT_SECRET || '';
const REQUEST_TIMEOUT_MS = 8000;

let tokenCache = { token: null, expires: 0 };

function withTimeout(timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const { signal, clear } = withTimeout(timeoutMs);
  try {
    return await fetch(url, { ...options, signal });
  } finally {
    clear();
  }
}

/**
 * Get OAuth2 access token from OpenSky
 */
async function getAccessToken() {
  if (tokenCache.token && tokenCache.expires > Date.now()) {
    console.info('[OpenSky] Using cached OAuth2 token');
    return tokenCache.token;
  }

  if (!OPENSKY_CLIENT_ID || !OPENSKY_CLIENT_SECRET) {
    console.info('[OpenSky] No OAuth2 credentials, using anonymous access');
    return null;
  }

  try {
    console.info('[OpenSky] Requesting new OAuth2 token...');
    const response = await fetchWithTimeout(OPENSKY_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: OPENSKY_CLIENT_ID,
        client_secret: OPENSKY_CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[OpenSky] OAuth2 token request failed:', response.status, text);
      return null;
    }

    const data = await response.json();
    console.info('[OpenSky] OAuth2 token obtained, expires in:', data.expires_in, 'seconds');
    tokenCache = {
      token: data.access_token,
      expires: Date.now() + ((Number(data.expires_in) - 300) * 1000),
    };
    return data.access_token;
  } catch (error) {
    console.error('[OpenSky] OAuth2 error:', error.message);
    return null;
  }
}

/**
 * Fetch flight track from OpenSky REST API
 */
async function fetchFlightTrack(icao24, accessToken) {
  const headers = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const trackUrl = `${OPENSKY_API_URL}/tracks/all?icao24=${encodeURIComponent(icao24)}&time=0`;
  console.info('[OpenSky] Fetching track:', trackUrl);

  const response = await fetchWithTimeout(trackUrl, { headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenSky API error: ${response.status} - ${text}`);
  }

  return response.json();
}

/**
 * ICAO24 format validation
 * @param {string} icao24 - ICAO 24 identifier (hex)
 */
function validateIcao24(icao24) {
  if (typeof icao24 !== 'string') {
    return { valid: false, error: 'Invalid ICAO24 format' };
  }

  const normalized = icao24.trim().toLowerCase();
  const validPattern = /^[0-9a-f]{6}$/;
  if (!validPattern.test(normalized)) {
    return { valid: false, error: 'Invalid ICAO24: must be 6-character hex string' };
  }

  return { valid: true, normalized };
}

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;
  if (await checkRateLimit(req, res)) return;

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  const { icao24 } = req.query;
  if (!icao24) {
    return res.status(400).json({ error: 'icao24 parameter is required' });
  }

  const validation = validateIcao24(icao24);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const normalizedIcao24 = validation.normalized;
    console.info('[OpenSky] Request for icao24:', normalizedIcao24);
    console.info('[OpenSky] OAuth2 configured:', !!OPENSKY_CLIENT_ID && !!OPENSKY_CLIENT_SECRET);

    const accessToken = await getAccessToken();
    const trackData = await fetchFlightTrack(normalizedIcao24, accessToken);

    if (!trackData || !Array.isArray(trackData.path) || trackData.path.length === 0) {
      return res.status(200).json({
        icao24: normalizedIcao24,
        path: [],
        error: 'No track data available',
        source: 'opensky-rest',
      });
    }

    const path = trackData.path
      .filter((point) => Array.isArray(point) && point.length >= 6)
      .map((p) => ({
        time: p[0],
        lat: p[1],
        lon: p[2],
        altitude_ft: p[3] ? Math.round(p[3] * 3.28084) : 0,
        altitude_m: p[3] || 0,
        track: p[4],
        on_ground: p[5],
      }));

    let sampledPath = path;
    if (path.length > 500) {
      const step = Math.ceil(path.length / 500);
      sampledPath = path.filter((_, i) => i % step === 0 || i === path.length - 1);
    }

    return res.status(200).json({
      icao24: trackData.icao24 || normalizedIcao24,
      callsign: trackData.callsign?.trim(),
      startTime: trackData.startTime,
      endTime: trackData.endTime,
      totalPoints: path.length,
      sampledPoints: sampledPath.length,
      path: sampledPath,
      source: 'opensky-rest',
      authenticated: !!accessToken,
    });
  } catch (error) {
    console.error('[OpenSky] Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch flight track',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
      path: [],
    });
  }
}
