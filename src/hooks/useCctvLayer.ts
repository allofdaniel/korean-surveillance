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
}

const IS_PROD = import.meta.env.PROD;
const ITS_KEY = import.meta.env.VITE_ITS_API_KEY || '';
const DATA_GO_KR_KEY = import.meta.env.VITE_DATA_GO_KR_API_KEY || '';

/** ITS 전국 CCTV (고속도로 + 국도) */
async function fetchItsCctv(): Promise<CctvCamera[]> {
  const all: CctvCamera[] = [];
  for (const roadType of ['its', 'ex']) {
    try {
      const url = IS_PROD
        ? `/api/cctv?source=its&type=${roadType}&minX=125&maxX=132&minY=33&maxY=39`
        : `https://openapi.its.go.kr:9443/cctvInfo?apiKey=${ITS_KEY}&type=${roadType}&cctvType=4&minX=125&maxX=132&minY=33&maxY=39&getType=json`;
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
      properties: { name: cam.name, url: cam.url, source: cam.source },
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
              'circle-color': '#FFD700',
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

        // 클릭 → HLS 팝업
        m.on('click', 'cctv-dots', (e) => {
          if (!e.features?.length) return;
          const props = e.features[0].properties;
          if (!props?.url) return;
          const coords = (e.features[0].geometry as GeoJSON.Point).coordinates;
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
        cctvDataRef.current = [...itsCams, ...yeosuCams];
        loadedRef.current = true;
        logger.info('CCTV', `Total: ${cctvDataRef.current.length} (ITS: ${itsCams.length}, Yeosu: ${yeosuCams.length})`);
      }
      updateMapSource();
      setVis(true);
    };

    run();
  }, [map, mapLoaded, showCctv, updateMapSource]);
}
