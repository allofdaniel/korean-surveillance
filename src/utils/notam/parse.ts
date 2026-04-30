/**
 * NOTAM Parse Utilities
 * NOTAM 파싱 관련 유틸리티 함수 모음
 */

import { parseNotamDateString } from '../format';
import type { NotamCoordinates, Notam } from './types';

interface ExtractedDates {
  start: Date | null;
  end: Date | null;
}

/**
 * NOTAM Q-line 좌표 파싱
 * 유효성 검증 포함
 */
export const parseNotamCoordinates = (fullText: string | null | undefined): NotamCoordinates | null => {
  if (!fullText) return null;
  // Q-line format: Q) FIR/QCODE/TRAFFIC/PURPOSE/SCOPE/LOWER/UPPER/COORD
  // Normalize whitespace to handle real-world NOTAMs with extra spaces inside Q-line parts
  const normalizedText = fullText.replace(/\s+/g, ' ').trim();
  const qLineMatch = normalizedText.match(/Q\)\s*\S+\/\S+\/\S+\/\S+\/\S+\/(\d{3})\/(\d{3})\/(\d{4})([NS])(\d{5})([EW])(\d{3})/);
  if (!qLineMatch || qLineMatch.length < 8) return null;

  const [, lowerAlt, upperAlt, latDeg, latDir, lonDeg, lonDir, radiusNM] = qLineMatch;

  // 입력 유효성 검증
  if (!latDeg || latDeg.length !== 4) return null;
  if (!lonDeg || lonDeg.length !== 5) return null;

  // Parse latitude: DDMM format
  const latDegrees = parseInt(latDeg.substring(0, 2), 10);
  const latMinutes = parseInt(latDeg.substring(2, 4), 10);

  // 위도 유효성 검증
  if (isNaN(latDegrees) || isNaN(latMinutes)) return null;
  if (latDegrees < 0 || latDegrees > 90) return null;
  if (latMinutes < 0 || latMinutes >= 60) return null;

  let lat = latDegrees + latMinutes / 60;
  if (latDir === 'S') lat = -lat;

  // Parse longitude: DDDMM format
  const lonDegrees = parseInt(lonDeg.substring(0, 3), 10);
  const lonMinutes = parseInt(lonDeg.substring(3, 5), 10);

  // 경도 유효성 검증
  if (isNaN(lonDegrees) || isNaN(lonMinutes)) return null;
  if (lonDegrees < 0 || lonDegrees > 180) return null;
  if (lonMinutes < 0 || lonMinutes >= 60) return null;

  let lon = lonDegrees + lonMinutes / 60;
  if (lonDir === 'W') lon = -lon;

  // radiusNM=0 renders as a single point (ambiguous). Use '5' as nullish default so that
  // missing regex groups default to 5 NM rather than 0. Explicit '000' from a Q-line
  // produces 0, which downstream callers guard with `|| 5` to keep rendering safe.
  const radius = parseInt(radiusNM ?? '5', 10);
  const lower = parseInt(lowerAlt ?? '0', 10);
  const upper = parseInt(upperAlt ?? '0', 10);

  // 최종 유효성 검증
  if (isNaN(radius) || isNaN(lower) || isNaN(upper)) return null;

  return {
    lat,
    lon,
    radiusNM: radius,
    lowerAlt: lower * 100, // FL to feet
    upperAlt: upper * 100,
  };
};

/**
 * NOTAM 타입 파싱 (N=New, R=Replace, C=Cancel)
 * 헤더 부분에서만 검색하여 본문 오탐 방지
 */
export const getNotamType = (fullText: string | null | undefined): 'N' | 'R' | 'C' => {
  if (!fullText) return 'N';
  // NOTAM 헤더는 보통 처음 200자 이내에 있음
  const header = fullText.substring(0, 200);
  // 정확한 패턴 매칭: NOTAMN, NOTAMR, NOTAMC 뒤에 공백이나 줄바꿈이 옴
  if (/NOTAMC[\s\n]/.test(header)) return 'C'; // Cancel
  if (/NOTAMR[\s\n]/.test(header)) return 'R'; // Replace
  // includes도 헤더에서만 확인 (fallback)
  if (header.includes('NOTAMC')) return 'C';
  if (header.includes('NOTAMR')) return 'R';
  return 'N'; // New - default
};

/**
 * 취소/교체된 NOTAM 참조 추출
 */
export const getCancelledNotamRef = (fullText: string | null | undefined): string | null => {
  if (!fullText) return null;
  // Pattern: NOTAMC or NOTAMR followed by the reference (e.g., "NOTAMC A1045/24")
  const match = fullText.match(/NOTAM[CR]\s+([A-Z]\d{4}\/\d{2})/);
  return match?.[1] ?? null;
};

