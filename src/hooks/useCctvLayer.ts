/**
 * useCctvLayer - 전국 CCTV 실시간 영상 표시
 * 데이터 소스:
 * 1. ITS 국가교통정보센터 (고속도로/국도 HTTPS HLS) - 전국
 * 2. data.go.kr 여수시 CCTV (HTTPS HLS) - 여수 지역
 */
import { useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import mapboxgl, { type Map as MapboxMap } from 'mapbox-gl';
import { logger } from '../utils/logger';

interface CctvCamera {
  id: string;
  name: string;
  lat: number;
  lng: number;
  url: string;
  source: string;
  type: 'hls' | 'link'; // hls: HLS 팝업 재생, link: 새 창 열기
}

const IS_PROD = import.meta.env.PROD;
const ITS_KEY = import.meta.env.VITE_ITS_API_KEY || '';
const DATA_GO_KR_KEY = import.meta.env.VITE_DATA_GO_KR_API_KEY || '';

// 외부 CCTV/웹캠 사이트 (클릭 시 새 창 열기)
const EXTERNAL_SITES: CctvCamera[] = [
  // 교통
  { id: 'ext-utic', name: '전국 교통 CCTV (UTIC)', lat: 37.5665, lng: 126.9780, url: 'http://www.utic.go.kr/map/map.do?menu=cctv', source: '경찰청', type: 'link' },
  { id: 'ext-its', name: 'ITS 국도/고속도로 CCTV', lat: 37.4800, lng: 127.0400, url: 'https://www.its.go.kr/map/cctv', source: 'ITS', type: 'link' },
  { id: 'ext-topis', name: '서울 교통 CCTV (TOPIS)', lat: 37.5519, lng: 126.9918, url: 'http://www.spatic.go.kr/mobile/map/cctv.do?menuId=57', source: '서울시', type: 'link' },
  // 해변/연안
  { id: 'ext-wsb', name: '전국 서핑 웹캠 (WSB)', lat: 35.1590, lng: 129.1601, url: 'https://www.wsbfarm.com/wavecam/WaveCamList', source: '서핑', type: 'link' },
  { id: 'ext-coast', name: '연안 실시간 (해수부)', lat: 35.1028, lng: 129.0403, url: 'https://coast.mof.go.kr/coastScene/coastMediaService.do', source: '해수부', type: 'link' },
  // 국립공원
  { id: 'ext-np', name: '국립공원 실시간', lat: 37.6593, lng: 126.9757, url: 'http://www.knps.or.kr/portal/main/contents.do?menuNo=8000168', source: '국립공원', type: 'link' },
  { id: 'ext-seorak', name: '설악산 권금성', lat: 38.1191, lng: 128.4654, url: 'http://www.knps.or.kr/common/cctv/cctv3.html', source: '국립공원', type: 'link' },
  { id: 'ext-deogyu', name: '덕유산 향적봉', lat: 35.8514, lng: 127.7464, url: 'http://www.knps.or.kr/common/cctv/cctv10.html', source: '국립공원', type: 'link' },
  // 제주
  { id: 'ext-jeju-tour', name: '제주 관광 CCTV', lat: 33.4584, lng: 126.9424, url: 'http://www.trendworld.kr/b/jeju_online_cctv', source: '제주', type: 'link' },
  { id: 'ext-jeju-its', name: '제주 교통정보', lat: 33.4996, lng: 126.5312, url: 'http://jejuits.go.kr/jido/mainView.do?DEVICE_KIND=CCTV', source: '제주', type: 'link' },
  { id: 'ext-jeju-now', name: 'Now 제주 (용두암 등)', lat: 33.5158, lng: 126.5118, url: 'http://www.nowjejuplus.com/cctv/1', source: '제주', type: 'link' },
  // 특수
  { id: 'ext-dokdo', name: '독도 실시간', lat: 37.2426, lng: 131.8697, url: 'http://www.ulleung.go.kr/live/index.do', source: '울릉군', type: 'link' },
  { id: 'ext-smg', name: '새만금 HD 웹캠', lat: 35.7900, lng: 126.6800, url: 'http://smgcctv.kr/cctv/', source: '새만금', type: 'link' },
  { id: 'ext-yongpyong', name: '용평리조트 웹캠', lat: 37.6443, lng: 128.6805, url: 'https://www.yongpyong.co.kr/kor/guide/realTimeNews/ypResortWebcam.do', source: '리조트', type: 'link' },
  // 시즌
  { id: 'ext-hadong', name: '하동 십리벚꽃길', lat: 35.0674, lng: 127.7514, url: 'http://flower.hadong.go.kr/', source: '하동군', type: 'link' },
  { id: 'ext-gyeongju', name: '경주 교통 CCTV', lat: 35.8562, lng: 129.2247, url: 'https://its.gyeongju.go.kr/cctvinfo.do', source: '경주시', type: 'link' },
];

/** ITS 전국 CCTV (고속도로 + 국도) */
async function fetchItsCctv(): Promise<CctvCamera[]> {
  const all: CctvCamera[] = [];
  for (const roadType of ['its', 'ex']) {
    try {
      // ITS API는 koreasurveillance.com CORS 허용 → 직접 호출 (Vercel 서버리스에서 포트 9443 타임아웃 문제)
      const url = `https://openapi.its.go.kr:9443/cctvInfo?apiKey=${ITS_KEY}&type=${roadType}&cctvType=4&minX=125&maxX=132&minY=33&maxY=39&getType=json`;
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const data = await resp.json();
      const items = data?.response?.data || [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.cctvurl || !item.coordy) continue;
        all.push({
          id: `its-${roadType}-${i}`,
          name: item.cctvname || '교통 CCTV',
          lat: parseFloat(item.coordy),
          lng: parseFloat(item.coordx),
          url: item.cctvurl,
          source: roadType === 'ex' ? '고속도로' : '국도',
          type: 'hls',
        });
      }
    } catch { /* skip */ }
  }
  return all;
}

