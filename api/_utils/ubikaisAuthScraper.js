import crypto from 'crypto';

// UBIKAIS User Credentials
const UBI_USER_ID = 'allofdanie';
const UBI_USER_PWD = 'pr12pr34!!';

let cachedCookieHeader = null;
let lastLoginTime = 0;
const SESSION_TTL_MS = 8 * 60 * 1000; // 8 minutes session refresh

// Airport cache (5 seconds)
const airportCache = new Map();
const cacheTimestamps = new Map();

/**
 * Log in to UBIKAIS via RSA authentication and establish an active session
 */
async function authenticateUbikais() {
  const now = Date.now();
  if (cachedCookieHeader && (now - lastLoginTime) < SESSION_TTL_MS) {
    return cachedCookieHeader;
  }

  const cookieJar = new Map();
  function saveCookies(res) {
    let cookies = [];
    if (res.headers.getSetCookie) {
      cookies = res.headers.getSetCookie();
    } else {
      cookies = [res.headers.get('set-cookie') || ''];
    }
    cookies.forEach(c => {
      if (!c) return;
      const [pair] = c.split(';');
      const [k, v] = pair.split('=');
      if (k && v) cookieJar.set(k.trim(), v.trim());
    });
  }

  function getCookieStr() {
    return Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  // 1. Fetch Login Page for RSA Public Key Modulus & Exponent
  const loginPageRes = await fetch('https://ubikais.fois.go.kr:8030/common/login?systemId=sysUbikais', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    },
    signal: AbortSignal.timeout(8000)
  });
  saveCookies(loginPageRes);

  const html = await loginPageRes.text();
  const modMatch = html.match(/id="rsaPublicKeyModulus"\s+value="([^"]+)"/);
  const expMatch = html.match(/id="rsaPublicKeyExponent"\s+value="([^"]+)"/);

  if (!modMatch || !expMatch) {
    throw new Error('Failed to retrieve RSA public key from UBIKAIS login portal');
  }

  const modulusHex = modMatch[1];
  const exponentHex = expMatch[1];

  const pubKey = crypto.createPublicKey({
    key: {
      kty: 'RSA',
      n: Buffer.from(modulusHex, 'hex').toString('base64url'),
      e: Buffer.from(exponentHex, 'hex').toString('base64url')
    },
    format: 'jwk'
  });

  // UBIKAIS specific 16-character space right-padding
  const rawId = UBI_USER_ID.padEnd(16, ' ');
  const rawPwd = UBI_USER_PWD.padEnd(16, ' ');

  const encId = crypto.publicEncrypt({
    key: pubKey,
    padding: crypto.constants.RSA_PKCS1_PADDING
  }, Buffer.from(rawId, 'utf8')).toString('hex');

  const encPwd = crypto.publicEncrypt({
    key: pubKey,
    padding: crypto.constants.RSA_PKCS1_PADDING
  }, Buffer.from(rawPwd, 'utf8')).toString('hex');

  // 2. POST /common/loginProc
  const loginProcRes = await fetch('https://ubikais.fois.go.kr:8030/common/loginProc', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Cookie': getCookieStr(),
      'Referer': 'https://ubikais.fois.go.kr:8030/common/login?systemId=sysUbikais',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: new URLSearchParams({
      loginSystem: 'PIB',
      userGroup: 'PIB',
      userId: encId,
      userPass: encPwd
    }).toString(),
    signal: AbortSignal.timeout(8000)
  });
  saveCookies(loginProcRes);

  const loginJson = await loginProcRes.json().catch(() => ({}));
  if (loginJson.status !== '개인' && !loginJson.status?.includes('개인') && loginJson.status !== 'Level0') {
    console.warn('[UBIKAIS Auth] Login status warning:', loginJson);
  }

  cachedCookieHeader = getCookieStr();
  lastLoginTime = Date.now();
  return cachedCookieHeader;
}

/**
 * Fetch 100% Genuine Real-Time Flights for any airport from UBIKAIS IFR Flight Plan Database
 */
