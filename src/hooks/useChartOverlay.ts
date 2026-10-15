/**
 * useChartOverlay Hook
 * 차트 오버레이 레이어 관리 (멀티 공항 지원)
 */
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { safeRemoveLayer, safeRemoveSource, isStyleReady } from '../utils/mapbox';
import { logger } from '../utils/logger';

type ChartBounds = [[number, number], [number, number], [number, number], [number, number]];

interface ChartData {
  file: string;
  /** transparent, frame-cropped image georeferenced to `bounds` */
  overlayFile?: string;
  bounds?: ChartBounds;
}

export type AllChartBounds = Record<string, Record<string, ChartData>>;

/**
 * Chart Overlay Hook
 */
const useChartOverlay = (
  map: MutableRefObject<MapboxMap | null>,
  mapLoaded: boolean,
  activeCharts: Record<string, boolean>,
  chartOpacities: Record<string, number>,
  allChartBounds: AllChartBounds,
  selectedAirport: string,
  /** dark basemap: invert luminance so black linework reads as light (Navigraph night mode) */
  invert = false
): void => {
  const prevLayersRef = useRef<Set<string>>(new Set());
  // styleReady tick — style 미준비 시 idle 이벤트 후 effect 강제 재실행 trigger.
  // 이전엔 onceLoaded 콜백이 비어있어 chart layer 가 영구히 추가 안됨.
  const [styleReadyTick, setStyleReadyTick] = useState(0);

  useEffect(() => {
    if (import.meta.env.DEV) {
      logger.debug('ChartOverlay', 'Effect triggered', {
        hasMap: !!map?.current,
        mapLoaded,
        selectedAirport,
        chartCount: Object.keys(allChartBounds?.[selectedAirport] || {}).length,
        activeCharts: Object.entries(activeCharts).filter(([, v]) => v).map(([k]) => k)
      });
    }
    if (!map?.current || !mapLoaded) return;

    // Mapbox style 가 setStyle() 직후엔 잠깐 not-loaded 상태 — addSource 호출 시 throw.
    // mapLoaded 만으로는 부족하므로 isStyleLoaded() 추가 검사 + 미로드 시 styledata 이벤트 대기.
    if (!isStyleReady(map.current)) {
      const m = map.current;
      const onceLoaded = (): void => {
        m.off('idle', onceLoaded);
        // styleReadyTick 증가 → effect 재실행 → 이번엔 isStyleLoaded() 통과
        setStyleReadyTick(t => t + 1);
      };
      m.once('idle', onceLoaded);
      return () => { m.off('idle', onceLoaded); };
    }

    // Get charts for selected airport
    const airportCharts = allChartBounds?.[selectedAirport] || {};
    const currentLayers = new Set<string>();

    // Process all charts for selected airport
    Object.entries(airportCharts).forEach(([chartId, chartData]) => {
      const layerId = `chart-${chartId}`;
      const sourceId = `chart-source-${chartId}`;
      const isActive = activeCharts[chartId];
      const bounds = chartData?.bounds;

      if (isActive && bounds) {
        currentLayers.add(layerId);
        if (import.meta.env.DEV) {
          logger.debug('ChartOverlay', `Adding chart: ${chartId}`, { file: chartData.file, bounds });
        }
        const paint = {
          'raster-opacity': chartOpacities[chartId] || 0.85,
          'raster-brightness-min': invert ? 1 : 0,
          'raster-brightness-max': invert ? 0.12 : 1,
        };
        const m = map.current!;
        if (m.getLayer(layerId) && m.getSource(sourceId)) {
          Object.entries(paint).forEach(([k, v]) => m.setPaintProperty(layerId, k as 'raster-opacity', v));
          return;
        }
        try {
          safeRemoveLayer(map.current, layerId);
          safeRemoveSource(map.current, sourceId);

          // Add source and layer
          map.current?.addSource(sourceId, {
            type: 'image',
            url: chartData.overlayFile || chartData.file,
            coordinates: bounds
          });

          // Find a suitable layer to insert before, or add on top
          const beforeLayer = map.current?.getLayer('runway') ? 'runway' : undefined;
          map.current?.addLayer({
            id: layerId,
            type: 'raster',
            source: sourceId,
            paint: { ...paint, 'raster-fade-duration': 0 }
          }, beforeLayer);
          if (import.meta.env.DEV) {
            logger.debug('ChartOverlay', `Successfully added chart layer: ${layerId}`);
          }
        } catch (e) {
          logger.error('ChartOverlay', `Failed to add chart overlay ${chartId}`, e instanceof Error ? e : new Error(String(e)));
        }
      } else {
        safeRemoveLayer(map.current, layerId);
        safeRemoveSource(map.current, sourceId);
      }
    });

    // Clean up layers from previously selected airport that are no longer needed
    prevLayersRef.current.forEach(layerId => {
      if (!currentLayers.has(layerId)) {
        const sourceId = layerId.replace('chart-', 'chart-source-');
        safeRemoveLayer(map.current, layerId);
        safeRemoveSource(map.current, sourceId);
      }
    });

    prevLayersRef.current = currentLayers;
  }, [map, activeCharts, chartOpacities, allChartBounds, selectedAirport, mapLoaded, styleReadyTick, invert]);
};

export default useChartOverlay;
