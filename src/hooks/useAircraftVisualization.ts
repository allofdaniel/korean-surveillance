import { useEffect, useRef, type MutableRefObject } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { ftToM, createRibbonSegment } from '../utils/geometry';
import { AIRCRAFT_CATEGORY_COLORS, AIRCRAFT_LABEL_SELECTED_COLOR } from '../utils/colors';
import type { AircraftData, AircraftTrails } from './useAircraftData';

interface LabelOffset {
  x: number;
  y: number;
}

interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: unknown;
  };
  properties: Record<string, unknown>;
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

type AnchorType = 'center' | 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };

function getSource(map: MutableRefObject<MapboxMap | null>, id: string) {
  return map.current?.getSource(id) as { setData: (data: FeatureCollection) => void } | undefined;
}

function setOrCreateSource(
  map: MutableRefObject<MapboxMap | null>,
  id: string,
  data: FeatureCollection,
  init: () => void
) {
  const src = getSource(map, id);
  if (src) {
    src.setData(data);
  } else {
    init();
  }
}

function getAnchorFromOffset(x: number, y: number): AnchorType {
  if (x >= 0 && y <= 0) return 'bottom-left';
  if (x < 0 && y <= 0) return 'bottom-right';
  if (x >= 0 && y > 0) return 'top-left';
  return 'top-right';
}

function createAircraftShape(lon: number, lat: number, heading: number, size = 0.002): number[][][] {
  const rad = -(heading || 0) * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const points: [number, number][] = [
    [0, size * 1.5],
    [-size * 0.5, -size],
    [0, -size * 0.3],
    [size * 0.5, -size],
  ];
  const rotated = points.map(([x, y]) => [
    lon + (x * cos - y * sin),
    lat + (x * sin + y * cos)
  ]);
  const first = rotated[0];
  if (first) rotated.push(first);
  return [rotated];
}

/**
 * useAircraftVisualization - 항공기 시각화 레이어 관리 훅
 *
 * 성능을 위해 두 개의 useEffect 로 분리:
 *   Effect A (positions) — `aircraft` 변화에 반응 (Kalman smoothed → ~15Hz)
 *     · 3D / 2D 항공기, 라벨, 헤딩 예측선
 *   Effect B (trails) — `aircraftTrails` 변화에 반응 (실측 데이터, 1Hz)
 *     · 3D 항적 리본 (가장 무거운 빌드)
 *
 * 항적은 1Hz 갱신만 일어나는데 기존엔 30Hz 로 재빌드되어 메인 스레드를 잡아먹었음.
 * 위치 관련 레이어만 빠르게 갱신하고 항적은 실측 변화 때만 다시 그린다.
 */
