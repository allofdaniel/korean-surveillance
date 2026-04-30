import { useEffect, type MutableRefObject } from 'react';
import type { Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
import type { AircraftData } from './useAircraftData';

/**
 * useAircraftClickHandler - 항공기 클릭 이벤트 처리 훅
 * - 라벨 클릭 시 항공기 선택
 * - 항적 클릭 시 항공기 선택
 * - 맵 클릭 시 선택 해제
 */
export default function useAircraftClickHandler(
  map: MutableRefObject<MapboxMap | null>,
  mapLoaded: boolean,
  aircraft: AircraftData[],
  selectedAircraft: AircraftData | null,
  setSelectedAircraft: React.Dispatch<React.SetStateAction<AircraftData | null>>
): void {
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Capture current map reference for cleanup
    const mapInstance = map.current;

    const handleAircraftClick = (e: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
      const feature = e.features?.[0];
      if (feature) {
        const hex = feature.properties?.hex as string | undefined;
        if (hex) {
          // 토글 방식: 같은 항공기 클릭 시 선택 해제
          if (selectedAircraft?.hex === hex) {
            setSelectedAircraft(null);
          } else {
            const ac = aircraft.find(a => a.hex === hex);
            if (ac) {
              setSelectedAircraft(ac);
            }
          }
        }
      }
    };

    const handleMapClick = (e: MapMouseEvent) => {
      // 항공기 레이어 외부 클릭 시 선택 해제
      const features = map.current?.queryRenderedFeatures(e.point, { layers: ['aircraft-labels', 'aircraft-3d', 'aircraft-2d', 'aircraft-heading-lines'] });
      if (!features || features.length === 0) {
        setSelectedAircraft(null);
      }
    };

    // 커서 핸들러를 named const 로 hoist — cleanup 시 정확히 같은 reference 로 off 해야 함
    const setCursorPointer = (): void => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer';
    };
    const resetCursor = (): void => {
      if (map.current) map.current.getCanvas().style.cursor = '';
    };

    // 라벨 클릭으로 항공기 선택
    const hasLabels = map.current.getLayer('aircraft-labels');
    if (hasLabels) {
      map.current.on('click', 'aircraft-labels', handleAircraftClick as (e: MapMouseEvent) => void);
      map.current.on('mouseenter', 'aircraft-labels', setCursorPointer);
      map.current.on('mouseleave', 'aircraft-labels', resetCursor);
    }

    // 항적 클릭으로도 항공기 선택 가능
    const hasTrails = map.current.getLayer('aircraft-trails-3d');
    if (hasTrails) {
      map.current.on('click', 'aircraft-trails-3d', handleAircraftClick as (e: MapMouseEvent) => void);
      map.current.on('mouseenter', 'aircraft-trails-3d', setCursorPointer);
      map.current.on('mouseleave', 'aircraft-trails-3d', resetCursor);
    }

    map.current.on('click', handleMapClick);

    return () => {
      if (mapInstance) {
        try {
          if (hasLabels) {
            mapInstance.off('click', 'aircraft-labels', handleAircraftClick as (e: MapMouseEvent) => void);
            mapInstance.off('mouseenter', 'aircraft-labels', setCursorPointer);
            mapInstance.off('mouseleave', 'aircraft-labels', resetCursor);
          }
          if (hasTrails) {
            mapInstance.off('click', 'aircraft-trails-3d', handleAircraftClick as (e: MapMouseEvent) => void);
            mapInstance.off('mouseenter', 'aircraft-trails-3d', setCursorPointer);
            mapInstance.off('mouseleave', 'aircraft-trails-3d', resetCursor);
          }
          mapInstance.off('click', handleMapClick);
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [mapLoaded, aircraft, selectedAircraft, setSelectedAircraft, map]);
}
