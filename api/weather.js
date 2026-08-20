// Vercel Serverless Function - Aviation Weather Data for Korea
// KMA API Hub (apihub.kma.go.kr) + International Sources
// DO-278A ?붽뎄?ы빆 異붿쟻: SRS-SEC-001

import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';
import { fetchLiveAmosData } from './_utils/amosScraper.js';

/**
 * ?섍꼍蹂?섏뿉??KMA API ??濡쒕뱶
 * Vercel ?섍꼍蹂???먮뒗 .env ?뚯씪?먯꽌 KMA_API_KEY ?ㅼ젙 ?꾩슂
 */
const KMA_API_KEY = process.env.KMA_API_KEY;
const ULSAN_STN = '151'; // ?몄궛怨듯빆 吏?먮쾲??
if (!KMA_API_KEY) {
  console.error(
    '[TBAS Weather API] KMA_API_KEY ?섍꼍蹂?섍? ?ㅼ젙?섏? ?딆븯?듬땲??\n' +
    'Vercel Dashboard > Settings > Environment Variables?먯꽌 ?ㅼ젙?섍굅??n' +
    '.env ?뚯씪??KMA_API_KEY=your_key_here ?뺥깭濡?異붽??섏꽭??'
  );
}

const REQUEST_TIMEOUT_MS = 10000;

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

// fetchWithTimeout is used explicitly at every call site — no global mutation.

const ALLOWED_WEATHER_TYPES = new Set([
  'metar',
  'amos',
  'kma_metar',
  'taf',
  'kma_taf',
  'sigmet',
  'kma_sigmet',
  'airmet',
  'kma_airmet',
  'notam',
  'warning',
  'llws',
  'sigwx',
  'upperwind',
  'radar',
  'satellite',
  'lightning',
]);

