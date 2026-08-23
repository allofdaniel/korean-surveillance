import vm from 'vm';
import { rsaBundleCode } from './rsaBundle.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

/**
 * UBIKAIS 실시간 인증 크롤러 (RSA PKCS#1 v1.5 암호화 세션)
 * - 사용자 계정(allofdanie / pr12pr34!!)을 이용해 정부 UBIKAIS에 로그인
 * - IFR 비행계획(selectDep.fois, selectArr.fois) 및 VFR 비행계획(selectVfrFpl.fois) 100% 실시간 DB 원본 수집
 */

let cachedCookieHeader = null;
let lastLoginTime = 0;

const airportCache = new Map();
const cacheTimestamps = new Map();

async function authenticateUbikais() {
  const now = Date.now();
  if (cachedCookieHeader && (now - lastLoginTime) < 10 * 60 * 1000) {
    return cachedCookieHeader;
  }

  const context = {
    window: {},
    navigator: { appName: 'Netscape' },
    alert: () => {},
    console: console,
    Math: Math,
    Date: Date,
    Array: Array,
    parseInt: parseInt
  };
  vm.createContext(context);

  vm.runInContext(`
    String.prototype.padRight = function(totalLength, paddingChar) {
      paddingChar = paddingChar || " ";
      var padCnt = Number(totalLength) - String(this).length;
      var returnString = "";
      for (var i=0; i<padCnt; i++) returnString += String(paddingChar);
      return (this + returnString).substring(0, totalLength);
    };
  `, context);

  vm.runInContext(rsaBundleCode, context);

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

  function getCookieHeader() {
    return Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  // 1. Fetch login page to retrieve RSA Public Key
  const res1 = await fetch('https://ubikais.fois.go.kr:8030/common/login?systemId=sysUbikais', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    signal: AbortSignal.timeout(8000)
  });
  saveCookies(res1);

  const html = await res1.text();
  const modMatch = html.match(/id="rsaPublicKeyModulus"\s+value="([^"]+)"/);
  const expMatch = html.match(/id="rsaPublicKeyExponent"\s+value="([^"]+)"/);

  if (!modMatch || !expMatch) {
    throw new Error('Failed to extract RSA public key from UBIKAIS login page');
  }

  context.modulus = modMatch[1];
  context.exponent = expMatch[1];
  context.rawId = 'allofdanie';
  context.rawPwd = 'pr12pr34!!';

  vm.runInContext(`
    var rsa = new RSAKey();
    rsa.setPublic(modulus, exponent);
    var encId = rsa.encrypt(rawId);
    var encPwd = rsa.encrypt(rawPwd);
  `, context);

  // 2. Perform RSA Encrypted Login
  const loginRes = await fetch('https://ubikais.fois.go.kr:8030/common/loginProc', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Cookie': getCookieHeader(),
      'Referer': 'https://ubikais.fois.go.kr:8030/common/login?systemId=sysUbikais',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: new URLSearchParams({
      loginSystem: 'PIB',
      userGroup: 'PIB',
      userId: context.encId,
      userPass: context.encPwd
    }).toString(),
    signal: AbortSignal.timeout(8000)
  });
  saveCookies(loginRes);

  const cookieHeader = getCookieHeader();
  cachedCookieHeader = cookieHeader;
  lastLoginTime = now;
  return cookieHeader;
}

/**
 * 특정 공항의 실시간 UBIKAIS 비행계획(IFR + VFR) 100% 원문 데이터베이스 조회
 */
