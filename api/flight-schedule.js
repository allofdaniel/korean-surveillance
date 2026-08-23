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
  const flight = normalizeFlight(parsedUrl.searchParams.get('flight') || req.query?.flight);
  const airport = (parsedUrl.searchParams.get('airport') || req.query?.airport || 'RKSI').toUpperCase();

  const isEfs = parsedUrl.searchParams.get('efs') === 'true' || req.query?.efs === 'true';

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
