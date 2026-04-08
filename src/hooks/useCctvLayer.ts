/**
 * useCctvLayer - CCTV 카메라를 맵에 표시하고 클릭 시 영상 팝업
 * 데이터 소스:
 * 1. V-World 2D데이터 API (LT_P_UTISCCTV) - 전국 교통 CCTV 위치
 * 2. data.go.kr - 여수시/남해군 CCTV (영상 URL 포함)
 * 3. 고정 CCTV (독도, 국립공원, 제주 관광)
 */
import { useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import mapboxgl, { type Map as MapboxMap } from 'mapbox-gl';
import { logger } from '../utils/logger';

interface CctvCamera {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'hls' | 'iframe' | 'image' | 'info';
  url: string;
  category: 'traffic' | 'park' | 'landmark' | 'coastal';
}

const VWORLD_KEY = import.meta.env.VITE_VWORLD_API_KEY || '';
const DATA_GO_KR_KEY = import.meta.env.VITE_DATA_GO_KR_API_KEY || '';

// 고정 CCTV 소스 (API 없이 직접 URL)
const FIXED_CCTV: CctvCamera[] = [
  { id: 'dokdo-1', name: '독도 라이브', lat: 37.2426, lng: 131.8697, type: 'hls', url: 'http://www.ulleung.go.kr/wowza/live/nsj.stream/playlist.m3u8', category: 'landmark' },
  { id: 'np-seorak', name: '설악산 권금성', lat: 38.1191, lng: 128.4654, type: 'hls', url: 'http://119.65.216.155:1935/live/cctv3.stream_360p/playlist.m3u8', category: 'park' },
  { id: 'np-deogyu', name: '덕유산 향적봉', lat: 35.8514, lng: 127.7464, type: 'hls', url: 'http://119.65.216.155:1935/live/cctv10.stream_360p/playlist.m3u8', category: 'park' },
  { id: 'np-jiri', name: '지리산 천왕봉', lat: 35.3371, lng: 127.7306, type: 'hls', url: 'http://119.65.216.155:1935/live/cctv1.stream_360p/playlist.m3u8', category: 'park' },
  { id: 'np-halla', name: '한라산 어리목', lat: 33.3617, lng: 126.4967, type: 'hls', url: 'http://119.65.216.155:1935/live/cctv15.stream_360p/playlist.m3u8', category: 'park' },
  { id: 'np-bukhan', name: '북한산 백운대', lat: 37.6593, lng: 126.9757, type: 'hls', url: 'http://119.65.216.155:1935/live/cctv5.stream_360p/playlist.m3u8', category: 'park' },
  { id: 'np-gyeryong', name: '계룡산', lat: 36.3444, lng: 127.2101, type: 'hls', url: 'http://119.65.216.155:1935/live/cctv7.stream_360p/playlist.m3u8', category: 'park' },
  { id: 'jeju-seongsan', name: '성산일출봉', lat: 33.4584, lng: 126.9424, type: 'iframe', url: 'http://www.nowjejuplus.com/cctv/2', category: 'landmark' },
  { id: 'jeju-yongduam', name: '용두암', lat: 33.5158, lng: 126.5118, type: 'iframe', url: 'http://www.nowjejuplus.com/cctv/1', category: 'landmark' },
];

/** V-World 2D데이터 API로 전국 교통 CCTV 위치 조회 */
async function fetchVworldCctv(): Promise<CctvCamera[]> {
  if (!VWORLD_KEY) return [];
  const results: CctvCamera[] = [];
  try {
    // 한반도를 4개 영역으로 분할하여 요청 (size=1000 제한 대응)
    const boxes = [
      'BOX(125,33,129,36)', // 남서
      'BOX(129,33,132,36)', // 남동
      'BOX(125,36,129,39)', // 북서
      'BOX(129,36,132,39)', // 북동
    ];
    for (const box of boxes) {
      const url = `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=LT_P_UTISCCTV&key=${VWORLD_KEY}&geomFilter=${box}&size=1000&format=json&crs=EPSG:4326&domain=koreasurveillance.com`;
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data.response?.status !== 'OK') continue;
      const features = data.response?.result?.featureCollection?.features || [];
      for (const feat of features) {
        const coords = feat.geometry?.coordinates;
        const props = feat.properties || {};
        if (!coords || coords.length < 2) continue;
        results.push({
          id: `vw-${results.length}`,
          name: props.cctvname || props.locate || '교통 CCTV',
          lat: coords[1],
          lng: coords[0],
          type: 'info',
          url: '',
          category: 'traffic',
        });
      }
    }
    logger.info('CCTV', `V-World: ${results.length} cameras loaded`);
  } catch (err) {
    logger.error('CCTV', `V-World CCTV error: ${err}`);
  }
  return results;
}

