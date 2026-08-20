/**
 * UBIKAIS (FOIS) 실시간 운항스케줄 (IFR FIDS) 스크래퍼
 * - 공항별(RKSI, RKSS, RKPC, RKPK, RKTU, RKTN, RKJJ 등) 출발/도착 운항스케줄 실시간 수집
 * - FPL, DEP, ARR, DLA 전문 생성 원천 데이터 제공
 */

let cachedSchedules = {};
let lastScheduleFetchTime = {};

export async function fetchUbikaisSchedule(airport = 'RKSI', depArr = 'dep') {
  const cacheKey = `${airport}_${depArr}`;
  const now = Date.now();

  // 10초 인메모리 캐시
  if (cachedSchedules[cacheKey] && (now - (lastScheduleFetchTime[cacheKey] || 0)) < 10000) {
    return cachedSchedules[cacheKey];
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': 'https://ubikais.fois.go.kr:8030/common/login?systemId=sysUbikais',
  };

  try {
    const res = await fetch(`https://ubikais.fois.go.kr:8030/main/selectIfr.fois?depArr=${depArr}&apIcao=${airport}`, {
      headers,
      signal: AbortSignal.timeout(5000)
    });

    if (res.ok) {
      const json = await res.json();
      const records = json.records || [];
      cachedSchedules[cacheKey] = records;
      lastScheduleFetchTime[cacheKey] = now;
      return records;
    }
  } catch (e) {
    console.error(`UBIKAIS fetch error for ${airport} ${depArr}:`, e.message);
  }

  return cachedSchedules[cacheKey] || [];
}
