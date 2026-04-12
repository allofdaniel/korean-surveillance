/**
 * Shared types, constants, and utility functions for Korea Airspace rendering.
 */
import { ftToM } from '../../utils/geometry';

// ---------------------------------------------------------------------------
// Local interfaces (narrow view used within rendering helpers)
// ---------------------------------------------------------------------------

export interface RoutePoint {
  lon: number;
  lat: number;
  mea_ft?: number;
  name?: string;
}

export interface Route {
  name: string;
  type: string;
  points?: RoutePoint[];
}

export interface Waypoint {
  name: string;
  lon: number;
  lat: number;
  type?: string;
}

export interface Navaid {
  name: string;
  ident?: string;
  lon: number;
  lat: number;
  type: string;
  freq_mhz?: string | null;
}

export interface Airspace {
  name: string;
  type: string;
  category?: string;
  boundary: [number, number][];
  upper_limit_ft?: number;
  lower_limit_ft?: number;
  active_time?: string;
}

// ---------------------------------------------------------------------------
// Airspace colour/name lookup tables
// ---------------------------------------------------------------------------

export const AIRSPACE_COLORS: Record<string, string> = {
  'P': '#FF0000',    // Prohibited
  'R': '#FFA500',    // Restricted
  'D': '#FFFF00',    // Danger
  'MOA': '#800080',  // Military
  'HTA': '#9932CC',  // Helicopter Training
  'CATA': '#4169E1', // Civil Aircraft Training
  'UA': '#32CD32',   // Ultralight
  'ALERT': '#FF6347' // Alert
};

export const AIRSPACE_TYPE_NAMES: Record<string, string> = {
  'P': 'Prohibited',
  'R': 'Restricted',
  'D': 'Danger',
  'MOA': 'Military Operations Area',
  'HTA': 'Helicopter Training Area',
  'CATA': 'Civil Aircraft Training Area',
  'UA': 'Ultralight Activity',
  'ALERT': 'Alert Area'
};

// ---------------------------------------------------------------------------
// Shared popup style constants
// ---------------------------------------------------------------------------

export const POPUP_STYLE = `
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 12px;
  line-height: 1.5;
  color: #E0E0E0;
  min-width: 200px;
`;

export const POPUP_HEADER = (color: string) => `
  font-weight: 700;
  font-size: 14px;
  color: ${color};
  margin-bottom: 6px;
  border-bottom: 1px solid rgba(255,255,255,0.15);
  padding-bottom: 4px;
`;

export const POPUP_ROW = `
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
`;

export const POPUP_LABEL = `
  color: #9E9E9E;
  font-size: 11px;
`;

export const POPUP_VALUE = `
  color: #FFFFFF;
  font-weight: 500;
  text-align: right;
`;

// ---------------------------------------------------------------------------
// Pure utility functions
// ---------------------------------------------------------------------------

/**
 * Build a 3-D route ribbon polygon between two consecutive route points.
 */
export const createRouteRibbon = (
  p1: RoutePoint,
  p2: RoutePoint,
  width = 0.003
): [number, number][] | null => {
  const dx = p2.lon - p1.lon;
  const dy = p2.lat - p1.lat;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.0001) return null;
  const px = -dy / len * width;
  const py = dx / len * width;
  return [
    [p1.lon - px, p1.lat - py],
    [p1.lon + px, p1.lat + py],
    [p2.lon + px, p2.lat + py],
    [p2.lon - px, p2.lat - py],
    [p1.lon - px, p1.lat - py]
  ];
};

/**
 * Clamp an MEA value to a safe rendering range (max FL600 = 60 000 ft).
 */
export const clampMEA = (mea?: number): number => {
  if (!mea || mea <= 0) return 5000;
  if (mea > 60000) return 5000;
  return mea;
};

/**
 * Format decimal lat/lon as DMS string.
 * GeoJSON properties are stored as strings, so parseFloat is applied defensively.
 */
export const formatCoord = (lat: number | string, lon: number | string): string => {
  const latNum = typeof lat === 'string' ? parseFloat(lat) : lat;
  const lonNum = typeof lon === 'string' ? parseFloat(lon) : lon;
  if (isNaN(latNum) || isNaN(lonNum)) return 'N/A';

  const fmtDMS = (deg: number, pos: string, neg: string): string => {
    const sign = deg >= 0 ? pos : neg;
    const abs = Math.abs(deg);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = ((abs - d - m / 60) * 3600).toFixed(1);
    return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(4, '0')}"${sign}`;
  };
  return `${fmtDMS(latNum, 'N', 'S')} ${fmtDMS(lonNum, 'E', 'W')}`;
};

/**
 * Generate a racetrack holding-pattern polygon in geographic coordinates.
 */
export const createHoldingPattern = (
  lat: number,
  lon: number,
  inboundCourse: number,
  turnDirection: string = 'R',
  legLengthNm: number = 4
): [number, number][] => {
  const points: [number, number][] = [];
  const NM_TO_DEG = 1 / 60;
  const legLength = legLengthNm * NM_TO_DEG;
  const turnRadius = 1.5 * NM_TO_DEG;

  const inboundRad = (90 - inboundCourse) * Math.PI / 180;
  const outboundRad = inboundRad + Math.PI;
  const turnSign = turnDirection === 'L' ? -1 : 1;
  const perpOffset = turnRadius * turnSign;
  const perpRad = inboundRad + Math.PI / 2;

  const fixLon = lon;
  const fixLat = lat;
  const outEndLon = fixLon + Math.cos(outboundRad) * legLength;
  const outEndLat = fixLat + Math.sin(outboundRad) * legLength / Math.cos(lat * Math.PI / 180);

  const segments = 12;

  const turnCenter1Lon = fixLon + Math.cos(perpRad) * perpOffset;
  const turnCenter1Lat = fixLat + Math.sin(perpRad) * perpOffset / Math.cos(lat * Math.PI / 180);

  for (let i = 0; i <= segments; i++) {
    const angle = inboundRad - turnSign * Math.PI * i / segments;
    const pLon = turnCenter1Lon + Math.cos(angle) * turnRadius;
    const pLat = turnCenter1Lat + Math.sin(angle) * turnRadius / Math.cos(lat * Math.PI / 180);
    points.push([pLon, pLat]);
  }

  const turnCenter2Lon = outEndLon + Math.cos(perpRad) * perpOffset;
  const turnCenter2Lat = outEndLat + Math.sin(perpRad) * perpOffset / Math.cos(lat * Math.PI / 180);

  for (let i = 0; i <= segments; i++) {
    const angle = outboundRad - turnSign * Math.PI * i / segments;
    const pLon = turnCenter2Lon + Math.cos(angle) * turnRadius;
    const pLat = turnCenter2Lat + Math.sin(angle) * turnRadius / Math.cos(lat * Math.PI / 180);
    points.push([pLon, pLat]);
  }

  if (points.length > 0 && points[0]) {
    points.push(points[0]);
  }

  return points;
};

// Re-export ftToM so consumers of this barrel can import from one place.
export { ftToM };
