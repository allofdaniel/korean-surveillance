/**
 * useVworldLayers - V-World 건물/특수건물/도로망 레이어
 * 뷰포트 이동 시 자동 로드 (줌 10+ 에서만)
 */
import { useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import type { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl';
import { logger } from '../utils/logger';

const MIN_ZOOM = 5; // 줌 5 이상에서 로드
const DEBOUNCE_MS = 800;

type LayerType = 'buildings' | 'special' | 'roads';

// V-World API 가 자주 502/500 → circuit breaker 로 연속 실패 시 일시 차단.
// 5분간 3회 이상 실패하면 그 후 5분간 호출 안함 — 콘솔 도배 + 서버 부하 방지.
const vworldCircuit = { failures: 0, openedAt: 0, COOLDOWN_MS: 5 * 60 * 1000 };

async function fetchVworldData(type: LayerType, bounds: { minX: number; maxX: number; minY: number; maxY: number }) {
  // Circuit open — 지난 5분 안에 3회 이상 실패했으면 skip
  if (vworldCircuit.failures >= 3) {
    if (Date.now() - vworldCircuit.openedAt < vworldCircuit.COOLDOWN_MS) return null;
    // cooldown 끝났으면 reset 하고 한 번 시도
    vworldCircuit.failures = 0;
  }
  try {
    const size = type === 'roads' ? 500 : 1000;
    // 보안: API 키를 브라우저에 노출하지 않기 위해 항상 서버사이드 프록시 사용
    const url = `/api/vworld-data?type=${type}&minX=${bounds.minX}&maxX=${bounds.maxX}&minY=${bounds.minY}&maxY=${bounds.maxY}&size=${size}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      vworldCircuit.failures++;
      if (vworldCircuit.failures === 3) {
        vworldCircuit.openedAt = Date.now();
        logger.warn('VWorld', `Circuit OPEN — skipping requests for ${vworldCircuit.COOLDOWN_MS / 1000}s`);
      }
      return null;
    }
    const data = await resp.json();
    if (data.response?.status !== 'OK') return null;
    // 성공 — circuit 리셋
    vworldCircuit.failures = 0;
    return data.response?.result?.featureCollection || null;
  } catch {
    vworldCircuit.failures++;
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
    const zoom = m.getZoom();
    if (zoom < MIN_ZOOM) return;

    const bounds = m.getBounds();
    if (!bounds) return;
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
          const src = m.getSource('vw-buildings') as GeoJSONSource;
          if (src) src.setData(fc);
        }
      })());
    }

    if (showSpecial && zoom >= 13) {
      // SPBD: bbox 10km² 제한이라 줌 13+ 에서만
      loads.push((async () => {
        const fc = await fetchVworldData('special', b);
        if (fc) {
          const src = m.getSource('vw-special') as GeoJSONSource;
          if (src) src.setData(fc);
        }
      })());
    }

    if (showRoads) {
      loads.push((async () => {
        const fc = await fetchVworldData('roads', b);
        if (fc) {
          const src = m.getSource('vw-roads') as GeoJSONSource;
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
              'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.2, 10, 0.8, 15, 2, 18, 4],
              'line-opacity': 0.6,
            },
          });
        }

        // 건물 소스/레이어 (줌 5+)
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
              'fill-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.2, 10, 0.4, 15, 0.6],
              'fill-outline-color': '#4a5568',
            },
          });
        }

        // 특수건물 소스/레이어 (줌 13+, bbox 10km² 제한)
        if (!m.getSource('vw-special')) {
          m.addSource('vw-special', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        }
        if (!m.getLayer('vw-special-fill')) {
          m.addLayer({
            id: 'vw-special-fill', type: 'fill', source: 'vw-special',
            minzoom: 13,
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
              'text-field': ['concat',
                ['get', 'rd_nm'], ' ',
                ['get', 'buld_no'],
                ['case', ['!=', ['get', 'buld_nm'], ''], ['concat', '\n', ['get', 'buld_nm']], ''],
              ],
              'text-size': 10,
              'text-anchor': 'center',
              'text-allow-overlap': false,
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
