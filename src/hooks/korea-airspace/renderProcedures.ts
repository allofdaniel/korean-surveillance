/**
 * renderProcedures - holdings, terminal waypoints, and SID/STAR/IAP legs.
 */
import type { Map as MapboxMap } from 'mapbox-gl';
import type {
  KoreaHolding,
  KoreaTerminalWaypoint,
  KoreaProcedures,
  KoreaAirport,
  KoreaNavaid,
  KoreaWaypoint
} from '../useDataLoading';
import { createHoldingPattern } from './types';

// ---------------------------------------------------------------------------
// Holdings (racetrack patterns)
// ---------------------------------------------------------------------------

export function renderHoldings(map: MapboxMap, holdings: KoreaHolding[]): void {
  const holdingPolygonFeatures = holdings
    .filter(h => h.lat && h.lon && h.inbound_course !== undefined)
    .map(h => {
      const legNm = h.leg_length || (h.leg_time ? h.leg_time * 3 : 4);
      const pattern = createHoldingPattern(h.lat, h.lon, h.inbound_course, h.turn || 'R', legNm);
      return {
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [pattern] },
        properties: {
          waypoint: h.waypoint,
          name: h.name || h.waypoint,
          inbound_course: h.inbound_course,
          turn: h.turn || 'R',
          leg_time: h.leg_time,
          leg_length: h.leg_length,
          speed: h.speed,
          min_alt: h.min_alt,
          max_alt: h.max_alt,
          lat: h.lat,
          lon: h.lon
        }
      };
    });

  const holdingLabelFeatures = holdings
    .filter(h => h.lat && h.lon)
    .map(h => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [h.lon, h.lat] },
      properties: {
        waypoint: h.waypoint,
        name: h.name || h.waypoint,
        inbound_course: h.inbound_course,
        turn: h.turn || 'R',
        leg_time: h.leg_time,
        leg_length: h.leg_length,
        speed: h.speed,
        min_alt: h.min_alt,
        max_alt: h.max_alt,
        lat: h.lat,
        lon: h.lon
      }
    }));

  map.addSource('korea-holdings', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: holdingPolygonFeatures }
  });
  map.addSource('korea-holdings-labels', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: holdingLabelFeatures }
  });

  map.addLayer({
    id: 'korea-holdings',
    type: 'fill',
    source: 'korea-holdings',
    minzoom: 6,
    paint: { 'fill-color': '#FF69B4', 'fill-opacity': 0.15 }
  });
  map.addLayer({
    id: 'korea-holdings-outline',
    type: 'line',
    source: 'korea-holdings',
    minzoom: 6,
    paint: {
      'line-color': '#FF69B4',
      'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 10, 2, 14, 3],
      'line-opacity': 0.9
    }
  });
  map.addLayer({
    id: 'korea-holdings-fix',
    type: 'circle',
    source: 'korea-holdings-labels',
    minzoom: 7,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 3, 12, 5],
      'circle-color': '#FF69B4',
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 1.5
    }
  });
  map.addLayer({
    id: 'korea-holding-labels',
    type: 'symbol',
    source: 'korea-holdings-labels',
    minzoom: 8,
    layout: {
      'text-field': ['get', 'waypoint'],
      'text-size': 10,
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
      'text-offset': [0, 1.5],
      'text-allow-overlap': false
    },
    paint: {
      'text-color': '#FF69B4',
      'text-halo-color': 'rgba(0,0,0,0.8)',
      'text-halo-width': 1
    }
  });
}

// ---------------------------------------------------------------------------
// Terminal waypoints
// ---------------------------------------------------------------------------

export function renderTerminalWaypoints(
  map: MapboxMap,
  termWpts: KoreaTerminalWaypoint[],
  isDayMode: boolean
): void {
  const termWptFeatures = termWpts
    .filter(w => w.lat && w.lon)
    .map(w => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [w.lon, w.lat] },
      properties: {
        id: w.id,
        name: w.name || w.id,
        type: w.type || '',
        region: w.region || '',
        lat: w.lat,
        lon: w.lon
      }
    }));

  map.addSource('korea-terminal-waypoints', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: termWptFeatures }
  });
  map.addLayer({
    id: 'korea-terminal-waypoints',
    type: 'circle',
    source: 'korea-terminal-waypoints',
    minzoom: 7,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 6, 8, 8, 10, 12],
      'circle-color': '#20B2AA',
      'circle-stroke-color': isDayMode ? '#000000' : '#FFFFFF',
      'circle-stroke-width': 1,
      'circle-opacity': 0.8
    }
  });
  map.addLayer({
    id: 'korea-terminal-waypoint-labels',
    type: 'symbol',
    source: 'korea-terminal-waypoints',
    minzoom: 10,
    layout: {
      'text-field': ['get', 'id'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 7, 6, 8, 8, 10, 11, 12, 22, 14, 44],
      'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
      'text-offset': [0, 1.3],
      'text-allow-overlap': false,
      'text-transform': 'uppercase'
    },
    paint: {
      'text-color': isDayMode ? '#000000' : '#20B2AA',
      'text-halo-color': isDayMode ? '#FFFFFF' : 'rgba(0,0,0,0.8)',
      'text-halo-width': 1
    }
  });
}