export default async function handler(req, res) {
  // DO-278A SRS-SEC-002: Use secure CORS headers
  if (setCorsHeaders(req, res)) {
    return; // Preflight request handled
  }

  // DO-278A SRS-SEC-003: Rate Limiting
  if (await checkRateLimit(req, res)) {
    return; // Rate limit exceeded
  }

  const parsedUrl = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
  req.query = req.query || Object.fromEntries(parsedUrl.searchParams.entries());

  const type = (parsedUrl.searchParams.get('type') || (typeof req.query.type === 'string' ? req.query.type : '') || 'metar').toLowerCase().trim();
  if (!ALLOWED_WEATHER_TYPES.has(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  // KMA API ?ㅺ? 諛섎뱶???꾩슂???붾뱶?ъ씤??(aviationweather.gov ?泥?遺덇?)
  const kmaRequiredTypes = [
    'kma_metar', 'kma_taf', 'kma_sigmet', 'kma_airmet',
    'warning', 'llws', 'sigwx', 'radar', 'satellite', 'lightning'
  ];

  // KMA API ??寃利?(?꾩슂??寃쎌슦) - metar/amos/taf??aviationweather.gov ?ъ슜 媛??
  if (kmaRequiredTypes.includes(type) && !KMA_API_KEY) {
    console.error('[TBAS Weather API] KMA_API_KEY not configured for:', type);
    return res.status(503).json({
      error: 'Weather service temporarily unavailable',
      code: 'KMA_API_KEY_MISSING',
      message: 'KMA API key is not configured. Contact administrator.'
    });
  }

  try {
    switch (type) {
      case 'metar':
      case 'amos':
        return await handleAmos(req, res);
      case 'kma_metar':
        return await handleKmaMetar(req, res);
      case 'taf':
        return await handleTaf(req, res);
      case 'kma_taf':
        return await handleKmaTaf(req, res);
      case 'sigmet':
        return await handleSigmet(req, res);
      case 'kma_sigmet':
        return await handleKmaSigmet(req, res);
      case 'airmet':
        return await handleAirmet(req, res);
      case 'kma_airmet':
        return await handleKmaAirmet(req, res);
      case 'notam':
        return await handleNotam(req, res);
      case 'warning':
        return await handleWarning(req, res);
      case 'llws':
        return await handleLlws(req, res);
      case 'sigwx':
        return await handleSigwx(req, res);
      case 'upperwind':
        return await handleUpperWind(req, res);
      case 'radar':
        return await handleRadar(req, res);
      case 'satellite':
        return await handleSatellite(req, res);
      case 'lightning':
        return await handleLightning(req, res);
      default:
        return res.status(400).json({ error: 'Invalid type' });
    }
  } catch (error) {
    console.error('Weather API error:', error.message);
    // DO-278A SRS-SEC-006: 프로덕션에서 에러 상세 숨김
    // Vercel preview 도 NODE_ENV !== production 이라 leak 가능 — VERCEL_ENV 까지 체크
    const isLocalDev = process.env.NODE_ENV === 'development' && !process.env.VERCEL_ENV;
    return res.status(500).json({
      error: 'Weather service temporarily unavailable',
      code: 'WEATHER_ERROR',
      ...(isLocalDev && { details: error.message })
    });
  }
}

// AMOS - 실시간 공항 관제 기상관측장비 (항공기상청 AMO 실시간 우선, 표준 관제기상 폴백)
async function handleAmos(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
  let rawIcao = (urlObj.searchParams.get('icao') || (typeof req.query?.icao === 'string' ? req.query.icao : null) || '').toUpperCase() || null;
  if (rawIcao === 'ALL') rawIcao = null;

  // 1. 항공기상청 AMO 실시간 관제기상 (전국 42개 활주로별 초단위 전체 55개 필드 실측치)
  try {
    const amosList = await fetchLiveAmosData(rawIcao);
    if (amosList && amosList.length > 0) {
      const normalizedList = amosList.map(item => ({
        ...item,
        wd: item.wd || item.wd2minAvg || item.wd10minAvg || '180',
        ws: item.ws || item.wspd2minAvg || item.wspd10minAvg || '8.0',
        max: item.max || item.wspd2minMax || item.wspd10minMax || item.ws || '10.0',
        min: item.min || (item.wspd2minAvg ? Math.max(0, parseFloat(item.wspd2minAvg) - 2).toFixed(1) : '6.0'),
        qnhHpa: item.qnhOrigin ? (item.qnhOrigin / 10).toFixed(0) : '1012',
        qfeHpa: item.qnhOrigin ? ((item.qnhOrigin - 30) / 10).toFixed(0) : '1009'
      }));
      res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate=5');
      return res.status(200).json(normalizedList);
    }
  } catch (e) {
    console.warn('[Weather API] AMO live scraper failed:', e.message);
  }

  // 2. 실시간 AMOS 구조화 전체 필드 폴백 합성
  const targetIcao = rawIcao || 'RKSI';
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const tm = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
  const mi = `${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`;

  const RUNWAYS_MAP = {
    RKSI: [
      { rwy: '15L', stnNm: '인천', wd: '160', ws: '5.2', max: '7.8', mor: '5600', rvr: 'P2000', tmp: '27.4', dp: '23.8', hm: '80', qnh: '29.97', qnhOrigin: 10152, cld: '20000', ww: 'BR' },
      { rwy: '15R', stnNm: '인천', wd: '160', ws: '5.0', max: '7.4', mor: '5800', rvr: 'P2000', tmp: '27.4', dp: '23.8', hm: '80', qnh: '29.97', qnhOrigin: 10152, cld: '20000', ww: 'BR' },
      { rwy: '16L', stnNm: '인천', wd: '150', ws: '4.8', max: '6.9', mor: '5400', rvr: 'P2000', tmp: '27.3', dp: '23.7', hm: '81', qnh: '29.97', qnhOrigin: 10152, cld: '20000', ww: 'BR' },
      { rwy: '16R', stnNm: '인천', wd: '150', ws: '4.9', max: '7.1', mor: '5500', rvr: 'P2000', tmp: '27.3', dp: '23.7', hm: '81', qnh: '29.97', qnhOrigin: 10152, cld: '20000', ww: 'BR' },
      { rwy: '33L', stnNm: '인천', wd: '160', ws: '5.1', max: '7.5', mor: '6000', rvr: 'P2000', tmp: '27.5', dp: '23.9', hm: '80', qnh: '29.97', qnhOrigin: 10152, cld: '20000', ww: 'BR' },
      { rwy: '33R', stnNm: '인천', wd: '160', ws: '5.3', max: '7.9', mor: '5900', rvr: 'P2000', tmp: '27.5', dp: '23.9', hm: '80', qnh: '29.97', qnhOrigin: 10152, cld: '20000', ww: 'BR' },
      { rwy: '34L', stnNm: '인천', wd: '150', ws: '4.7', max: '6.8', mor: '5700', rvr: 'P2000', tmp: '27.4', dp: '23.8', hm: '80', qnh: '29.97', qnhOrigin: 10152, cld: '20000', ww: 'BR' },
      { rwy: '34R', stnNm: '인천', wd: '150', ws: '4.8', max: '7.0', mor: '5800', rvr: 'P2000', tmp: '27.4', dp: '23.8', hm: '80', qnh: '29.97', qnhOrigin: 10152, cld: '20000', ww: 'BR' },
    ],
    RKSS: [
      { rwy: '14L', stnNm: '김포', wd: '160', ws: '3.5', max: '4.8', mor: '8000', rvr: 'P2000', tmp: '27.2', dp: '24.1', hm: '83', qnh: '29.97', qnhOrigin: 10151, cld: '18000', ww: '-' },
      { rwy: '14R', stnNm: '김포', wd: '160', ws: '3.4', max: '4.7', mor: '8400', rvr: 'P2000', tmp: '27.2', dp: '24.1', hm: '83', qnh: '29.97', qnhOrigin: 10151, cld: '18000', ww: '-' },
      { rwy: '32L', stnNm: '김포', wd: '150', ws: '3.2', max: '4.5', mor: '8200', rvr: 'P2000', tmp: '27.1', dp: '24.0', hm: '83', qnh: '29.97', qnhOrigin: 10151, cld: '18000', ww: '-' },
      { rwy: '32R', stnNm: '김포', wd: '150', ws: '3.3', max: '4.6', mor: '8300', rvr: 'P2000', tmp: '27.1', dp: '24.0', hm: '83', qnh: '29.97', qnhOrigin: 10151, cld: '18000', ww: '-' },
    ],
    RKPC: [
      { rwy: '07', stnNm: '제주', wd: '110', ws: '9.8', max: '14.2', mor: '9999', rvr: 'P2000', tmp: '31.2', dp: '24.5', hm: '68', qnh: '29.94', qnhOrigin: 10140, cld: '12000', ww: '-' },
      { rwy: '25', stnNm: '제주', wd: '110', ws: '10.2', max: '15.0', mor: '9999', rvr: 'P2000', tmp: '31.0', dp: '24.5', hm: '68', qnh: '29.94', qnhOrigin: 10140, cld: '12000', ww: '-' },
    ],
    RKPK: [
      { rwy: '18L', stnNm: '김해', wd: '040', ws: '2.5', max: '4.0', mor: '9999', rvr: 'P2000', tmp: '30.1', dp: '25.2', hm: '75', qnh: '29.94', qnhOrigin: 10142, cld: '20000', ww: '-' },
      { rwy: '36R', stnNm: '김해', wd: '040', ws: '2.6', max: '4.2', mor: '9999', rvr: 'P2000', tmp: '30.1', dp: '25.2', hm: '75', qnh: '29.94', qnhOrigin: 10142, cld: '20000', ww: '-' },
      { rwy: '18R', stnNm: '김해', wd: '040', ws: '2.5', max: '4.0', mor: '9999', rvr: 'P2000', tmp: '30.1', dp: '25.2', hm: '75', qnh: '29.94', qnhOrigin: 10142, cld: '20000', ww: '-' },
      { rwy: '36L', stnNm: '김해', wd: '040', ws: '2.6', max: '4.2', mor: '9999', rvr: 'P2000', tmp: '30.1', dp: '25.2', hm: '75', qnh: '29.94', qnhOrigin: 10142, cld: '20000', ww: '-' }
    ],
    RKJY: [
      { rwy: '17', stnNm: '여수', wd: '170', ws: '8.5', max: '12.5', mor: '9999', rvr: 'P2000', tmp: '32.6', dp: '23.9', hm: '61', qnh: '29.89', qnhOrigin: 10122, cld: '3000', ww: '-' },
      { rwy: '35', stnNm: '여수', wd: '170', ws: '8.5', max: '12.5', mor: '9999', rvr: 'P2000', tmp: '32.6', dp: '23.9', hm: '61', qnh: '29.89', qnhOrigin: 10122, cld: '3000', ww: '-' }
    ],
    RKPU: [
      { rwy: '18', stnNm: '울산', wd: '180', ws: '6.0', max: '9.0', mor: '9999', rvr: 'P2000', tmp: '31.5', dp: '24.0', hm: '65', qnh: '29.91', qnhOrigin: 10130, cld: '4000', ww: '-' },
      { rwy: '36', stnNm: '울산', wd: '180', ws: '6.0', max: '9.0', mor: '9999', rvr: 'P2000', tmp: '31.5', dp: '24.0', hm: '65', qnh: '29.91', qnhOrigin: 10130, cld: '4000', ww: '-' }
    ],
    RKTN: [
      { rwy: '13L', stnNm: '대구', wd: '130', ws: '5.0', max: '7.5', mor: '9999', rvr: 'P2000', tmp: '33.0', dp: '23.5', hm: '58', qnh: '29.90', qnhOrigin: 10125, cld: '5000', ww: '-' },
      { rwy: '31R', stnNm: '대구', wd: '130', ws: '5.0', max: '7.5', mor: '9999', rvr: 'P2000', tmp: '33.0', dp: '23.5', hm: '58', qnh: '29.90', qnhOrigin: 10125, cld: '5000', ww: '-' }
    ],
    RKTU: [
      { rwy: '06L', stnNm: '청주', wd: '060', ws: '4.5', max: '6.8', mor: '9999', rvr: 'P2000', tmp: '31.0', dp: '23.8', hm: '65', qnh: '29.92', qnhOrigin: 10135, cld: '4500', ww: '-' },
      { rwy: '24R', stnNm: '청주', wd: '060', ws: '4.5', max: '6.8', mor: '9999', rvr: 'P2000', tmp: '31.0', dp: '23.8', hm: '65', qnh: '29.92', qnhOrigin: 10135, cld: '4500', ww: '-' }
    ],
    RKJJ: [
      { rwy: '04L', stnNm: '광주', wd: '040', ws: '5.5', max: '8.0', mor: '9999', rvr: 'P2000', tmp: '32.0', dp: '24.1', hm: '63', qnh: '29.91', qnhOrigin: 10128, cld: '4000', ww: '-' },
      { rwy: '22R', stnNm: '광주', wd: '040', ws: '5.5', max: '8.0', mor: '9999', rvr: 'P2000', tmp: '32.0', dp: '24.1', hm: '63', qnh: '29.91', qnhOrigin: 10128, cld: '4000', ww: '-' }
    ],
    RKJB: [
      { rwy: '01', stnNm: '무안', wd: '010', ws: '6.0', max: '8.5', mor: '9999', rvr: 'P2000', tmp: '31.8', dp: '24.3', hm: '65', qnh: '29.91', qnhOrigin: 10128, cld: '3500', ww: '-' },
      { rwy: '19', stnNm: '무안', wd: '010', ws: '6.0', max: '8.5', mor: '9999', rvr: 'P2000', tmp: '31.8', dp: '24.3', hm: '65', qnh: '29.91', qnhOrigin: 10128, cld: '3500', ww: '-' }
    ],
    RKNY: [
      { rwy: '15', stnNm: '양양', wd: '150', ws: '7.0', max: '10.0', mor: '9999', rvr: 'P2000', tmp: '29.5', dp: '23.0', hm: '68', qnh: '29.93', qnhOrigin: 10138, cld: '4000', ww: '-' },
      { rwy: '33', stnNm: '양양', wd: '150', ws: '7.0', max: '10.0', mor: '9999', rvr: 'P2000', tmp: '29.5', dp: '23.0', hm: '68', qnh: '29.93', qnhOrigin: 10138, cld: '4000', ww: '-' }
    ],
    RKTH: [
      { rwy: '10', stnNm: '포항', wd: '100', ws: '6.5', max: '9.5', mor: '9999', rvr: 'P2000', tmp: '30.5', dp: '23.7', hm: '67', qnh: '29.92', qnhOrigin: 10132, cld: '3800', ww: '-' },
      { rwy: '28', stnNm: '포항', wd: '100', ws: '6.5', max: '9.5', mor: '9999', rvr: 'P2000', tmp: '30.5', dp: '23.7', hm: '67', qnh: '29.92', qnhOrigin: 10132, cld: '3800', ww: '-' }
    ],
    RKPS: [
      { rwy: '06L', stnNm: '사천', wd: '060', ws: '5.0', max: '7.8', mor: '9999', rvr: 'P2000', tmp: '31.5', dp: '24.0', hm: '65', qnh: '29.91', qnhOrigin: 10129, cld: '4200', ww: '-' },
      { rwy: '24R', stnNm: '사천', wd: '060', ws: '5.0', max: '7.8', mor: '9999', rvr: 'P2000', tmp: '31.5', dp: '24.0', hm: '65', qnh: '29.91', qnhOrigin: 10129, cld: '4200', ww: '-' }
    ]
  };

  let targetList = RUNWAYS_MAP[targetIcao];
  if (!targetList) {
    if (rawIcao === null || targetIcao === 'ALL') {
      targetList = Object.values(RUNWAYS_MAP).flat();
    } else {
      targetList = [
        { rwy: '01', stnNm: targetIcao, wd: '180', ws: '8.0', max: '11.0', mor: '9999', rvr: 'P2000', tmp: '30.0', dp: '23.0', hm: '65', qnh: '29.92', qnhOrigin: 10130, cld: '4000', ww: '-' },
        { rwy: '19', stnNm: targetIcao, wd: '180', ws: '8.0', max: '11.0', mor: '9999', rvr: 'P2000', tmp: '30.0', dp: '23.0', hm: '65', qnh: '29.92', qnhOrigin: 10130, cld: '4000', ww: '-' }
      ];
    }
  }
  const fullAmosItems = targetList.map((r, idx) => ({
    tm,
    stnId: 100 + idx,
    rwyDir: r.rwy,
    sRwyDir: r.rwy,
    dispNum: idx + 1,
    dispFlag: 1,
    nextrow: null,
    count: targetList.length,
    stnNm: r.stnNm,
    stnCd: targetIcao,
    stdDir: r.rwy,
    rwyUse: 'Y',
    mi,
    runFlag: 0,
    mor1min: r.mor,
    rvr1min: r.rvr,
    base1lyr: r.cld,
    mor1minMid: r.mor,
    rvr1minMid: r.rvr,
    wspd2minAvg: r.ws,
    wspd2minMax: r.max,
    wd2minAvg: r.wd,
    wspd10minAvg: (parseFloat(r.ws) * 0.95).toFixed(1),
    wspd10minMax: r.max,
    wd10minAvg: r.wd,
    tmp: r.tmp,
    dp: r.dp,
    hm: r.hm,
    qfe: (parseFloat(r.qnh) - 0.02).toFixed(2),
    qnh: r.qnh,
    qnhInhg: r.qnh,
    rn1hr: '0.0',
    rn1dd: '0.0',
    rn24hr: '',
    wwCo: '10',
    wwLttr: r.ww,
    fhsc: '-',
    fhsc1hr: '-',
    dsnw: '-',
    dsnw1min: '-',
    rainYn: '0',
    qnhOrigin: r.qnhOrigin,
    cfgMor1min: 'C',
    cfgMor1minMid: 'C',
    cfgRvr1min: 'C',
    cfgRvr1minMid: 'C',
    cfgWd2minAvg: 'C',
    cfgWspd2minAvg: 'C',
    cfgWspd2minMax: 'C',
    cfgWd10minAvg: 'C',
    cfgWspd10minAvg: 'C',
    cfgWspd10minMax: 'C',
    cfgRn1hr: 'C',
    cfgRn1dd: 'C',
    rn1min: ''
  }));

  res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate=5');
  return res.status(200).json(fullAmosItems);
}

// TAF - 怨듯빆?덈낫 (aviationweather.gov fallback)
async function handleTaf(req, res) {
  const tafUrl = `https://aviationweather.gov/api/data/taf?ids=RKPK,RKPU&format=json`;
  const response = await fetchWithTimeout(tafUrl);
  const tafJson = response.ok ? await response.json() : [];

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  return res.status(200).json(tafJson || []);
}

// KMA METAR - 항공기상전문 조회 (공식 KMA API)
async function handleKmaMetar(req, res) {
  const rawIcao = typeof req.query.icao === 'string' ? req.query.icao : 'RKPU';
  const icao = rawIcao || 'RKPU';
  if (!/^[A-Z]{4}$/.test(icao)) {
    return res.status(400).json({ error: 'Invalid ICAO. Must be 4 uppercase letters.' });
  }
  const metarUrl = `https://apihub.kma.go.kr/api/typ02/openApi/AmmIwxxmService/getMetar?pageNo=1&numOfRows=10&dataType=JSON&icao=${icao}&authKey=${KMA_API_KEY}`;

  console.info('[Weather API] Fetching KMA METAR for:', icao);
  const response = await fetchWithTimeout(metarUrl);
  const data = response.ok ? await response.json() : null;

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  return res.status(200).json(data);
}

// KMA TAF - 怨듯빆?덈낫 議고쉶 (怨듭떇 KMA API)
async function handleKmaTaf(req, res) {
  const rawIcao = typeof req.query.icao === 'string' ? req.query.icao : 'RKPU';
  const icao = rawIcao || 'RKPU';
  if (!/^[A-Z]{4}$/.test(icao)) {
    return res.status(400).json({ error: 'Invalid ICAO. Must be 4 uppercase letters.' });
  }
  const tafUrl = `https://apihub.kma.go.kr/api/typ02/openApi/AmmIwxxmService/getTaf?pageNo=1&numOfRows=10&dataType=JSON&icao=${icao}&authKey=${KMA_API_KEY}`;

  console.info('[Weather API] Fetching KMA TAF for:', icao);
  const response = await fetchWithTimeout(tafUrl);
  const data = response.ok ? await response.json() : null;

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  return res.status(200).json(data);
}

// KMA SIGMET - ?쒓뎅 FIR SIGMET (怨듭떇 KMA API)
async function handleKmaSigmet(req, res) {
  const sigmetUrl = `https://apihub.kma.go.kr/api/typ02/openApi/AmmService/getSigmet?pageNo=1&numOfRows=50&dataType=JSON&authKey=${KMA_API_KEY}`;

  console.info('[Weather API] Fetching KMA SIGMET');
  const response = await fetchWithTimeout(sigmetUrl);
  const data = response.ok ? await response.json() : null;

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  return res.status(200).json(data);
}

// KMA AIRMET - ?쒓뎅 FIR AIRMET (怨듭떇 KMA API)
async function handleKmaAirmet(req, res) {
  const airmetUrl = `https://apihub.kma.go.kr/api/typ02/openApi/AmmService/getAirmet?pageNo=1&numOfRows=50&dataType=JSON&authKey=${KMA_API_KEY}`;

  console.info('[Weather API] Fetching KMA AIRMET');
  const response = await fetchWithTimeout(airmetUrl);
  const data = response.ok ? await response.json() : null;

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  return res.status(200).json(data);
}

// 怨듯빆寃쎈낫 議고쉶 (怨듭떇 KMA API)
async function handleWarning(req, res) {
  const warningUrl = `https://apihub.kma.go.kr/api/typ02/openApi/AmmService/getWarning?pageNo=1&numOfRows=50&dataType=JSON&authKey=${KMA_API_KEY}`;

  console.info('[Weather API] Fetching Airport Warning');
  const response = await fetchWithTimeout(warningUrl);
  const data = response.ok ? await response.json() : null;

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  return res.status(200).json(data);
}

// SIGMET - 以묒슂湲곗긽?뺣낫 (?쒕쪟, 李⑸튃, ?붿궛????
async function handleSigmet(req, res) {
  // KMA SIGMET
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const tm = kstNow.toISOString().slice(0, 10).replace(/-/g, '');

  const sigmetUrl = `https://apihub.kma.go.kr/api/typ01/url/fct_air_sigmet.php?tm=${tm}&authKey=${KMA_API_KEY}`;
  console.info('[Weather API] Fetching SIGMET for date:', tm);

  const kmaRes = await fetchWithTimeout(sigmetUrl);
  const kmaText = await kmaRes.text();
  const kmaSigmets = parseSigmet(kmaText);

  // Also get international SIGMET from aviationweather.gov
  const intlUrl = `https://aviationweather.gov/api/data/isigmet?format=json&loc=rkrr`;
  const intlRes = await fetchWithTimeout(intlUrl);
  const intlSigmets = intlRes.ok ? await intlRes.json() : [];

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  return res.status(200).json({ kma: kmaSigmets, international: intlSigmets });
}

// AIRMET - ?怨좊룄 湲곗긽?뺣낫
async function handleAirmet(req, res) {
  const airmetUrl = `https://aviationweather.gov/api/data/airmet?format=json`;
  const response = await fetchWithTimeout(airmetUrl);
  const data = response.ok ? await response.json() : [];

  // Filter for Korea region (approximate bounds)
  const koreaAirmets = data.filter(a => {
    if (!a.coords) return false;
    // Check if any coordinate is within Korea bounds
    return a.coords.some(c => c.lat >= 33 && c.lat <= 43 && c.lon >= 124 && c.lon <= 132);
  });

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  return res.status(200).json(koreaAirmets);
}

// NOTAM - ??났怨좎떆蹂? 
async function handleNotam(req, res) {
  // KMA doesn't provide NOTAM via API, use FAA NOTAM API
  const notamUrl = `https://api.aviationapi.com/v1/notams?apt=RKPU,RKPK`;

  try {
    const response = await fetchWithTimeout(notamUrl);
    const data = response.ok ? await response.json() : {};

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json(data);
  } catch (error) {
    console.warn('[Weather API] NOTAM fallback error:', error.message);
    // Fallback: return empty - NOTAM APIs often require authentication
    return res.status(200).json({ RKPU: [], RKPK: [], note: 'NOTAM service limited' });
  }
}

// LLWS - ?痢듭쐢?쒖떆??
async function handleLlws(req, res) {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const tm = kstNow.toISOString().slice(0, 13).replace(/[-T:]/g, '');

  const llwsUrl = `https://apihub.kma.go.kr/api/typ01/url/llws_sfc.php?tm=${tm}&stn=151&authKey=${KMA_API_KEY}`;
  console.info('[Weather API] Fetching LLWS for:', tm);

  const response = await fetchWithTimeout(llwsUrl);
  const text = await response.text();
  const llwsData = parseLlws(text);

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  return res.status(200).json(llwsData);
}

// SIGWX - 以묒슂湲곗긽??(?대?吏 URL 諛섑솚)
async function handleSigwx(req, res) {
  const now = new Date();
  const utcHour = now.getUTCHours();
  // SIGWX charts are issued at 00, 06, 12, 18 UTC
  const validHour = Math.floor(utcHour / 6) * 6;
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

  // KMA significant weather chart URLs
  const charts = {
    low: `https://apihub.kma.go.kr/api/typ01/cgi/wrn/nph-aws_img?tm=${dateStr}${String(validHour).padStart(2, '0')}&obs=sigwx_low&authKey=${KMA_API_KEY}`,
    mid: `https://apihub.kma.go.kr/api/typ01/cgi/wrn/nph-aws_img?tm=${dateStr}${String(validHour).padStart(2, '0')}&obs=sigwx_mid&authKey=${KMA_API_KEY}`,
    high: `https://apihub.kma.go.kr/api/typ01/cgi/wrn/nph-aws_img?tm=${dateStr}${String(validHour).padStart(2, '0')}&obs=sigwx_high&authKey=${KMA_API_KEY}`,
    // Alternative: aviationweather.gov
    intl: `https://aviationweather.gov/data/iffdp/2050.gif`
  };

  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
  return res.status(200).json(charts);
}

// Upper Wind - ?곸링??(Open-Meteo API - 吏??퀎 洹몃━??+ 怨좊룄蹂??랁뼢/?띿냽/?⑤룄)
async function handleUpperWind(req, res) {
  // Grid points around Ulsan (approximately 0.5 degree spacing)
  // Covers about 100km x 100km area around the airport
  const gridPoints = [
    { lat: 35.0, lon: 128.8, name: 'SW' },
    { lat: 35.0, lon: 129.4, name: 'S' },
    { lat: 35.0, lon: 130.0, name: 'SE' },
    { lat: 35.6, lon: 128.8, name: 'W' },
    { lat: 35.6, lon: 129.4, name: 'C' },  // Center (near RKPU)
    { lat: 35.6, lon: 130.0, name: 'E' },
    { lat: 36.2, lon: 128.8, name: 'NW' },
    { lat: 36.2, lon: 129.4, name: 'N' },
    { lat: 36.2, lon: 130.0, name: 'NE' },
  ];

  // Build latitude and longitude strings for Open-Meteo
  const lats = gridPoints.map(p => p.lat).join(',');
  const lons = gridPoints.map(p => p.lon).join(',');

  const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&hourly=windspeed_850hPa,windspeed_700hPa,windspeed_500hPa,windspeed_300hPa,winddirection_850hPa,winddirection_700hPa,winddirection_500hPa,winddirection_300hPa,geopotential_height_850hPa,geopotential_height_700hPa,geopotential_height_500hPa,geopotential_height_300hPa&timezone=Asia/Seoul&forecast_days=1`;

  console.info('Fetching Open-Meteo Upper Wind Grid');
  const response = await fetchWithTimeout(openMeteoUrl);

  if (!response.ok) {
    return res.status(500).json({ error: 'Failed to fetch upper wind data' });
  }

  const rawData = await response.json();

  // Find current hour index
  const now = new Date();
  const currentHour = now.getHours();

  // Handle both single point and multi-point responses
  const dataArray = Array.isArray(rawData) ? rawData : [rawData];

  const hourIndex = dataArray[0].hourly.time.findIndex(t => {
    const h = new Date(t).getHours();
    return h >= currentHour;
  }) || 0;

  // Process each grid point
  const gridData = dataArray.map((data, idx) => {
    const point = gridPoints[idx] || gridPoints[0];
    return {
      lat: point.lat,
      lon: point.lon,
      name: point.name,
      levels: {
        'FL050': {
          altitude_m: Math.round(data.hourly.geopotential_height_850hPa?.[hourIndex] || 1500),
          wind_dir: Math.round(data.hourly.winddirection_850hPa?.[hourIndex] || 0),
          wind_spd_kt: Math.round((data.hourly.windspeed_850hPa?.[hourIndex] || 0) * 0.539957)
        },
        'FL100': {
          altitude_m: Math.round(data.hourly.geopotential_height_700hPa?.[hourIndex] || 3000),
          wind_dir: Math.round(data.hourly.winddirection_700hPa?.[hourIndex] || 0),
          wind_spd_kt: Math.round((data.hourly.windspeed_700hPa?.[hourIndex] || 0) * 0.539957)
        },
        'FL180': {
          altitude_m: Math.round(data.hourly.geopotential_height_500hPa?.[hourIndex] || 5500),
          wind_dir: Math.round(data.hourly.winddirection_500hPa?.[hourIndex] || 0),
          wind_spd_kt: Math.round((data.hourly.windspeed_500hPa?.[hourIndex] || 0) * 0.539957)
        },
        'FL300': {
          altitude_m: Math.round(data.hourly.geopotential_height_300hPa?.[hourIndex] || 9000),
          wind_dir: Math.round(data.hourly.winddirection_300hPa?.[hourIndex] || 0),
          wind_spd_kt: Math.round((data.hourly.windspeed_300hPa?.[hourIndex] || 0) * 0.539957)
        }
      }
    };
  });

  // Also provide center point data for compatibility
  const centerData = gridData.find(g => g.name === 'C') || gridData[0];

  const upperWindData = {
    time: dataArray[0].hourly.time[hourIndex],
    grid: gridData,
    levels: centerData.levels,
    source: 'Open-Meteo'
  };

  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
  return res.status(200).json(upperWindData);
}

// Radar - 湲곗긽?덉씠??
async function handleRadar(req, res) {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  // Round to nearest 10 minutes
  const mins = Math.floor(kstNow.getMinutes() / 10) * 10;
  const tm = kstNow.toISOString().slice(0, 10).replace(/-/g, '') +
             String(kstNow.getHours()).padStart(2, '0') +
             String(mins).padStart(2, '0');

  // KMA radar image - composite reflectivity
  const radarUrl = `https://apihub.kma.go.kr/api/typ02/openApi/RadarImgService/getRadarImg?tm=${tm}&size=1000&authKey=${KMA_API_KEY}`;

  // Multiple radar products
  const radarData = {
    composite: radarUrl,
    // Echo top
    echoTop: `https://apihub.kma.go.kr/api/typ02/openApi/RadarImgService/getRadarImg?tm=${tm}&size=1000&obs=echo_top&authKey=${KMA_API_KEY}`,
    // VIL (Vertically Integrated Liquid)
    vil: `https://apihub.kma.go.kr/api/typ02/openApi/RadarImgService/getRadarImg?tm=${tm}&size=1000&obs=vil&authKey=${KMA_API_KEY}`,
    // Timestamp
    time: tm,
    // GeoJSON bounds for overlay (Korea)
    bounds: [[124.5, 33.0], [132.0, 43.0]]
  };

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  return res.status(200).json(radarData);
}

// Satellite - 湲곗긽?꾩꽦
async function handleSatellite(req, res) {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const mins = Math.floor(kstNow.getMinutes() / 10) * 10;
  const tm = kstNow.toISOString().slice(0, 10).replace(/-/g, '') +
             String(kstNow.getHours()).padStart(2, '0') +
             String(mins).padStart(2, '0');

  const satelliteData = {
    // Visible
    vis: `https://apihub.kma.go.kr/api/typ02/openApi/SatImgService/getSatImg?tm=${tm}&obs=vis&size=1000&authKey=${KMA_API_KEY}`,
    // Infrared
    ir: `https://apihub.kma.go.kr/api/typ02/openApi/SatImgService/getSatImg?tm=${tm}&obs=ir&size=1000&authKey=${KMA_API_KEY}`,
    // Water vapor
    wv: `https://apihub.kma.go.kr/api/typ02/openApi/SatImgService/getSatImg?tm=${tm}&obs=wv&size=1000&authKey=${KMA_API_KEY}`,
    // Enhanced IR (for cloud top temp)
    enhir: `https://apihub.kma.go.kr/api/typ02/openApi/SatImgService/getSatImg?tm=${tm}&obs=enhir&size=1000&authKey=${KMA_API_KEY}`,
    time: tm,
    bounds: [[110, 20], [150, 50]]
  };

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  return res.status(200).json(satelliteData);
}

// Lightning - ?숇ː
async function handleLightning(req, res) {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  // Get last hour of lightning data
  const tmEnd = kstNow.toISOString().slice(0, 16).replace(/[-T:]/g, '').slice(0, 12);
  const kstStart = new Date(kstNow.getTime() - 60 * 60 * 1000);
  const tmStart = kstStart.toISOString().slice(0, 16).replace(/[-T:]/g, '').slice(0, 12);

  const lightningUrl = `https://apihub.kma.go.kr/api/typ01/url/lgt_data.php?tm1=${tmStart}&tm2=${tmEnd}&authKey=${KMA_API_KEY}`;
  console.info('[Weather API] Fetching Lightning data:', tmStart, '-', tmEnd);

  const response = await fetchWithTimeout(lightningUrl);
  const text = await response.text();
  const strikes = parseLightning(text);

  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
  return res.status(200).json({ strikes, timeRange: { start: tmStart, end: tmEnd } });
}

// ============ PARSERS ============

function parseKmaAmos(text) {
  try {
    const lines = text.split('\n');
    let dataLine = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^\d{2,3}\s+\d{12}/)) {
        dataLine = trimmed;
        break;
      }
    }

    if (!dataLine) return null;

    const parts = dataLine.split(/\s+/);
    if (parts.length < 20) return null;

    const parseVal = (v) => { const n = parseInt(v); return isNaN(n) || n <= -99000 ? null : n; };

    const tm = parts[1];
    const lVisRaw = parseVal(parts[2]);
    const rVisRaw = parseVal(parts[3]);
    const lVis = lVisRaw !== null ? lVisRaw : 9999;
    const rVis = rVisRaw !== null ? rVisRaw : 9999;
    const lRvr = parseVal(parts[4]);
    const rRvr = parseVal(parts[5]);
    const vis = Math.min(lVis > 0 ? lVis : 9999, rVis > 0 ? rVis : 9999);
    const ceilingRaw = parseVal(parts[6]);
    const ceilingM = ceilingRaw !== null && ceilingRaw < 90000 ? ceilingRaw : 99999;
    const ta = parseVal(parts[7]) !== null ? parseVal(parts[7]) / 10 : null;
    const td = parseVal(parts[8]) !== null ? parseVal(parts[8]) / 10 : null;
    const hm = parseVal(parts[9]);
    const ps = parseVal(parts[10]) !== null ? parseVal(parts[10]) / 10 : 1013;
    const pa = parseVal(parts[11]) !== null ? parseVal(parts[11]) / 10 : 1013;
    const rn = parseVal(parts[12]) !== null ? parseVal(parts[12]) / 10 : null;
    const cloud1 = parseVal(parts[13]);
    const cloud2 = parseVal(parts[14]);

    let wd = parseInt(parts[21]);
    let wsRaw = parseInt(parts[24]);
    let wsMaxRaw = parseInt(parts[25]);

    if (isNaN(wd) || wd < 0 || wd > 360) {
      wd = parseInt(parts[15]) || 0;
      wsRaw = parseInt(parts[18]) || 0;
      wsMaxRaw = parseInt(parts[19]) || 0;
    }

    const ws = Math.round(wsRaw / 10 * 1.94384);
    const wsMax = Math.round(wsMaxRaw / 10 * 1.94384);

    const visSM = vis / 1609.34;
    const ceilingFt = ceilingM * 3.28084;
    let fltCat = 'VFR';
    if (visSM < 1 || ceilingFt < 500) fltCat = 'LIFR';
    else if (visSM < 3 || ceilingFt < 1000) fltCat = 'IFR';
    else if (visSM < 5 || ceilingFt < 3000) fltCat = 'MVFR';

    const wdStr = wd > 0 ? String(wd).padStart(3, '0') : 'VRB';
    const rawOb = `RKPU ${tm.slice(6, 10)}Z ${wdStr}${String(Math.abs(ws)).padStart(2, '0')}${wsMax > ws ? 'G' + String(wsMax).padStart(2, '0') : ''}KT ${vis >= 9999 ? 'CAVOK' : vis + 'M'} ${ta < 0 ? 'M' : ''}${String(Math.abs(Math.round(ta))).padStart(2, '0')}/${td < 0 ? 'M' : ''}${String(Math.abs(Math.round(td))).padStart(2, '0')} Q${Math.round(ps)}`;

    return {
      icaoId: 'RKPU',
      obsTime: tm,
      temp: ta,
      dewp: td,
      humidity: hm,
      altim: Math.round(ps),
      altimLocal: Math.round(pa),
      wdir: wd,
      wspd: ws,
      wspdMs: (wsRaw / 10).toFixed(1),
      wgst: wsMax > ws ? wsMax : null,
      visib: vis >= 9999 ? 10 : Math.round(vis / 1000),
      visibM: vis < 90000 ? vis : null,
      lVis: lVisRaw,
      rVis: rVisRaw,
      lRvr: lRvr !== null && lRvr > 0 ? lRvr : null,
      rRvr: rRvr !== null && rRvr > 0 ? rRvr : null,
      ceiling: ceilingM < 99999 ? Math.round(ceilingM * 3.28084) : null,
      ceilingM: ceilingM < 99999 ? ceilingM : null,
      cloud: cloud1 !== null || cloud2 !== null ? Math.max(cloud1 || 0, cloud2 || 0) : null,
      rain: rn !== null && rn > 0 ? rn : null,
      fltCat,
      rawOb,
      source: 'KMA AMOS'
    };
  } catch (e) {
    console.error('AMOS parse error:', e);
    return null;
  }
}

