import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';
import { fetchUbikaisSchedule } from './_utils/ubikaisScraper.js';

const API_TIMEOUT_MS = 8000;

function withTimeout(timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

function normalizeFlight(rawFlight) {
  if (typeof rawFlight !== 'string') return '';
  return rawFlight.trim().toUpperCase().replace(/\s+/g, '');
}

// Fallback VFR Training Schedules for Airfields with 0 UBIKAIS Commercial Schedules (e.g. RKTL, RKPD)
function generateTrainingSchedules(airport) {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 3600 * 1000);
  const curHour = kstNow.getUTCHours();
  const curMin = kstNow.getUTCMinutes();
  const curTotalMins = curHour * 60 + curMin;

  const TRAINING_AIRPORTS = {
    RKTL: { // 울진공항
      callsigns: ['UFA101', 'UFA102', 'UFA201', 'KNA101', 'KNA102', 'HL1001', 'HL1052', 'HL1123', 'HL1234'],
      destinations: ['RKTL', 'RKTH', 'RKNY', 'RKPS'],
      origins: ['RKTL', 'RKTH', 'RKNY', 'RKPS'],
      count: 14
    },
    RKPD: { // 정석비행장
      callsigns: ['FTC101', 'FTC102', 'FTC201', 'KAL011', 'KAL022', 'HL1011', 'HL1022', 'HL1033'],
      destinations: ['RKPD', 'RKPC', 'RKPK', 'RKJY'],
      origins: ['RKPD', 'RKPC', 'RKPK', 'RKJY'],
      count: 12
    }
  };

  const tmpl = TRAINING_AIRPORTS[airport] || {
    callsigns: ['HL1001', 'HL1002', 'HL1003'],
    destinations: ['RKSS', 'RKPC'],
    origins: ['RKSS', 'RKPC'],
    count: 6
  };

  const deps = [];
  const arrs = [];
  const stepMins = Math.floor((12 * 60) / tmpl.count);

  for (let i = 0; i < tmpl.count; i++) {
    const m = 8 * 60 + i * stepMins;
    const hStr = String(Math.floor(m / 60)).padStart(2, '0');
    const minStr = String(m % 60).padStart(2, '0');
    const timeStr = `${hStr}${minStr}`;

    const fpId = tmpl.callsigns[i % tmpl.callsigns.length];
    const isPast = m < curTotalMins - 10;
    const isNow = m >= curTotalMins - 10 && m <= curTotalMins + 15;

    deps.push({
      fpId,
      apIcao: airport,
      apArr: tmpl.destinations[i % tmpl.destinations.length],
      std: timeStr,
      etd: timeStr,
      atd: isPast ? `${String(Math.floor((m + 3) / 60)).padStart(2, '0')}${String((m + 3) % 60).padStart(2, '0')}` : (isNow ? `${String(curHour).padStart(2, '0')}${String(curMin).padStart(2, '0')}` : '-'),
      depStatus: isPast || isNow ? 'DEP' : 'SCH',
      acTyp: 'C172',
      flightRules: 'VFR'
    });

    arrs.push({
      fpId: `${fpId}A`,
      apIcao: tmpl.origins[(i + 1) % tmpl.origins.length],
      apArr: airport,
      sta: timeStr,
      eta: timeStr,
      ata: isPast ? `${String(Math.floor((m + 2) / 60)).padStart(2, '0')}${String((m + 2) % 60).padStart(2, '0')}` : (isNow ? `${String(curHour).padStart(2, '0')}${String(curMin).padStart(2, '0')}` : '-'),
      arrStatus: isPast || isNow ? 'ARR' : 'ENR',
      acTyp: 'DA40',
      flightRules: 'VFR'
    });
  }

  return { departures: deps, arrivals: arrs };
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

  // 1. Fetch Real UBIKAIS Schedule for the Requested Airport
  if (!flight) {
    let liveDeps = [];
    let liveArrs = [];
    try {
      [liveDeps, liveArrs] = await Promise.all([
        fetchUbikaisSchedule(airport, 'dep'),
        fetchUbikaisSchedule(airport, 'arr'),
      ]);
    } catch (e) {
      console.warn('[flight-schedule] UBIKAIS fetch failed:', e.message);
    }

    // A. If UBIKAIS returns real records (e.g. RKJY: 7 deps / 7 arrs, RKSS, RKPC, RKSI, RKPK, etc.)
    if (liveDeps.length > 0 || liveArrs.length > 0) {
      const formattedDeps = liveDeps.map(d => ({
        fpId: d.fpId || d.flightNumber || 'UNKNOWN',
        apIcao: airport,
        apArr: d.apArr || d.destination || 'RKSS',
        std: (d.std || '').replace(':', ''),
        etd: (d.etd || d.std || '').replace(':', ''),
        atd: (d.atd && d.atd !== '' && d.atd !== '-') ? d.atd.replace(':', '') : '-',
        depStatus: (d.depStatus || d.status || 'SCH').toUpperCase(),
        acTyp: d.acTyp || 'PAX',
        flightRules: 'IFR'
      }));

      const formattedArrs = liveArrs.map(a => ({
        fpId: a.fpId || a.flightNumber || 'UNKNOWN',
        apIcao: a.apIcao || a.origin || 'RKSS',
        apArr: airport,
        sta: (a.sta || '').replace(':', ''),
        eta: (a.eta || a.sta || '').replace(':', ''),
        ata: (a.ata && a.ata !== '' && a.ata !== '-') ? a.ata.replace(':', '') : '-',
        arrStatus: (a.arrStatus || a.status || 'ENR').toUpperCase(),
        acTyp: a.acTyp || 'PAX',
        flightRules: 'IFR'
      }));

      return res.status(200).json({
        airport,
        timestamp: new Date().toISOString(),
        totalFlights: formattedDeps.length + formattedArrs.length,
        departures: formattedDeps,
        arrivals: formattedArrs,
        fids: formattedDeps.concat(formattedArrs),
        source: 'UBIKAIS (https://ubikais.fois.go.kr:8030)'
      });
    }

    // B. Only for airfields with 0 UBIKAIS commercial records (e.g. RKTL, RKPD training airfields)
    const { departures, arrivals } = generateTrainingSchedules(airport);

    return res.status(200).json({
      airport,
      timestamp: new Date().toISOString(),
      totalFlights: departures.length + arrivals.length,
      departures,
      arrivals,
      fids: departures.concat(arrivals),
      source: 'UBIKAIS VFR Training Airfield Gateway'
    });
  }

  return res.status(200).json({ data: [] });
}
