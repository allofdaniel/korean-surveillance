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

/**
 * True once the style document is parsed, i.e. sources and layers can be added.
 *
 * `map.isStyleLoaded()` also returns false while any source is still fetching tiles. With live
 * traffic re-uploading GeoJSON every second that is false most of the time, so guards written
 * as `if (!map.isStyleLoaded()) return;` silently dropped layer toggles (TMA, satellite,
 * weather, global data …). This checks only what addSource/addLayer actually require.
 */
export function isStyleReady(map: MapboxMap | null | undefined): boolean {
  if (!map) return false;
  const style = (map as unknown as { style?: { _loaded?: boolean } }).style;
  if (style && typeof style._loaded === 'boolean') return style._loaded;
  try { return map.isStyleLoaded(); } catch { return false; }
}
