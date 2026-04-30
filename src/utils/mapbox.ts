import type { Map as MapboxMap } from 'mapbox-gl';
import { logger } from './logger';

/** Remove a Mapbox layer if present. Logs unexpected errors but never throws. */
export function safeRemoveLayer(map: MapboxMap | null | undefined, id: string): void {
  if (!map) return;
  try {
    if (map.getLayer(id)) map.removeLayer(id);
  } catch (e) {
    logger.warn('Mapbox', `removeLayer(${id}) failed`, { error: e instanceof Error ? e.message : String(e) });
  }
}

/** Remove a Mapbox source if present. */
export function safeRemoveSource(map: MapboxMap | null | undefined, id: string): void {
  if (!map) return;
  try {
    if (map.getSource(id)) map.removeSource(id);
  } catch (e) {
    logger.warn('Mapbox', `removeSource(${id}) failed`, { error: e instanceof Error ? e.message : String(e) });
  }
}
