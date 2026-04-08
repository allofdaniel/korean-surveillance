/**
 * useVworldLayers - V-World 건물/특수건물/도로망 레이어
 * 뷰포트 이동 시 자동 로드 (줌 10+ 에서만)
 */
import { useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import mapboxgl, { type Map as MapboxMap } from 'mapbox-gl';
import { logger } from '../utils/logger';

const IS_PROD = import.meta.env.PROD;
const MIN_ZOOM = 11; // 줌 11 이상에서만 로드
const DEBOUNCE_MS = 800;

type LayerType = 'buildings' | 'special' | 'roads';

async function fetchVworldData(type: LayerType, bounds: { minX: number; maxX: number; minY: number; maxY: number }) {
  try {
    const size = type === 'roads' ? 500 : 1000;
    const url = IS_PROD
      ? `/api/vworld-data?type=${type}&minX=${bounds.minX}&maxX=${bounds.maxX}&minY=${bounds.minY}&maxY=${bounds.maxY}&size=${size}`
      : `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=${type === 'buildings' ? 'LT_C_UQ111' : type === 'special' ? 'LT_C_SPBD' : 'LT_L_MOCTLINK'}&key=${import.meta.env.VITE_VWORLD_API_KEY}&geomFilter=BOX(${bounds.minX},${bounds.minY},${bounds.maxX},${bounds.maxY})&size=${size}&format=json&crs=EPSG:4326&domain=localhost`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.response?.status !== 'OK') return null;
    return data.response?.result?.featureCollection || null;
  } catch {
    return null;
  }
}

export default function useVworldLayers(
  map: MutableRefObject<MapboxMap | null>,
  mapLoaded: boolean,
  showBuildings: boolean,
  showSpecial: boolean,
  showRoads: boolean
) {
  const layersAddedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBoundsRef = useRef('');

  const loadData = useCallback(async () => {
    const m = map.current;
    if (!m) return;
    if (m.getZoom() < MIN_ZOOM) return;

    const bounds = m.getBounds();
    const b = {
      minX: Math.round(bounds.getWest() * 1000) / 1000,
      maxX: Math.round(bounds.getEast() * 1000) / 1000,
      minY: Math.round(bounds.getSouth() * 1000) / 1000,
      maxY: Math.round(bounds.getNorth() * 1000) / 1000,
    };

    const boundsKey = `${b.minX},${b.minY},${b.maxX},${b.maxY}`;
    if (boundsKey === lastBoundsRef.current) return;
    lastBoundsRef.current = boundsKey;

    // 병렬 로드
    const loads: Promise<void>[] = [];

    if (showBuildings) {
      loads.push((async () => {
        const fc = await fetchVworldData('buildings', b);
        if (fc) {
          const src = m.getSource('vw-buildings') as mapboxgl.GeoJSONSource;
          if (src) src.setData(fc);
        }
      })());
    }

    if (showSpecial) {
      loads.push((async () => {
        const fc = await fetchVworldData('special', b);
        if (fc) {
          const src = m.getSource('vw-special') as mapboxgl.GeoJSONSource;
          if (src) src.setData(fc);
        }
      })());
    }

    if (showRoads) {
      loads.push((async () => {
        const fc = await fetchVworldData('roads', b);
        if (fc) {
          const src = m.getSource('vw-roads') as mapboxgl.GeoJSONSource;
          if (src) src.setData(fc);
        }
      })());
    }

    await Promise.all(loads);
    logger.info('VWorld', `Loaded data for viewport ${boundsKey}`);
  }, [map, showBuildings, showSpecial, showRoads]);

  const debouncedLoad = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(loadData, DEBOUNCE_MS);
  }, [loadData]);

  // 레이어 생성
  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded) return;

    const ensureLayers = () => {
      if (layersAddedRef.current) return;
      try {
        // 도로망 소스/레이어
        if (!m.getSource('vw-roads')) {
          m.addSource('vw-roads', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        }
        if (!m.getLayer('vw-roads-line')) {
          m.addLayer({
            id: 'vw-roads-line', type: 'line', source: 'vw-roads',
            minzoom: MIN_ZOOM,
            layout: { visibility: 'none' },
            paint: {
              'line-color': '#4a5568',
              'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 15, 2, 18, 4],
              'line-opacity': 0.6,
            },
          });
        }

        // 건물 소스/레이어
        if (!m.getSource('vw-buildings')) {
          m.addSource('vw-buildings', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        }
        if (!m.getLayer('vw-buildings-fill')) {
          m.addLayer({
            id: 'vw-buildings-fill', type: 'fill', source: 'vw-buildings',
            minzoom: MIN_ZOOM,
            layout: { visibility: 'none' },
            paint: {
              'fill-color': '#2d3748',
              'fill-opacity': 0.5,
              'fill-outline-color': '#4a5568',
            },
          });
        }

        // 특수건물 소스/레이어 (라벨 포함)
        if (!m.getSource('vw-special')) {
          m.addSource('vw-special', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        }
        if (!m.getLayer('vw-special-fill')) {
          m.addLayer({
            id: 'vw-special-fill', type: 'fill', source: 'vw-special',
            minzoom: MIN_ZOOM,
            layout: { visibility: 'none' },
            paint: {
              'fill-color': '#e53e3e',
              'fill-opacity': 0.3,
              'fill-outline-color': '#e53e3e',
            },
          });
        }
        if (!m.getLayer('vw-special-labels')) {
          m.addLayer({
            id: 'vw-special-labels', type: 'symbol', source: 'vw-special',
            minzoom: 13,
            layout: {
              'text-field': ['coalesce', ['get', 'buld_nm'], ['get', 'buld_nm_dc'], ['get', 'uname'], ''],
              'text-size': 10,
              visibility: 'none',
            },
            paint: {
              'text-color': '#fc8181',
              'text-halo-color': '#000',
              'text-halo-width': 1,
            },
          });
        }

        // 맵 이동 이벤트
        m.on('moveend', debouncedLoad);
        m.on('zoomend', debouncedLoad);

        layersAddedRef.current = true;
        logger.info('VWorld', 'Layers created');
      } catch (err) {
        logger.error('VWorld', `Layer error: ${err}`);
      }
    };

    if (m.isStyleLoaded()) ensureLayers();
    else m.once('style.load', ensureLayers);

    return () => {
      if (m) {
        m.off('moveend', debouncedLoad);
        m.off('zoomend', debouncedLoad);
      }
    };
  }, [map, mapLoaded, debouncedLoad]);

  // 표시/숨김 토글
  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded) return;
    try {
      if (m.getLayer('vw-buildings-fill')) m.setLayoutProperty('vw-buildings-fill', 'visibility', showBuildings ? 'visible' : 'none');
      if (m.getLayer('vw-special-fill')) m.setLayoutProperty('vw-special-fill', 'visibility', showSpecial ? 'visible' : 'none');
      if (m.getLayer('vw-special-labels')) m.setLayoutProperty('vw-special-labels', 'visibility', showSpecial ? 'visible' : 'none');
      if (m.getLayer('vw-roads-line')) m.setLayoutProperty('vw-roads-line', 'visibility', showRoads ? 'visible' : 'none');
    } catch { /* ignore */ }

    // 켜지면 즉시 로드
    if (showBuildings || showSpecial || showRoads) {
      lastBoundsRef.current = ''; // 강제 새로고침
      debouncedLoad();
    }
  }, [map, mapLoaded, showBuildings, showSpecial, showRoads, debouncedLoad]);
}
