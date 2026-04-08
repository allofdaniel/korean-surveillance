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

const IS_PROD = import.meta.env.PROD;
const VWORLD_KEY = import.meta.env.VITE_VWORLD_API_KEY || '';
const DATA_GO_KR_KEY = import.meta.env.VITE_DATA_GO_KR_API_KEY || '';

// 고정 CCTV 소스 (2026-04-08 HTTPS + iframe 확인)
const FIXED_CCTV: CctvCamera[] = [
  // === 종합/교통 ===
  { id: 'utic', name: '전국 교통 CCTV (UTIC)', lat: 37.5665, lng: 126.9780, type: 'iframe', url: 'https://www.utic.go.kr/map/map.do?menu=cctv', category: 'traffic' },
  { id: 'seoul-topis', name: '서울 교통 CCTV (TOPIS)', lat: 37.5519, lng: 126.9918, type: 'iframe', url: 'https://www.spatic.go.kr/mobile/map/cctv.do?menuId=57', category: 'traffic' },
  { id: 'gj-traffic', name: '경주 교통 CCTV', lat: 35.8562, lng: 129.2247, type: 'iframe', url: 'https://its.gyeongju.go.kr/cctvinfo.do', category: 'traffic' },
  { id: 'jeju-traffic', name: '제주 교통 CCTV', lat: 33.4996, lng: 126.5312, type: 'iframe', url: 'https://jejuits.go.kr/jido/mainView.do?DEVICE_KIND=CCTV', category: 'traffic' },
  // === 해변/연안 ===
  { id: 'coast-portal', name: '연안 실시간 (해수부)', lat: 35.1028, lng: 129.0403, type: 'iframe', url: 'https://coast.mof.go.kr/coastScene/coastMediaService.do', category: 'coastal' },
  { id: 'wsb-surf', name: '전국 서핑 웹캠 (WSB)', lat: 35.1590, lng: 129.1601, type: 'iframe', url: 'https://www.wsbfarm.com/wavecam/WaveCamList', category: 'coastal' },
  // === 산/국립공원 ===
  { id: 'np-seorak', name: '설악산 실시간', lat: 38.1191, lng: 128.4654, type: 'iframe', url: 'https://www.knps.or.kr/common/cctv/cctv3.html', category: 'park' },
  { id: 'np-deogyu', name: '덕유산 실시간', lat: 35.8514, lng: 127.7464, type: 'iframe', url: 'https://www.knps.or.kr/common/cctv/cctv10.html', category: 'park' },
  // === 제주도 ===
  { id: 'jeju-tour', name: '제주 관광 CCTV', lat: 33.4584, lng: 126.9424, type: 'iframe', url: 'https://www.trendworld.kr/b/jeju_online_cctv', category: 'landmark' },
  // === 특수 ===
  { id: 'dokdo', name: '독도 실시간 (울릉군)', lat: 37.2426, lng: 131.8697, type: 'iframe', url: 'https://www.ulleung.go.kr/live/index.do', category: 'landmark' },
];

/** V-World 2D데이터 API로 전국 교통 CCTV 위치 조회 (프록시 경유) */
async function fetchVworldCctv(): Promise<CctvCamera[]> {
  const results: CctvCamera[] = [];
  try {
    const regions = [
      { minX: 125, maxX: 129, minY: 33, maxY: 36 },
      { minX: 129, maxX: 132, minY: 33, maxY: 36 },
      { minX: 125, maxX: 129, minY: 36, maxY: 39 },
      { minX: 129, maxX: 132, minY: 36, maxY: 39 },
    ];
    for (const r of regions) {
      let url: string;
      if (IS_PROD) {
        // Production: Vercel serverless proxy (CORS 우회)
        url = `/api/cctv?source=vworld&minX=${r.minX}&maxX=${r.maxX}&minY=${r.minY}&maxY=${r.maxY}`;
      } else {
        // Dev: 직접 호출 (CORS 무시 가능한 프록시 설정)
        if (!VWORLD_KEY) continue;
        url = `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=LT_P_UTISCCTV&key=${VWORLD_KEY}&geomFilter=BOX(${r.minX},${r.minY},${r.maxX},${r.maxY})&size=1000&format=json&crs=EPSG:4326&domain=localhost`;
      }
      try {
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const data = await resp.json();
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
      } catch { /* skip region */ }
    }
    logger.info('CCTV', `V-World: ${results.length} cameras loaded`);
  } catch (err) {
    logger.error('CCTV', `V-World CCTV error: ${err}`);
  }
  return results;
}