// ---------------------------------------------------------------------------
// SID / STAR / IAP procedure leg rendering
// ---------------------------------------------------------------------------

interface ProcLeg {
  seq: number;
  wpt: string | null;
  path?: string | null;
  turn?: string | null;
}

/**
 * Build a waypoint-name -> [lon, lat] lookup map from all available nav data.
 */
function buildWptCoordMap(
  termWpts: KoreaTerminalWaypoint[],
  enrouteWpts: KoreaWaypoint[],
  navaids: KoreaNavaid[],
  airports: KoreaAirport[]
): Map<string, [number, number]> {
  const wptCoordMap = new Map<string, [number, number]>();

  termWpts.forEach(w => {
    if (w.id && w.lon && w.lat) wptCoordMap.set(w.id, [w.lon, w.lat]);
    if (w.name && w.lon && w.lat) wptCoordMap.set(w.name, [w.lon, w.lat]);
  });

  enrouteWpts.forEach(w => {
    if (w.name && w.lon && w.lat && !wptCoordMap.has(w.name)) {
      wptCoordMap.set(w.name, [w.lon, w.lat]);
    }
  });

  navaids.forEach(n => {
    if (n.ident && n.lon && n.lat && !wptCoordMap.has(n.ident)) {
      wptCoordMap.set(n.ident, [n.lon, n.lat]);
    }
  });

  // Add runway threshold waypoints (RW06L, RW24R, …)
  airports.forEach(apt => {
    if (!apt.runways) return;
    apt.runways.forEach(rwy => {
      if (!rwy.id || typeof rwy.lat !== 'number' || typeof rwy.lon !== 'number') return;
      const parts = rwy.id.split('/');
      parts.forEach(rwyNum => {
        const rwyWpt = `RW${rwyNum.trim()}`;
        if (!wptCoordMap.has(rwyWpt)) {
          wptCoordMap.set(rwyWpt, [rwy.lon, rwy.lat]);
        }
      });
    });
  });

  return wptCoordMap;
}

/**
 * Build an ILS localizer coordinate map (used for AF arc center detection).
 */
function buildIlsCoordMap(airports: KoreaAirport[]): Map<string, [number, number]> {
  const ilsCoordMap = new Map<string, [number, number]>();
  airports.forEach(apt => {
    if (!apt.ils) return;
    apt.ils.forEach(ils => {
      if (ils.ident && typeof ils.llz_lon === 'number' && typeof ils.llz_lat === 'number') {
        ilsCoordMap.set(ils.ident, [ils.llz_lon, ils.llz_lat]);
        ilsCoordMap.set(`${apt.icao}_${ils.ident}`, [ils.llz_lon, ils.llz_lat]);
      }
    });
  });
  return ilsCoordMap;
}

/**
 * Build a navaid-ident -> [lon, lat] lookup map.
 */
function buildNavaidCoordMap(navaids: KoreaNavaid[]): Map<string, [number, number]> {
  const navaidCoordMap = new Map<string, [number, number]>();
  navaids.forEach(nav => {
    if (nav.ident && typeof nav.lon === 'number' && typeof nav.lat === 'number') {
      navaidCoordMap.set(nav.ident, [nav.lon, nav.lat]);
    }
  });
  return navaidCoordMap;
}

/**
 * Map each airport to the nearest usable navaid (used as AF arc fallback).
 */
function buildAirportNavaidMap(
  airports: KoreaAirport[],
  navaids: KoreaNavaid[]
): Map<string, [number, number]> {
  const airportNavaidMap = new Map<string, [number, number]>();
  airports.forEach(apt => {
    if (apt.ils && apt.ils.length > 0) {
      const ils = apt.ils[0];
      if (ils && typeof ils.llz_lon === 'number' && typeof ils.llz_lat === 'number') {
        airportNavaidMap.set(apt.icao, [ils.llz_lon, ils.llz_lat]);
      }
    }
    let nearestDist = Infinity;
    let nearestCoord: [number, number] | null = null;
    navaids.forEach(nav => {
      if (!nav.lon || !nav.lat) return;
      if (nav.type !== 'VORDME' && nav.type !== 'VOR' && nav.type !== 'DME' && nav.type !== 'TACAN') return;
      const dist = Math.sqrt(Math.pow(nav.lon - apt.lon, 2) + Math.pow(nav.lat - apt.lat, 2));
      if (dist < nearestDist && dist < 0.5) {
        nearestDist = dist;
        nearestCoord = [nav.lon, nav.lat];
      }
    });
    if (nearestCoord && !airportNavaidMap.has(apt.icao)) {
      airportNavaidMap.set(apt.icao, nearestCoord);
    }
  });
  return airportNavaidMap;
}

