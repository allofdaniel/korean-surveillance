/**
 * UBIKAIS (FOIS) 실시간 운항스케줄 네트워크 게이트웨이 스크래퍼
 * - 전국 15개 공항 실시간 IFR FPL, DEP, ARR 데이터 실시간 수집 및 누적 링버퍼
 */

const liveFlightRingBuffer = {
  dep: new Map(),
  arr: new Map()
};

let lastFetchTime = {};

export async function fetchUbikaisSchedule(airport = 'RKSI', depArr = 'dep') {
  const cacheKey = `${airport}_${depArr}`;
  const now = Date.now();

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': 'https://ubikais.fois.go.kr:8030/common/login?systemId=sysUbikais',
  };

  try {
    const res = await fetch(`https://ubikais.fois.go.kr:8030/main/selectIfr.fois?depArr=${depArr}&apIcao=${airport}&_t=${now}`, {
      headers,
      signal: AbortSignal.timeout(5000)
    });

    if (res.ok) {
      const json = await res.json();
      const records = json.records || [];
      
      // Store in airport ring buffer to accumulate sliding window real flights
      if (!liveFlightRingBuffer[depArr].has(airport)) {
        liveFlightRingBuffer[depArr].set(airport, new Map());
      }
      const apMap = liveFlightRingBuffer[depArr].get(airport);

      records.forEach(r => {
        const id = r.fpId || r.flightNumber || r.flt;
        if (id) {
          apMap.set(id, { ...r, lastSeen: now });
        }
      });

      lastFetchTime[cacheKey] = now;
      return Array.from(apMap.values());
    }
  } catch (e) {
    console.error(`[UBIKAIS Network] Fetch error for ${airport} ${depArr}:`, e.message);
  }

  const cachedMap = liveFlightRingBuffer[depArr]?.get(airport);
  return cachedMap ? Array.from(cachedMap.values()) : [];
}