/** data.go.kr - 여수시 실시간 CCTV */
async function fetchYeosuCctv(): Promise<CctvCamera[]> {
  try {
    const url = IS_PROD
      ? '/api/cctv?source=yeosu'
      : `https://apis.data.go.kr/4810000/YsRoadCctv/CCTVInfo?serviceKey=${encodeURIComponent(DATA_GO_KR_KEY)}&pageNo=1&numOfRows=100&type=json`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    const items = data?.response?.body?.items || data?.items || [];
    return (Array.isArray(items) ? items : []).map((item: Record<string, string>, i: number) => ({
      id: `yeosu-${i}`,
      name: item.istl_lctn_nm || item.cctvName || `여수 CCTV ${i + 1}`,
      lat: parseFloat(item.y_crdn || item.latitude || '0'),
      lng: parseFloat(item.x_crdn || item.longitude || '0'),
      type: (item.strm_http_addr || item.cctvUrl || '').includes('m3u8') ? 'hls' as const : 'info' as const,
      url: item.strm_http_addr || item.cctvUrl || '',
      category: 'traffic' as const,
    })).filter((c: CctvCamera) => !isNaN(c.lat) && !isNaN(c.lng) && c.lat !== 0);
  } catch (err) {
    logger.error('CCTV', `Yeosu API error: ${err}`);
    return [];
  }
}

