/**
 * NOTAM Geometry Resolver
 *
 * NOTAM 1건 → 지도에 그릴 정확한 지오메트리(폴리곤 좌표 + 중심 + 반경 + 메타).
 * 우선순위 로직을 단 하나의 함수로 통합하여 호출처마다 재구현되어 발생하는
 * 표시 부정확/누락 문제를 원천 차단한다.
 *
 * 우선순위 (정확도 순, 첫 매치 채택):
 *   1. E-text 폴리곤 (DMS 체인 또는 번호 매긴 좌표 목록)
 *   2. E-text 원형 ("A CIRCLE RADIUS X NM CENTERED ON DMS") — Q-line 보다 정확
 *   3. Q-line center + radius (full_text Q) line)
 *   4. q_lat / q_lon DB 컬럼 + q_radius
 *   5. 공항 좌표 fallback (location ICAO 기준) + 기본 5 NM
 *
 * 주의:
 *   - polygon 일 때는 fillRing 사용, marker 위치는 centroid (단순 평균).
 *   - circle/point 일 때는 createNotamCircle() 로 fillRing 생성, marker 위치는 center.
 *   - radiusBucket 은 마커/필 시각 차별화용 (point < 0.5 NM, small ≤ 5, medium ≤ 25,
 *     large ≤ 100, wide > 100).
 *   - FIR-wide (radius ≥ 999) 는 호출처에서 직접 필터링 (이 함수는 항상 결과 반환).
 */

import {
  parseNotamCoordinates,
  parseNotamPolygon,
  parseNotamCircleFromText,
  createNotamCircle,
} from './notam';
import { AIRPORT_COORDINATES } from '../constants/airports';

export type NotamGeomKind = 'polygon' | 'circle' | 'point';
export type NotamGeomSource =
  | 'polygon-text'
  | 'text-circle'
  | 'qline'
  | 'qlat-lon'
  | 'airport-fallback';
export type NotamRadiusBucket = 'point' | 'small' | 'medium' | 'large' | 'wide';

export interface ResolvedNotamGeom {
  /** 폴리곤이냐 원이냐 점이냐. circle/point 도 fillRing 으로 그려진다. */
  kind: NotamGeomKind;
  /** mapbox fill geometry: GeoJSON Polygon coordinates (LngLat ring 1개 이상) */
  fillCoordinates: [number, number][][];
  /** marker(아이콘 + 라벨) 위치. polygon 이면 centroid, circle/point 면 center. */
  centroid: { lat: number; lon: number };
  /** circle/point center (polygon 인 경우 centroid 와 동일) */
  center: { lat: number; lon: number };
  /** NM 단위. polygon 이면 Q-line bounding radius (참고용). */
  radiusNM: number;
  /** 시각 차별화용 버킷 */
  radiusBucket: NotamRadiusBucket;
  /** Q-line lower altitude (feet). 없으면 0. */
  lowerAlt: number;
  /** Q-line upper altitude (feet). 없으면 5000. */
  upperAlt: number;
  /** 어떤 소스로 결정됐는지 (디버깅/QA 용) */
  source: NotamGeomSource;
}

interface NotamLike {
  full_text?: string;
  e_text?: string;
  location?: string;
  notam_number?: string;
  q_lat?: number;
  q_lon?: number;
  q_radius?: number;
  q_lower_alt?: number;
  q_upper_alt?: number;
  [key: string]: unknown;
}

function bucketFor(radiusNM: number): NotamRadiusBucket {
  if (radiusNM < 0.5) return 'point';
  if (radiusNM <= 5) return 'small';
  if (radiusNM <= 25) return 'medium';
  if (radiusNM <= 100) return 'large';
  return 'wide';
}

function ringCentroid(ring: [number, number][]): { lat: number; lon: number } | null {
  if (!ring || ring.length === 0) return null;
  let sx = 0, sy = 0, n = 0;
  for (const [lon, lat] of ring) {
    if (typeof lon !== 'number' || typeof lat !== 'number') continue;
    sx += lon; sy += lat; n++;
  }
  if (n === 0) return null;
  return { lon: sx / n, lat: sy / n };
}

