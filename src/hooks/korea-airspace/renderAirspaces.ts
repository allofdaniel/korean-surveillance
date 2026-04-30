/**
 * renderAirspaces - add Korea airspace polygons and airport markers.
 */
import type { Map as MapboxMap } from 'mapbox-gl';
import type { KoreaAirport } from '../useDataLoading';
import { Airspace, AIRSPACE_COLORS, AIRSPACE_TYPE_NAMES, ftToM } from './types';
import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Airspaces
// ---------------------------------------------------------------------------

interface AirspaceFeature {
  type: 'Feature';
  geometry: { type: 'Polygon'; coordinates: [[number, number][]] };
  properties: {
    name: string;
    type: string;
    typeName: string;
    category: string;
    color: string;
    upper_limit: number;
    lower_limit: number;
    upperAltM: number;
    lowerAltM: number;
    active_time: string;
  };
}

export function renderAirspaces(
  map: MapboxMap,
  airspaces: Airspace[],
  is3DView: boolean,
  show3DAltitude: boolean
): void {
  const airspaceFeatures: AirspaceFeature[] = airspaces
    .filter(asp => asp.boundary && asp.boundary.length >= 3)
    .map(asp => {
      const boundary = [...asp.boundary];
      if (boundary.length > 0) {
        const first = boundary[0];
        const last = boundary[boundary.length - 1];
        if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
          const f0 = first[0];
          const f1 = first[1];
          if (f0 !== undefined && f1 !== undefined) {
            boundary.push([f0, f1]);
          }
        }
      }
      return {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [boundary] },
        properties: {
          name: asp.name,
          type: asp.type,
          typeName: AIRSPACE_TYPE_NAMES[asp.type] || asp.type,
          category: asp.category || '',
          color: AIRSPACE_COLORS[asp.type] || '#808080',
          upper_limit: asp.upper_limit_ft || 5000,
          lower_limit: asp.lower_limit_ft || 0,
          upperAltM: ftToM(asp.upper_limit_ft || 5000),
          lowerAltM: ftToM(asp.lower_limit_ft || 0),
          active_time: asp.active_time || ''
        }
      };
    });

  map.addSource('korea-airspaces', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: airspaceFeatures }
  });

  if (is3DView && show3DAltitude) {
    map.addLayer({
      id: 'korea-airspaces-3d',
      type: 'fill-extrusion',
      source: 'korea-airspaces',
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'upperAltM'],
        'fill-extrusion-base': ['get', 'lowerAltM'],
        'fill-extrusion-opacity': 0.25
      }
    });
  } else {
    map.addLayer({
      id: 'korea-airspaces-fill',
      type: 'fill',
      source: 'korea-airspaces',
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.15
      }
    });
  }

  map.addLayer({
    id: 'korea-airspaces-outline',
    type: 'line',
    source: 'korea-airspaces',
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 2,
      'line-opacity': 0.8
    }
  });

  map.addLayer({
    id: 'korea-airspaces-labels',
    type: 'symbol',
    source: 'korea-airspaces',
    minzoom: 6,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 10,
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
      'text-allow-overlap': false,
      'symbol-placement': 'point'
    },
    paint: {
      'text-color': ['get', 'color'],
      'text-halo-color': 'rgba(0,0,0,0.8)',
      'text-halo-width': 1
    }
  });
}

// ---------------------------------------------------------------------------
// Airports
// ---------------------------------------------------------------------------

interface AptFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: Record<string, unknown>;
}

export function renderAirports(map: MapboxMap, airports: KoreaAirport[]): void {
  try {
    const aptData = airports.filter(
      apt => apt != null && typeof apt.lat === 'number' && typeof apt.lon === 'number' && apt.icao
    );

    if (aptData.length === 0) {
      logger.warn('KoreaAirspace', 'No valid airports found');
      return;
    }

    const aptFeatures: AptFeature[] = aptData.map(apt => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [apt.lon, apt.lat] },
      properties: {
        icao: apt.icao || '',
        iata: apt.iata || '',
        name: apt.name || '',
        city: apt.city || '',
        elevation_ft: apt.elevation_ft ?? 0,
        type: apt.type || 'civil',
        ifr: apt.ifr ?? false,
        label: `${apt.icao || ''}${apt.iata ? '/' + apt.iata : ''}\n${apt.elevation_ft ?? 0}ft`,
        runways: Array.isArray(apt.runways) ? apt.runways.length : 0,
        ils_count: Array.isArray(apt.ils) ? apt.ils.length : 0,
        comms_count: Array.isArray(apt.comms) ? apt.comms.length : 0,
        gates_count: Array.isArray(apt.gates) ? apt.gates.length : 0,
        freq_count: Array.isArray(apt.frequencies) ? apt.frequencies.length : 0,
        transition_alt: apt.transition_alt ?? null,
        transition_level: apt.transition_level ?? null,
        mag_var: apt.mag_var ?? null,
        lat: apt.lat,
        lon: apt.lon
      }
    }));

    if (!map.getSource('korea-airports')) {
      map.addSource('korea-airports', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: aptFeatures }
      });
    }
    if (!map.getLayer('korea-airports')) {
      map.addLayer({
        id: 'korea-airports',
        type: 'circle',
        source: 'korea-airports',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4, 8, 8, 12, 14],
          'circle-color': [
            'match', ['get', 'type'],
            'civil', '#4FC3F7',
            'military', '#EF5350',
            'joint', '#FFB74D',
            '#4FC3F7'
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9
        }
      });
    }
    if (!map.getLayer('korea-airport-labels')) {
      map.addLayer({
        id: 'korea-airport-labels',
        type: 'symbol',
        source: 'korea-airports',
        minzoom: 5,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 10, 13],
          'text-offset': [0, 1.8],
          'text-anchor': 'top',
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': false
        },
        paint: {
          'text-color': [
            'match', ['get', 'type'],
            'civil', '#4FC3F7',
            'military', '#EF5350',
            'joint', '#FFB74D',
            '#4FC3F7'
          ],
          'text-halo-color': 'rgba(0,0,0,0.9)',
          'text-halo-width': 1.5
        }
      });
    }

    // Runway and ILS rendering disabled - alignment issues with Mapbox basemap
    // TODO: Consider using actual runway polygon data from OSM or other sources
  } catch (err) {
    logger.error('KoreaAirspace', 'Airport layer error', { error: (err as Error).message });
  }
}
