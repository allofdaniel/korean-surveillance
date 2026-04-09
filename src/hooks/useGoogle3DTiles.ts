/**
 * useGoogle3DTiles - Google Photorealistic 3D Tiles on Mapbox
 * deck.gl Tile3DLayer를 Mapbox 위에 오버레이
 */
import { useEffect, useRef, type MutableRefObject } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { Tile3DLayer } from '@deck.gl/geo-layers';
import { Tiles3DLoader } from '@loaders.gl/3d-tiles';
import { logger } from '../utils/logger';

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export default function useGoogle3DTiles(
  map: MutableRefObject<MapboxMap | null>,
  mapLoaded: boolean,
  showCesium: boolean // 3D 버튼 상태 재활용
) {
  const overlayRef = useRef<MapboxOverlay | null>(null);

  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded || !GOOGLE_KEY) return;

    if (showCesium) {
      // Google 3D Tiles 활성화
      if (overlayRef.current) return; // 이미 추가됨

      try {
        const tileLayer = new Tile3DLayer({
          id: 'google-3d-tiles',
          data: `https://tile.googleapis.com/v1/3dtiles/root.json?key=${GOOGLE_KEY}`,
          loaders: [Tiles3DLoader],
          loadOptions: {
            fetch: {
              headers: {
                'X-GOOG-API-KEY': GOOGLE_KEY,
              },
            },
          },
          onTilesetLoad: (tileset: unknown) => {
            logger.info('Google3D', 'Photorealistic 3D Tiles loaded');
            console.log('[Google3D] Tileset:', tileset);
          },
          onTileLoad: () => {
            // 타일 로드 시 리렌더
            if (overlayRef.current) {
              overlayRef.current.setProps({});
            }
          },
          onTileError: (tile: unknown, url: string, message: string) => {
            logger.error('Google3D', `Tile error: ${message} (${url})`);
          },
        });

        const overlay = new MapboxOverlay({
          interleaved: true,
          layers: [tileLayer],
        });

        m.addControl(overlay as unknown as mapboxgl.IControl);
        overlayRef.current = overlay;
        logger.info('Google3D', 'Overlay added to map');
      } catch (err) {
        logger.error('Google3D', `Init error: ${err}`);
      }
    } else {
      // Google 3D Tiles 비활성화
      if (overlayRef.current) {
        try {
          m.removeControl(overlayRef.current as unknown as mapboxgl.IControl);
        } catch { /* ignore */ }
        overlayRef.current = null;
        logger.info('Google3D', 'Overlay removed');
      }
    }

    return () => {
      // cleanup on unmount
      if (overlayRef.current && m) {
        try {
          m.removeControl(overlayRef.current as unknown as mapboxgl.IControl);
        } catch { /* ignore */ }
        overlayRef.current = null;
      }
    };
  }, [map, mapLoaded, showCesium]);
}