/**
 * Interpolate arc points between two coordinates around a given center.
 * Uses latitude-corrected equirectangular projection for accurate circles.
 */
function interpolateArc(
  start: [number, number],
  end: [number, number],
  center: [number, number],
  turnDir: string,
  numPoints: number = 24
): [number, number][] {
  const points: [number, number][] = [];
  const centerLat = center[1];
  const cosLat = Math.cos(centerLat * Math.PI / 180);

  const scaleX = (lon: number) => (lon - center[0]) * cosLat;
  const scaleY = (lat: number) => lat - center[1];

  const startScaledX = scaleX(start[0]);
  const startScaledY = scaleY(start[1]);
  const endScaledX = scaleX(end[0]);
  const endScaledY = scaleY(end[1]);

  const startAngle = Math.atan2(startScaledY, startScaledX);
  let endAngle = Math.atan2(endScaledY, endScaledX);

  const startRadius = Math.sqrt(startScaledX ** 2 + startScaledY ** 2);
  const endRadius = Math.sqrt(endScaledX ** 2 + endScaledY ** 2);
  const radius = (startRadius + endRadius) / 2;

  if (turnDir === 'R') {
    while (endAngle > startAngle) endAngle -= 2 * Math.PI;
    if (startAngle - endAngle > 2 * Math.PI) endAngle += 2 * Math.PI;
  } else {
    while (endAngle < startAngle) endAngle += 2 * Math.PI;
    if (endAngle - startAngle > 2 * Math.PI) endAngle -= 2 * Math.PI;
  }

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const angle = startAngle + (endAngle - startAngle) * t;
    const scaledX = radius * Math.cos(angle);
    const scaledY = radius * Math.sin(angle);
    const lon = center[0] + scaledX / cosLat;
    const lat = center[1] + scaledY;
    points.push([lon, lat]);
  }

  return points;
}

/**
 * Find the best arc center (navaid equidistant from start and end).
 */
function findArcCenter(
  startCoord: [number, number],
  endCoord: [number, number],
  wptName: string,
  airportIcao: string,
  procType: string,
  navaidCoordMap: Map<string, [number, number]>,
  ilsCoordMap: Map<string, [number, number]>,
  airportNavaidMap: Map<string, [number, number]>
): [number, number] | null {
  const calcDist = (a: [number, number], b: [number, number]) =>
    Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));

  let bestCenter: [number, number] | null = null;
  let bestDiff = Infinity;
  const maxDistDiff = 0.015;

  for (const [, coord] of navaidCoordMap.entries()) {
    const distToStart = calcDist(coord, startCoord);
    const distToEnd = calcDist(coord, endCoord);
    const diff = Math.abs(distToStart - distToEnd);
    const avgDist = (distToStart + distToEnd) / 2;
    if (avgDist < 0.05 || avgDist > 0.5) continue;
    if (diff < bestDiff && diff < maxDistDiff) {
      bestDiff = diff;
      bestCenter = coord;
    }
  }

  for (const [key, coord] of ilsCoordMap.entries()) {
    if (!key.startsWith(`${airportIcao}_`) && procType === 'iaps') continue;
    const distToStart = calcDist(coord, startCoord);
    const distToEnd = calcDist(coord, endCoord);
    const diff = Math.abs(distToStart - distToEnd);
    const avgDist = (distToStart + distToEnd) / 2;
    if (avgDist < 0.05 || avgDist > 0.5) continue;
    if (diff < bestDiff && diff < maxDistDiff) {
      bestDiff = diff;
      bestCenter = coord;
    }
  }

  if (bestCenter) return bestCenter;

  // Pattern-based fallback
  if (wptName && wptName.length >= 2) {
    if (wptName.startsWith('D') && wptName.length >= 4) {
      const suffix = wptName.slice(-1).toUpperCase();
      for (const [ident, coord] of navaidCoordMap.entries()) {
        if (ident.endsWith(suffix)) {
          const dist = calcDist(coord, endCoord);
          if (dist < 0.5) return coord;
        }
      }
    }
    if (wptName.startsWith('C')) {
      const aptNavaid = airportNavaidMap.get(airportIcao);
      if (aptNavaid) return aptNavaid;
    }
  }

  return airportNavaidMap.get(airportIcao) || null;
}

/**
 * Render one procedure type (SIDs, STARs, or IAPs) for a selected airport.
 */
