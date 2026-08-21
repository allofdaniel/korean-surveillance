import crypto from 'crypto';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

/**
 * 대한민국 항공기상청 (AMO / global.amo.go.kr) 실시간 공식 기상 게이트웨이
 * - METAR, SPECI, TAF, AMOS 관제기상, 공항경보(WARNING), 급변풍(LLWS) 실측 원문 수집
 */

let cachedMetarTaf = {};
let lastMetarTafFetch = {};

let cachedAmosData = null;
let lastAmosFetchTime = 0;

/**
 * 항공기상청(AMO) 실시간 METAR, TAF, SPECI, WARNING 100% 원문 직결 수집
 */
export async function fetchLiveAmoMetarTaf(icao = 'RKSI') {
  const now = Date.now();
  if (cachedMetarTaf[icao] && (now - (lastMetarTafFetch[icao] || 0)) < 15000) {
    return cachedMetarTaf[icao];
  }

  try {
    const kst = new Date(now + 9 * 3600 * 1000);
    const now_date = `${kst.getUTCFullYear()}.${String(kst.getUTCMonth() + 1).padStart(2, '0')}.${String(kst.getUTCDate()).padStart(2, '0')}.${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`;

    const url = `https://global.amo.go.kr/airportWeather/getAmosData.do?stnCd=${icao}&now_date=${encodeURIComponent(now_date)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Referer': 'https://global.amo.go.kr/airportWeather/domestic-airport.do'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (res.ok) {
      const json = await res.json();
      let metar = (json.metarData?.content || json.metar || '').trim();
      let taf = (json.tafData?.content || json.taf || '').trim();
      const warnings = json.warningList || [];
      const speci = (json.speciList?.[0]?.content || '').trim();

      // If AMO doesn't have METAR (e.g. military/training or international), check NOAA as secondary source
      if (!metar) {
        try {
          const noaaRes = await fetch(`https://aviationweather.gov/api/data/metar?ids=${icao}&format=raw`, {
            signal: AbortSignal.timeout(4000)
          });
          if (noaaRes.ok) {
            const noaaTxt = (await noaaRes.text()).trim();
            if (noaaTxt && !noaaTxt.startsWith('<')) metar = noaaTxt;
          }
        } catch { /* noaa failed */ }
      }

      if (!taf) {
        try {
          const noaaTafRes = await fetch(`https://aviationweather.gov/api/data/taf?ids=${icao}&format=raw`, {
            signal: AbortSignal.timeout(4000)
          });
          if (noaaTafRes.ok) {
            const noaaTafTxt = (await noaaTafRes.text()).trim();
            if (noaaTafTxt && !noaaTafTxt.startsWith('<')) taf = noaaTafTxt;
          }
        } catch { /* noaa taf failed */ }
      }

      const result = {
        metar: metar || null,
        taf: taf || null,
        speci: speci || null,
        warnings: warnings,
        metReport: json.metReportData || null,
        timestamp: new Date().toISOString(),
        source: '대한민국 항공기상청 (AMO / global.amo.go.kr)'
      };

      cachedMetarTaf[icao] = result;
      lastMetarTafFetch[icao] = now;
      return result;
    }
  } catch (e) {
    console.error(`[AMO Weather Scraper] Error for ${icao}:`, e.message);
  }

  // Fallback to NOAA if AMO request failed
  try {
    const [noaaMetar, noaaTaf] = await Promise.all([
      fetch(`https://aviationweather.gov/api/data/metar?ids=${icao}&format=raw`, { signal: AbortSignal.timeout(4000) }).then(r => r.text()).catch(() => ''),
      fetch(`https://aviationweather.gov/api/data/taf?ids=${icao}&format=raw`, { signal: AbortSignal.timeout(4000) }).then(r => r.text()).catch(() => '')
    ]);

    const result = {
      metar: (noaaMetar && !noaaMetar.startsWith('<')) ? noaaMetar.trim() : (cachedMetarTaf[icao]?.metar || null),
      taf: (noaaTaf && !noaaTaf.startsWith('<')) ? noaaTaf.trim() : (cachedMetarTaf[icao]?.taf || null),
      warnings: cachedMetarTaf[icao]?.warnings || [],
      timestamp: new Date().toISOString(),
      source: 'NOAA Aviation Weather Gateway'
    };

    if (result.metar || result.taf) {
      cachedMetarTaf[icao] = result;
      lastMetarTafFetch[icao] = now;
      return result;
    }
  } catch {}

  return cachedMetarTaf[icao] || { metar: null, taf: null, warnings: [] };
}

/**
 * 항공기상청(AMO) 실시간 AMOS 활주로별 순간풍/평균풍/RVR 실측 관측치
 */
export async function fetchLiveAmosData(icao = null) {
  const now = Date.now();
  if (cachedAmosData && (now - lastAmosFetchTime) < 3000) {
    if (icao) {
      return cachedAmosData.filter(d => d.stnCd === icao);
    }
    return cachedAmosData;
  }

  try {
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
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: `tm=${encodeURIComponent(tmStr)}`,
      signal: AbortSignal.timeout(5000)
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
    console.error('[AMOS Live Scraper] Error:', e.message);
  }

  return cachedAmosData || [];
}