/** 여수시 CCTV */
async function fetchYeosuCctv(): Promise<CctvCamera[]> {
  try {
    const url = IS_PROD
      ? '/api/cctv?source=yeosu'
      : `https://apis.data.go.kr/4810000/YsRoadCctv/CCTVInfo?serviceKey=${encodeURIComponent(DATA_GO_KR_KEY)}&pageNo=1&numOfRows=100&type=json`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    const items = data?.response?.body?.items || [];
    return (Array.isArray(items) ? items : []).map((item: Record<string, string>, i: number) => ({
      id: `yeosu-${i}`,
      name: item.istl_lctn_nm || `여수 CCTV ${i + 1}`,
      lat: parseFloat(item.y_crdn || '0'),
      lng: parseFloat(item.x_crdn || '0'),
      url: item.strm_http_addr || '',
      source: '여수시',
      type: 'hls' as const,
    })).filter((c: CctvCamera) => c.url && !isNaN(c.lat) && c.lat !== 0);
  } catch (err) {
    logger.error('CCTV', `Yeosu error: ${err}`);
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
  const layersAddedRef = useRef(false);

  const updateMapSource = useCallback(() => {
    const m = map.current;
    if (!m) return;
    const features = cctvDataRef.current.map(cam => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [cam.lng, cam.lat] },
      properties: { name: cam.name, url: cam.url, source: cam.source, type: cam.type },
    }));
    try {
      const src = m.getSource('cctv-cameras') as mapboxgl.GeoJSONSource;
      if (src) {
        src.setData({ type: 'FeatureCollection', features: features as GeoJSON.Feature[] });
        logger.info('CCTV', `Updated ${features.length} cameras`);
      }
    } catch { /* ignore */ }
  }, [map]);

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
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 1.5, 10, 4, 15, 7],
              'circle-color': ['match', ['get', 'type'], 'link', '#03A9F4', '#FFD700'],
              'circle-stroke-color': '#fff',
              'circle-stroke-width': 0.5,
            },
          });
        }
        if (!m.getLayer('cctv-labels')) {
          m.addLayer({
            id: 'cctv-labels', type: 'symbol', source: 'cctv-cameras', minzoom: 12,
            layout: { 'text-field': ['get', 'name'], 'text-size': 9, 'text-offset': [0, 1.5], 'text-anchor': 'top', visibility: 'none' },
            paint: { 'text-color': '#FFD700', 'text-halo-color': '#000', 'text-halo-width': 1 },
          });
        }

        // 클릭 → HLS 팝업 또는 새 창 열기
        m.on('click', 'cctv-dots', (e) => {
          if (!e.features?.length) return;
          const props = e.features[0].properties;
          if (!props?.url) return;
          const coords = (e.features[0].geometry as GeoJSON.Point).coordinates;

          // 외부 링크 → 새 창으로 열기
          if (props.type === 'link') {
            window.open(props.url, '_blank', 'noopener,noreferrer');
            return;
          }

          // HLS → 팝업 영상 재생
          if (popupRef.current) popupRef.current.remove();

          const content = `<div style="width:360px;background:#000;border-radius:8px;overflow:hidden;">
            <div style="padding:8px 12px;background:#1a1a2e;color:#FFD700;font-weight:bold;font-size:13px;">📹 ${props.name}</div>
            <video id="cctv-player" style="width:100%;height:200px;background:#000;" autoplay muted playsinline></video>
            <div style="padding:4px 12px;color:#666;font-size:10px;">${props.source} CCTV · ITS 국가교통정보센터</div>
          </div>`;

          const p = new mapboxgl.Popup({ closeOnClick: true, maxWidth: '400px' })
            .setLngLat(coords as [number, number]).setHTML(content).addTo(m);
          popupRef.current = p;

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
            } catch (err) { logger.error('CCTV', `HLS error: ${err}`); }
          }, 200);
        });

        m.on('mouseenter', 'cctv-dots', () => { m.getCanvas().style.cursor = 'pointer'; });
        m.on('mouseleave', 'cctv-dots', () => { m.getCanvas().style.cursor = ''; });
        layersAddedRef.current = true;
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
      if (m.isStyleLoaded()) ensureLayers();
      else await new Promise<void>(r => m.once('style.load', () => { ensureLayers(); r(); }));

      if (!showCctv) { setVis(false); return; }
      if (!loadedRef.current) {
        logger.info('CCTV', 'Loading ITS + Yeosu CCTV...');
        const [itsCams, yeosuCams] = await Promise.all([fetchItsCctv(), fetchYeosuCctv()]);
        cctvDataRef.current = [...EXTERNAL_SITES, ...itsCams, ...yeosuCams];
        loadedRef.current = true;
        logger.info('CCTV', `Total: ${cctvDataRef.current.length} (External: ${EXTERNAL_SITES.length}, ITS: ${itsCams.length}, Yeosu: ${yeosuCams.length})`);
      }
      updateMapSource();
      setVis(true);
    };

    run();
  }, [map, mapLoaded, showCctv, updateMapSource]);
}
