import crypto from 'crypto';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const AMO_USER_ID = 'kal05';
const AMO_USER_PWD = 'pr12pr34!!';

let amoSessionCookie = null;
let amoSessionExpires = 0;

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

export async function fetchLiveAmoMetarTaf(icao = 'RKSI') {
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

      return {
        metar: metar || null,
        taf: taf || null,
        speci: speci || null,
        warnings: warnings,
        metReport: metReport,
        timestamp: new Date().toISOString(),
        source: metar ? '대한민국 항공기상청 (AMO / global.amo.go.kr)' : '미수신 (관측소 없음)'
      };
    }
  } catch (e) {
    console.error(`[AMO Weather Scraper] Error for ${icao}:`, e.message);
  }

  return { metar: null, taf: null, warnings: [], metReport: null, source: '미수신 (관측소 없음)' };
}

export async function fetchLiveAmosData(icao = null) {
  try {
    const cookies = await getAmoAuthenticatedCookies();
    const kst = new Date(Date.now() + 9 * 3600 * 1000);
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
        if (icao) {
          return json.results.filter(d => d.stnCd === icao);
        }
        return json.results;
      }
    }
  } catch (e) {
    console.error('[AMOS Live Scraper] Error:', e.message);
  }

  return [];
}
