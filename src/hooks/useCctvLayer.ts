/**
 * useCctvLayer - CCTV 카메라를 맵에 표시하고 클릭 시 영상 팝업
 * - ITS Open API (교통 CCTV - HLS)
 * - 고정 CCTV (독도, 국립공원, 제주 관광 등)
 */
import { useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { logger } from '../utils/logger';

// 고정 CCTV 소스 (API 없이 직접 URL)
const FIXED_CCTV_SOURCES: CctvCamera[] = [
  // 독도 라이브
  { id: 'dokdo-1', name: '독도 라이브', lat: 37.2426, lng: 131.8697, type: 'hls', url: 'http://www.ulleung.go.kr/wowza/live/nsj.stream/playlist.m3u8', category: 'landmark' },
  // 국립공원 (설악산, 지리산 등)
  { id: 'np-seorak', name: '설악산 권금성', lat: 38.1191, lng: 128.4654, type: 'hls', url: 'http://119.65.216.155:1935/live/cctv3.stream_360p/playlist.m3u8', category: 'park' },
  { id: 'np-deogyu', name: '덕유산 향적봉', lat: 35.8514, lng: 127.7464, type: 'hls', url: 'http://119.65.216.155:1935/live/cctv10.stream_360p/playlist.m3u8', category: 'park' },
  // Now 제주 관광 CCTV
  { id: 'jeju-hallasan', name: '한라산 어리목', lat: 33.3617, lng: 126.4967, type: 'hls', url: 'http://119.65.216.155:1935/live/cctv15.stream_360p/playlist.m3u8', category: 'landmark' },
  { id: 'jeju-seongsan', name: '성산일출봉', lat: 33.4584, lng: 126.9424, type: 'iframe', url: 'http://www.nowjejuplus.com/cctv/2', category: 'landmark' },
  { id: 'jeju-yongduam', name: '용두암', lat: 33.5158, lng: 126.5118, type: 'iframe', url: 'http://www.nowjejuplus.com/cctv/1', category: 'landmark' },
];

interface CctvCamera {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'hls' | 'iframe' | 'image';
  url: string;
  category: 'traffic' | 'park' | 'landmark' | 'coastal';
}

const ITS_API_KEY = '7975323471'; // ITS 공공 CCTV 테스트키

async function fetchItsCctv(bounds: { minX: number; maxX: number; minY: number; maxY: number }): Promise<CctvCamera[]> {
  try {
    const url = `https://openapi.its.go.kr:9443/cctvInfo?apiKey=${ITS_API_KEY}&type=its&cctvType=1&minX=${bounds.minX}&maxX=${bounds.maxX}&minY=${bounds.minY}&maxY=${bounds.maxY}&getType=json`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    if (!data?.response?.data) return [];
    return data.response.data.map((item: { cctvname: string; coordx: string; coordy: string; cctvurl: string }, i: number) => ({
      id: `its-${i}`,
      name: item.cctvname || '교통 CCTV',
      lat: parseFloat(item.coordy),
      lng: parseFloat(item.coordx),
      type: 'hls' as const,
      url: item.cctvurl || '',
      category: 'traffic' as const,
    })).filter((c: CctvCamera) => c.url && !isNaN(c.lat) && !isNaN(c.lng));
  } catch (err) {
    logger.error('CCTV', `ITS API error: ${err}`);
    return [];
  }
}

export default function useCctvLayer(
  map: MutableRefObject<MapboxMap | null>,
  mapLoaded: boolean,
  showCctv: boolean
) {
  const cctvDataRef = useRef<CctvCamera[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const loadedRef = useRef(false);

  const loadCctvData = useCallback(async () => {
    if (loadedRef.current) return;
    // 한반도 전체 범위
    const itsCameras = await fetchItsCctv({ minX: 125, maxX: 132, minY: 33, maxY: 39 });
    cctvDataRef.current = [...FIXED_CCTV_SOURCES, ...itsCameras];
    loadedRef.current = true;
    logger.info('CCTV', `Loaded ${cctvDataRef.current.length} cameras (ITS: ${itsCameras.length}, Fixed: ${FIXED_CCTV_SOURCES.length})`);
  }, []);

  const updateMapSource = useCallback(() => {
    const mapInstance = map.current;
    if (!mapInstance || !mapInstance.isStyleLoaded()) return;

    const features = cctvDataRef.current.map(cam => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [cam.lng, cam.lat] },
      properties: { id: cam.id, name: cam.name, type: cam.type, url: cam.url, category: cam.category },
    }));

    const source = mapInstance.getSource('cctv-cameras');
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

      if (!mapInstance.getSource('cctv-cameras')) {
        mapInstance.addSource('cctv-cameras', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
      }

      if (!mapInstance.getLayer('cctv-dots')) {
        mapInstance.addLayer({
          id: 'cctv-dots',
          type: 'circle',
          source: 'cctv-cameras',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 2, 10, 5, 15, 8],
            'circle-color': [
              'match', ['get', 'category'],
              'traffic', '#FFD700',
              'park', '#4CAF50',
              'landmark', '#FF5722',
              'coastal', '#03A9F4',
              '#FFD700'
            ],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1,
            'circle-opacity': 0,
          },
        });
      }

      if (!mapInstance.getLayer('cctv-labels')) {
        mapInstance.addLayer({
          id: 'cctv-labels',
          type: 'symbol',
          source: 'cctv-cameras',
          minzoom: 10,
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 10,
            'text-offset': [0, 1.5],
            'text-anchor': 'top',
          },
          paint: {
            'text-color': '#FFD700',
            'text-halo-color': '#000000',
            'text-halo-width': 1,
            'text-opacity': 0,
          },
        });
      }

      // 클릭 이벤트 - CCTV 팝업
      mapInstance.on('click', 'cctv-dots', (e) => {
        if (!e.features || e.features.length === 0) return;
        const props = e.features[0].properties;
        if (!props) return;
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates;

        // 기존 팝업 제거
        if (popupRef.current) popupRef.current.remove();

        let content = '';
        if (props.type === 'hls') {
          content = `
            <div style="width:320px;background:#000;border-radius:8px;overflow:hidden;">
              <div style="padding:8px 12px;background:#1a1a2e;color:#FFD700;font-weight:bold;font-size:13px;">${props.name}</div>
              <video id="cctv-player" style="width:100%;height:180px;background:#000;" autoplay muted playsinline></video>
              <div style="padding:4px 12px;color:#888;font-size:10px;">${props.category === 'traffic' ? 'ITS 교통 CCTV' : props.category}</div>
            </div>
          `;
        } else if (props.type === 'iframe') {
          content = `
            <div style="width:320px;background:#000;border-radius:8px;overflow:hidden;">
              <div style="padding:8px 12px;background:#1a1a2e;color:#FFD700;font-weight:bold;font-size:13px;">${props.name}</div>
              <iframe src="${props.url}" style="width:100%;height:200px;border:none;" allowfullscreen></iframe>
            </div>
          `;
        } else {
          content = `
            <div style="width:320px;background:#000;border-radius:8px;overflow:hidden;">
              <div style="padding:8px 12px;background:#1a1a2e;color:#FFD700;font-weight:bold;font-size:13px;">${props.name}</div>
              <img src="${props.url}" style="width:100%;height:180px;object-fit:cover;" />
            </div>
          `;
        }

        const popup = new (mapInstance as any).constructor.Popup
          ? null
          : null;

        // mapboxgl Popup 직접 사용
        import('mapbox-gl').then(({ Popup }) => {
          const p = new Popup({ closeOnClick: true, maxWidth: '350px', className: 'cctv-popup' })
            .setLngLat(coords as [number, number])
            .setHTML(content)
            .addTo(mapInstance);

          popupRef.current = p;

          // HLS 플레이어 초기화
          if (props.type === 'hls') {
            setTimeout(() => {
              const video = document.getElementById('cctv-player') as HTMLVideoElement;
              if (!video) return;
              import('hls.js').then(({ default: Hls }) => {
                if (Hls.isSupported()) {
                  const hls = new Hls();
                  hls.loadSource(props.url);
                  hls.attachMedia(video);
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                  video.src = props.url;
                }
              });
            }, 100);
          }
        });
      });

      // 커서 변경
      mapInstance.on('mouseenter', 'cctv-dots', () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      });
      mapInstance.on('mouseleave', 'cctv-dots', () => {
        mapInstance.getCanvas().style.cursor = '';
      });
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

    const opacity = showCctv ? 1 : 0;

    if (mapInstance.getLayer('cctv-dots')) {
      mapInstance.setPaintProperty('cctv-dots', 'circle-opacity', opacity);
      mapInstance.setPaintProperty('cctv-dots', 'circle-stroke-opacity', opacity);
    }
    if (mapInstance.getLayer('cctv-labels')) {
      mapInstance.setPaintProperty('cctv-labels', 'text-opacity', opacity);
    }

    if (showCctv && !loadedRef.current) {
      loadCctvData().then(updateMapSource);
    }
  }, [map, mapLoaded, showCctv, loadCctvData, updateMapSource]);
}