/**
 * NOTAM 전문에서 시작/종료 날짜 추출
 */
export const extractDatesFromFullText = (fullText: string | null | undefined): ExtractedDates => {
  if (!fullText) return { start: null, end: null };

  // Item B: start date B) YYMMDDHHMM
  const startMatch = fullText.match(/B\)\s*(\d{10})/);
  const start = startMatch ? parseNotamDateString(startMatch[1]) : null;

  // Item C: end date C) YYMMDDHHMM or PERM or EST
  const endMatch = fullText.match(/C\)\s*(\d{10}|PERM)/);
  let end: Date | null = null;
  if (endMatch) {
    if (endMatch[1] === 'PERM') {
      end = new Date(Date.UTC(2099, 11, 31)); // Permanent = far future (UTC)
    } else {
      end = parseNotamDateString(endMatch[1]);
    }
  }

  return { start, end };
};

/**
 * 취소된 NOTAM 세트 빌드
 */
export const buildCancelledNotamSet = (notams: Notam[] | null | undefined): Set<string> => {
  const cancelledSet = new Set<string>();
  if (!notams) return cancelledSet;

  notams.forEach(n => {
    const type = getNotamType(n.full_text);
    if (type === 'C' || type === 'R') {
      const ref = getCancelledNotamRef(n.full_text);
      if (ref) cancelledSet.add(ref);
    }
  });

  return cancelledSet;
};

/**
 * DMS 좌표 하나를 decimal degrees로 변환
 * format: DDMMSS[NS] or DDDMMSS[EW]
 */
export const parseDmsCoord = (dms: string, isLon: boolean): number | null => {
  const len = isLon ? 7 : 6; // DDDMMSS vs DDMMSS (direction char excluded)
  if (dms.length < len + 1) return null;
  const dir = dms.charAt(dms.length - 1);
  const numPart = dms.substring(0, dms.length - 1);

  let deg: number, min: number, sec: number;
  if (isLon) {
    deg = parseInt(numPart.substring(0, 3), 10);
    min = parseInt(numPart.substring(3, 5), 10);
    sec = parseInt(numPart.substring(5, 7), 10);
  } else {
    deg = parseInt(numPart.substring(0, 2), 10);
    min = parseInt(numPart.substring(2, 4), 10);
    sec = parseInt(numPart.substring(4, 6), 10);
  }

  if (isNaN(deg) || isNaN(min) || isNaN(sec)) return null;
  let val = deg + min / 60 + sec / 3600;
  if (dir === 'S' || dir === 'W') val = -val;
  return val;
};

/**
 * Decimal-second DMS 좌표 파싱
 * format: DDMMSS[.SS]N/S 또는 DDDMMSS[.SS]E/W (소수점 초 허용)
 */
export const parseDecDmsCoord = (s: string, isLon: boolean): number | null => {
  const m = isLon
    ? s.match(/^(\d{3})(\d{2})(\d{2}(?:\.\d+)?)\s*([EW])$/)
    : s.match(/^(\d{2})(\d{2})(\d{2}(?:\.\d+)?)\s*([NS])$/);
  if (!m) return null;
  const deg = parseFloat(m[1]!);
  const min = parseFloat(m[2]!);
  const sec = parseFloat(m[3]!);
  const dir = m[4]!;
  if (isNaN(deg) || isNaN(min) || isNaN(sec)) return null;
  let val = deg + min / 60 + sec / 3600;
  if (dir === 'S' || dir === 'W') val = -val;
  return val;
};

/**
 * NOTAM E-text에서 다각형 좌표 추출
 * 지원 패턴:
 *   1) DMS 체인 — 363910N1272105E-363909N1272110E-... (하이픈 구분)
 *   2) 번호 매긴 목록 — "1. 345839.64N 1262251.89E\n 2. 345839.64N 1262300.25E\n ..." (소수점 초 허용)
 * 줄바꿈이 좌표 중간에 들어올 수 있음 (AIM long-line wrap)
 */
