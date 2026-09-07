import crypto from 'crypto';
import { logWeatherError, saveWeatherSnapshot, getWeatherSnapshot } from './supabase.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

/**
 * 대한민국 항공기상청 (AMO / global.amo.go.kr) 실시간 공식 기상 관제 게이트웨이
 * - 사용자 공식 계정(kal05 / pr12pr34!!) SHA256 암호화 인증 세션 수립
 * - 전국 공항 활주로별 실시간 AMOS 관제기상(순간풍, 2분/10분 평균풍, 기온, 이슬점, QNH, 강수량, 시정, RVR) 실측 수집
 * - METAR, TAF, SPECI, MET REPORT 100% 원문 직결 (NOAA 배제, 오직 대한민국 항공기상청 단일 소스)
 * - 장애 및 통신 두절 발생 시 Supabase DB(weather_error_logs, weather_snapshot_cache) 자동 기록 및 복구
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

  try {
    const initRes = await fetch('https://global.amo.go.kr/sign/login-page.do?result=main', { headers, signal: AbortSignal.timeout(8000) });
    const rawInitCookies = initRes?.headers?.getSetCookie ? initRes.headers.getSetCookie() : [initRes?.headers?.get?.('set-cookie')];
    let cookies = (rawInitCookies || []).map(c => c ? c.split(';')[0] : '').filter(Boolean).join('; ');

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

    const loginCookies = loginRes?.headers?.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes?.headers?.get?.('set-cookie')];
    if (loginCookies && loginCookies.length > 0) {
      cookies = [cookies, ...loginCookies.map(c => c ? c.split(';')[0] : '').filter(Boolean)].join('; ');
    }

    if (!loginRes.ok && loginRes.status !== 302 && loginRes.status !== 200) {
      logWeatherError('AMO_LOGIN', `HTTP_${loginRes.status}`, 'AMO login page returned unexpected status', { status: loginRes.status });
    }

    amoSessionCookie = cookies;
    amoSessionExpires = now + 15 * 60 * 1000;
    return amoSessionCookie;
  } catch (e) {
    console.error('[AMO Auth] Error acquiring cookies:', e.message);
    logWeatherError('AMO_LOGIN', 'AUTH_EXCEPTION', e.message, { stack: e.stack });
    throw e;
  }
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
      const domesticMetar = json.domesticMetar || [];

      const result = {
        metar: metar || null,
        taf: taf || null,
        speci: speci || null,
        warnings: warnings,
        metReport: metReport,
        domesticMetar: domesticMetar,
        timestamp: new Date().toISOString(),
        source: metar ? '대한민국 항공기상청 (AMO / global.amo.go.kr)' : '미수신 (관측소 없음)'
      };

      if (result.metar || result.taf) {
        cachedMetarTaf.set(icao, result);
        lastMetarTafFetch.set(icao, now);
        // Supabase snapshot cache update
        saveWeatherSnapshot(icao, null, result, 'HEALTHY');
      } else {
        // Returned 200 OK but empty METAR/TAF
        logWeatherError('AMO_METAR_TAF', 'EMPTY_MET_DATA', `AMO returned empty METAR/TAF for ${icao}`, { icao }, icao);
      }
      return result;
    } else {
      logWeatherError('AMO_METAR_TAF', `HTTP_${res.status}`, `AMO getAmosData.do returned HTTP ${res.status} for ${icao}`, { status: res.status }, icao);
    }
  } catch (e) {
    console.error(`[AMO Weather Scraper] Error for ${icao}:`, e.message);
    logWeatherError('AMO_METAR_TAF', 'FETCH_EXCEPTION', e.message, { stack: e.stack }, icao);
  }

  // Fallback 1: Local memory cache
  const memCached = cachedMetarTaf.get(icao);
  if (memCached && (memCached.metar || memCached.taf)) {
    return memCached;
  }

  // Fallback 2: Supabase persistent snapshot cache
  try {
    const snap = await getWeatherSnapshot(icao);
    if (snap && snap.metar_taf_data) {
      console.log(`[AMO Weather Scraper] Using Supabase snapshot cache for ${icao} (from ${snap.last_success_at})`);
      return {
        ...snap.metar_taf_data,
        source: `대한민국 항공기상청 (Supabase 복구 캐시 / ${snap.last_success_at || '이전 유효본'})`
      };
    }
  } catch (e) {}

  return { metar: null, taf: null, warnings: [], metReport: null, domesticMetar: [], source: '미수신 (수신 장애)' };
}

/**
 * 항공기상청(AMO) 실시간 AMOS 활주로별 55개 전체 필드 실측치 수집 (AmosRealTimeMqc.do)
 */
export async function fetchLiveAmosData(icao = null) {
  const now = Date.now();
  if (cachedAmosData && (now - lastAmosFetchTime) < 8000 && cachedAmosData.length > 0) {
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
        
        // Save snapshot to Supabase
        if (icao) {
          saveWeatherSnapshot(icao, json.results.filter(d => d.stnCd === icao), null, 'HEALTHY');
        } else {
          saveWeatherSnapshot('ALL', json.results, null, 'HEALTHY');
        }

        if (icao) {
          return cachedAmosData.filter(d => d.stnCd === icao);
        }
        return cachedAmosData;
      } else {
        logWeatherError('AMO_AMOS_DATA', 'EMPTY_RESULTS', 'AmosRealTimeMqc returned 200 OK but empty results array', { tm: tmStr }, icao);
      }
    } else {
      logWeatherError('AMO_AMOS_DATA', `HTTP_${res.status}`, `AmosRealTimeMqc returned HTTP ${res.status}`, { status: res.status }, icao);
    }
  } catch (e) {
    console.error('[AMOS Live Scraper] Error:', e.message);
    logWeatherError('AMO_AMOS_DATA', 'FETCH_EXCEPTION', e.message, { stack: e.stack }, icao);
  }

  // Fallback 1: Memory cache
  if (cachedAmosData && cachedAmosData.length > 0) {
    if (icao) return cachedAmosData.filter(d => d.stnCd === icao);
    return cachedAmosData;
  }

  // Fallback 2: Supabase persistent snapshot cache
  if (icao) {
    try {
      const snap = await getWeatherSnapshot(icao);
      if (snap && snap.amos_data && snap.amos_data.length > 0) {
        console.log(`[AMOS Live Scraper] Using Supabase snapshot cache for ${icao} (from ${snap.last_success_at})`);
        return snap.amos_data;
      }
    } catch (e) {}
  }

  return [];
}