export async function fetchUbikaisAirportLive(airportIcao = 'RKSS') {
  const now = Date.now();
  const lastTime = cacheTimestamps.get(airportIcao) || 0;
  if (airportCache.has(airportIcao) && (now - lastTime) < 5000) {
    return airportCache.get(airportIcao);
  }

  let cookieHeader = null;
  try {
    cookieHeader = await authenticateUbikais();
  } catch (e) {
    console.error('[UBIKAIS Auth] Authentication failed:', e.message);
    if (airportCache.has(airportIcao)) return airportCache.get(airportIcao);
    throw e;
  }

  // Format today's date
  const kstDate = new Date(Date.now() + 9 * 3600 * 1000);
  const today = kstDate.toISOString().slice(0, 10);
  const todaysh = today.replace(/-/g, '');

  const depUrl = `https://ubikais.fois.go.kr:8030/sysUbikais/biz/fpl/selectDep.fois?downloadYn=1&srchDate=${today}&srchDatesh=${todaysh}&srchAl=&srchFln=&srchDep=${airportIcao}&srchArr=`;
  const arrUrl = `https://ubikais.fois.go.kr:8030/sysUbikais/biz/fpl/selectArr.fois?downloadYn=1&srchDate=${today}&srchDatesh=${todaysh}&srchAl=&srchFln=&srchDep=&srchArr=${airportIcao}`;

  let [dRes, aRes] = await Promise.all([
    fetch(depUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Cookie': cookieHeader,
        'Referer': 'https://ubikais.fois.go.kr:8030/sysUbikais/biz/fpl/dep.fois',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01'
      },
      signal: AbortSignal.timeout(9000)
    }),
    fetch(arrUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Cookie': cookieHeader,
        'Referer': 'https://ubikais.fois.go.kr:8030/sysUbikais/biz/fpl/arr.fois',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01'
      },
      signal: AbortSignal.timeout(9000)
    })
  ]);

  let dTxt = await dRes.text();
  let aTxt = await aRes.text();

  // If session expired on server side, force re-login once
  if (dTxt.includes('로그인 세션') || aTxt.includes('로그인 세션') || !dTxt.startsWith('{')) {
    cachedCookieHeader = null;
    cookieHeader = await authenticateUbikais();
    [dRes, aRes] = await Promise.all([
      fetch(depUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Cookie': cookieHeader,
          'Referer': 'https://ubikais.fois.go.kr:8030/sysUbikais/biz/fpl/dep.fois',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/javascript, */*; q=0.01'
        },
        signal: AbortSignal.timeout(9000)
      }),
      fetch(arrUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Cookie': cookieHeader,
          'Referer': 'https://ubikais.fois.go.kr:8030/sysUbikais/biz/fpl/arr.fois',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/javascript, */*; q=0.01'
        },
        signal: AbortSignal.timeout(9000)
      })
    ]);
    dTxt = await dRes.text();
    aTxt = await aRes.text();
  }

  const dJson = JSON.parse(dTxt);
  const aJson = JSON.parse(aTxt);

  const rawDeps = dJson.records || [];
  const rawArrs = aJson.records || [];

  // Format DEPARTURES into 12-column standardized IFS schema
  const departures = rawDeps.map(r => {
    let flt = r.fpId || 'UNKNOWN';
    if (flt.startsWith('IFR') && flt.length > 3) flt = flt.substring(3);
    if (flt.startsWith('VFR') && flt.length > 3) flt = flt.substring(3);

    const std = (r.schTime || r.std || '').replace(':', '') || '-';
    const etd = (r.etd || std).replace(':', '') || '-';
    const atd = (r.atd && r.atd !== '-' && r.atd !== '') ? r.atd.replace(':', '') : '-';
    const eta = (r.eta || '').replace(':', '') || '-';
    const ram = (r.blockOffTime || r.blockOnTime || '-').replace(':', '');
    const isFplFiled = r.fpl === 'Y' || r.fplYn === 'Y';
    const isChanged = r.chaYn === 'Y' || r.cha === 'Y' || (r.depStatus === 'DLA');

    return {
      flt,
      typ: r.acType || '-',
      reg: r.acId || '-',
      nat: r.nat || 'PAX',
      fpl: isFplFiled ? 'Y' : '-',
      des: r.apArr || r.des || '-',
      spt: r.standDep || r.spt || '-',
      ram: ram || '-',
      std,
      etd,
      atd,
      eta,
      cha: isChanged ? 'Y' : '-',
      sts: (r.depStatus || 'SCH').toUpperCase(),
      flightRules: flt.startsWith('HL') ? 'VFR' : 'IFR'
    };
  }).sort((a, b) => parseInt((a.etd || '0').replace(':', '')) - parseInt((b.etd || '0').replace(':', '')));

  // Format ARRIVALS into 13-column standardized IFS schema
  const arrivals = rawArrs.map(r => {
    let flt = r.fpId || 'UNKNOWN';
    if (flt.startsWith('IFR') && flt.length > 3) flt = flt.substring(3);
    if (flt.startsWith('VFR') && flt.length > 3) flt = flt.substring(3);

    const etd = (r.etd || '').replace(':', '') || '-';
    const sta = (r.sta || '').replace(':', '') || '-';
    const eta = (r.eta || sta).replace(':', '') || '-';
    const ata = (r.ata && r.ata !== '-' && r.ata !== '') ? r.ata.replace(':', '') : '-';
    const ram = (r.blockOnTime || r.blockOffTime || '-').replace(':', '');
    const isFplFiled = r.fpl === 'Y' || r.fplYn === 'Y';
    const isChanged = r.chaYn === 'Y' || r.cha === 'Y' || (r.arrStatus === 'DLA');

    return {
      flt,
      typ: r.acType || '-',
      reg: r.acId || '-',
      sts: (r.arrStatus || 'ENR').toUpperCase(),
      org: r.apIcao || r.org || '-',
      nat: r.nat || 'PAX',
      fpl: isFplFiled ? 'Y' : '-',
      spt: r.standArr || r.spt || '-',
      ram: ram || '-',
      etd,
      sta,
      eta,
      ata,
      cha: isChanged ? 'Y' : '-',
      flightRules: flt.startsWith('HL') ? 'VFR' : 'IFR'
    };
  }).sort((a, b) => parseInt((a.eta || '0').replace(':', '')) - parseInt((b.eta || '0').replace(':', '')));

  const result = {
    airport: airportIcao,
    timestamp: new Date().toISOString(),
    totalFlights: departures.length + arrivals.length,
    departures,
    arrivals,
    fids: departures.concat(arrivals),
    source: 'UBIKAIS 실시간 비행정보 데이터베이스 (https://ubikais.fois.go.kr:8030)'
  };

  airportCache.set(airportIcao, result);
  cacheTimestamps.set(airportIcao, Date.now());
  return result;
}
