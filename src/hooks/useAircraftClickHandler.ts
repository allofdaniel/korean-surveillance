import { useEffect, useRef, type MutableRefObject } from 'react';
import type { Map as MapboxMap, MapMouseEvent, PointLike } from 'mapbox-gl';
import type { AircraftData } from './useAircraftData';

/** Layers whose features carry a `hex` property identifying an aircraft. */
const PICK_LAYERS = ['aircraft-2d', 'aircraft-labels', 'aircraft-trails-2d', 'aircraft-trails-3d'];
/** Hit radius in CSS px — symbols are small and fingers are not. */
const HIT_PX = 14;

/**
 * useAircraftClickHandler - 항공기 선택
 * - 아이콘·라벨·항적 어디를 눌러도 가장 가까운 항공기를 선택 (터치 고려해 ±14px)
 * - 같은 항공기를 다시 누르거나 빈 곳을 누르면 선택 해제
 * 핸들러는 한 번만 등록하고 최신 항공기 목록은 ref 로 읽는다 (예전엔 2초마다 재등록했다).
 */
export default function useAircraftClickHandler(
  map: MutableRefObject<MapboxMap | null>,
  mapLoaded: boolean,
  aircraft: AircraftData[],
  selectedAircraft: AircraftData | null,
  setSelectedAircraft: React.Dispatch<React.SetStateAction<AircraftData | null>>
): void {
  const aircraftRef = useRef(aircraft);
  const selectedRef = useRef(selectedAircraft);
  aircraftRef.current = aircraft;
  selectedRef.current = selectedAircraft;

  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded) return;

    const pick = (point: { x: number; y: number }): string | null => {
      const layers = PICK_LAYERS.filter(id => { try { return !!m.getLayer(id); } catch { return false; } });
      if (!layers.length) return null;
      const box: [PointLike, PointLike] = [[point.x - HIT_PX, point.y - HIT_PX], [point.x + HIT_PX, point.y + HIT_PX]];
      let feats: GeoJSON.Feature[] = [];
      try { feats = m.queryRenderedFeatures(box, { layers }); } catch { return null; }
      let best: { hex: string; d: number } | null = null;
      for (const f of feats) {
        const hex = f.properties?.hex as string | undefined;
        if (!hex) continue;
        let d = HIT_PX * 2; // label/trail hits rank behind a direct icon hit
        if (f.geometry.type === 'Point') {
          const p = m.project(f.geometry.coordinates as [number, number]);
          d = Math.hypot(p.x - point.x, p.y - point.y);
        }
        if (!best || d < best.d) best = { hex, d };
      }
      return best?.hex ?? null;
    };

    const onClick = (e: MapMouseEvent): void => {
      const hex = pick(e.point);
      if (!hex) {
        if (selectedRef.current) setSelectedAircraft(null);
        return;
      }
      if (selectedRef.current?.hex === hex) { setSelectedAircraft(null); return; }
      const ac = aircraftRef.current.find(a => a.hex === hex);
      if (ac) setSelectedAircraft(ac);
    };

    let raf = 0;
    const onMove = (e: MapMouseEvent): void => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        m.getCanvas().style.cursor = pick(e.point) ? 'pointer' : '';
      });
    };

    m.on('click', onClick);
    m.on('mousemove', onMove);
    return () => {
      m.off('click', onClick);
      m.off('mousemove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [map, mapLoaded, setSelectedAircraft]);
}
