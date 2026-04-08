/* global AbortController */

// Vercel Serverless Function - aviationstack API (Mixed Content fix applied)
import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';

const API_TIMEOUT_MS = 8000;
const FLIGHT_PATTERN = /^[A-Z0-9]{3,8}$/;

function withTimeout(timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

async function requestJson(url) {
  const { signal, clear } = withTimeout(API_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`Aviationstack API error: ${response.status} - ${responseText}`);
    }
    return response.json();
  } finally {
    clear();
  }
}

function normalizeFlight(rawFlight) {
  if (typeof rawFlight !== 'string') return '';
  return rawFlight.trim().toUpperCase().replace(/\s+/g, '');
}

function buildFlightSearchUrl(apiKey, paramName, flight) {
  const url = new URL('https://api.aviationstack.com/v1/flights');
  url.searchParams.set('access_key', apiKey);
  url.searchParams.set(paramName, flight);
  return url.toString();
}

function validateFlight(flight) {
  if (!FLIGHT_PATTERN.test(flight)) {
    return { valid: false, error: 'Invalid flight parameter format' };
  }
  return { valid: true };
}

export default async function handler(req, res) {
  // DO-278A SRS-SEC-002: Use secure CORS headers
  if (setCorsHeaders(req, res)) return;
  // DO-278A SRS-SEC-003: Rate Limiting
  if (await checkRateLimit(req, res)) return;

  const flight = normalizeFlight(req.query.flight);

  if (!flight) {
    return res.status(400).json({ error: 'flight parameter required' });
  }

  const validation = validateFlight(flight);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const API_KEY = process.env.VITE_AVIATIONSTACK_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    // 1st query: IATA active
    const activeUrl = new URL(buildFlightSearchUrl(API_KEY, 'flight_iata', flight));
    activeUrl.searchParams.set('flight_status', 'active');
    const data1 = await requestJson(activeUrl.toString());
    if (data1?.data?.length > 0) {
      return res.status(200).json(data1);
    }

    // 2nd query: IATA any status
    const data2 = await requestJson(buildFlightSearchUrl(API_KEY, 'flight_iata', flight));
    if (data2?.data?.length > 0) {
      return res.status(200).json(data2);
    }

    // 3rd query: ICAO
    const data3 = await requestJson(buildFlightSearchUrl(API_KEY, 'flight_icao', flight));
    return res.status(200).json(data3);
  } catch (error) {
    console.error('aviationstack API error:', error);
    return res.status(500).json({ error: 'Failed to fetch flight schedule' });
  }
}
