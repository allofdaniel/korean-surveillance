/**
 * useCctvLayer - CCTV 카메라를 맵에 표시하고 클릭 시 HLS 영상 팝업
 * 현재 소스: 여수시 실시간 CCTV (data.go.kr API, 95개 HLS)
 * 추후: 경찰청/도로교통 API 확보 시 전국 확대
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
}

const IS_PROD = import.meta.env.PROD;
const DATA_GO_KR_KEY = import.meta.env.VITE_DATA_GO_KR_API_KEY || '';

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
    })).filter((c: CctvCamera) => c.url && !isNaN(c.lat) && c.lat !== 0);
  } catch (err) {
    logger.error('CCTV', `Yeosu API error: ${err}`);
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
      properties: { name: cam.name, url: cam.url },
    }));
    try {
      const source = m.getSource('cctv-cameras') as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData({ type: 'FeatureCollection', features: features as GeoJSON.Feature[] });
        logger.info('CCTV', `Updated ${features.length} cameras on map`);
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
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 2, 10, 5, 15, 8],
              'circle-color': '#FFD700',
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 1,
            },
          });
        }
        if (!m.getLayer('cctv-labels')) {
          m.addLayer({
            id: 'cctv-labels', type: 'symbol', source: 'cctv-cameras', minzoom: 10,
            layout: { 'text-field': ['get', 'name'], 'text-size': 10, 'text-offset': [0, 1.5], 'text-anchor': 'top', visibility: 'none' },
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
            <div style="padding:4px 12px;color:#666;font-size:10px;">여수시 교통 CCTV</div>
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
        const cams = await fetchYeosuCctv();
        cctvDataRef.current = cams;
        loadedRef.current = true;
        logger.info('CCTV', `Loaded ${cams.length} Yeosu cameras`);
      }
      updateMapSource();
      setVis(true);
    };

    run();
  }, [map, mapLoaded, showCctv, updateMapSource]);
}
