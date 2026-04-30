/**
 * NOTAM Q-line 좌표/반경/고도 파서 — API 측 공유 유틸
 *
 * NOTAM 의 Q) 라인 형식:
 *   Q) FIR / QCODE / TRAFFIC / PURPOSE / SCOPE / LOWER / UPPER / COORD
 *   예: Q)RKRR/QMRLC/IV/NBO/A/000/100/3729N12626E005
 *
 *   COORD 는 DDMMSS[N|S]DDDMMSS[E|W] + radius(NM) 형식.
 *
 * api/notam.js + 향후 다른 api 함수가 동일 로직을 reimplement 하지 않도록 단일 소스로.
 */

const QLINE_FULL_RE =
  /Q\)\s*\S+\/\S+\/\S+\/\S+\/\S+\/(\d{3})\/(\d{3})\/(\d{4})([NS])(\d{5})([EW])(\d{3})/;

const QLINE_COORD_ONLY_RE =
  /Q\)\s*\S+\/\S+\/\S+\/\S+\/\S+\/\d{3}\/\d{3}\/(\d{4})([NS])(\d{5})([EW])\d{3}/;

const QCODE_RE = /Q\)\s*[A-Z]{4}\/(Q[A-Z]{4})\//;

/**
 * Q-line 에서 lat/lon (DD + MM 분 단위로 decimal 변환).
 * 좌표만 필요하면 이 함수.
 *
 * @param {string} fullText - NOTAM full_text
 * @returns {{ lat: number, lon: number } | null}
 */
function parseQLineCoords(fullText) {
  if (!fullText) return null;
  const m = fullText.match(QLINE_COORD_ONLY_RE);
  if (!m) return null;
  const [, latDeg, latDir, lonDeg, lonDir] = m;
  const latDegrees = parseInt(latDeg.substring(0, 2), 10);
  const latMinutes = parseInt(latDeg.substring(2, 4), 10);
  let lat = latDegrees + latMinutes / 60;
  if (latDir === 'S') lat = -lat;
  const lonDegrees = parseInt(lonDeg.substring(0, 3), 10);
  const lonMinutes = parseInt(lonDeg.substring(3, 5), 10);
  let lon = lonDegrees + lonMinutes / 60;
  if (lonDir === 'W') lon = -lon;
  return { lat, lon };
}

/**
 * Q-line 전체 파싱: lat/lon + radius (NM) + lower/upper altitude (FL units = hundreds of feet).
 *
 * @param {string} fullText - NOTAM full_text
 * @returns {{ lat: number, lon: number, radius: number, lowerFL: number, upperFL: number } | null}
 */
function parseQLine(fullText) {
  if (!fullText) return null;
  const m = fullText.match(QLINE_FULL_RE);
  if (!m) return null;
  const [, lowerFL, upperFL, latDeg, latDir, lonDeg, lonDir, radiusStr] = m;
  const latDegrees = parseInt(latDeg.substring(0, 2), 10);
  const latMinutes = parseInt(latDeg.substring(2, 4), 10);
  let lat = latDegrees + latMinutes / 60;
  if (latDir === 'S') lat = -lat;
  const lonDegrees = parseInt(lonDeg.substring(0, 3), 10);
  const lonMinutes = parseInt(lonDeg.substring(3, 5), 10);
  let lon = lonDegrees + lonMinutes / 60;
  if (lonDir === 'W') lon = -lon;
  return {
    lat,
    lon,
    radius: parseInt(radiusStr, 10),
    lowerFL: parseInt(lowerFL, 10),
    upperFL: parseInt(upperFL, 10),
  };
}

/**
 * Q-line 에서 QCODE 추출 (5자 — Q + 4글자, 예: QMRLC).
 *
 * @param {string} fullText - NOTAM full_text
 * @returns {string} - QCODE 또는 빈 문자열
 */
function extractQCode(fullText) {
  if (!fullText) return '';
  const m = fullText.match(QCODE_RE);
  return m ? m[1] : '';
}

export { parseQLineCoords, parseQLine, extractQCode };