/** data.go.kr - 여수시 실시간 CCTV */
async function fetchYeosuCctv(): Promise<CctvCamera[]> {
  if (!DATA_GO_KR_KEY) return [];
  try {
    const url = `https://apis.data.go.kr/4810000/YsRoadCctv/CCTVInfo?serviceKey=${encodeURIComponent(DATA_GO_KR_KEY)}&pageNo=1&numOfRows=100&type=json`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    const items = data?.response?.body?.items || data?.items || [];
    return items.map((item: Record<string, string>, i: number) => ({
      id: `yeosu-${i}`,
      name: item.cctvName || item.cctvNm || `여수 CCTV ${i + 1}`,
      lat: parseFloat(item.latitude || item.lat || '0'),
      lng: parseFloat(item.longitude || item.lng || '0'),
      type: (item.cctvUrl || item.url || '').includes('m3u8') ? 'hls' as const : 'info' as const,
      url: item.cctvUrl || item.url || '',
      category: 'traffic' as const,
    })).filter((c: CctvCamera) => !isNaN(c.lat) && !isNaN(c.lng) && c.lat !== 0);
  } catch (err) {
    logger.error('CCTV', `Yeosu API error: ${err}`);
    return [];
  }
}

/** data.go.kr - 남해군 CCTV */
async function fetchNamhaeCctv(): Promise<CctvCamera[]> {
  if (!DATA_GO_KR_KEY) return [];
  try {
    const url = `https://apis.data.go.kr/5430000/nh_cctv/get_cctv_list?serviceKey=${encodeURIComponent(DATA_GO_KR_KEY)}&pageNo=1&numOfRows=100&type=json`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    const items = data?.response?.body?.items?.item || data?.items || [];
    return (Array.isArray(items) ? items : [items]).map((item: Record<string, string>, i: number) => ({
      id: `namhae-${i}`,
      name: item.cctvNm || item.instlLcDesc || `남해 CCTV ${i + 1}`,
      lat: parseFloat(item.lat || item.latitude || '0'),
      lng: parseFloat(item.lot || item.longitude || '0'),
      type: (item.strmUrl || item.cctvUrl || '').includes('m3u8') ? 'hls' as const : 'info' as const,
      url: item.strmUrl || item.cctvUrl || '',
      category: 'traffic' as const,
    })).filter((c: CctvCamera) => !isNaN(c.lat) && !isNaN(c.lng) && c.lat !== 0);
  } catch (err) {
    logger.error('CCTV', `Namhae API error: ${err}`);
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
    logger.info('CCTV', 'Loading CCTV data from all sources...');

    // 모든 소스를 병렬로 fetch
    const [vworldCams, yeosuCams, namhaeCams] = await Promise.all([
      fetchVworldCctv(),
      fetchYeosuCctv(),
      fetchNamhaeCctv(),
    ]);

    cctvDataRef.current = [...FIXED_CCTV, ...vworldCams, ...yeosuCams, ...namhaeCams];
    loadedRef.current = true;
    logger.info('CCTV', `Total: ${cctvDataRef.current.length} cameras (V-World: ${vworldCams.length}, Yeosu: ${yeosuCams.length}, Namhae: ${namhaeCams.length}, Fixed: ${FIXED_CCTV.length})`);
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

        if (popupRef.current) popupRef.current.remove();

        let content = '';
        if (props.type === 'hls' && props.url) {
          content = `
            <div style="width:320px;background:#000;border-radius:8px;overflow:hidden;">
              <div style="padding:8px 12px;background:#1a1a2e;color:#FFD700;font-weight:bold;font-size:13px;">📹 ${props.name}</div>
              <video id="cctv-player" style="width:100%;height:180px;background:#000;" autoplay muted playsinline></video>
              <div style="padding:4px 12px;color:#888;font-size:10px;">${props.category === 'traffic' ? '교통 CCTV' : props.category}</div>
            </div>`;
        } else if (props.type === 'iframe' && props.url) {
          content = `
            <div style="width:320px;background:#000;border-radius:8px;overflow:hidden;">
              <div style="padding:8px 12px;background:#1a1a2e;color:#FFD700;font-weight:bold;font-size:13px;">📹 ${props.name}</div>
              <iframe src="${props.url}" style="width:100%;height:200px;border:none;" allowfullscreen></iframe>
            </div>`;
        } else {
          // info 타입 (위치만 있고 영상 URL 없음)
          content = `
            <div style="width:260px;background:#1a1a2e;border-radius:8px;overflow:hidden;padding:12px;">
              <div style="color:#FFD700;font-weight:bold;font-size:13px;">📍 ${props.name}</div>
              <div style="color:#aaa;font-size:11px;margin-top:4px;">${props.category === 'traffic' ? '교통 CCTV (위치 정보)' : props.category}</div>
              <div style="color:#666;font-size:10px;margin-top:4px;">좌표: ${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}</div>
            </div>`;
        }

        const p = new mapboxgl.Popup({ closeOnClick: true, maxWidth: '350px', className: 'cctv-popup' })
          .setLngLat(coords as [number, number])
          .setHTML(content)
          .addTo(mapInstance);
        popupRef.current = p;

        if (props.type === 'hls' && props.url) {
          setTimeout(async () => {
            const video = document.getElementById('cctv-player') as HTMLVideoElement;
            if (!video) return;
            try {
              const { default: Hls } = await import('hls.js');
              if (Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(props.url);
                hls.attachMedia(video);
              } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = props.url;
              }
            } catch (err) {
              logger.error('CCTV', `HLS init error: ${err}`);
            }
          }, 200);
        }
      });

      mapInstance.on('mouseenter', 'cctv-dots', () => { mapInstance.getCanvas().style.cursor = 'pointer'; });
      mapInstance.on('mouseleave', 'cctv-dots', () => { mapInstance.getCanvas().style.cursor = ''; });
    };

    if (mapInstance.isStyleLoaded()) addLayers();
    else mapInstance.once('style.load', addLayers);
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
