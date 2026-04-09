/**
 * useGoogle3DTiles - Google Photorealistic 3D Tiles on Mapbox
 * deck.gl Tile3DLayer를 Mapbox 위에 오버레이
 */
import { useEffect, useRef, type MutableRefObject } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { Tile3DLayer } from '@deck.gl/geo-layers';
import { Tiles3DLoader } from '@loaders.gl/3d-tiles';

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const TILESET_URL = 'https://tile.googleapis.com/v1/3dtiles/root.json';

export default function useGoogle3DTiles(
  map: MutableRefObject<MapboxMap | null>,
  mapLoaded: boolean,
  enabled: boolean
) {
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const addedRef = useRef(false);

  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded || !GOOGLE_KEY) return;

    if (enabled && !addedRef.current) {
      // 3D 모드로 자동 전환 (피치가 없으면 건물이 안 보임)
      if (m.getPitch() < 30) {
        m.easeTo({ pitch: 60, bearing: -30, duration: 1000 });
      }

      try {
        const overlay = new MapboxOverlay({
          layers: [
            new Tile3DLayer({
              id: 'google-3d-tiles',
              data: TILESET_URL,
              loaders: [Tiles3DLoader],
              loadOptions: {
                fetch: {
                  headers: {
                    'X-GOOG-API-KEY': GOOGLE_KEY,
                  },
                },
              },
              onTilesetLoad: (tileset: unknown) => {
                console.log('[Google3D] Tileset loaded:', tileset);
              },
              onTileError: (_tile: unknown, _url: string, message: string) => {
                console.error('[Google3D] Tile error:', message);
              },
            }),
          ],
        });

        m.addControl(overlay as unknown as mapboxgl.IControl);
        overlayRef.current = overlay;
        addedRef.current = true;
        console.log('[Google3D] Overlay added to map');
      } catch (err) {
        console.error('[Google3D] Init error:', err);
      }
    } else if (!enabled && addedRef.current) {
      // 비활성화
      if (overlayRef.current) {
        try {
          m.removeControl(overlayRef.current as unknown as mapboxgl.IControl);
        } catch { /* ignore */ }
        overlayRef.current = null;
        addedRef.current = false;
        console.log('[Google3D] Overlay removed');
      }
    }
  }, [map, mapLoaded, enabled]);

  // cleanup
  useEffect(() => {
    return () => {
      if (overlayRef.current && map.current) {
        try {
          map.current.removeControl(overlayRef.current as unknown as mapboxgl.IControl);
        } catch { /* ignore */ }
        overlayRef.current = null;
        addedRef.current = false;
      }
    };
  }, [map]);
}