export const parseNotamPolygon = (fullText: string | null | undefined): [number, number][][] | null => {
  if (!fullText) return null;

  // Normalize: remove \r\n within coordinate sequences (AIM wraps long lines)
  const normalized = fullText.replace(/\r?\n/g, '');

  // Pattern 1: DMS chain (hyphen-separated, no decimal seconds)
  const polyPattern = /(\d{6}[NS]\d{7}[EW])(?:\s*-\s*(\d{6}[NS]\d{7}[EW])){2,}/g;
  const match = polyPattern.exec(normalized);
  if (match) {
    const coordPairs = match[0].split(/\s*-\s*/);
    if (coordPairs.length >= 3) {
      const ring: [number, number][] = [];
      let allOk = true;
      for (const pair of coordPairs) {
        const latPart = pair.substring(0, 7);  // DDMMSSN
        const lonPart = pair.substring(7);     // DDDMMSSE
        const lat = parseDmsCoord(latPart, false);
        const lon = parseDmsCoord(lonPart, true);
        if (lat === null || lon === null) { allOk = false; break; }
        ring.push([lon, lat]);
      }
      if (allOk && ring.length >= 3) {
        const first = ring[0]!;
        const last = ring[ring.length - 1]!;
        const EPS = 1e-9;
        const closed = Math.abs(first[0] - last[0]) < EPS && Math.abs(first[1] - last[1]) < EPS;
        if (!closed) ring.push([first[0], first[1]]);
        return [ring];
      }
    }
  }

  // Pattern 2: numbered list with decimal-second DMS coords
  // e.g., "1. 345839.64N 1262251.89E\n 2. 345839.64N 1262300.25E"
  // After normalization (no newlines), match: "1. {lat} {lon} 2. {lat} {lon} ..."
  const numberedPattern = /(\d+)\s*\.\s*(\d{6}(?:\.\d+)?[NS])\s+(\d{7}(?:\.\d+)?[EW])/g;
  const numberedMatches: Array<{ lat: string; lon: string }> = [];
  let nm: RegExpExecArray | null;
  while ((nm = numberedPattern.exec(normalized)) !== null) {
    numberedMatches.push({ lat: nm[2]!, lon: nm[3]! });
  }
  if (numberedMatches.length >= 3) {
    const ring: [number, number][] = [];
    let allOk = true;
    for (const { lat: latStr, lon: lonStr } of numberedMatches) {
      const lat = parseDecDmsCoord(latStr, false);
      const lon = parseDecDmsCoord(lonStr, true);
      if (lat === null || lon === null) { allOk = false; break; }
      ring.push([lon, lat]);
    }
    if (allOk && ring.length >= 3) {
      const first = ring[0]!;
      const last = ring[ring.length - 1]!;
      const EPS = 1e-9;
      const closed = Math.abs(first[0] - last[0]) < EPS && Math.abs(first[1] - last[1]) < EPS;
      if (!closed) ring.push([first[0], first[1]]);
      return [ring];
    }
  }

  return null;
};

/**
 * NOTAM E-text에서 "A CIRCLE RADIUS X NM CENTERED ON DMS" 패턴으로
 * 정확한 중심/반경 추출. Q-line 의 bounding circle 보다 정확.
 *
 * 지원 단위: NM (해리), M (미터). 미터는 NM 으로 변환 (1 NM = 1852 m).
 *
 * 예:
 *   "A CIRCLE RADIUS 1.8NM CENTERED ON 363144N1261938E" → {lat, lon, radiusNM: 1.8}
 *   "A CIRCLE RADIUS 100M CENTERED ON 373547N1264720E" → {lat, lon, radiusNM: 0.054}
 */
export const parseNotamCircleFromText = (
  fullText: string | null | undefined,
): { lat: number; lon: number; radiusNM: number } | null => {
  if (!fullText) return null;
  const normalized = fullText.replace(/\r?\n/g, ' ');

  // Match: CIRCLE [OF] RADIUS <num> <NM|M> CENTERED ON <DMS>
  // num: integer or decimal (1, 1.8, 100)
  // DMS: DDMMSS[.SS]N + DDDMMSS[.SS]E
  const re = /CIRCLE\s+(?:OF\s+)?RADIUS\s+(\d+(?:\.\d+)?)\s*(NM|KM|M)\s+CENTERED\s+ON\s+(\d{6}(?:\.\d+)?[NS])\s*(\d{7}(?:\.\d+)?[EW])/i;
  const m = normalized.match(re);
  if (!m) return null;

  const num = parseFloat(m[1]!);
  const unit = m[2]!.toUpperCase();
  const latStr = m[3]!;
  const lonStr = m[4]!;
  if (isNaN(num) || num <= 0) return null;

  let radiusNM: number;
  if (unit === 'NM') radiusNM = num;
  else if (unit === 'KM') radiusNM = num / 1.852;
  else if (unit === 'M') radiusNM = num / 1852; // meters → NM
  else return null;

  const lat = parseDecDmsCoord(latStr, false);
  const lon = parseDecDmsCoord(lonStr, true);
  if (lat === null || lon === null) return null;

  return { lat, lon, radiusNM };
};
