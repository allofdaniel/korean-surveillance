/**
 * useGoogle3DTiles - Google Photorealistic 3D Tiles on Mapbox
 * deck.gl Tile3DLayer를 Mapbox 위에 오버레이
 */
import { useEffect, useRef, type MutableRefObject } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { Tile3DLayer } from '@deck.gl/geo-layers';
import { Tiles3DLoader } from '@loaders.gl/3d-tiles';
import useMapStore from '../stores/useMapStore';

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
      // 3D 모드로 자동 전환
      if (m.getPitch() < 30) {
        m.easeTo({ pitch: 60, bearing: -30, duration: 1000 });
      }
      // V-World 위성 끄기 (Google 3D가 자체 위성 포함)
      const { showSatellite, setShowSatellite } = useMapStore.getState();
      if (showSatellite) {
        setShowSatellite(false);
      }
      // Mapbox 3D 건물 숨기기 (Google 3D가 건물 제공)
      try {
        if (m.getLayer('3d-buildings')) {
          m.setLayoutProperty('3d-buildings', 'visibility', 'none');
        }
      } catch { /* ignore */ }

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
        // Mapbox 3D 건물 복원
        try {
          if (m.getLayer('3d-buildings')) {
            m.setLayoutProperty('3d-buildings', 'visibility', 'visible');
          }
        } catch { /* ignore */ }
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
