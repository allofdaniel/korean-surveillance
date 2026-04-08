/**
 * useSatelliteTracking - CelesTrak TLE 기반 위성 궤도 추적
 */
import { useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import mapboxgl, { type Map as MapboxMap } from 'mapbox-gl';
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
const UPDATE_INTERVAL = 2000;

interface SatRecord {
  name: string;
  satrec: satellite.SatRec;
}

function parseTLE(tleText: string): SatRecord[] {
  const lines = tleText.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const records: SatRecord[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i];
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];
    if (!line1.startsWith('1') || !line2.startsWith('2')) continue;
    try {
      const satrec = satellite.twoline2satrec(line1, line2);
      records.push({ name, satrec });
    } catch { /* skip */ }
  }
  return records;
}

function getSatPosition(satrec: satellite.SatRec, now: Date) {
  try {
    const posVel = satellite.propagate(satrec, now);
    if (!posVel.position || typeof posVel.position === 'boolean') return null;
    const gmst = satellite.gstime(now);
    const geo = satellite.eciToGeodetic(posVel.position, gmst);
    return {
      lng: satellite.degreesLong(geo.longitude),
      lat: satellite.degreesLat(geo.latitude),
      alt: geo.height,
    };
  } catch {
    return null;
  }
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

  const updatePositions = useCallback(() => {
    const m = map.current;
    if (!m || satRecords.current.length === 0) return;
    try {
      if (!m.getSource('satellite-positions')) return;
    } catch { return; }

    const now = new Date();
    const features: GeoJSON.Feature[] = [];
    for (const rec of satRecords.current) {
      const pos = getSatPosition(rec.satrec, now);
      if (!pos || isNaN(pos.lat) || isNaN(pos.lng)) continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [pos.lng, pos.lat] },
        properties: { name: rec.name, alt: Math.round(pos.alt) },
      });
    }

    try {
      const source = m.getSource('satellite-positions') as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData({ type: 'FeatureCollection', features });
      }
    } catch (err) {
      logger.error('SatTracking', `Update error: ${err}`);
    }
  }, [map]);

  // 단일 effect: 맵 로드 + showSatellites 변경 시 모두 처리
  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded) return;

    const ensureLayers = () => {
      if (layersAddedRef.current) return;
      try {
        if (!m.getSource('satellite-positions')) {
          m.addSource('satellite-positions', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
        }
        if (!m.getLayer('satellite-dots')) {
          m.addLayer({
            id: 'satellite-dots',
            type: 'circle',
            source: 'satellite-positions',
            paint: {
              'circle-radius': 4,
              'circle-color': '#ff6b6b',
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 1,
            },
          });
        }
        if (!m.getLayer('satellite-labels')) {
          m.addLayer({
            id: 'satellite-labels',
            type: 'symbol',
            source: 'satellite-positions',
            layout: {
              'text-field': ['get', 'name'],
              'text-size': 9,
              'text-offset': [0, 1.2],
              'text-anchor': 'top',
            },
            paint: {
              'text-color': '#ff6b6b',
              'text-halo-color': '#000000',
              'text-halo-width': 1,
            },
          });
        }
        layersAddedRef.current = true;
        logger.info('SatTracking', 'Layers added to map');
      } catch (err) {
        logger.error('SatTracking', `Layer creation error: ${err}`);
      }
    };

    const setVisibility = (visible: boolean) => {
      try {
        const vis = visible ? 'visible' : 'none';
        if (m.getLayer('satellite-dots')) m.setLayoutProperty('satellite-dots', 'visibility', vis);
        if (m.getLayer('satellite-labels')) m.setLayoutProperty('satellite-labels', 'visibility', vis);
      } catch { /* ignore */ }
    };

    const start = async () => {
      // 레이어 생성
      if (m.isStyleLoaded()) {
        ensureLayers();
      } else {
        await new Promise<void>(resolve => {
          m.once('style.load', () => { ensureLayers(); resolve(); });
        });
      }

      if (!showSatellites) {
        setVisibility(false);
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        return;
      }

      setVisibility(true);

      // TLE 데이터 로드
      if (!loadedRef.current) {
        try {
          logger.info('SatTracking', `Fetching TLE data from ${TLE_URLS.length} groups...`);
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
          logger.info('SatTracking', `Loaded ${satRecords.current.length} satellites from ${TLE_URLS.length} groups`);
        } catch (err) {
          logger.error('SatTracking', `Fetch error: ${err}`);
          return;
        }
      }

      // 즉시 업데이트 + 주기 업데이트
      updatePositions();
      if (!intervalRef.current) {
        intervalRef.current = setInterval(updatePositions, UPDATE_INTERVAL);
      }
    };

    start();

    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [map, mapLoaded, showSatellites, updatePositions]);
}
