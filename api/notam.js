import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';
import { parseQLineCoords, parseQLine, extractQCode } from './_utils/notamCoords.js';

// Static fallback URL (deployed app's public data) — last-resort if AIM Korea live fetch fails
const STATIC_FALLBACK_URL = 'https://tbas.vercel.app/data/notams.json';

// AIM Korea live endpoint (무인증, 한반도 NOTAM 실시간)
const AIM_KOREA_BASE = 'https://aim.koca.go.kr';
const AIM_KOREA_INIT = `${AIM_KOREA_BASE}/pib/pibMain.do?type=2&language=ko_KR`;
const AIM_KOREA_SEARCH = `${AIM_KOREA_BASE}/pib/aisSearch.do`;

// AIM Korea live cache (모듈 레벨, hot 인스턴스 재사용)
let aimLiveCache = { data: null, fetchedAt: 0, ttlMs: 5 * 60 * 1000 };

// ============================================================
// Supabase 설정
// ============================================================
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const SUPABASE_PUBLIC = SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/notam-data` : '';
const HAS_SUPABASE_BACKEND = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);

// ============================================================
// 유틸리티 함수
// ============================================================

// 좌표 파서는 _utils/notamCoords.js 에 통합 — alias 로 호환성 유지
const parseNotamCoordinates = parseQLineCoords;

function isInBounds(lat, lon, bounds, margin = 1) {
  if (bounds == null) return true;
  if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) return true;
  return (
    lat >= bounds.south - margin &&
    lat <= bounds.north + margin &&
    lon >= bounds.west - margin &&
    lon <= bounds.east + margin
  );
}

function parseNotamDate(dateStr) {
  if (!dateStr || dateStr.length < 6) return null;
  const year = 2000 + parseInt(dateStr.substring(0, 2), 10);
  const month = parseInt(dateStr.substring(2, 4), 10);
  const day = parseInt(dateStr.substring(4, 6), 10);
  const hour = dateStr.length >= 8 ? parseInt(dateStr.substring(6, 8), 10) : 0;
  const minute = dateStr.length >= 10 ? parseInt(dateStr.substring(8, 10), 10) : 0;
  // NOTAM 시간은 UTC (Z 표기). Date.UTC 로 파싱해야 period 필터가 timezone-correct.
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day) ||
      Number.isNaN(hour) || Number.isNaN(minute)) return null;
  // Validate ranges before constructing Date — prevents month=0 wrapping to Dec of prior year.
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

function extractNotamDates(fullText) {
  if (!fullText) return { start: null, end: null };
  const startMatch = fullText.match(/B\)\s*(\d{10})/);
  const start = startMatch ? parseNotamDate(startMatch[1]) : null;
  const endMatch = fullText.match(/C\)\s*(\d{10}|PERM)/);
  let end = null;
  if (endMatch) {
    end = endMatch[1] === 'PERM' ? new Date(2099, 11, 31) : parseNotamDate(endMatch[1]);
  }
  return { start, end };
}

function isValidInPeriod(notam, period) {
  if (!period || period === 'all') return true;
  const now = new Date();
  const { start, end } = extractNotamDates(notam.full_text);

  if (period === 'current') {
    if (start && start > now) return false;
    if (end && end < now) return false;
    return true;
  }

  let periodStart, periodEnd;
  if (period === '1month') {
    periodStart = new Date(now.getTime() - 30 * 86400000);
    periodEnd = new Date(now.getTime() + 30 * 86400000);
  } else if (period === '1year') {
    periodStart = new Date(now.getTime() - 365 * 86400000);
    periodEnd = new Date(now.getTime() + 365 * 86400000);
  } else {
    return true;
  }

  if (start && start > periodEnd) return false;
  if (end && end < periodStart) return false;
  return true;
}

// ============================================================
// 방식 1: Supabase PostgREST DB 쿼리
// ============================================================

async function fetchFromDatabase(params) {
  const { limit, period, bounds } = params;

  const queryParams = new URLSearchParams();
  queryParams.set('select', 'notam_number,location,full_text,e_text,qcode,qcode_mean,effective_start,effective_end,series,fir,q_lat,q_lon,q_radius_nm,crawled_at');
  queryParams.set('order', 'crawled_at.desc,notam_number.desc');
  queryParams.set('limit', String(limit > 0 ? limit : 2000));

  // 영역 필터 (좌표 있는 것 + 없는 것 모두 포함)
  if (bounds) {
    queryParams.set(
      'or',
      `(and(q_lat.gte.${bounds.south - 1},q_lat.lte.${bounds.north + 1},q_lon.gte.${bounds.west - 1},q_lon.lte.${bounds.east + 1}),q_lat.is.null)`
    );
  }

  const url = `${SUPABASE_URL}/rest/v1/notams?${queryParams.toString()}`;
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Accept': 'application/json',
      'Prefer': 'count=exact'
    }
  });

  if (!response.ok) {
    throw new Error(`PostgREST error: ${response.status} ${response.statusText}`);
  }

  const contentRange = response.headers.get('content-range');
  const totalCount = contentRange ? parseInt(contentRange.split('/')[1], 10) : 0;

  let notamData = await response.json();

  // DB 레코드 → 프론트엔드 포맷
  notamData = notamData.map(row => ({
    notam_number: row.notam_number,
    location: row.location,
    full_text: row.full_text,
    e_text: row.e_text,
    qcode: row.qcode,
    qcode_mean: row.qcode_mean,
    effective_start: row.effective_start,
    effective_end: row.effective_end,
    series: row.series,
    fir: row.fir,
    q_lat: row.q_lat,
    q_lon: row.q_lon,
    q_radius: row.q_radius_nm,
  }));

  // 기간 필터
  const beforePeriod = notamData.length;
  if (period && period !== 'all') {
    notamData = notamData.filter(n => isValidInPeriod(n, period));
  }

  return {
    data: notamData,
    count: totalCount || beforePeriod,
    afterPeriodFilter: notamData.length,
    source: 'database',
  };
}

// ============================================================
// 방식 2: Supabase Storage 폴백 (기존 방식)
// ============================================================

function transformAimNotam(item) {
  return {
    notam_number: item.NOTAM_NO || '',
    location: item.LOCATION || '',
    full_text: item.FULL_TEXT || '',
    e_text: item.ECODE || '',
    qcode: item.QCODE || '',
    qcode_mean: item.QCODE_MEAN || '',
    effective_start: item.EFFECTIVESTART || '',
    effective_end: item.EFFECTIVEEND || '',
    series: item.SERIES || '',
    fir: item.FIR || '',
  };
}

function flattenAimData(aimData) {
  const items = [];
  if (aimData.domestic) {
    for (const seriesItems of Object.values(aimData.domestic)) {
      if (Array.isArray(seriesItems)) {
        for (const item of seriesItems) items.push(transformAimNotam(item));
      }
    }
  }
  if (aimData.international) {
    for (const airportItems of Object.values(aimData.international)) {
      if (Array.isArray(airportItems)) {
        for (const item of airportItems) items.push(transformAimNotam(item));
      }
    }
  }
  if (Array.isArray(aimData.snowtam)) {
    for (const item of aimData.snowtam) items.push(transformAimNotam(item));
  }
  return items;
}

/**
 * AIM Korea (aim.koca.go.kr) 무인증 라이브 NOTAM 패치
 * 1. /pib/pibMain.do 로 세션 쿠키 획득
 * 2. /pib/aisSearch.do POST 로 NOTAM 검색
 * 3. 응답을 프로젝트 표준 포맷으로 변환
 */
async function fetchAimKoreaLive() {
  // Cache hit
  const now = Date.now();
  if (aimLiveCache.data && (now - aimLiveCache.fetchedAt) < aimLiveCache.ttlMs) {
    return { data: aimLiveCache.data, cached: true };
  }

  try {
    // Step 1: init session, capture cookie
    const initRes = await fetch(AIM_KOREA_INIT, {
      method: 'GET',
      headers: { 'User-Agent': 'KoreanSurveillance/1.0 NOTAM-bot' }
    });
    const setCookie = initRes.headers.get('set-cookie') || '';
    const jsessionMatch = setCookie.match(/JSESSIONID=([^;]+)/);
    if (!jsessionMatch) {
      console.warn('[NOTAM/AIM] no JSESSIONID in init response');
      return { data: null, error: 'no_session_cookie' };
    }
    const jsessionId = jsessionMatch[1];

    // Step 2: search (today + 7 days range to capture current + upcoming)
    const today = new Date();
    const future = new Date(today.getTime() + 7 * 86400_000);
    const fmt = (d) => d.toISOString().substring(0, 10);

    const params = new URLSearchParams({
      validity_from: fmt(today),
      validity_to: fmt(future),
      ais_type: 'NOTAM',
      traffic: 'I',
      fir: 'RKRR',
    });

    const searchRes = await fetch(AIM_KOREA_SEARCH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': `JSESSIONID=${jsessionId}`,
        'Referer': AIM_KOREA_INIT,
        'User-Agent': 'KoreanSurveillance/1.0 NOTAM-bot',
      },
      body: params.toString(),
    });

    if (!searchRes.ok) {
      console.warn('[NOTAM/AIM] search HTTP', searchRes.status);
      return { data: null, error: `http_${searchRes.status}` };
    }

    const json = await searchRes.json();
    const records = Array.isArray(json?.DATA) ? json.DATA : [];

    // Step 3: transform to project format
    const transformed = records.map((r) => transformAimRecord(r)).filter(Boolean);

    // Update cache
    aimLiveCache = { data: transformed, fetchedAt: now, ttlMs: aimLiveCache.ttlMs };
    return { data: transformed, cached: false, raw_count: records.length };
  } catch (e) {
    console.warn('[NOTAM/AIM] fetch failed:', e.message);
    return { data: null, error: e.message };
  }
}

/**
 * AIM Korea 레코드 → 프로젝트 표준 포맷
 */
function transformAimRecord(r) {
  if (!r || !r.LOCATION || !r.NOTAM_NO) return null;

  // ECODE / FULL_TEXT 안의 \r\n 정리는 그대로 둠 (parser 가 처리)
  const fullText = (r.FULL_TEXT || '').trim();
  const eText = (r.ECODE || '').trim();

  // 좌표 / 반경 추출 (Q-line) — 공유 유틸 사용
  const q = parseQLine(fullText);
  const q_lat = q ? q.lat : null;
  const q_lon = q ? q.lon : null;
  const q_radius = q ? q.radius : null;

  // 시작/종료 일시 ISO 변환
  const cleanStart = (r.EFFECTIVE_START || '').replace(/\r?\n/g, '').trim();
  const cleanEnd = (r.EFFECTIVE_END || '').replace(/\r?\n/g, '').trim();
  const startISO = yymmddhhmmToISO(cleanStart);
  const endISO = cleanEnd === 'PERM' ? 'PERM' : yymmddhhmmToISO(cleanEnd);

  // qcode 추출
  const qcode = extractQCode(fullText);
  // series (NOTAM 번호의 접두 문자)
  const seriesMatch = (r.NOTAM_NO || '').match(/^([A-Z])/);
  const series = seriesMatch ? seriesMatch[1] : 'A';

  return {
    notam_number: r.NOTAM_NO,
    notam_id: r.NOTAM_NO,
    location: r.LOCATION,
    full_text: fullText,
    e_text: eText,
    qcode,
    qcode_mean: r.QCODE_DESC || '',
    effective_start: startISO || cleanStart,
    effective_end: endISO || cleanEnd,
    series,
    fir: r.FIR || 'RKRR',
    q_lat,
    q_lon,
    q_radius,
    crawled_at: new Date().toISOString(),
  };
}

function yymmddhhmmToISO(s) {
  if (!s || s.length < 10) return null;
  if (!/^\d{10}/.test(s)) return null;
  const yy = parseInt(s.substring(0, 2), 10);
  const mm = parseInt(s.substring(2, 4), 10);
  const dd = parseInt(s.substring(4, 6), 10);
  const hh = parseInt(s.substring(6, 8), 10);
  const mn = parseInt(s.substring(8, 10), 10);
  const yyyy = yy >= 50 ? 1900 + yy : 2000 + yy;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const d = new Date(Date.UTC(yyyy, mm - 1, dd, hh, mn));
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

async function fetchStaticFallback() {
  try {
    const fallbackResponse = await fetch(STATIC_FALLBACK_URL);
    if (!fallbackResponse.ok) {
      console.warn('Static fallback failed:', fallbackResponse.status);
      return null;
    }

    const data = await fallbackResponse.json();
    const list = Array.isArray(data) ? data : [];

    if (!Array.isArray(list)) {
      return null;
    }

    return list.map((item) => ({
      notam_number: item.notam_id || item.notam_number || '',
      location: item.location || item.icao || '',
      full_text: item.full_text || '',
      e_text: item.message || item.e_text || '',
      qcode: item.qcode || item.type || '',
      qcode_mean: item.qcode_desc || item.qcode_mean || '',
      effective_start: item.effectiveStart || item.effective_start || '',
      effective_end: item.effectiveEnd || item.effective_end || '',
      series: item.series || '',
      fir: item.fir || '',
      q_lat: item.latitude || item.q_lat,
      q_lon: item.longitude || item.q_lon,
      q_radius: item.radius || item.q_radius,
      crawled_at: null,
    }));
  } catch (error) {
    console.warn('Static fallback error:', error.message);
    return null;
  }
}

async function fetchFromStorage(params) {
  const { period, bounds } = params;

  if (!SUPABASE_PUBLIC) {
    // 우선순위 1: AIM Korea 라이브 (무인증, 5분 캐시)
    const aimLive = await fetchAimKoreaLive();
    if (aimLive.data && aimLive.data.length > 0) {
      let filtered = aimLive.data;
      // 영역 필터
      if (bounds) {
        filtered = filtered.filter(notam => {
          const coords = parseNotamCoordinates(notam.full_text);
          if (!coords) return false;
          return isInBounds(coords.lat, coords.lon, bounds);
        });
      }
      return {
        data: filtered,
        count: filtered.length,
        afterPeriodFilter: filtered.length,
        source: aimLive.cached ? 'aim-korea-cached' : 'aim-korea-live',
        file: 'aim.koca.go.kr',
        crawled_at: new Date(aimLive.cached ? aimLiveCache.fetchedAt : Date.now()).toISOString(),
      };
    }

    // 우선순위 2: tbas.vercel.app 정적 fallback (AIM 실패 시)
    console.warn('AIM Korea live failed, falling back to static:', aimLive.error);
    const staticFallback = await fetchStaticFallback();
    if (staticFallback) {
      let filtered = staticFallback;
      if (bounds) {
        filtered = filtered.filter(notam => {
          const coords = parseNotamCoordinates(notam.full_text);
          if (!coords) return false;
          return isInBounds(coords.lat, coords.lon, bounds);
        });
      }
      return {
        data: filtered,
        count: filtered.length,
        afterPeriodFilter: filtered.length,
        source: 'static-fallback',
        file: 'http-fallback',
        crawled_at: null,
      };
    }
    return {
      data: [],
      count: 0,
      afterPeriodFilter: 0,
      source: 'static-fallback',
      file: 'http-fallback',
      crawled_at: null,
    };
  }

  const today = new Date().toISOString().split('T')[0];
  let latestPath = `notam_realtime/${today}/notam_latest.json`;
  let fileUrl = `${SUPABASE_PUBLIC}/${latestPath}`;
  let response = await fetch(fileUrl);
  let usedStaticFallback = false;

  if (!response.ok) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    latestPath = `notam_realtime/${yesterday}/notam_latest.json`;
    fileUrl = `${SUPABASE_PUBLIC}/${latestPath}`;
    response = await fetch(fileUrl);
  }

  // Helper to check if data is empty/invalid
  const isEmptyData = (data) => !data ||
    (Array.isArray(data) && data.length === 0) ||
    (typeof data === 'object' && !Array.isArray(data) &&
     !data.domestic && !data.international && !data.snowtam);

  // Try to get data from Supabase storage response
  let rawData = null;
  if (response.ok) {
    try {
      rawData = await response.json();
    } catch (parseError) {
      console.warn('Storage JSON parse failed:', parseError.message);
    }
  }

  // If storage failed or returned empty, use HTTP fallback
  if (isEmptyData(rawData)) {
    console.info('Storage unavailable or empty, fetching from static fallback URL');
    const fallbackItems = await fetchStaticFallback();
    if (fallbackItems) {
      rawData = fallbackItems;
      usedStaticFallback = true;
      latestPath = 'http-fallback';
      console.info(`HTTP fallback loaded ${fallbackItems.length} items`);
    }
  }

  let notamData;

  // Handle different data formats
  if (Array.isArray(rawData)) {
    // Static fallback format (direct array from /data/notams.json)
    notamData = rawData.map(item => ({
      notam_number: item.notam_id || item.notam_number || '',
      location: item.location || item.icao || '',
      full_text: item.full_text || '',
      e_text: item.message || item.e_text || '',
      qcode: item.qcode || item.type || '',
      qcode_mean: item.qcode_desc || item.qcode_mean || '',
      effective_start: item.effectiveStart || item.effective_start || '',
      effective_end: item.effectiveEnd || item.effective_end || '',
      series: item.series || '',
      fir: item.fir || '',
      q_lat: item.latitude || item.q_lat,
      q_lon: item.longitude || item.q_lon,
      q_radius: item.radius || item.q_radius,
    }));
  } else if (rawData && typeof rawData === 'object') {
    // AIM format (object with domestic/international structure)
    notamData = flattenAimData(rawData);
  } else {
    notamData = [];
  }
  const totalCount = notamData.length;

  if (period && period !== 'all') {
    notamData = notamData.filter(n => isValidInPeriod(n, period));
  }
  const afterPeriodCount = notamData.length;

  if (bounds) {
    notamData = notamData.filter(notam => {
      const coords = parseNotamCoordinates(notam.full_text);
      if (!coords) return false;
      return isInBounds(coords.lat, coords.lon, bounds);
    });
  }

  return {
    data: notamData,
    count: totalCount,
    afterPeriodFilter: afterPeriodCount,
    source: usedStaticFallback ? 'static-fallback' : 'storage',
    file: latestPath,
    crawled_at: Array.isArray(rawData) ? null : (rawData.crawled_at || null),
  };
}

// ============================================================
// API Handler
// ============================================================

export default async function handler(req, res) {
  // DO-278A SRS-SEC-002: CORS
  if (setCorsHeaders(req, res)) return;
  // DO-278A SRS-SEC-003: Rate Limiting
  if (await checkRateLimit(req, res)) return;

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // limit 검증 — DoS 방지를 위해 상한 10000
    const MAX_LIMIT = 10000;
    const rawLimit = parseInt(url.searchParams.get('limit'), 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_LIMIT)
      : 0;

    // period whitelist 검증
    const VALID_PERIODS = new Set(['current', '1month', '1year', 'all']);
    const rawPeriod = url.searchParams.get('period') || 'all';
    if (!VALID_PERIODS.has(rawPeriod)) {
      return res.status(400).json({
        error: 'Invalid period parameter',
        valid: Array.from(VALID_PERIODS),
        data: [],
      });
    }
    const period = rawPeriod;

    const boundsParam = url.searchParams.get('bounds');
    let bounds = null;
    if (boundsParam) {
      const [south, west, north, east] = boundsParam.split(',').map(Number);
      if ([south, west, north, east].some(v => !Number.isFinite(v))) {
        return res.status(400).json({ error: 'Invalid bounds parameter', data: [] });
      }
      // bounds 일관성 검증 — south < north, west < east
      if (south >= north || west >= east) {
        return res.status(400).json({
          error: 'Invalid bounds: south must be < north, west < east',
          data: [],
        });
      }
      const clamped = {
        south: Math.max(-90, Math.min(90, south)),
        north: Math.max(-90, Math.min(90, north)),
        west: Math.max(-180, Math.min(180, west)),
        east: Math.max(-180, Math.min(180, east)),
      };
      bounds = clamped;
    }

    const params = { limit, period, bounds };
    let result;

    // DB 우선 → Storage 폴백 → Static 폴백
    if (HAS_SUPABASE_BACKEND) {
      try {
        result = await fetchFromDatabase(params);
        // DB에 데이터가 없으면 Storage 폴백
        if (result.data.length === 0) {
          result = await fetchFromStorage(params);
        }
      } catch (dbError) {
        console.warn('DB query failed, falling back to Storage:', dbError.message);
        result = await fetchFromStorage(params);
      }
    } else {
      result = await fetchFromStorage(params);
    }

    let { data: notamData, ...meta } = result;

    const filteredCount = notamData.length;
    if (limit > 0 && notamData.length > limit) {
      notamData = notamData.slice(0, limit);
    }

    // Content-Type 명시적 설정 (브라우저 호환성)
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({
      data: notamData,
      ...meta,
      filtered: filteredCount,
      returned: notamData.length,
      period,
      bounds,
    });
  } catch (error) {
    console.error('NOTAM fetch error:', error.message);
    // 에러 details 는 로컬 dev 에서만 노출.
    // Vercel preview 도 NODE_ENV !== 'production' 이라 leak 가능했음 — VERCEL_ENV 까지 체크.
    const isLocalDev = process.env.NODE_ENV === 'development' && !process.env.VERCEL_ENV;
    res.status(500).json({
      error: 'NOTAM service temporarily unavailable',
      code: 'NOTAM_ERROR',
      ...(isLocalDev && { details: error.message }),
    });
  }
}
