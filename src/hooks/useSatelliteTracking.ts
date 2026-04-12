/**
 * useSatelliteTracking - CelesTrak TLE 기반 위성 궤도 추적
 * 위성 아이콘 + 궤도 라인 표시
 */
import { useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import type { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl';
import * as satellite from 'satellite.js';
import { logger } from '../utils/logger';

const TLE_URLS = [
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle',
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle',
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=resource&FORMAT=tle',
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=sarsat&FORMAT=tle',
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=geo&FORMAT=tle',
];
const MAX_SATELLITES = 300;
const UPDATE_INTERVAL = 2000; // 2초마다 위치 업데이트 (부드러운 이동)
const ORBIT_UPDATE_INTERVAL = 30000; // 30초마다 궤도선 재계산 (성능)
const ORBIT_MINUTES = 90; // 궤도 예측 시간
const ORBIT_STEP = 1; // 1분 간격

interface SatRecord { name: string; satrec: satellite.SatRec; }

function parseTLE(tleText: string): SatRecord[] {
  const lines = tleText.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const records: SatRecord[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i];
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];
    if (!name || !line1 || !line2) continue;
    if (!line1.startsWith('1') || !line2.startsWith('2')) continue;
    try { records.push({ name, satrec: satellite.twoline2satrec(line1, line2) }); } catch { /* skip */ }
  }
  return records;
}

function getSatPosition(satrec: satellite.SatRec, time: Date) {
  try {
    const posVel = satellite.propagate(satrec, time);
    if (!posVel.position || typeof posVel.position === 'boolean') return null;
    const gmst = satellite.gstime(time);
    const geo = satellite.eciToGeodetic(posVel.position, gmst);
    const lng = satellite.degreesLong(geo.longitude);
    const lat = satellite.degreesLat(geo.latitude);
    if (isNaN(lng) || isNaN(lat)) return null;
    return { lng, lat, alt: geo.height };
  } catch { return null; }
}