export default function useAircraftVisualization(
  map: MutableRefObject<MapboxMap | null>,
  mapLoaded: boolean,
  aircraft: AircraftData[],
  aircraftTrails: AircraftTrails,
  showAircraft: boolean,
  showAircraftTrails: boolean,
  show3DAircraft: boolean,
  is3DView: boolean,
  show3DAltitude: boolean,
  trailDuration: number,
  headingPrediction: number,
  selectedAircraft: AircraftData | null,
  labelOffset: LabelOffset
): void {
  // 트레일 빌드 시점에 최신 smoothed aircraft 위치를 참조하기 위한 ref
  const aircraftRef = useRef<AircraftData[]>(aircraft);
  aircraftRef.current = aircraft;

  // ─────────────────────────────────────────────────────────────────────────
  // Effect A: 위치/라벨/헤딩 예측선 (자주 갱신)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // OFF — 빈 데이터로 비움
    if (!showAircraft || aircraft.length === 0) {
      ['aircraft-3d', 'aircraft-2d', 'aircraft-labels', 'aircraft-heading-lines'].forEach(id => {
        const src = getSource(map, id);
        if (src) src.setData(EMPTY_FC);
      });
      return;
    }

    const flyingAircraft = aircraft.filter(ac => !ac.on_ground && ac.altitude_ft > 100);

    // 3D Aircraft
    const features3d: GeoJSONFeature[] = (show3DAircraft && flyingAircraft.length > 0)
      ? flyingAircraft.map(ac => {
          const altM = ftToM(ac.altitude_ft);
          return {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: createAircraftShape(ac.lon, ac.lat, ac.track, 0.008) },
            properties: { color: AIRCRAFT_CATEGORY_COLORS[ac.category] || '#00BCD4', height: altM + 150, base: altM }
          };
        })
      : [];

    // 2D Aircraft
    const features2d: GeoJSONFeature[] = (!show3DAircraft) && flyingAircraft.length > 0
      ? flyingAircraft.map(ac => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [ac.lon, ac.lat] },
          properties: { callsign: ac.callsign, color: AIRCRAFT_CATEGORY_COLORS[ac.category] || '#00BCD4', rotation: ac.track || 0 }
        }))
      : [];

    // Labels
    const labelFeatures: GeoJSONFeature[] = flyingAircraft.map(ac => {
      const isEmergency = ['7700', '7600', '7500'].includes(ac.squawk);
      const vsIndicator = ac.vertical_rate > 100 ? '↑' : ac.vertical_rate < -100 ? '↓' : '';
      const isSelected = selectedAircraft?.hex === ac.hex;

      let label: string;
      if (isSelected) {
        const route = (ac.origin || ac.destination) ? `${ac.origin || '???'}→${ac.destination || '???'}` : '';
        label = `${ac.callsign || ac.hex} [${ac.icao_type || ac.type || '?'}]` +
          `${ac.registration ? ` ${ac.registration}` : ''}` +
          `${route ? `\n${route}` : ''}` +
          `\nALT ${(ac.altitude_ft || 0).toLocaleString()}ft  GS ${ac.ground_speed || 0}kt` +
          `\nHDG ${Math.round(ac.track || 0)}°  VS ${ac.vertical_rate > 0 ? '+' : ''}${ac.vertical_rate || 0}fpm` +
          `\nSQK ${ac.squawk || '----'}`;
      } else {
        label = `${ac.callsign || ac.hex}\n${ac.altitude_ft || 0} ${ac.ground_speed || 0}kt${vsIndicator}\n${ac.squawk || '----'}`;
      }

      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [ac.lon, ac.lat] },
        properties: {
          label,
          hex: ac.hex,
          color: isEmergency ? '#ff0000' : (isSelected ? AIRCRAFT_LABEL_SELECTED_COLOR : '#FFFFFF')
        }
      };
    });

    // 헤딩 예측 리본
    const headingRibbonFeatures: GeoJSONFeature[] = [];
    if (headingPrediction > 0) {
      flyingAircraft.forEach(ac => {
        const heading = (ac.track || 0) * Math.PI / 180;
        const speedKt = ac.ground_speed || 0;
        const distanceNm = (speedKt / 3600) * headingPrediction;
        const distanceDeg = distanceNm * 0.0166;
        const lineLength = Math.max(0.005, distanceDeg);
        const endLon = ac.lon + Math.sin(heading) * lineLength;
        const endLat = ac.lat + Math.cos(heading) * lineLength;
        const ribbon = createRibbonSegment(
          [ac.lon, ac.lat, ac.altitude_m],
          [endLon, endLat, ac.altitude_m],
          0.0008
        );
        if (ribbon && ribbon.coordinates) {
          headingRibbonFeatures.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: ribbon.coordinates },
            properties: {
              color: '#00ffff',
              height: ac.altitude_m + 50,
              base: ac.altitude_m - 50,
              hex: ac.hex
            }
          });
        }
      });
    }

    // 3D Aircraft source
    setOrCreateSource(map, 'aircraft-3d',
      { type: 'FeatureCollection', features: features3d },
      () => {
        map.current?.addSource('aircraft-3d', { type: 'geojson', data: { type: 'FeatureCollection', features: features3d } as GeoJSON.FeatureCollection });
        map.current?.addLayer({
          id: 'aircraft-3d', type: 'fill-extrusion', source: 'aircraft-3d',
          paint: {
            'fill-extrusion-color': ['get', 'color'],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'base'],
            'fill-extrusion-opacity': 0.9
          }
        });
      }
    );

    // 2D Aircraft source
    setOrCreateSource(map, 'aircraft-2d',
      { type: 'FeatureCollection', features: features2d },
      () => {
        map.current?.addSource('aircraft-2d', { type: 'geojson', data: { type: 'FeatureCollection', features: features2d } as GeoJSON.FeatureCollection });
        map.current?.addLayer({
          id: 'aircraft-2d', type: 'symbol', source: 'aircraft-2d',
          layout: {
            'icon-image': 'airport-15',
            'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 10, 2.5, 14, 3.5],
            'icon-rotate': ['get', 'rotation'],
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap': true
          },
          paint: { 'icon-color': ['get', 'color'] }
        });
      }
    );

    // Labels source
    const currentAnchor = getAnchorFromOffset(labelOffset.x, labelOffset.y);
    setOrCreateSource(map, 'aircraft-labels',
      { type: 'FeatureCollection', features: labelFeatures },
      () => {
        map.current?.addSource('aircraft-labels', { type: 'geojson', data: { type: 'FeatureCollection', features: labelFeatures } as GeoJSON.FeatureCollection });
        map.current?.addLayer({
          id: 'aircraft-labels', type: 'symbol', source: 'aircraft-labels',
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 10,
            'text-anchor': currentAnchor,
            'text-offset': [labelOffset.x, labelOffset.y],
            'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
            'text-ignore-placement': true
          },
          paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#000000', 'text-halo-width': 1.5, 'text-halo-blur': 0.5 }
        });
      }
    );
    if (map.current?.getLayer('aircraft-labels')) {
      map.current.setLayoutProperty('aircraft-labels', 'text-anchor', currentAnchor);
      map.current.setLayoutProperty('aircraft-labels', 'text-offset', [labelOffset.x, labelOffset.y]);
    }

    // Heading lines source
    setOrCreateSource(map, 'aircraft-heading-lines',
      { type: 'FeatureCollection', features: headingRibbonFeatures },
      () => {
        map.current?.addSource('aircraft-heading-lines', { type: 'geojson', data: { type: 'FeatureCollection', features: headingRibbonFeatures } as GeoJSON.FeatureCollection });
        map.current?.addLayer({
          id: 'aircraft-heading-lines', type: 'fill-extrusion', source: 'aircraft-heading-lines',
          paint: {
            'fill-extrusion-color': ['get', 'color'],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'base'],
            'fill-extrusion-opacity': 0.85
          }
        });
      }
    );
  }, [aircraft, showAircraft, show3DAircraft, mapLoaded, headingPrediction, selectedAircraft, labelOffset, map]);

  // ─────────────────────────────────────────────────────────────────────────
  // Effect B: 항적 리본 (1Hz 실측 변화 시에만)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (!showAircraft || !showAircraftTrails || Object.keys(aircraftTrails).length === 0) {
      const src = getSource(map, 'aircraft-trails-3d');
      if (src) src.setData(EMPTY_FC);
      // 미사용 레이어들도 빈 상태 유지
      const s2 = getSource(map, 'aircraft-trails-2d');
      if (s2) s2.setData(EMPTY_FC);
      const sa = getSource(map, 'aircraft-trails-arrows');
      if (sa) sa.setData(EMPTY_FC);
      return;
    }

    const trail3dFeatures: GeoJSONFeature[] = [];
    const now = Date.now();
    const currentAircraft = aircraftRef.current; // 최신 smoothed 위치 (effect 시점 기준)

    Object.entries(aircraftTrails).forEach(([hex, trail]) => {
      if (trail.length < 1) return;
      const ac = currentAircraft.find(a => a.hex === hex);
      if (!ac || ac.on_ground) return;

      // 항적 마지막 점 → 현재 항공기 위치까지 한 세그먼트 연장 (시각적 끊김 방지)
      const extendedTrail = [...trail];
      const lastTrail = trail[trail.length - 1];
      if (lastTrail && (lastTrail.lat !== ac.lat || lastTrail.lon !== ac.lon)) {
        extendedTrail.push({ lat: ac.lat, lon: ac.lon, altitude_m: ac.altitude_m, timestamp: now });
      }

      if (extendedTrail.length < 2) return;

      for (let i = 0; i < extendedTrail.length - 1; i++) {
        if (i % 3 === 2) continue; // 점선 효과
        const p1 = extendedTrail[i];
        const p2 = extendedTrail[i + 1];
        if (!p1 || !p2) continue;
        const segTime = (p1.timestamp + p2.timestamp) / 2;
        const age = now - segTime;
        const opacity = Math.max(0.3, 1.0 - (age / trailDuration) * 0.7);
        const colorWithAlpha = `rgba(0, 255, 136, ${opacity})`;
        const ribbon = createRibbonSegment(
          [p1.lon, p1.lat, p1.altitude_m || 100],
          [p2.lon, p2.lat, p2.altitude_m || 100],
          0.001
        );
        if (ribbon) trail3dFeatures.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: ribbon.coordinates },
          properties: { height: ribbon.avgAlt + 30, base: Math.max(0, ribbon.avgAlt - 30), color: colorWithAlpha }
        });
      }
    });

    setOrCreateSource(map, 'aircraft-trails-3d',
      { type: 'FeatureCollection', features: trail3dFeatures },
      () => {
        map.current?.addSource('aircraft-trails-3d', { type: 'geojson', data: { type: 'FeatureCollection', features: trail3dFeatures } as GeoJSON.FeatureCollection });
        map.current?.addLayer({
          id: 'aircraft-trails-3d', type: 'fill-extrusion', source: 'aircraft-trails-3d',
          paint: {
            'fill-extrusion-color': ['get', 'color'],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'base'],
            'fill-extrusion-opacity': 0.9
          }
        });
      }
    );

    // 미사용 레이어 source 보장 (initial create 시 빈 상태)
    setOrCreateSource(map, 'aircraft-trails-2d', EMPTY_FC, () => {
      map.current?.addSource('aircraft-trails-2d', { type: 'geojson', data: EMPTY_FC as GeoJSON.FeatureCollection });
    });
    setOrCreateSource(map, 'aircraft-trails-arrows', EMPTY_FC, () => {
      map.current?.addSource('aircraft-trails-arrows', { type: 'geojson', data: EMPTY_FC as GeoJSON.FeatureCollection });
    });
  }, [aircraftTrails, showAircraft, showAircraftTrails, trailDuration, mapLoaded, map]);

  // is3DView / show3DAltitude 는 layer paint expression 에 직접 영향이 없으므로
  // 의도적으로 deps 제외 — 필요시 useMapStyle 쪽에서 layer 갱신
  void is3DView;
  void show3DAltitude;
}
