import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';
import { fetchUbikaisSchedule } from './_utils/ubikaisScraper.js';

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

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;
  if (await checkRateLimit(req, res)) return;

  const parsedUrl = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
  const flight = normalizeFlight(parsedUrl.searchParams.get('flight') || req.query?.flight);
  const airport = (parsedUrl.searchParams.get('airport') || req.query?.airport || 'RKSI').toUpperCase();
  const depArr = parsedUrl.searchParams.get('depArr') || req.query?.depArr || 'dep';

  // 1. If general FIDS / EFS schedule list is requested
  if (!flight) {
    try {
      const [depList, arrList] = await Promise.all([
        fetchUbikaisSchedule(airport, 'dep'),
        fetchUbikaisSchedule(airport, 'arr'),
      ]);

      return res.status(200).json({
        airport,
        timestamp: new Date().toISOString(),
        totalFlights: depList.length + arrList.length,
        departures: depList,
        arrivals: arrList,
        fids: depList.slice(0, 10).concat(arrList.slice(0, 10)),
        source: 'UBIKAIS (https://ubikais.fois.go.kr:8030)'
      });
    } catch (e) {
      console.warn('[flight-schedule] UBIKAIS fetch failed:', e.message);
    }
  }

  // 2. Specific flight search
  if (flight) {
    try {
      const [depList, arrList] = await Promise.all([
        fetchUbikaisSchedule(airport, 'dep'),
        fetchUbikaisSchedule(airport, 'arr'),
      ]);

      const matched = depList.find(d => (d.fpId || '').replace(/\s+/g, '') === flight) ||
                      arrList.find(a => (a.fpId || '').replace(/\s+/g, '') === flight);

      if (matched) {
        return res.status(200).json({
          data: [{
            flight_date: new Date().toISOString().slice(0, 10),
            flight_status: matched.depStatus || matched.arrStatus || 'active',
            departure: { airport: matched.apIcao || airport, scheduled: matched.std, estimated: matched.etd, actual: matched.atd },
            arrival: { airport: matched.apArr, scheduled: matched.sta, estimated: matched.eta, actual: matched.ata },
            flight: { iata: matched.fpId, icao: matched.fpId, number: matched.fpId },
            source: 'UBIKAIS'
          }]
        });
      }
    } catch (e) {
      console.warn('[flight-schedule] UBIKAIS flight match error:', e.message);
    }
  }

  const API_KEY = process.env.VITE_AVIATIONSTACK_API_KEY;
  if (!API_KEY) {
    return res.status(200).json({
      data: [{
        flight_date: new Date().toISOString().slice(0, 10),
        flight_status: 'active',
        departure: { airport: airport, scheduled: '09:00', actual: '09:15' },
        arrival: { airport: 'RKPC', scheduled: '10:10', actual: '10:12' },
        flight: { iata: flight || 'KAL867', icao: flight || 'KAL867' },
        source: 'SYNTHESIS'
      }]
    });
  }

  try {
    const activeUrl = `https://api.aviationstack.com/v1/flights?access_key=${API_KEY}&flight_iata=${flight}&flight_status=active`;
    const data1 = await requestJson(activeUrl);
    if (data1?.data?.length > 0) return res.status(200).json(data1);

    const data2 = await requestJson(`https://api.aviationstack.com/v1/flights?access_key=${API_KEY}&flight_iata=${flight}`);
    if (data2?.data?.length > 0) return res.status(200).json(data2);

    const data3 = await requestJson(`https://api.aviationstack.com/v1/flights?access_key=${API_KEY}&flight_icao=${flight}`);
    return res.status(200).json(data3);
  } catch (error) {
    return res.status(200).json({ data: [] });
  }
}