function getOrbitPath(satrec: satellite.SatRec, now: Date): [number, number][][] {
  // 경도가 급변(날짜변경선)하면 라인을 분리하여 MultiLineString으로 반환
  const segments: [number, number][][] = [];
  let current: [number, number][] = [];
  let prevLng: number | null = null;

  for (let m = -ORBIT_MINUTES / 2; m <= ORBIT_MINUTES / 2; m += ORBIT_STEP) {
    const t = new Date(now.getTime() + m * 60000);
    const pos = getSatPosition(satrec, t);
    if (!pos) continue;

    // 경도 급변 감지 (>100° 차이 = 날짜변경선 통과)
    if (prevLng !== null && Math.abs(pos.lng - prevLng) > 100) {
      if (current.length > 1) segments.push(current);
      current = [];
    }
    current.push([pos.lng, pos.lat]);
    prevLng = pos.lng;
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

// 위성 아이콘 생성 (삼각형 + 날개)
function createSatelliteIcon(map: MapboxMap) {
  if (map.hasImage('satellite-icon')) return;
  const size = 20;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 위성 몸체 (사각형)
  ctx.fillStyle = '#ff6b6b';
  ctx.fillRect(7, 5, 6, 10);

  // 태양전지판 (양쪽 날개)
  ctx.fillStyle = '#4fc3f7';
  ctx.fillRect(0, 7, 6, 6);
  ctx.fillRect(14, 7, 6, 6);

  // 태양전지판 줄무늬
  ctx.strokeStyle = '#0288d1';
  ctx.lineWidth = 1;
  for (let x = 1; x < 6; x += 2) {
    ctx.beginPath(); ctx.moveTo(x, 7); ctx.lineTo(x, 13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 14, 7); ctx.lineTo(x + 14, 13); ctx.stroke();
  }

  // 안테나
  ctx.strokeStyle = '#ff6b6b';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(10, 5); ctx.lineTo(10, 1); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(10, 1, 1.5, 0, Math.PI * 2); ctx.fill();

  map.addImage('satellite-icon', ctx.getImageData(0, 0, size, size), { pixelRatio: 1 });
}

export default function useSatelliteTracking(
  map: MutableRefObject<MapboxMap | null>,
  mapLoaded: boolean,
  showSatellites: boolean
) {
  const satRecords = useRef<SatRecord[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadedRef = useRef(false);
  const layersAddedRef = useRef(false);
  const lastOrbitUpdate = useRef<number>(0);

  const updatePositions = useCallback(() => {
    const m = map.current;
    if (!m || satRecords.current.length === 0) return;
    try { if (!m.getSource('satellite-positions')) return; } catch { return; }

    const now = new Date();
    const pointFeatures: GeoJSON.Feature[] = [];
    const shouldUpdateOrbits = Date.now() - lastOrbitUpdate.current > ORBIT_UPDATE_INTERVAL;
    const lineFeatures: GeoJSON.Feature[] = [];

    for (const rec of satRecords.current) {
      const pos = getSatPosition(rec.satrec, now);
      if (!pos) continue;

      // 위성 위치 점
      pointFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [pos.lng, pos.lat] },
        properties: { name: rec.name, alt: Math.round(pos.alt) },
      });

      // 궤도 라인 (30초마다, 10개당 1개만)
      if (shouldUpdateOrbits && pointFeatures.length % 10 === 0) {
        const segments = getOrbitPath(rec.satrec, now);
        if (segments.length > 0) {
          lineFeatures.push({
            type: 'Feature',
            geometry: { type: 'MultiLineString', coordinates: segments },
            properties: { name: rec.name },
          });
        }
      }
    }

    try {
      const posSrc = m.getSource('satellite-positions') as GeoJSONSource;
      if (posSrc) posSrc.setData({ type: 'FeatureCollection', features: pointFeatures });

      if (shouldUpdateOrbits) {
        lastOrbitUpdate.current = Date.now();
        const orbitSrc = m.getSource('satellite-orbits') as GeoJSONSource;
        if (orbitSrc) orbitSrc.setData({ type: 'FeatureCollection', features: lineFeatures });
      }
    } catch (err) { logger.error('SatTracking', `Update error: ${err}`); }
  }, [map]);

  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded) return;

    const ensureLayers = () => {
      if (layersAddedRef.current) return;
      try {
        createSatelliteIcon(m);

        // 궤도 라인 소스/레이어
        if (!m.getSource('satellite-orbits')) {
          m.addSource('satellite-orbits', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        }
        if (!m.getLayer('satellite-orbit-lines')) {
          m.addLayer({
            id: 'satellite-orbit-lines', type: 'line', source: 'satellite-orbits',
            paint: { 'line-color': '#ff6b6b', 'line-width': 1, 'line-opacity': 0.4, 'line-dasharray': [4, 4] },
          });
        }

        // 위성 위치 소스/레이어
        if (!m.getSource('satellite-positions')) {
          m.addSource('satellite-positions', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        }
        if (!m.getLayer('satellite-icons')) {
          m.addLayer({
            id: 'satellite-icons', type: 'symbol', source: 'satellite-positions',
            layout: {
              'icon-image': 'satellite-icon',
              'icon-size': 1.5,
              'icon-allow-overlap': true,
              'text-field': ['get', 'name'],
              'text-size': 9,
              'text-offset': [0, 1.8],
              'text-anchor': 'top',
              'text-optional': true,
            },
            paint: {
              'text-color': '#ff6b6b',
              'text-halo-color': '#000000',
              'text-halo-width': 1,
            },
          });
        }

        layersAddedRef.current = true;
        logger.info('SatTracking', 'Layers + icon added');
      } catch (err) { logger.error('SatTracking', `Layer error: ${err}`); }
    };

    const setVis = (v: boolean) => {
      try {
        const vis = v ? 'visible' : 'none';
        if (m.getLayer('satellite-icons')) m.setLayoutProperty('satellite-icons', 'visibility', vis);
        if (m.getLayer('satellite-orbit-lines')) m.setLayoutProperty('satellite-orbit-lines', 'visibility', vis);
      } catch { /* ignore */ }
    };

    const start = async () => {
      if (m.isStyleLoaded()) ensureLayers();
      else await new Promise<void>(r => m.once('style.load', () => { ensureLayers(); r(); }));

      if (!showSatellites) {
        setVis(false);
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        return;
      }

      setVis(true);

      if (!loadedRef.current) {
        try {
          logger.info('SatTracking', 'Fetching TLE data...');
          const allRecords: SatRecord[] = [];
          const results = await Promise.allSettled(TLE_URLS.map(url => fetch(url)));
          for (const result of results) {
            if (result.status === 'fulfilled' && result.value.ok) {
              const text = await result.value.text();
              allRecords.push(...parseTLE(text));
            }
          }
          satRecords.current = allRecords.slice(0, MAX_SATELLITES);
          loadedRef.current = true;
          logger.info('SatTracking', `Loaded ${satRecords.current.length} satellites`);
        } catch (err) { logger.error('SatTracking', `Fetch error: ${err}`); return; }
      }

      updatePositions();
      if (!intervalRef.current) {
        intervalRef.current = setInterval(updatePositions, UPDATE_INTERVAL);
      }
    };

    start();
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [map, mapLoaded, showSatellites, updatePositions]);
}
