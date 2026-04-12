/**
 * renderRoutes - add Korea enroute routes/airways layer to a Mapbox map.
 */
import type { Map as MapboxMap } from 'mapbox-gl';
import { Route, RoutePoint, createRouteRibbon, clampMEA, ftToM } from './types';

interface LineFeature {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  properties: { name: string; type: string; color: string; pointCount: number };
}

interface Route3dFeature {
  type: 'Feature';
  geometry: { type: 'Polygon'; coordinates: [[number, number][]] };
  properties: { name: string; color: string; height: number; base: number; type: string };
}

export function renderRoutes(
  map: MapboxMap,
  routes: Route[],
  is3DView: boolean,
  show3DAltitude: boolean
): void {
  const routeLineFeatures: LineFeature[] = routes
    .filter(route => route.points && route.points.length >= 2)
    .map(route => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: route.points!.map(p => [p.lon, p.lat] as [number, number])
      },
      properties: {
        name: route.name,
        type: route.type,
        color: route.type === 'RNAV' ? '#00BFFF' : '#FFD700',
        pointCount: route.points!.length
      }
    }));

  const route3dFeatures: Route3dFeature[] = [];
  routes.forEach(route => {
    if (!route.points || route.points.length < 2) return;
    const color = route.type === 'RNAV' ? '#00BFFF' : '#FFD700';
    for (let i = 0; i < route.points.length - 1; i++) {
      const p1 = route.points[i] as RoutePoint;
      const p2 = route.points[i + 1] as RoutePoint;
      if (!p1 || !p2) continue;
      const ribbon = createRouteRibbon(p1, p2, 0.004);
      if (!ribbon) continue;
      const alt1 = clampMEA(p1.mea_ft);
      const alt2 = clampMEA(p2.mea_ft);
      const avgAltM = ftToM((alt1 + alt2) / 2);
      route3dFeatures.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [ribbon] },
        properties: {
          name: route.name,
          color,
          height: avgAltM + 50,
          base: avgAltM,
          type: route.type
        }
      });
    }
  });

  if (routeLineFeatures.length === 0) return;

  map.addSource('korea-routes', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: routeLineFeatures }
  });

  if (is3DView && show3DAltitude && route3dFeatures.length > 0) {
    map.addSource('korea-routes-3d', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: route3dFeatures }
    });
    map.addLayer({
      id: 'korea-routes-3d',
      type: 'fill-extrusion',
      source: 'korea-routes-3d',
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'base'],
        'fill-extrusion-opacity': 0.7
      }
    });
  } else {
    map.addLayer({
      id: 'korea-routes',
      type: 'line',
      source: 'korea-routes',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1, 8, 2, 12, 3],
        'line-opacity': 0.7,
        'line-dasharray': [2, 1]
      }
    });
  }

  map.addLayer({
    id: 'korea-routes-labels',
    type: 'symbol',
    source: 'korea-routes',
    minzoom: 6,
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'name'],
      'text-size': 11,
      'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
      'text-rotation-alignment': 'map',
      'text-allow-overlap': false,
      'symbol-spacing': 300
    },
    paint: {
      'text-color': ['get', 'color'],
      'text-halo-color': 'rgba(0,0,0,0.9)',
      'text-halo-width': 1.5
    }
  });
}