/** data.go.kr - 남해군 CCTV */
async function fetchNamhaeCctv(): Promise<CctvCamera[]> {
  try {
    const url = IS_PROD
      ? '/api/cctv?source=namhae'
      : `https://apis.data.go.kr/5430000/nh_cctv/get_cctv_list?serviceKey=${encodeURIComponent(DATA_GO_KR_KEY)}&pageNo=1&numOfRows=100&type=json`;
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
    if (!mapInstance) return;

    const features = cctvDataRef.current.map(cam => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [cam.lng, cam.lat] },
      properties: { id: cam.id, name: cam.name, type: cam.type, url: cam.url, category: cam.category },
    }));

    try {
      const source = mapInstance.getSource('cctv-cameras');
      if (source && 'setData' in source) {
        (source as mapboxgl.GeoJSONSource).setData({
          type: 'FeatureCollection',
          features: features as GeoJSON.Feature[],
        });
        logger.info('CCTV', `Updated map source with ${features.length} features`);
      } else {
        logger.error('CCTV', 'Source cctv-cameras not found on map');
      }
    } catch (err) {
      logger.error('CCTV', `updateMapSource error: ${err}`);
    }
  }, [map]);

  const layersAddedRef = useRef(false);

  // 통합 effect: 레이어 생성 + 데이터 로드 + 표시
  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded) return;

    const ensureLayers = () => {
      if (layersAddedRef.current) return;
      try {
        if (!m.getSource('cctv-cameras')) {
          m.addSource('cctv-cameras', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        }
        if (!m.getLayer('cctv-dots')) {
          m.addLayer({
            id: 'cctv-dots', type: 'circle', source: 'cctv-cameras',
            layout: { visibility: 'none' },
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 2, 10, 5, 15, 8],
              'circle-color': ['match', ['get', 'category'], 'traffic', '#FFD700', 'park', '#4CAF50', 'landmark', '#FF5722', 'coastal', '#03A9F4', '#FFD700'],
              'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1,
            },
          });
        }
        if (!m.getLayer('cctv-labels')) {
          m.addLayer({
            id: 'cctv-labels', type: 'symbol', source: 'cctv-cameras', minzoom: 10,
            layout: { 'text-field': ['get', 'name'], 'text-size': 10, 'text-offset': [0, 1.5], 'text-anchor': 'top', visibility: 'none' },
            paint: { 'text-color': '#FFD700', 'text-halo-color': '#000000', 'text-halo-width': 1 },
          });
        }
        // 클릭 이벤트
        m.on('click', 'cctv-dots', (e) => {
          if (!e.features?.length) return;
          const props = e.features[0].properties;
          if (!props) return;
          const coords = (e.features[0].geometry as GeoJSON.Point).coordinates;
          if (popupRef.current) popupRef.current.remove();

          let content = '';
          if (props.type === 'hls' && props.url) {
            content = `<div style="width:320px;background:#000;border-radius:8px;overflow:hidden;"><div style="padding:8px 12px;background:#1a1a2e;color:#FFD700;font-weight:bold;font-size:13px;">📹 ${props.name}</div><video id="cctv-player" style="width:100%;height:180px;background:#000;" autoplay muted playsinline></video><div style="padding:4px 12px;color:#888;font-size:10px;">${props.category === 'traffic' ? '교통 CCTV' : props.category}</div></div>`;
          } else if (props.type === 'iframe' && props.url) {
            content = `<div style="width:480px;background:#000;border-radius:8px;overflow:hidden;"><div style="padding:8px 12px;background:#1a1a2e;color:#FFD700;font-weight:bold;font-size:13px;">📹 ${props.name}</div><iframe src="${props.url}" style="width:100%;height:360px;border:none;" allowfullscreen sandbox="allow-scripts allow-same-origin allow-popups"></iframe></div>`;
          } else {
            content = `<div style="width:260px;background:#1a1a2e;border-radius:8px;overflow:hidden;padding:12px;"><div style="color:#FFD700;font-weight:bold;font-size:13px;">📍 ${props.name}</div><div style="color:#aaa;font-size:11px;margin-top:4px;">${props.category === 'traffic' ? '교통 CCTV (위치 정보)' : props.category}</div><div style="color:#666;font-size:10px;margin-top:4px;">좌표: ${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}</div></div>`;
          }

          const p = new mapboxgl.Popup({ closeOnClick: true, maxWidth: '520px', className: 'cctv-popup' })
            .setLngLat(coords as [number, number]).setHTML(content).addTo(m);
          popupRef.current = p;

          if (props.type === 'hls' && props.url) {
            setTimeout(async () => {
              const video = document.getElementById('cctv-player') as HTMLVideoElement;
              if (!video) return;
              try {
                const { default: Hls } = await import('hls.js');
                if (Hls.isSupported()) { const hls = new Hls(); hls.loadSource(props.url); hls.attachMedia(video); }
                else if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = props.url; }
              } catch (err) { logger.error('CCTV', `HLS error: ${err}`); }
            }, 200);
          }
        });
        m.on('mouseenter', 'cctv-dots', () => { m.getCanvas().style.cursor = 'pointer'; });
        m.on('mouseleave', 'cctv-dots', () => { m.getCanvas().style.cursor = ''; });
        layersAddedRef.current = true;
        logger.info('CCTV', 'Layers added to map');
      } catch (err) { logger.error('CCTV', `Layer error: ${err}`); }
    };

    const setVis = (v: boolean) => {
      try {
        const vis = v ? 'visible' : 'none';
        if (m.getLayer('cctv-dots')) m.setLayoutProperty('cctv-dots', 'visibility', vis);
        if (m.getLayer('cctv-labels')) m.setLayoutProperty('cctv-labels', 'visibility', vis);
      } catch { /* ignore */ }
    };

    const run = async () => {
      if (m.isStyleLoaded()) { ensureLayers(); } else { await new Promise<void>(r => m.once('style.load', () => { ensureLayers(); r(); })); }
      if (!showCctv) { setVis(false); return; }
      if (!loadedRef.current) await loadCctvData();
      updateMapSource();
      setVis(true);
    };

    run();
  }, [map, mapLoaded, showCctv, loadCctvData, updateMapSource]);
}
