/**
 * Supabase Cloud Database Client Helper
 * Target: https://xwwygmiwjlhnlfultear.supabase.co
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xwwygmiwjlhnlfultear.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3d3lnbWl3amxobmxmdWx0ZWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTE3MDEsImV4cCI6MjEwMzA4NzcwMX0.2dwsq8yeZNwo9rEapB1IHYS4lvQsHZWPSlOvbDX196A';

const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Prefer': 'return=representation,resolution=merge-duplicates'
};

/**
 * 1번 & 2번 15초 실시간 동기화: 운항스케줄 및 비행계획서 일괄 Supabase DB 동기화
 */
export async function batchSaveFlightSchedulesAndPlans(airport, departures = [], arrivals = []) {
  if (!airport) return null;
  const now = new Date().toISOString();
  const todayStr = now.split('T')[0];

  try {
    // 1. Save schedule snapshot
    const schedPayload = {
      target_date: todayStr,
      airport_icao: airport.toUpperCase(),
      flight_type: 'ALL',
      flight_json: {
        timestamp: now,
        airport: airport.toUpperCase(),
        totalFlights: departures.length + arrivals.length,
        departures,
        arrivals
      },
      updated_at: now
    };

    fetch(`${SUPABASE_URL}/rest/v1/flight_schedules_3days`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(schedPayload),
      signal: AbortSignal.timeout(3000)
    }).catch(() => {});

    // 2. Batch-sync Flight Plan records into flight_plan_details
    const allFlights = [...departures, ...arrivals];
    const fplRows = [];

    for (const f of allFlights) {
      const pk = f.amsRecPkCha || f.amsRecPk || f.vfrPk;
      if (!pk) continue;

      fplRows.push({
        ams_rec_pk: String(pk),
        flight_id: f.flt || '',
        dep_airport: f.des ? airport.toUpperCase() : (f.org || ''),
        arr_airport: f.des || (f.org ? airport.toUpperCase() : ''),
        flight_rules: f.flightRules || 'IFR',
        aircraft_type: f.typ || '',
        registration: f.reg || '',
        raw_telegram: f.via ? `ROUTE: ${f.via}` : '',
        parsed_route: {
          flt: f.flt,
          typ: f.typ,
          reg: f.reg,
          std: f.std,
          etd: f.etd,
          atd: f.atd,
          sta: f.sta,
          eta: f.eta,
          ata: f.ata,
          spt: f.spt,
          ram: f.ram,
          sts: f.sts,
          via: f.via || ''
        },
        updated_at: now
      });
    }

    if (fplRows.length > 0) {
      // Chunk into batches of 50
      for (let i = 0; i < fplRows.length; i += 50) {
        const chunk = fplRows.slice(i, i + 50);
        fetch(`${SUPABASE_URL}/rest/v1/flight_plan_details`, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify(chunk),
          signal: AbortSignal.timeout(4000)
        }).catch(() => {});
      }
    }
  } catch (e) {
    console.warn('[supabase] batchSaveFlightSchedulesAndPlans error:', e.message);
  }
}

/**
 * 2번 비행계획서 ICAO FPL 원문 및 상세 데이터 Supabase DB 저장/업서트
 */
