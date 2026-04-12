/**
 * useShipTracking - 선박 AIS 위치 추적
 * data.go.kr 해양수산부 선박위치 API 또는 AISstream.io 활용
 */
import { useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import mapboxgl, { type Map as MapboxMap } from 'mapbox-gl';
import { logger } from '../utils/logger';
import { escapeHtml } from '../utils/sanitize';

const UPDATE_INTERVAL = 30000; // 30초마다 업데이트

interface Ship {
  mmsi: string;
  name: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  type: string;
}

function createShipIcon(map: MapboxMap) {
  if (map.hasImage('ship-icon')) return;
  const size = 20;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 선박 형태 (삼각형 + 몸통)
  ctx.fillStyle = '#03A9F4';
  ctx.beginPath();
  ctx.moveTo(10, 0);    // 뱃머리
  ctx.lineTo(17, 14);   // 우현
  ctx.lineTo(14, 18);   // 우현 선미
  ctx.lineTo(6, 18);    // 좌현 선미
  ctx.lineTo(3, 14);    // 좌현
  ctx.closePath();
  ctx.fill();

  // 선체 강조
  ctx.strokeStyle = '#0288D1';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 갑판 (중앙선)
  ctx.strokeStyle = '#B3E5FC';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(10, 3);
  ctx.lineTo(10, 15);
  ctx.stroke();

  map.addImage('ship-icon', ctx.getImageData(0, 0, size, size), { pixelRatio: 1 });
}

export default function useShipTracking(
  map: MutableRefObject<MapboxMap | null>,
  mapLoaded: boolean,
  showShips: boolean
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const layersAddedRef = useRef(false);

  const fetchShips = useCallback(async (): Promise<Ship[]> => {
    try {
      const resp = await fetch('/api/ships');
      if (!resp.ok) return [];
      const data = await resp.json();
      return data.ships || [];
    } catch (err) {
      logger.error('Ships', `Fetch error: ${err}`);
      return [];
    }
  }, []);

  const updatePositions = useCallback(async () => {
    const m = map.current;
    if (!m) return;
    try { if (!m.getSource('ship-positions')) return; } catch { return; }

    const ships = await fetchShips();
    const features: GeoJSON.Feature[] = ships.map(ship => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [ship.lng, ship.lat] },
      properties: {
        name: ship.name,
        mmsi: ship.mmsi,
        heading: ship.heading,
        speed: ship.speed,
        type: ship.type,
      },
    }));

    try {
      const src = m.getSource('ship-positions') as mapboxgl.GeoJSONSource;
      if (src) {
        src.setData({ type: 'FeatureCollection', features });
        logger.info('Ships', `Updated ${features.length} ships`);
      }
    } catch (err) {
      logger.error('Ships', `Update error: ${err}`);
    }
  }, [map, fetchShips]);

  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded) return;

    const ensureLayers = () => {
      if (layersAddedRef.current) return;
      try {
        createShipIcon(m);

        if (!m.getSource('ship-positions')) {
          m.addSource('ship-positions', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        }
        if (!m.getLayer('ship-icons')) {
          m.addLayer({
            id: 'ship-icons', type: 'symbol', source: 'ship-positions',
            layout: {
              'icon-image': 'ship-icon',
              'icon-size': 1.2,
              'icon-allow-overlap': true,
              'icon-rotate': ['get', 'heading'],
              'icon-rotation-alignment': 'map',
              'text-field': ['get', 'name'],
              'text-size': 9,
              'text-offset': [0, 1.8],
              'text-anchor': 'top',
              'text-optional': true,
            },
            paint: {
              'text-color': '#03A9F4',
              'text-halo-color': '#000000',
              'text-halo-width': 1,
            },
          });
        }

        // 클릭 팝업
        m.on('click', 'ship-icons', (e) => {
          const feature = e.features?.[0];
          if (!feature?.properties) return;
          const props = feature.properties;
          const coords = (feature.geometry as GeoJSON.Point).coordinates;
          const name = escapeHtml(props.name as string);
          const mmsi = escapeHtml(props.mmsi as string);
          const speed = escapeHtml(String(props.speed ?? ''));
          const heading = escapeHtml(String(props.heading ?? ''));
          const type = escapeHtml(props.type as string);
          new mapboxgl.Popup({ closeOnClick: true, maxWidth: '280px' })
            .setLngLat(coords as [number, number])
            .setHTML(`
              <div style="background:#0a1628;padding:12px;border-radius:8px;color:#fff;" role="dialog" aria-label="선박 ${name}">
                <div style="color:#03A9F4;font-weight:bold;font-size:14px;">🚢 ${name}</div>
                <div style="color:#aaa;font-size:11px;margin-top:6px;">
                  MMSI: ${mmsi}<br/>
                  속도: ${speed} kt<br/>
                  방향: ${heading}°<br/>
                  유형: ${type}
                </div>
              </div>
            `)
            .addTo(m);
        });
        m.on('mouseenter', 'ship-icons', () => { m.getCanvas().style.cursor = 'pointer'; });
        m.on('mouseleave', 'ship-icons', () => { m.getCanvas().style.cursor = ''; });

        layersAddedRef.current = true;
        logger.info('Ships', 'Layers added');
      } catch (err) { logger.error('Ships', `Layer error: ${err}`); }
    };

    const setVis = (v: boolean) => {
      try {
        if (m.getLayer('ship-icons')) m.setLayoutProperty('ship-icons', 'visibility', v ? 'visible' : 'none');
      } catch { /* ignore */ }
    };

    const start = async () => {
      if (m.isStyleLoaded()) ensureLayers();
      else await new Promise<void>(r => m.once('style.load', () => { ensureLayers(); r(); }));

      if (!showShips) {
        setVis(false);
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        return;
      }

      setVis(true);
      await updatePositions();
      if (!intervalRef.current) {
        intervalRef.current = setInterval(updatePositions, UPDATE_INTERVAL);
      }
    };

    start();
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [map, mapLoaded, showShips, updatePositions]);
}
