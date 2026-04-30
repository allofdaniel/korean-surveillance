/**
 * NOTAM Display Utilities
 * NOTAM 지도 표시 관련 유틸리티 함수 모음
 */

import { AIRPORT_COORDINATES } from '../../constants/airports';
import { parseNotamCoordinates } from './parse';
import type { Notam, NotamCoordinates } from './types';

/**
 * NOTAM 표시 좌표 가져오기
 * Q-line 우선, 직접 좌표 필드, 없으면 공항 좌표 사용
 */
export const getNotamDisplayCoords = (notam: Notam): NotamCoordinates | null => {
  // First try to parse from Q-line
  const qCoords = parseNotamCoordinates(notam.full_text);
  if (qCoords) return qCoords;

  // Check for direct q_lat/q_lon fields (from local demo data)
  const qLat = notam.q_lat as number | undefined;
  const qLon = notam.q_lon as number | undefined;
  if (qLat !== undefined && qLon !== undefined) {
    return {
      lat: qLat,
      lon: qLon,
      radiusNM: (notam.q_radius as number) || 5,
      lowerAlt: 0,
      upperAlt: 5000,
    };
  }

  // Fallback: use airport coordinates from database
  const airportCoords = notam.location ? AIRPORT_COORDINATES[notam.location] : null;
  if (airportCoords) {
    return {
      lat: airportCoords.lat,
      lon: airportCoords.lon,
      radiusNM: 5, // Default 5 NM radius for airport NOTAMs
      lowerAlt: 0,
      upperAlt: 5000, // Default 5000 ft
    };
  }

  return null;
};

/**
 * NOTAM 반경 원형 폴리곤 생성
 */
export const createNotamCircle = (
  lon: number,
  lat: number,
  radiusNM: number,
  numPoints: number = 32
): [number, number][][] => {
  const coords: [number, number][] = [];
  // 1 NM = 1.852 km, convert to degrees (roughly)
  const radiusDeg = (radiusNM * 1.852) / 111.32; // approximate for latitude
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const latOffset = radiusDeg * Math.sin(angle);
    const lonOffset = (radiusDeg * Math.cos(angle)) / Math.cos(lat * Math.PI / 180);
    coords.push([lon + lonOffset, lat + latOffset]);
  }
  return [coords];
};
