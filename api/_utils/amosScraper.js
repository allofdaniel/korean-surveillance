import crypto from 'crypto';

/**
 * AMO (항공기상청) 실시간 AMOS 관제기상 스크래퍼
 * - SHA256 패스워드 인증 세션 풀링
 * - 전국 42개 활주로 엔드별 1~2초 단위 실시간 관제기상 (순간풍, 2분/10분 평균풍, RVR, 시정, QNH, 기온) 수집
 */

let amoSessionCookie = null;
let amoSessionExpires = 0;
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

async function getAmoAuthenticatedCookies() {
  const now = Date.now();
  if (amoSessionCookie && now < amoSessionExpires) {
    return amoSessionCookie;
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Origin': 'https://global.amo.go.kr',
    'Referer': 'https://global.amo.go.kr/sign/login-page.do?result=main',
  };

  const initRes = await fetch('https://global.amo.go.kr/sign/login-page.do?result=main', { headers });
  const rawInitCookies = initRes.headers.getSetCookie ? initRes.headers.getSetCookie() : [initRes.headers.get('set-cookie')];
  let cookies = rawInitCookies.map(c => c ? c.split(';')[0] : '').filter(Boolean).join('; ');

  const formParams = new URLSearchParams({
    loginId: process.env.AMO_USER_ID || 'kal05',
    pwd: hashPassword(process.env.AMO_PASSWORD || 'pr12pr34!!'),
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
    redirect: 'manual'
  });

  const loginCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie')];
  if (loginCookies.length > 0) {
    cookies = [cookies, loginCookies.map(c => c ? c.split(';')[0] : '').filter(Boolean)].join('; ');
  }

  amoSessionCookie = cookies;
  amoSessionExpires = now + 15 * 60 * 1000; // 15분 세션 유지
  return amoSessionCookie;
}

export async function fetchLiveAmosData(icao = null) {
  const now = Date.now();
  // 1초 인메모리 캐시 (초당 수십회 호출 시에도 AMO 서버 부하 0 유지)
  if (cachedAmosData && (now - lastAmosFetchTime) < 1500) {
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

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': 'https://global.amo.go.kr',
      'Referer': 'https://global.amo.go.kr/control/amos.do',
      'Cookie': cookies,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    };

    const res = await fetch('https://global.amo.go.kr/control/AmosRealTimeMqc.do', {
      method: 'POST',
      headers,
      body: `tm=${encodeURIComponent(tmStr)}`
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
    console.error('AMOS Realtime fetch error:', e.message);
  }

  return cachedAmosData || [];
}

let cachedMetarTaf = {};
let lastMetarTafFetch = {};

export async function fetchLiveAmoMetarTaf(icao = 'RKSI') {
  const now = Date.now();
  if (cachedMetarTaf[icao] && (now - (lastMetarTafFetch[icao] || 0)) < 60000) {
    return cachedMetarTaf[icao];
  }

  try {
    const cookies = await getAmoAuthenticatedCookies();
    const kst = new Date(now + 9 * 3600 * 1000);
    const now_date = `${kst.getUTCFullYear()}.${String(kst.getUTCMonth() + 1).padStart(2, '0')}.${String(kst.getUTCDate()).padStart(2, '0')}.${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': 'https://global.amo.go.kr',
      'Referer': 'https://global.amo.go.kr/airportWeather/domestic-airport.do',
      'Cookie': cookies,
    };

    const res = await fetch(`https://global.amo.go.kr/airportWeather/getAmosData.do?stnCd=${icao}&now_date=${encodeURIComponent(now_date)}`, { headers });
    if (res.ok) {
      const json = await res.json();
      const result = {
        metar: json.metarData?.content || null,
        taf: json.tafData?.content || null,
        warnings: json.warningList || [],
        metReport: json.metReportData || null,
      };
      cachedMetarTaf[icao] = result;
      lastMetarTafFetch[icao] = now;
      return result;
    }
  } catch (e) {
    console.error(`AMO METAR/TAF fetch error for ${icao}:`, e.message);
  }

  return cachedMetarTaf[icao] || { metar: null, taf: null, warnings: [] };
}