function renderOneProcedureType(
  map: MapboxMap,
  procData: Record<string, Record<string, ProcLeg[]>>,
  airportIcao: string,
  layerId: string,
  color: string,
  wptCoordMap: Map<string, [number, number]>,
  navaidCoordMap: Map<string, [number, number]>,
  ilsCoordMap: Map<string, [number, number]>,
  airportNavaidMap: Map<string, [number, number]>
): void {
  const airportProcs = procData[airportIcao];
  if (!airportProcs) return;

  interface ProcFeature {
    type: 'Feature';
    geometry: { type: 'LineString'; coordinates: [number, number][] };
    properties: { name: string; airport: string; type: string };
  }

  const features: ProcFeature[] = [];
  const procType = layerId.includes('sids') ? 'sids' :
                   layerId.includes('stars') ? 'stars' : 'iaps';

  Object.entries(airportProcs).forEach(([procName, legs]) => {
    const coords: [number, number][] = [];
    const sortedLegs = legs.slice().sort((a, b) => a.seq - b.seq);

    sortedLegs.forEach((leg, idx) => {
      if (!leg.wpt) return;
      const coord = wptCoordMap.get(leg.wpt);
      if (!coord) return;

      if (leg.path === 'AF' && idx > 0 && coords.length > 0) {
        const prevCoord = coords[coords.length - 1] as [number, number];
        const arcCenter = findArcCenter(
          prevCoord, coord, leg.wpt || '', airportIcao, procType,
          navaidCoordMap, ilsCoordMap, airportNavaidMap
        );
        if (arcCenter) {
          const arcPoints = interpolateArc(prevCoord, coord, arcCenter, leg.turn || 'R', 20);
          arcPoints.slice(1).forEach(pt => coords.push(pt));
        } else {
          coords.push(coord);
        }
      } else {
        coords.push(coord);
      }
    });

    if (coords.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {
          name: procName,
          airport: airportIcao,
          type: layerId.replace('korea-', '').toUpperCase()
        }
      });
    }
  });

  if (features.length === 0) return;

  map.addSource(layerId, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features }
  });

  const isSid = layerId.includes('sids');
  const isStar = layerId.includes('stars');
  const dashArray = isSid ? [1] : isStar ? [4, 2] : [2, 1];

  map.addLayer({
    id: layerId,
    type: 'line',
    source: layerId,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': color,
      'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 10, 2, 14, 3],
      'line-opacity': 0.75,
      'line-dasharray': dashArray
    }
  });

  map.addLayer({
    id: `${layerId}-labels`,
    type: 'symbol',
    source: layerId,
    minzoom: 9,
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'name'],
      'text-size': 9,
      'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
      'text-rotation-alignment': 'map',
      'text-allow-overlap': false,
      'symbol-spacing': 250,
      'text-max-angle': 30
    },
    paint: {
      'text-color': color,
      'text-halo-color': 'rgba(0,0,0,0.9)',
      'text-halo-width': 1.2
    }
  });
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface RenderProceduresOptions {
  map: MapboxMap;
  procedures: KoreaProcedures;
  selectedAirport: string;
  terminalWaypoints: KoreaTerminalWaypoint[];
  enrouteWaypoints: KoreaWaypoint[];
  navaids: KoreaNavaid[];
  airports: KoreaAirport[];
  showSids: boolean;
  showStars: boolean;
  showIaps: boolean;
}

export function renderProcedures({
  map,
  procedures,
  selectedAirport,
  terminalWaypoints,
  enrouteWaypoints,
  navaids,
  airports,
  showSids,
  showStars,
  showIaps
}: RenderProceduresOptions): void {
  const wptCoordMap = buildWptCoordMap(terminalWaypoints, enrouteWaypoints, navaids, airports);
  const ilsCoordMap = buildIlsCoordMap(airports);
  const navaidCoordMap = buildNavaidCoordMap(navaids);
  const airportNavaidMap = buildAirportNavaidMap(airports, navaids);

  if (showSids && procedures.sids && selectedAirport) {
    renderOneProcedureType(
      map, procedures.sids, selectedAirport, 'korea-sids', '#4CAF50',
      wptCoordMap, navaidCoordMap, ilsCoordMap, airportNavaidMap
    );
  }
  if (showStars && procedures.stars && selectedAirport) {
    renderOneProcedureType(
      map, procedures.stars, selectedAirport, 'korea-stars', '#2196F3',
      wptCoordMap, navaidCoordMap, ilsCoordMap, airportNavaidMap
    );
  }
  if (showIaps && procedures.iaps && selectedAirport) {
    renderOneProcedureType(
      map, procedures.iaps, selectedAirport, 'korea-iaps', '#FF9800',
      wptCoordMap, navaidCoordMap, ilsCoordMap, airportNavaidMap
    );
  }
}
