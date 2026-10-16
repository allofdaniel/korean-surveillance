/**
 * useVworldLayers - V-World 건물/특수건물/도로망 레이어
 * 뷰포트 이동 시 자동 로드 (줌 10+ 에서만)
 */
import { useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import type { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl';
import { logger } from '../utils/logger';
import { isStyleReady } from '../utils/mapbox';

const MIN_ZOOM = 13; // V-World GetFeature 는 bbox 크기 제한이 있어 확대했을 때만 로드
const DEBOUNCE_MS = 800;

type LayerType = 'buildings' | 'special' | 'roads';
type Box = { minX: number; maxX: number; minY: number; maxY: number };

// V-World rejects large boxes (INVALID_RANGE): special buildings ~0.04°, others well above 0.2°.
const MAX_SPAN: Record<LayerType, number> = { buildings: 0.03, roads: 0.15, special: 0.03 };
function clampBox(b: Box, span: number): Box {
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  const hx = Math.min((b.maxX - b.minX) / 2, span / 2), hy = Math.min((b.maxY - b.minY) / 2, span / 2);
  const r = (v: number): number => Math.round(v * 1000) / 1000;
  return { minX: r(cx - hx), maxX: r(cx + hx), minY: r(cy - hy), maxY: r(cy + hy) };
}

// V-World API 가 자주 502/500 → circuit breaker 로 연속 실패 시 일시 차단.
// 5분간 3회 이상 실패하면 그 후 5분간 호출 안함 — 콘솔 도배 + 서버 부하 방지.
const vworldCircuit = { failures: 0, openedAt: 0, COOLDOWN_MS: 5 * 60 * 1000 };

async function fetchVworldData(type: LayerType, view: Box) {
  const bounds = clampBox(view, MAX_SPAN[type]);
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBoundsRef = useRef('');

  const loadData = useCallback(async () => {
    const m = map.current;
    if (!m || !isStyleReady(m)) return;
    try {
      ensureVwLayers(m);
      applyVisibility(m, showBuildings, showSpecial, showRoads);
    } catch (err) {
      logger.error('VWorld', `Layer error: ${err}`);
      return;
    }
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
      // SPBD: bbox 제한이 가장 작아 줌 13+ 에서 화면 중앙 부분만
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

  // 지도 이동 / 스타일 교체(다크·위성 전환) 후 다시 로드 — 레이어는 loadData 에서 매번 보장한다
  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded) return;
    const onStyle = (): void => { lastBoundsRef.current = ''; debouncedLoad(); };
    m.on('moveend', debouncedLoad);
    m.on('style.load', onStyle);
    return () => {
      m.off('moveend', debouncedLoad);
      m.off('style.load', onStyle);
    };
  }, [map, mapLoaded, debouncedLoad]);

  // 표시/숨김 토글
  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded) return;
    if (isStyleReady(m)) applyVisibility(m, showBuildings, showSpecial, showRoads);
    if (showBuildings || showSpecial || showRoads) {
      lastBoundsRef.current = ''; // 강제 새로고침
      debouncedLoad();
    }
  }, [map, mapLoaded, showBuildings, showSpecial, showRoads, debouncedLoad]);
}

/** Create the V-World sources/layers if the current style lacks them (style switches wipe them). */
function ensureVwLayers(m: MapboxMap): void {
  const empty = { type: 'FeatureCollection' as const, features: [] };
  if (!m.getSource('vw-roads')) m.addSource('vw-roads', { type: 'geojson', data: empty });
  if (!m.getLayer('vw-roads-line')) {
    m.addLayer({
      id: 'vw-roads-line', type: 'line', source: 'vw-roads', minzoom: MIN_ZOOM,
      layout: { visibility: 'none' },
      paint: {
        'line-color': '#8fa3bf',
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 15, 2, 18, 4],
        'line-opacity': 0.7,
      },
    });
  }
  if (!m.getSource('vw-buildings')) m.addSource('vw-buildings', { type: 'geojson', data: empty });
  if (!m.getLayer('vw-buildings-fill')) {
    m.addLayer({
      id: 'vw-buildings-fill', type: 'fill', source: 'vw-buildings', minzoom: MIN_ZOOM,
      layout: { visibility: 'none' },
      paint: { 'fill-color': '#7d8ca3', 'fill-opacity': 0.45, 'fill-outline-color': '#b8c4d6' },
    });
  }
  if (!m.getSource('vw-special')) m.addSource('vw-special', { type: 'geojson', data: empty });
  if (!m.getLayer('vw-special-fill')) {
    m.addLayer({
      id: 'vw-special-fill', type: 'fill', source: 'vw-special', minzoom: 13,
      filter: ['!=', ['coalesce', ['get', 'buld_nm'], ''], ''],
      layout: { visibility: 'none' },
      paint: { 'fill-color': '#e53e3e', 'fill-opacity': 0.3, 'fill-outline-color': '#e53e3e' },
    });
  }
  if (!m.getLayer('vw-special-labels')) {
    m.addLayer({
      id: 'vw-special-labels', type: 'symbol', source: 'vw-special', minzoom: 15,
      filter: ['!=', ['coalesce', ['get', 'buld_nm'], ''], ''],
      layout: {
        'text-field': ['coalesce', ['get', 'buld_nm'], ''],
        'text-size': 10, 'text-anchor': 'center', 'text-allow-overlap': false, visibility: 'none',
      },
      paint: { 'text-color': '#fc8181', 'text-halo-color': '#000', 'text-halo-width': 1 },
    });
  }
}

function applyVisibility(m: MapboxMap, buildings: boolean, special: boolean, roads: boolean): void {
  const set = (id: string, on: boolean): void => { if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); };
  set('vw-buildings-fill', buildings);
  set('vw-special-fill', special);
  set('vw-special-labels', special);
  set('vw-roads-line', roads);
}