/**
 * NOTAM 1건의 표시 지오메트리를 결정. 항상 결과 반환 (실패 시 null).
 *
 * null 반환 조건: location 도 모르고 Q-line 도 없고 q_lat 도 없는 경우 (그릴 수 없음).
 * 호출처는 null 인 NOTAM 을 필터링해야 한다.
 */
export function resolveNotamGeometry(notam: NotamLike): ResolvedNotamGeom | null {
  const fullText = notam.full_text;

  // Q-line 메타 (altitude/radius 정보) — 폴리곤 NOTAM 도 Q-line 의 alt 는 사용
  const qLine = parseNotamCoordinates(fullText);
  const qLower = qLine?.lowerAlt ?? (notam.q_lower_alt != null ? notam.q_lower_alt * 100 : 0);
  const qUpper = qLine?.upperAlt ?? (notam.q_upper_alt != null ? notam.q_upper_alt * 100 : 5000);

  // 1. E-text 폴리곤 (가장 정확)
  const polygon = parseNotamPolygon(fullText);
  if (polygon && polygon[0] && polygon[0].length >= 3) {
    const ring = polygon[0];
    const centroid = ringCentroid(ring);
    if (centroid) {
      const radiusNM = qLine?.radiusNM ?? notam.q_radius ?? 5;
      return {
        kind: 'polygon',
        fillCoordinates: polygon,
        centroid,
        center: centroid,
        radiusNM,
        radiusBucket: bucketFor(radiusNM),
        lowerAlt: qLower,
        upperAlt: qUpper,
        source: 'polygon-text',
      };
    }
  }

  // 2. E-text 원형 (Q-line 보다 정확한 center+radius)
  const textCircle = parseNotamCircleFromText(fullText);
  if (textCircle) {
    const { lat, lon, radiusNM } = textCircle;
    return {
      kind: radiusNM < 0.5 ? 'point' : 'circle',
      fillCoordinates: createNotamCircle(lon, lat, radiusNM),
      centroid: { lat, lon },
      center: { lat, lon },
      radiusNM,
      radiusBucket: bucketFor(radiusNM),
      lowerAlt: qLower,
      upperAlt: qUpper,
      source: 'text-circle',
    };
  }

  // 3. Q-line center + radius
  if (qLine) {
    return {
      kind: qLine.radiusNM < 0.5 ? 'point' : 'circle',
      fillCoordinates: createNotamCircle(qLine.lon, qLine.lat, qLine.radiusNM || 5),
      centroid: { lat: qLine.lat, lon: qLine.lon },
      center: { lat: qLine.lat, lon: qLine.lon },
      radiusNM: qLine.radiusNM || 5,
      radiusBucket: bucketFor(qLine.radiusNM || 5),
      lowerAlt: qLine.lowerAlt,
      upperAlt: qLine.upperAlt,
      source: 'qline',
    };
  }

  // 4. q_lat / q_lon DB 컬럼
  if (typeof notam.q_lat === 'number' && typeof notam.q_lon === 'number') {
    const radiusNM = typeof notam.q_radius === 'number' ? notam.q_radius : 5;
    return {
      kind: radiusNM < 0.5 ? 'point' : 'circle',
      fillCoordinates: createNotamCircle(notam.q_lon, notam.q_lat, radiusNM || 5),
      centroid: { lat: notam.q_lat, lon: notam.q_lon },
      center: { lat: notam.q_lat, lon: notam.q_lon },
      radiusNM,
      radiusBucket: bucketFor(radiusNM),
      lowerAlt: qLower,
      upperAlt: qUpper,
      source: 'qlat-lon',
    };
  }

  // 5. 공항 좌표 fallback
  const airport = notam.location ? AIRPORT_COORDINATES[notam.location] : null;
  if (airport) {
    return {
      kind: 'circle',
      fillCoordinates: createNotamCircle(airport.lon, airport.lat, 5),
      centroid: { lat: airport.lat, lon: airport.lon },
      center: { lat: airport.lat, lon: airport.lon },
      radiusNM: 5,
      radiusBucket: 'small',
      lowerAlt: 0,
      upperAlt: 5000,
      source: 'airport-fallback',
    };
  }

  return null;
}