export async function saveFlightPlanToSupabase(fplData) {
  if (!fplData || !fplData.ams_rec_pk) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/flight_plan_details`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        ams_rec_pk: String(fplData.ams_rec_pk),
        flight_id: fplData.flight_id || '',
        dep_airport: fplData.dep_airport || '',
        arr_airport: fplData.arr_airport || '',
        flight_rules: fplData.flight_rules || 'IFR',
        aircraft_type: fplData.aircraft_type || '',
        registration: fplData.registration || '',
        raw_telegram: fplData.raw_telegram || '',
        parsed_route: fplData.parsed_route || {},
        updated_at: new Date().toISOString()
      }),
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('[supabase] saveFlightPlanToSupabase error:', e.message);
  }
  return null;
}

/**
 * 2번 비행계획서 Supabase DB 캐시 우선 조회
 */
export async function getFlightPlanFromSupabase(amsRecPk) {
  if (!amsRecPk) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/flight_plan_details?ams_rec_pk=eq.${encodeURIComponent(amsRecPk)}&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      signal: AbortSignal.timeout(2500)
    });
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        return list[0];
      }
    }
  } catch (e) {
    console.warn('[supabase] getFlightPlanFromSupabase error:', e.message);
  }
  return null;
}

/**
 * 4번 e-AIP 7일/14일 자동 동기화 상태 및 패키지 메타데이터 Supabase DB 기록
 */
export async function recordEaipSyncPackage(pkgData) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/eaip_sync_packages`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        package_date: pkgData.package_date || '2026-08-20',
        airac_cycle: pkgData.airac_cycle || '2608',
        total_waypoints: pkgData.total_waypoints || 1113,
        last_checked_at: new Date().toISOString(),
        sync_interval_days: pkgData.sync_interval_days || 7,
        status: 'ACTIVE',
        metadata: pkgData.metadata || {}
      }),
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('[supabase] recordEaipSyncPackage error:', e.message);
  }
  return null;
}

/**
 * 5번 실시간 항공기상(AMO/KMA/AMOS) 장애 및 수집 에러 추적 로깅 (Supabase)
 */
export async function logWeatherError(service, errorType, message, details = {}, airportIcao = null) {
  try {
    const payload = {
      service: String(service || 'WEATHER_API').toUpperCase(),
      error_type: String(errorType || 'UNKNOWN_ERROR').toUpperCase(),
      airport_icao: airportIcao ? String(airportIcao).toUpperCase() : null,
      message: String(message || 'No error message provided'),
      details: details && typeof details === 'object' ? details : { raw: String(details) },
      created_at: new Date().toISOString()
    };

    return await fetch(`${SUPABASE_URL}/rest/v1/weather_error_logs`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000)
    });
  } catch (e) {
    console.warn('[supabase] logWeatherError error:', e.message);
  }
}

/**
 * 최신 기상 관측 스냅샷 Supabase 캐싱 (AMO 셧다운/다운타임 대비 영구 보존)
 */
export async function saveWeatherSnapshot(airportIcao, amosData = null, metarTafData = null, status = 'HEALTHY', lastErrorMessage = null) {
  if (!airportIcao) return;
  try {
    const now = new Date().toISOString();
    const payload = {
      airport_icao: airportIcao.toUpperCase(),
      status,
      updated_at: now
    };
    if (amosData) payload.amos_data = amosData;
    if (metarTafData) payload.metar_taf_data = metarTafData;
    if (status === 'HEALTHY') payload.last_success_at = now;
    if (lastErrorMessage) payload.last_error_message = String(lastErrorMessage);

    fetch(`${SUPABASE_URL}/rest/v1/weather_snapshot_cache`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000)
    }).catch(() => {});
  } catch (e) {
    console.warn('[supabase] saveWeatherSnapshot error:', e.message);
  }
}

/**
 * Supabase에 캐시된 최신 유효 기상 스냅샷 조회
 */
export async function getWeatherSnapshot(airportIcao) {
  if (!airportIcao) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/weather_snapshot_cache?airport_icao=eq.${encodeURIComponent(airportIcao.toUpperCase())}&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      const rows = await res.json();
      return rows && rows.length > 0 ? rows[0] : null;
    }
  } catch (e) {
    console.warn('[supabase] getWeatherSnapshot error:', e.message);
  }
  return null;
}

/**
 * Supabase 기상 수집 에러 로그 최근 N건 조회 (원인 분석용)
 */
export async function getRecentWeatherErrors(limit = 50) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/weather_error_logs?order=created_at.desc&limit=${limit}`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('[supabase] getRecentWeatherErrors error:', e.message);
  }
  return [];
}