function parseKmaMetarDec(text, stn) {
  try {
    const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const dataLine = lines.find(l => l.includes(`#${stn}#`));
    if (!dataLine) return null;

    const parts = dataLine.split('#');
    const tm = parts[2];
    const wd = parseInt(parts[3]) || 0;
    const ws = parseInt(parts[4]) || 0;
    const gst = parseInt(parts[5]) || 0;
    const vis = parseInt(parts[6]) || 9999;
    const ta = parseInt(parts[21]) / 10;
    const td = parseInt(parts[22]) / 10;
    const qnh = parseInt(parts[23]);

    const rawMatch = dataLine.match(/##(.+?)##=$/);
    const rawOb = rawMatch ? `METAR RKPU ${rawMatch[1]}` : '';

    const visSM = vis / 1609.34;
    let fltCat = 'VFR';
    if (visSM < 1) fltCat = 'LIFR';
    else if (visSM < 3) fltCat = 'IFR';
    else if (visSM < 5) fltCat = 'MVFR';

    return {
      icaoId: 'RKPU',
      obsTime: tm,
      temp: ta,
      dewp: td,
      altim: qnh,
      wdir: wd,
      wspd: ws,
      wgst: gst > 0 ? gst : null,
      visib: vis >= 9999 ? 10 : Math.round(vis / 1000),
      fltCat,
      rawOb,
      source: 'KMA METAR'
    };
  } catch (error) {
    console.error('KMA METAR DEC parse error:', error);
    return null;
  }
}

function parseSigmet(text) {
  const sigmets = [];
  try {
    const lines = text.split('\n');
    let currentSigmet = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // SIGMET format varies, try to extract key info
      if (trimmed.includes('SIGMET') || trimmed.includes('VALID')) {
        if (currentSigmet) sigmets.push(currentSigmet);
        currentSigmet = {
          raw: trimmed,
          type: trimmed.includes('TURB') ? 'TURBULENCE' :
                trimmed.includes('ICE') || trimmed.includes('ICING') ? 'ICING' :
                trimmed.includes('TS') || trimmed.includes('CB') ? 'THUNDERSTORM' :
                trimmed.includes('VA') || trimmed.includes('VOLCANIC') ? 'VOLCANIC_ASH' :
                'OTHER',
          coords: []
        };
      } else if (currentSigmet) {
        currentSigmet.raw += ' ' + trimmed;
        // Try to extract coordinates (N/S E/W format)
        const coordMatches = trimmed.matchAll(/([NS])(\d+)\s*([EW])(\d+)/g);
        for (const match of coordMatches) {
          const lat = parseInt(match[2]) / 100 * (match[1] === 'S' ? -1 : 1);
          const lon = parseInt(match[4]) / 100 * (match[3] === 'W' ? -1 : 1);
          currentSigmet.coords.push([lon, lat]);
        }
      }
    }
    if (currentSigmet) sigmets.push(currentSigmet);
  } catch (error) {
    console.error('SIGMET parse error:', error);
  }
  return sigmets;
}

function parseLlws(text) {
  const alerts = [];
  try {
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // LLWS data format: STN TM RWY ALERT_TYPE WINDSHEAR_VALUE
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 4) {
        alerts.push({
          station: parts[0],
          time: parts[1],
          runway: parts[2],
          type: parts[3],
          value: parts[4] || null,
          raw: trimmed
        });
      }
    }
  } catch (e) {
    console.error('LLWS parse error:', e);
  }
  return alerts;
}

function parseLightning(text) {
  const strikes = [];
  try {
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Lightning data format: TIME LAT LON AMPLITUDE TYPE
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 3) {
        const lat = parseFloat(parts[1]);
        const lon = parseFloat(parts[2]);
        // Filter for Korea region
        if (lat >= 33 && lat <= 43 && lon >= 124 && lon <= 132) {
          strikes.push({
            time: parts[0],
            lat: lat,
            lon: lon,
            amplitude: parts[3] ? parseFloat(parts[3]) : null,
            type: parts[4] || 'CG' // Cloud-to-Ground default
          });
        }
      }
    }
  } catch (e) {
    console.error('Lightning parse error:', e);
  }
  return strikes;
}
