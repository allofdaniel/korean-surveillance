/**
 * renderWaypoints - add Korea enroute waypoints and NAVAIDs layers.
 */
import type { Map as MapboxMap } from 'mapbox-gl';
import { Route, Waypoint, Navaid, ftToM } from './types';

// ---------------------------------------------------------------------------
// Waypoints
// ---------------------------------------------------------------------------

interface Wp3dFeature {
  type: 'Feature';
  geometry: { type: 'Polygon'; coordinates: [[number, number][]] };
  properties: { name: string; height: number; base: number; color: string; type: string; lat: number; lon: number; alt_ft: number };
}

interface WpFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: { name: string; type: string; lat: number; lon: number; alt_ft: number | null };
}

interface LabelFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] | [number, number, number] };
  properties: { name: string; altitude_ft: number | null; label: string };
}

export function renderWaypoints(
  map: MapboxMap,
  waypoints: Waypoint[],
  routes: Route[] | undefined,
  is3DView: boolean,
  show3DAltitude: boolean,
  isDayMode: boolean
): void {
  // Build MEA lookup from route points
  const waypointAltitudes: Record<string, number> = {};
  if (routes) {
    routes.forEach(route => {
      if (route.points) {
        route.points.forEach(p => {
          if (p.name && p.mea_ft && p.mea_ft > 0 && p.mea_ft <= 60000) {
            const currentAlt = waypointAltitudes[p.name];
            if (!currentAlt || currentAlt < p.mea_ft) {
              waypointAltitudes[p.name] = p.mea_ft;
            }
          }
        });
      }
    });
  }

  if (is3DView && show3DAltitude) {
    const wp3dFeatures: Wp3dFeature[] = [];
    waypoints.forEach(wp => {
      const altFt = waypointAltitudes[wp.name] || 5000;
      const altM = ftToM(altFt);
      const size = 0.008;
      const coords: [number, number][] = [
        [wp.lon, wp.lat + size],
        [wp.lon + size, wp.lat],
        [wp.lon, wp.lat - size],
        [wp.lon - size, wp.lat],
        [wp.lon, wp.lat + size]
      ];
      wp3dFeatures.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: {
          name: wp.name,
          height: altM + 100,
          base: altM,
          color: '#00FF7F',
          type: wp.type || 'WPT',
          lat: wp.lat,
          lon: wp.lon,
          alt_ft: altFt
        }
      });
    });

    map.addSource('korea-waypoints', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: wp3dFeatures }
    });
    map.addLayer({
      id: 'korea-waypoints',
      type: 'fill-extrusion',
      source: 'korea-waypoints',
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'base'],
        'fill-extrusion-opacity': 0.8
      }
    });
  } else {
    const wpFeatures: WpFeature[] = waypoints.map(wp => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [wp.lon, wp.lat] },
      properties: {
        name: wp.name,
        type: wp.type || 'WPT',
        lat: wp.lat,
        lon: wp.lon,
        alt_ft: waypointAltitudes[wp.name] || null
      }
    }));

    map.addSource('korea-waypoints', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: wpFeatures }
    });
    map.addLayer({
      id: 'korea-waypoints',
      type: 'circle',
      source: 'korea-waypoints',
      minzoom: 7,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 6, 8, 8, 10, 12],
        'circle-color': '#00FF7F',
        'circle-stroke-width': 1,
        'circle-stroke-color': isDayMode ? '#000000' : '#FFFFFF'
      }
    });
  }

  // Waypoint labels
  if (is3DView && show3DAltitude) {
    const labelFeatures: LabelFeature[] = waypoints.map(wp => {
      const altFt = waypointAltitudes[wp.name] || null;
      const altM = altFt ? ftToM(altFt) : 0;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [wp.lon, wp.lat, altM] },
        properties: {
          name: wp.name,
          altitude_ft: altFt,
          label: altFt ? `${wp.name}\n${altFt}ft` : wp.name
        }
      };
    });
    map.addSource('korea-waypoint-labels-src', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: labelFeatures }
    });
    map.addLayer({
      id: 'korea-waypoint-labels',
      type: 'symbol',
      source: 'korea-waypoint-labels-src',
      minzoom: 7,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 7, 6, 8, 8, 10, 11, 12, 22, 14, 44],
        'text-offset': [0, -1],
        'text-anchor': 'bottom',
        'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
        'text-transform': 'uppercase',
        'symbol-z-elevate': true
      },
      paint: {
        'text-color': isDayMode ? '#000000' : '#00FF7F',
        'text-halo-color': isDayMode ? '#FFFFFF' : 'rgba(0,0,0,0.8)',
        'text-halo-width': 1
      }
    });
  } else {
    const labelFeatures: LabelFeature[] = waypoints.map(wp => {
      const altFt = waypointAltitudes[wp.name] || null;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [wp.lon, wp.lat] },
        properties: {
          name: wp.name,
          altitude_ft: altFt,
          label: altFt ? `${wp.name}\n${altFt}ft` : wp.name
        }
      };
    });
    map.addSource('korea-waypoint-labels-src', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: labelFeatures }
    });
    map.addLayer({
      id: 'korea-waypoint-labels',
      type: 'symbol',
      source: 'korea-waypoint-labels-src',
      minzoom: 7,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 7, 6, 8, 8, 10, 11, 12, 22, 14, 44],
        'text-offset': [0, 1],
        'text-anchor': 'top',
        'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
        'text-transform': 'uppercase'
      },
      paint: {
        'text-color': isDayMode ? '#000000' : '#00FF7F',
        'text-halo-color': isDayMode ? '#FFFFFF' : 'rgba(0,0,0,0.8)',
        'text-halo-width': 1
      }
    });
  }
}

// ---------------------------------------------------------------------------
// NAVAIDs
// ---------------------------------------------------------------------------

interface NavaidFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: { ident: string; fullName: string; type: string; freq: string; label: string; lat: number; lon: number };
}

export function renderNavaids(map: MapboxMap, navaids: Navaid[]): void {
  const navaidFeatures: NavaidFeature[] = navaids.map(nav => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [nav.lon, nav.lat] },
    properties: {
      ident: nav.ident || nav.name,
      fullName: nav.name,
      type: nav.type,
      freq: nav.freq_mhz || '',
      label: `${nav.ident || nav.name} ${nav.type}${nav.freq_mhz ? '\n' + nav.freq_mhz + ' MHz' : ''}`,
      lat: nav.lat,
      lon: nav.lon
    }
  }));

  map.addSource('korea-navaids', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: navaidFeatures }
  });
  map.addLayer({
    id: 'korea-navaids',
    type: 'circle',
    source: 'korea-navaids',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3, 8, 6, 12, 10],
      'circle-color': [
        'match', ['get', 'type'],
        'VOR', '#FF69B4',
        'VORTAC', '#FF69B4',
        'VORDME', '#FF1493',
        'NDB', '#FFA500',
        'DME', '#00CED1',
        '#FF69B4'
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff'
    }
  });
  map.addLayer({
    id: 'korea-navaid-labels',
    type: 'symbol',
    source: 'korea-navaids',
    minzoom: 6,
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 11,
      'text-offset': [0, 1.5],
      'text-anchor': 'top',
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold']
    },
    paint: {
      'text-color': [
        'match', ['get', 'type'],
        'VOR', '#FF69B4',
        'VORTAC', '#FF69B4',
        'VORDME', '#FF1493',
        'NDB', '#FFA500',
        'DME', '#00CED1',
        '#FF69B4'
      ],
      'text-halo-color': 'rgba(0,0,0,0.8)',
      'text-halo-width': 1
    }
  });
}
