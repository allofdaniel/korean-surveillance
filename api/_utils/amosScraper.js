import crypto from 'crypto';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

/**
 * 대한민국 항공기상청 (AMO / global.amo.go.kr) 실시간 공식 기상 관제 게이트웨이
 * - 사용자 공식 계정(kal05 / pr12pr34!!) SHA256 암호화 인증 세션 수립
 * - 전국 공항 활주로별 실시간 AMOS 관제기상(순간풍, 2분/10분 평균풍, 기온, 이슬점, QNH, 강수량, 시정, RVR) 실측 수집
 * - METAR, TAF, SPECI, MET REPORT 100% 원문 직결 (NOAA 배제, 오직 대한민국 항공기상청 단일 소스)
 */

const AMO_USER_ID = 'kal05';
const AMO_USER_PWD = 'pr12pr34!!';

let amoSessionCookie = null;
let amoSessionExpires = 0;

const cachedMetarTaf = new Map();
const lastMetarTafFetch = new Map();

let cachedAmosData = null;
let lastAmosFetchTime = 0;

function hashPassword(pw) {
  let chgPassword = pw;
  chgPassword = chgPassword.replace(/&/g, '&amp;');
  chgPassword = chgPassword.replace(/</g, '&lt;');
  chgPassword = chgPassword.replace(/>/g, '&gt;');
  chgPassword = chgPassword.replace(/\"/g, '&quot;');
  chgPassword = chgPassword.replace(/\'/g, '&#39;');
  return crypto.createHash('sha256').update(chgPassword, 'utf-8').digest('base64');
}

/**
 * 항공기상청(global.amo.go.kr) 공식 계정 인증 세션 획득 및 유지
 */
async function getAmoAuthenticatedCookies() {
  const now = Date.now();
  if (amoSessionCookie && now < amoSessionExpires) {
    return amoSessionCookie;
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Origin': 'https://global.amo.go.kr',
    'Referer': 'https://global.amo.go.kr/sign/login-page.do?result=main',
  };

  const initRes = await fetch('https://global.amo.go.kr/sign/login-page.do?result=main', { headers, signal: AbortSignal.timeout(8000) });
  const rawInitCookies = initRes.headers.getSetCookie ? initRes.headers.getSetCookie() : [initRes.headers.get('set-cookie')];
  let cookies = rawInitCookies.map(c => c ? c.split(';')[0] : '').filter(Boolean).join('; ');

  const formParams = new URLSearchParams({
    loginId: AMO_USER_ID,
    pwd: hashPassword(AMO_USER_PWD),
    siteRoleCode: '',
    role: 'AMI0002',
    userType: 'user'
  });

  const loginRes = await fetch('https://global.amo.go.kr/sign/login.do', {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Cookie': cookies,
    },
    body: formParams.toString(),
    redirect: 'manual',
    signal: AbortSignal.timeout(8000)
  });

  const loginCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie')];
  if (loginCookies.length > 0) {
    cookies = [cookies, ...loginCookies.map(c => c ? c.split(';')[0] : '').filter(Boolean)].join('; ');
  }

  amoSessionCookie = cookies;
  amoSessionExpires = now + 15 * 60 * 1000;
  return amoSessionCookie;
}

/**
 * 항공기상청(AMO) 실시간 METAR, TAF, SPECI, WARNING 100% 원문 직결 수집 (오직 항공기상청만 사용)
 */
export async function fetchLiveAmoMetarTaf(icao = 'RKSI') {
  const now = Date.now();
  const lastTime = lastMetarTafFetch.get(icao) || 0;
  if (cachedMetarTaf.has(icao) && (now - lastTime) < 60000 && cachedMetarTaf.get(icao)?.metar) {
    return cachedMetarTaf.get(icao);
  }

  try {
    const url = `https://global.amo.go.kr/airportWeather/getAmosData.do?stnCd=${icao}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json, text/javascript, */*; q=0.01'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (res.ok) {
      const json = await res.json();
      let metar = (json.metarData?.content || json.metar || json.domesticMetar?.[0]?.content || json.metarDecode?.[0]?.metarSource || '').trim();
      let taf = (json.tafData?.content || json.taf || '').trim();
      const warnings = json.warningList || [];
      const speci = (json.speciList?.[0]?.content || '').trim();
      const metReport = json.metReportData || null;

      const result = {
        metar: metar || null,
        taf: taf || null,
        speci: speci || null,
        warnings: warnings,
        metReport: metReport,
        timestamp: new Date().toISOString(),
        source: metar ? '대한민국 항공기상청 (AMO / global.amo.go.kr)' : '미수신 (관측소 없음)'
      };

      if (result.metar || result.taf) {
        cachedMetarTaf.set(icao, result);
        lastMetarTafFetch.set(icao, now);
      }
      return result;
    }
  } catch (e) {
    console.error(`[AMO Weather Scraper] Error for ${icao}:`, e.message);
  }

  return cachedMetarTaf.get(icao) || { metar: null, taf: null, warnings: [], metReport: null, source: '미수신 (관측소 없음)' };
}

/**
 * 항공기상청(AMO) 실시간 AMOS 활주로별 55개 전체 필드 실측치 수집 (AmosRealTimeMqc.do)
 */
export async function fetchLiveAmosData(icao = null) {
  const now = Date.now();
  if (cachedAmosData && (now - lastAmosFetchTime) < 30000 && cachedAmosData.length > 0) {
    if (icao) {
      return cachedAmosData.filter(d => d.stnCd === icao);
    }
    return cachedAmosData;
  }

  try {
    const cookies = await getAmoAuthenticatedCookies();
    const kst = new Date(now + 9 * 3600 * 1000);
    const y = kst.getUTCFullYear();
    const mo = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(kst.getUTCDate()).padStart(2, '0');
    const h = String(kst.getUTCHours()).padStart(2, '0');
    const mi = String(kst.getUTCMinutes()).padStart(2, '0');
    const tmStr = `${y}.${mo}.${d}.${h}:${mi}`;

    const res = await fetch('https://global.amo.go.kr/control/AmosRealTimeMqc.do', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://global.amo.go.kr/control/amos.do',
        'Cookie': cookies,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: `tm=${encodeURIComponent(tmStr)}`,
      signal: AbortSignal.timeout(8000)
    });

    if (res.ok) {
      const json = await res.json();
      if (json.results && json.results.length > 0) {
        cachedAmosData = json.results;
        lastAmosFetchTime = now;
        if (icao) {
          return cachedAmosData.filter(d => d.stnCd === icao);
        }
        return cachedAmosData;
      }
    }
  } catch (e) {
    console.error('[AMOS Live Scraper] Error:', e.message);
  }

  if (cachedAmosData && cachedAmosData.length > 0) {
    if (icao) return cachedAmosData.filter(d => d.stnCd === icao);
    return cachedAmosData;
  }

  return [];
}
