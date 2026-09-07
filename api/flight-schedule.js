import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';
import { fetchUbikaisAirportLive } from './_utils/ubikaisAuthScraper.js';

function normalizeFlight(rawFlight) {
  if (typeof rawFlight !== 'string') return '';
  let f = rawFlight.trim().toUpperCase().replace(/\s+/g, '');
  if (f.startsWith('IFR') && f.length > 3) f = f.substring(3);
  if (f.startsWith('VFR') && f.length > 3) f = f.substring(3);
  return f;
}

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;
  if (await checkRateLimit(req, res)) return;

  const parsedUrl = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
  const rawFlightParam = req.query?.flight ?? parsedUrl.searchParams.get('flight');
  const rawAirportParam = req.query?.airport ?? parsedUrl.searchParams.get('airport');
  const isEfs = parsedUrl.searchParams.get('efs') === 'true' || req.query?.efs === 'true';

  if (rawFlightParam !== undefined && rawFlightParam !== null) {
    if (typeof rawFlightParam !== 'string' || !/^[A-Za-z0-9]{2,8}$/.test(rawFlightParam.trim())) {
      return res.status(400).json({ error: 'Invalid flight format: must be 2-8 alphanumeric characters' });
    }
  }

  if (!rawFlightParam && !rawAirportParam && !isEfs) {
    return res.status(400).json({ error: 'flight or airport parameter is required' });
  }

  const flight = normalizeFlight(rawFlightParam || '');
  const airport = (rawAirportParam || 'RKSI').toUpperCase();

  if (isEfs) {
    return res.status(200).json({
      status: 'STANDBY',
      interfaceNo: 22,
      interfaceName: '전자비행스트립 (EFS)',
      source: '사용자 자체 관제 시스템 (미수신/연계 대기)',
      message: '사용자 측 관제 시스템으로부터 전자비행스트립(EFS) 데이터 연계 대기 중입니다.',
      timestamp: new Date().toISOString()
    });
  }

  if (flight && process.env.AVIATIONSTACK_API_KEY) {
    try {
      const avUrl = `https://api.aviationstack.com/v1/flights?access_key=${process.env.AVIATIONSTACK_API_KEY}&flight_iata=${flight}`;
      const avRes = await fetch(avUrl);
      if (avRes.ok) {
        const avData = await avRes.json();
        return res.status(200).json(avData);
      }
    } catch {}
  }

  // 1. Fetch 100% Genuine Live Database from UBIKAIS Authenticated Crawler
  try {
    const liveData = await fetchUbikaisAirportLive(airport);
    res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate=5');
    return res.status(200).json(liveData);
  } catch (e) {
    console.error(`[flight-schedule] UBIKAIS live query failed for ${airport}:`, e.message);
    return res.status(200).json({
      airport,
      timestamp: new Date().toISOString(),
      totalFlights: 0,
      departures: [],
      arrivals: [],
      fids: [],
      source: 'UBIKAIS 실시간 비행정보 데이터베이스 (오류/미수신)'
    });
  }
}
