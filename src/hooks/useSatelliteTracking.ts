/**
 * useSatelliteTracking - CelesTrak TLE 기반 위성 궤도 추적
 */
import { useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import * as satellite from 'satellite.js';
import { logger } from '../utils/logger';

const TLE_GROUPS = [
  { name: 'stations', url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle' },
  { name: 'active', url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle' },
];

const MAX_SATELLITES = 150;
const UPDATE_INTERVAL = 2000; // 2초마다 위치 업데이트

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
    } catch {
      // skip invalid TLE
    }
  }
  return records;
}

function getSatPosition(satrec: satellite.SatRec, now: Date): { lng: number; lat: number; alt: number } | null {
  const posVel = satellite.propagate(satrec, now);
  if (!posVel.position || typeof posVel.position === 'boolean') return null;
  const gmst = satellite.gstime(now);
  const geo = satellite.eciToGeodetic(posVel.position, gmst);
  return {
    lng: satellite.degreesLong(geo.longitude),
    lat: satellite.degreesLat(geo.latitude),
    alt: geo.height, // km
  };
}

export default function useSatelliteTracking(
  map: MutableRefObject<MapboxMap | null>,
  mapLoaded: boolean,
  showSatellites: boolean
) {
  const satRecords = useRef<SatRecord[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadedRef = useRef(false);

  const fetchTLE = useCallback(async () => {
    if (loadedRef.current) return;
    try {
      // 첫 번째 그룹(stations)만 로드하여 가볍게 시작
      const resp = await fetch(TLE_GROUPS[0].url);
      if (!resp.ok) return;
      const text = await resp.text();
      const records = parseTLE(text);
      satRecords.current = records.slice(0, MAX_SATELLITES);
      loadedRef.current = true;
      logger.info('SatTracking', `Loaded ${satRecords.current.length} satellites`);
    } catch (err) {
      logger.error('SatTracking', `Failed to fetch TLE: ${err}`);
    }
  }, []);

  const updatePositions = useCallback(() => {
    const mapInstance = map.current;
    if (!mapInstance || !mapInstance.isStyleLoaded()) return;
    if (satRecords.current.length === 0) return;

    const now = new Date();
    const features = satRecords.current
      .map(rec => {
        const pos = getSatPosition(rec.satrec, now);
        if (!pos) return null;
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [pos.lng, pos.lat] },
          properties: { name: rec.name, alt: Math.round(pos.alt) },
        };
      })
      .filter(Boolean);

    const source = mapInstance.getSource('satellite-positions');
    if (source && 'setData' in source) {
      (source as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: features as GeoJSON.Feature[],
      });
    }
  }, [map]);

  // 소스/레이어 생성
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !mapLoaded) return;

    const addLayers = () => {
      if (!mapInstance.isStyleLoaded()) return;

      if (!mapInstance.getSource('satellite-positions')) {
        mapInstance.addSource('satellite-positions', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
      }

      if (!mapInstance.getLayer('satellite-dots')) {
        mapInstance.addLayer({
          id: 'satellite-dots',
          type: 'circle',
          source: 'satellite-positions',
          paint: {
            'circle-radius': 3,
            'circle-color': '#ff6b6b',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1,
            'circle-opacity': 0,
          },
        });
      }

      if (!mapInstance.getLayer('satellite-labels')) {
        mapInstance.addLayer({
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
            'text-opacity': 0,
          },
        });
      }
    };

    if (mapInstance.isStyleLoaded()) {
      addLayers();
    } else {
      mapInstance.once('style.load', addLayers);
    }
  }, [map, mapLoaded]);

  // 표시/숨김 토글
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !mapLoaded) return;
    if (!mapInstance.isStyleLoaded()) return;

    const opacity = showSatellites ? 1 : 0;

    if (mapInstance.getLayer('satellite-dots')) {
      mapInstance.setPaintProperty('satellite-dots', 'circle-opacity', opacity);
      mapInstance.setPaintProperty('satellite-dots', 'circle-stroke-opacity', opacity);
    }
    if (mapInstance.getLayer('satellite-labels')) {
      mapInstance.setPaintProperty('satellite-labels', 'text-opacity', opacity);
    }

    if (showSatellites) {
      fetchTLE().then(() => {
        updatePositions();
        if (!intervalRef.current) {
          intervalRef.current = setInterval(updatePositions, UPDATE_INTERVAL);
        }
      });
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [map, mapLoaded, showSatellites, fetchTLE, updatePositions]);
}