export async function fetchUbikaisAirportLive(airportIcao = 'RKSI') {
  const now = Date.now();
  const lastTime = cacheTimestamps.get(airportIcao) || 0;
  if (airportCache.has(airportIcao) && (now - lastTime) < 15000) {
    return airportCache.get(airportIcao);
  }

  let cookieHeader = await authenticateUbikais();

  const kst = new Date(now + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  const today = `${y}-${m}-${d}`;
  const todaysh = `${y}${m}${d}`;

  const ap = airportIcao.toUpperCase();
  const depUrl = `https://ubikais.fois.go.kr:8030/sysUbikais/biz/fpl/selectDep.fois?downloadYn=1&srchDate=${today}&srchDatesh=${todaysh}&srchAl=&srchFln=&srchDep=${ap}&srchArr=`;
  const arrUrl = `https://ubikais.fois.go.kr:8030/sysUbikais/biz/fpl/selectArr.fois?downloadYn=1&srchDate=${today}&srchDatesh=${todaysh}&srchAl=&srchFln=&srchDep=&srchArr=${ap}`;

  const con01 = (ap === 'RKSI') ? "'RKSI','RKRE'" : `'${ap}'`;
  const con02 = (ap === 'RKSI') ? " OR VIA LIKE '%RKRE%'" : "";
  const vfrUrl = `https://ubikais.fois.go.kr:8030/sysUbikais/biz/fpl/selectVfrFpl.fois?${new URLSearchParams({
    userGroup: 'PIB',
    userId: 'allofdanie',
    downloadYn: '1',
    con01: con01,
    con02: con02,
    srchDate: today,
    srchDatesh: todaysh,
    airport: ap,
    srchFp: ''
  }).toString()}`;

  let [dRes, aRes, vRes] = await Promise.all([
    fetch(depUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Cookie': cookieHeader,
        'Referer': 'https://ubikais.fois.go.kr:8030/sysUbikais/biz/fpl/dep.fois',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01'
      },
      signal: AbortSignal.timeout(12000)
    }),
    fetch(arrUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Cookie': cookieHeader,
        'Referer': 'https://ubikais.fois.go.kr:8030/sysUbikais/biz/fpl/arr.fois',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01'
      },
      signal: AbortSignal.timeout(12000)
    }),
    fetch(vfrUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Cookie': cookieHeader,
        'Referer': 'https://ubikais.fois.go.kr:8030/sysUbikais/biz/fpl/vfrFpl.fois',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01'
      },
      signal: AbortSignal.timeout(12000)
    })
  ]);

  let dTxt = await dRes.text();
  let aTxt = await aRes.text();
  let vTxt = await vRes.text();

  // If session expired on server side, force re-login once
  if (dTxt.includes('로그인 세션') || aTxt.includes('로그인 세션') || !dTxt.startsWith('{')) {
    cachedCookieHeader = null;
    cookieHeader = await authenticateUbikais();
    [dRes, aRes, vRes] = await Promise.all([
      fetch(depUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Cookie': cookieHeader,
          'Referer': 'https://ubikais.fois.go.kr:8030/sysUbikais/biz/fpl/dep.fois',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/javascript, */*; q=0.01'
        },
        signal: AbortSignal.timeout(12000)
      }),
      fetch(arrUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Cookie': cookieHeader,
          'Referer': 'https://ubikais.fois.go.kr:8030/sysUbikais/biz/fpl/arr.fois',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/javascript, */*; q=0.01'
        },
        signal: AbortSignal.timeout(12000)
      }),
      fetch(vfrUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Cookie': cookieHeader,
          'Referer': 'https://ubikais.fois.go.kr:8030/sysUbikais/biz/fpl/vfrFpl.fois',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/javascript, */*; q=0.01'
        },
        signal: AbortSignal.timeout(12000)
      })
    ]);
    dTxt = await dRes.text();
    aTxt = await aRes.text();
    vTxt = await vRes.text();
  }

  const dJson = JSON.parse(dTxt);
  const aJson = JSON.parse(aTxt);
  const vJson = vTxt.startsWith('{') ? JSON.parse(vTxt) : { records: [] };

  const rawDeps = dJson.records || [];
  const rawArrs = aJson.records || [];
  const rawVfrs = vJson.records || [];

  // 1. Format IFR DEPARTURES
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
  });

  // 2. Format IFR ARRIVALS
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
  });

  // Helper to convert VFR FPL raw UTC time (Zulu) to KST (UTC+9)
  function utcToKstTime(timeStr) {
    if (!timeStr || timeStr === '-' || timeStr === '') return '-';
    const clean = timeStr.replace(/[^0-9]/g, '');
    if (clean.length < 4) return timeStr;
    const h = parseInt(clean.substring(0, 2), 10);
    const m = clean.substring(2, 4);
    const kstH = (h + 9) % 24;
    return `${String(kstH).padStart(2, '0')}${m}`;
  }

  // 3. Format & Merge VFR Flight Plans (selectVfrFpl.fois - Converted from UTC to KST)
  rawVfrs.forEach(r => {
    const via = r.via || '';
    const viaParts = via.split('/');
    const org = viaParts[0] || ap;
    const des = viaParts.length > 1 ? viaParts[viaParts.length - 1].split(' ')[0] : ap;

    const flt = r.fpId || 'UNKNOWN';
    const rules = r.classify9 || (flt.startsWith('HL') ? 'VFR' : 'IFR');
    const isFplFiled = r.fplYn === 'Y' || r.fpl === 'Y';

    // Convert raw UTC times to KST for seamless integration with commercial IFR schedules
    const rawEtd = (r.etd || '').replace(':', '') || '-';
    const rawAtd = (r.atd && r.atd !== '-' && r.atd !== '') ? r.atd.replace(':', '') : '-';
    const rawEta = (r.eta || '').replace(':', '') || '-';
    const rawAta = (r.ata && r.ata !== '-' && r.ata !== '') ? r.ata.replace(':', '') : '-';

    const etd = utcToKstTime(rawEtd);
    const atd = utcToKstTime(rawAtd);
    const eta = utcToKstTime(rawEta);
    const ata = utcToKstTime(rawAta);

    // Check if Departure for this airport
    const isDep = (org === ap) || (r.depYn === 'Y') || (etd !== '-' && !arrivals.some(a => a.flt === flt && a.eta === eta));
    if (isDep) {
      // Avoid duplicate if already in IFR departures
      if (!departures.some(d => d.flt === flt && (d.etd === etd || d.atd === atd))) {
        departures.push({
          flt,
          typ: r.acType || '-',
          reg: flt.startsWith('HL') ? flt : '-',
          nat: rules,
          fpl: isFplFiled ? 'Y' : '-',
          des: des || ap,
          spt: '-',
          ram: '-',
          std: etd,
          etd,
          atd,
          eta,
          cha: '-',
          sts: atd !== '-' ? 'DEP' : 'SCH',
          flightRules: rules
        });
      }
    }

    // Check if Arrival for this airport
    const isArr = (des === ap) || (r.arrYn === 'Y') || (eta !== '-' && !departures.some(d => d.flt === flt && d.etd === etd));
    if (isArr) {
      // Avoid duplicate if already in IFR arrivals
      if (!arrivals.some(a => a.flt === flt && (a.eta === eta || a.ata === ata))) {
        arrivals.push({
          flt,
          typ: r.acType || '-',
          reg: flt.startsWith('HL') ? flt : '-',
          sts: ata !== '-' ? 'ARR' : (atd !== '-' ? 'ENR' : 'SCH'),
          org: org || ap,
          nat: rules,
          fpl: isFplFiled ? 'Y' : '-',
          spt: '-',
          ram: '-',
          etd,
          sta: eta,
          eta,
          ata,
          cha: '-',
          flightRules: rules
        });
      }
    }
  });

  departures.sort((a, b) => parseInt((a.etd || '0').replace(/[^0-9]/g, '')) - parseInt((b.etd || '0').replace(/[^0-9]/g, '')));
  arrivals.sort((a, b) => parseInt((a.eta || '0').replace(/[^0-9]/g, '')) - parseInt((b.eta || '0').replace(/[^0-9]/g, '')));

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
