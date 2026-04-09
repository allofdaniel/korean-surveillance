/**
 * useMapStyle Hook
 * 맵 스타일 및 뷰 모드 관리
 */
import { useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { MAP_STYLES } from '../constants/config';
import { logger } from '../utils/logger';

export interface UseMapStyleOptions {
  map: MutableRefObject<MapboxMap | null>;
  mapLoaded: boolean;
  setMapLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  isDarkMode: boolean;
  showSatellite: boolean;
  radarBlackBackground: boolean;
  is3DView: boolean;
  setIs3DView: (value: boolean) => void;
  showTerrain: boolean;
  show3DAltitude: boolean;
}

// 커스텀 레이어 ID 프리픽스 (Mapbox 베이스가 아닌 우리가 추가한 레이어)
const CUSTOM_LAYER_PREFIXES = [
  'satellite-overlay', 'satellite-icons', 'satellite-orbit',
  'cctv-', 'ship-', 'vworld-',
  'aircraft-', 'trail-', '3d-buildings', 'sky',
  'runway', 'airspace-', 'waypoint', 'obstacle', 'notam-',
  'sid-', 'star-', 'apch-', 'chart-', 'holding-',
  'radar-black-overlay',
];

function isCustomLayer(layerId: string): boolean {
  return CUSTOM_LAYER_PREFIXES.some(p => layerId.startsWith(p));
}

const useMapStyle = ({
  map,
  mapLoaded,
  setMapLoaded,
  isDarkMode,
  showSatellite,
  radarBlackBackground,
  is3DView,
  setIs3DView,
  showTerrain,
  show3DAltitude
}: UseMapStyleOptions): void => {
  const prevStyleRef = useRef<string | null>(null);
  const prev3DViewRef = useRef<boolean | null>(null);
  const hiddenLayersRef = useRef<string[]>([]);

  // Mapbox 베이스 레이어 숨기기/복원
  const toggleMapboxBaseLayers = useCallback((m: MapboxMap, hide: boolean) => {
    try {
      const layers = m.getStyle()?.layers || [];
      if (hide) {
        const toHide: string[] = [];
        for (const layer of layers) {
          if (layer.id === 'satellite-overlay-layer') continue;
          if (isCustomLayer(layer.id)) continue;
          if (layer.type === 'background') continue;
          try {
            m.setLayoutProperty(layer.id, 'visibility', 'none');
            toHide.push(layer.id);
          } catch { /* skip */ }
        }
        hiddenLayersRef.current = toHide;
        logger.info('MapStyle', `Hidden ${toHide.length} Mapbox base layers`);
      } else {
        for (const layerId of hiddenLayersRef.current) {
          try {
            if (m.getLayer(layerId)) {
              m.setLayoutProperty(layerId, 'visibility', 'visible');
            }
          } catch { /* skip */ }
        }
        logger.info('MapStyle', `Restored ${hiddenLayersRef.current.length} Mapbox base layers`);
        hiddenLayersRef.current = [];
      }
    } catch (err) {
      logger.error('MapStyle', `toggleMapboxBaseLayers error: ${err}`);
    }
  }, []);

  // Handle base style change (dark/light)
  useEffect(() => {
    if (!map?.current || !mapLoaded) return;

    const newStyle = isDarkMode ? MAP_STYLES.dark as string : MAP_STYLES.light as string;

    if (prevStyleRef.current === newStyle) return;
    prevStyleRef.current = newStyle;
    logger.info('MapStyle', `Changing style to: ${newStyle}`);

    const center = map.current.getCenter();
    const zoom = map.current.getZoom();
    const pitch = map.current.getPitch();
    const bearing = map.current.getBearing();

    map.current.setStyle(newStyle);
    map.current.once('style.load', () => {
      if (!map.current) return;

      map.current.setCenter(center);
      map.current.setZoom(zoom);

      if (is3DView) {
        map.current.setPitch(pitch > 0 ? pitch : 60);
        map.current.setBearing(bearing !== 0 ? bearing : -30);
      } else {
        map.current.setPitch(pitch);
        map.current.setBearing(bearing);
      }

      // Terrain DEM source
      if (!map.current.getSource('mapbox-dem')) {
        map.current.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14
        });
      }

      if (is3DView && showTerrain && (!show3DAltitude || showSatellite)) {
        map.current.setTerrain({ source: 'mapbox-dem', exaggeration: showSatellite ? 1.5 : 2.5 });
      }

      // Sky layer
      if (!map.current.getLayer('sky')) {
        map.current.addLayer({
          id: 'sky',
          type: 'sky',
          paint: {
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [0.0, 90.0],
            'sky-atmosphere-sun-intensity': 15
          }
        });
      }

      // 3D buildings
      try {
        if (!map.current.getLayer('3d-buildings') && map.current.getSource('composite')) {
          map.current.addLayer({
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            type: 'fill-extrusion',
            minzoom: 10,
            paint: {
              'fill-extrusion-color': showSatellite ? '#d0d0d0' : '#aaa',
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': ['get', 'min_height'],
              'fill-extrusion-opacity': showSatellite ? 0.85 : 0.6
            }
          });
        }
      } catch {
        logger.debug('MapStyle', '3D buildings skipped - no composite source');
      }

      // Runway
      if (!map.current.getSource('runway')) {
        map.current.addSource('runway', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [[129.3505, 35.5890], [129.3530, 35.5978]]
            }
          }
        });
      }
      if (!map.current.getLayer('runway')) {
        map.current.addLayer({
          id: 'runway',
          type: 'line',
          source: 'runway',
          paint: { 'line-color': '#FFFFFF', 'line-width': 8 }
        });
      }

      prev3DViewRef.current = is3DView;

      setMapLoaded(false);
      setTimeout(() => setMapLoaded(true), 100);
    });
  }, [map, isDarkMode, showSatellite, mapLoaded, setMapLoaded, is3DView, showTerrain, show3DAltitude]);

  // Handle black background toggle
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !mapLoaded) return;
    if (!mapInstance.isStyleLoaded()) return;

    const blackOverlayId = 'radar-black-overlay';

    if (radarBlackBackground) {
      if (!mapInstance.getLayer(blackOverlayId)) {
        const customLayerIds = [
          'aircraft-3d', 'aircraft-2d', 'aircraft-labels',
          'aircraft-trails-3d', 'aircraft-trails-2d', 'trail-layer',
          'waypoint-layer', 'airspace-layer', 'atc-sectors-fill'
        ];
        let beforeLayerId: string | undefined;
        for (const layerId of customLayerIds) {
          if (mapInstance.getLayer(layerId)) {
            beforeLayerId = layerId;
            break;
          }
        }
        mapInstance.addLayer({
          id: blackOverlayId,
          type: 'background',
          paint: { 'background-color': '#000000', 'background-opacity': 0.95 }
        }, beforeLayerId);
      }
    } else {
      if (mapInstance.getLayer(blackOverlayId)) {
        mapInstance.removeLayer(blackOverlayId);
      }
    }
  }, [map, radarBlackBackground, mapLoaded]);

  // Handle satellite raster overlay toggle (V-World)
  // 위성 ON: V-World 래스터 추가 + Mapbox 베이스 레이어 숨김
  // 위성 OFF: V-World 래스터 제거 + Mapbox 베이스 레이어 복원
  useEffect(() => {
    if (!map?.current || !mapLoaded) return;

    const vworldKey = import.meta.env.VITE_VWORLD_API_KEY;
    const sourceId = 'satellite-overlay';
    const layerId = 'satellite-overlay-layer';

    const toggleSatelliteLayer = () => {
      if (!map.current) return;

      try {
        if (showSatellite) {
          // V-World 위성 소스 추가
          if (!map.current.getSource(sourceId)) {
            if (vworldKey) {
              logger.info('MapStyle', 'Adding V-World satellite source');
              map.current.addSource(sourceId, {
                type: 'raster',
                tiles: [`https://api.vworld.kr/req/wmts/1.0.0/${vworldKey}/Satellite/{z}/{y}/{x}.jpeg`],
                tileSize: 256,
                minzoom: 5,
                maxzoom: 19,
                attribution: '&copy; V-World (국토교통부)'
              });
            } else {
              map.current.addSource(sourceId, {
                type: 'raster',
                url: 'mapbox://mapbox.satellite',
                tileSize: 256
              });
            }
          }
          // 위성 레이어 추가 (background 바로 위)
          if (!map.current.getLayer(layerId)) {
            const layers = map.current.getStyle()?.layers || [];
            let firstNonBgLayer: string | undefined;
            for (const layer of layers) {
              if (layer.type !== 'background') {
                firstNonBgLayer = layer.id;
                break;
              }
            }
            map.current.addLayer({
              id: layerId,
              type: 'raster',
              source: sourceId,
              paint: { 'raster-opacity': 1 }
            }, firstNonBgLayer);
          }
          // Mapbox 베이스 레이어 전부 숨기기 → V-World만 보임
          toggleMapboxBaseLayers(map.current, true);
        } else {
          // 위성 레이어/소스 제거
          if (map.current.getLayer(layerId)) {
            map.current.removeLayer(layerId);
          }
          if (map.current.getSource(sourceId)) {
            map.current.removeSource(sourceId);
          }
          // Mapbox 베이스 레이어 복원
          toggleMapboxBaseLayers(map.current, false);
        }
      } catch (err) {
        logger.error('MapStyle', `Satellite overlay error: ${err}`);
      }
    };

    if (map.current.isStyleLoaded()) {
      toggleSatelliteLayer();
    } else {
      map.current.once('style.load', toggleSatelliteLayer);
    }
  }, [map, showSatellite, mapLoaded, toggleMapboxBaseLayers]);

  // Handle 2D/3D toggle + satellite terrain
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !mapLoaded) return;
    const is3DChanged = prev3DViewRef.current !== is3DView;
    prev3DViewRef.current = is3DView;

    if (is3DView) {
      // 3D 진입 시 카메라 애니메이션 (최초 전환 시만)
      if (is3DChanged && mapInstance.getPitch() < 10) {
        mapInstance.easeTo({ pitch: 60, bearing: -30, duration: 1000 });
      }
      // Terrain 활성화
      if (!mapInstance.getSource('mapbox-dem')) {
        mapInstance.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14
        });
      }
      if (showTerrain && (!show3DAltitude || showSatellite)) {
        mapInstance.setTerrain({ source: 'mapbox-dem', exaggeration: showSatellite ? 1.5 : 2.5 });
      }
      // 3D 건물
      try {
        if (!mapInstance.getLayer('3d-buildings') && mapInstance.getSource('composite')) {
          mapInstance.addLayer({
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            type: 'fill-extrusion',
            minzoom: 10,
            paint: {
              'fill-extrusion-color': showSatellite ? '#d0d0d0' : '#aaa',
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': ['get', 'min_height'],
              'fill-extrusion-opacity': showSatellite ? 0.85 : 0.6
            }
          });
        } else if (mapInstance.getLayer('3d-buildings')) {
          mapInstance.setPaintProperty('3d-buildings', 'fill-extrusion-color', showSatellite ? '#d0d0d0' : '#aaa');
          mapInstance.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', showSatellite ? 0.85 : 0.6);
        }
      } catch {
        // composite source not available
      }
    } else if (is3DChanged) {
      // 2D로 전환 시 카메라 리셋
      if (mapInstance.getPitch() > 5) {
        mapInstance.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
      }
      mapInstance.setTerrain(null);
    }
  }, [map, is3DView, mapLoaded, showTerrain, show3DAltitude, showSatellite]);

  // 피치 변경에 따른 2D/3D 자동 전환
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !mapLoaded) return;

    const PITCH_3D_THRESHOLD = 15;
    const PITCH_2D_THRESHOLD = 5;

    const handlePitchEnd = () => {
      const currentPitch = mapInstance.getPitch();
      if (!is3DView && currentPitch > PITCH_3D_THRESHOLD) {
        setIs3DView(true);
      } else if (is3DView && currentPitch < PITCH_2D_THRESHOLD) {
        setIs3DView(false);
      }
    };

    mapInstance.on('pitchend', handlePitchEnd);
    return () => {
      mapInstance.off('pitchend', handlePitchEnd);
    };
  }, [map, mapLoaded, is3DView, setIs3DView]);
};

export default useMapStyle;
