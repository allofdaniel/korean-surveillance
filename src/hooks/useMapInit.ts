import { useEffect, useRef, useState, type RefObject, type MutableRefObject } from 'react';
import mapboxgl, { Map as MapboxMap } from 'mapbox-gl';
import { MAP_STYLES, TRAIL_COLOR, MAPBOX_ACCESS_TOKEN } from '../constants/config';
import { logger } from '../utils/logger';

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

export interface UseMapInitReturn {
  map: MutableRefObject<MapboxMap | null>;
  mapLoaded: boolean;
  setMapLoaded: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * useMapInit - Mapbox 지도 초기화 훅
 */
export default function useMapInit(
  mapContainerRef: RefObject<HTMLDivElement | null>
): UseMapInitReturn {
  const map = useRef<MapboxMap | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (map.current || !mapContainerRef.current) return;

    // Korea and surrounding airspace bounds
    // SW: [118, 30] to NE: [142, 46] covers Korea, Japan, parts of China
    const KOREA_BOUNDS: mapboxgl.LngLatBoundsLike = [[118, 30], [142, 46]];

    map.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES.dark as string,
      center: [127.5, 36.5], // Korea center
      zoom: 6, // Show all of Korea
      pitch: 0,
      bearing: 0,
      maxBounds: KOREA_BOUNDS,
      minZoom: 4,
      maxZoom: 18,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    map.current.on('load', () => {
      if (!map.current) return;

      // CRITICAL: 부분 실패에도 polling 이 시작되도록 setMapLoaded(true) 를 가장
      // 먼저 호출. 이후 addSource/addLayer 가 throw 해도 항공기 데이터는 들어옴.
      // (terrain-dem 등 일부 Mapbox source 는 계정 권한에 따라 차단될 수 있음)
      setMapLoaded(true);

      // Add terrain source (개별 try — 실패해도 calling chain 보호)
      try {
        map.current.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14
        });
        map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 2.5 });
      } catch (e) {
        logger.warn('Map', 'terrain-dem 추가 실패 (계속 진행)', { error: (e as Error)?.message });
      }

      // Add sky layer
      try {
        map.current.addLayer({
          id: 'sky',
          type: 'sky',
          paint: {
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [0.0, 90.0],
            'sky-atmosphere-sun-intensity': 15
          }
        });
      } catch (e) {
        logger.warn('Map', 'sky 레이어 추가 실패', { error: (e as Error)?.message });
      }

      // Add 3D buildings (composite source 가 다크 스타일에 없을 수도)
      try {
        map.current.addLayer({
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 10,
          paint: {
            'fill-extrusion-color': '#aaa',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.6
          }
        });
      } catch (e) {
        logger.warn('Map', '3d-buildings 레이어 추가 실패', { error: (e as Error)?.message });
      }

      // Add runway
      try {
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
        map.current.addLayer({
          id: 'runway',
          type: 'line',
          source: 'runway',
          paint: { 'line-color': '#FFFFFF', 'line-width': 8 }
        });
      } catch (e) {
        logger.warn('Map', 'runway 레이어 추가 실패', { error: (e as Error)?.message });
      }

      // Create custom triangle arrow image for trail arrowheads
      try {
        const arrowSize = 24;
        const arrowCanvas = document.createElement('canvas');
        arrowCanvas.width = arrowSize;
        arrowCanvas.height = arrowSize;
        const ctx = arrowCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = TRAIL_COLOR;
          ctx.beginPath();
          ctx.moveTo(arrowSize / 2, 0);
          ctx.lineTo(arrowSize, arrowSize);
          ctx.lineTo(arrowSize / 2, arrowSize * 0.7);
          ctx.lineTo(0, arrowSize);
          ctx.closePath();
          ctx.fill();
          map.current.addImage('trail-arrow', ctx.getImageData(0, 0, arrowSize, arrowSize), { sdf: true });
        }
      } catch (e) {
        logger.warn('Map', 'trail-arrow 이미지 추가 실패', { error: (e as Error)?.message });
      }

      // Context Menu 이벤트 설정 (캔버스에 직접 연결)
      try {
        const canvas = map.current.getCanvas();
        canvas.addEventListener('contextmenu', (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();

          const rect = canvas.getBoundingClientRect();
          const point = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          };

          // 화면 좌표를 지도 좌표로 변환
          const lngLat = map.current!.unproject([point.x, point.y]);

          // Custom event 발생
          const customEvent = new CustomEvent('map-contextmenu', {
            detail: {
              position: { x: e.clientX, y: e.clientY },
              coordinate: { lat: lngLat.lat, lon: lngLat.lng }
            }
          });
          window.dispatchEvent(customEvent);
          logger.debug('Map', 'Context menu event dispatched', { lat: lngLat.lat, lon: lngLat.lng });
        });
      } catch (e) {
        logger.warn('Map', 'context menu 등록 실패', { error: (e as Error)?.message });
      }
    });

    // Safety net: 어떤 이유로든 'load' 이벤트가 5초 안에 발생 안 하면
    // setMapLoaded(true) 를 강제 호출해 polling 만이라도 시작.
    // (구버전 Android WebView 에서 load 이벤트 누락 사례 대응)
    const loadTimeout = setTimeout(() => {
      logger.warn('Map', "5s 안에 'load' 이벤트 미발생 — setMapLoaded(true) 강제 호출");
      setMapLoaded(true);
    }, 5000);

    // load 이벤트 발생하면 timeout 취소
    map.current.on('load', () => clearTimeout(loadTimeout));

    // CRITICAL: container 가 0x0 으로 mount 됐다가 layout 후 resize 되는 케이스
    // (flex/grid layout + StrictMode + Tailwind 등에서 흔함). Mapbox 는
    // 초기 container 크기로 캔버스를 만들고 자동으로 resize 안 함 → 검은 화면.
    // 직접 resize() 를 여러 시점에 강제 호출 + ResizeObserver 로 후속 변경 추적.
    const forceResize = () => {
      if (map.current) {
        try { map.current.resize(); } catch { /* ignore */ }
      }
    };
    // 즉시 + 100ms + 500ms + 1s 시점에 resize (layout 완료 보장)
    forceResize();
    const resizeT1 = setTimeout(forceResize, 100);
    const resizeT2 = setTimeout(forceResize, 500);
    const resizeT3 = setTimeout(forceResize, 1000);

    // 이후 container 크기 변경 자동 추적
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(forceResize);
      resizeObserver.observe(mapContainerRef.current);
    }
    // window resize 도 한 번 더 안전망
    window.addEventListener('resize', forceResize);

    return () => {
      clearTimeout(loadTimeout);
      clearTimeout(resizeT1);
      clearTimeout(resizeT2);
      clearTimeout(resizeT3);
      window.removeEventListener('resize', forceResize);
      if (resizeObserver) resizeObserver.disconnect();
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapContainerRef]);

  return { map, mapLoaded, setMapLoaded };
}
