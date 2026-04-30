/**
 * useKoreaAirspace Hook
 * Korea Airspace Routes, Waypoints, NAVAIDs, Airspaces 레이어 관리
 * - 줌 레벨별 표시 제어
 * - 클릭 팝업 (Waypoint, Navaid, Route, Airspace)
 * - 호버 커서 변경
 *
 * Implementation is split across src/hooks/korea-airspace/:
 *   renderRoutes.ts       - enroute airways
 *   renderWaypoints.ts    - enroute waypoints & NAVAIDs
 *   renderAirspaces.ts    - airspace polygons & airports
 *   renderProcedures.ts   - holdings, terminal waypoints, SID/STAR/IAP
 *   types.ts              - shared interfaces, constants, utilities
 */
import { useEffect, useRef, type MutableRefObject } from 'react';
import mapboxgl, { type Map as MapboxMap } from 'mapbox-gl';
import { safeRemoveLayer, safeRemoveSource } from '../utils/mapbox';
import { escapeHtml } from '../utils/sanitize';
import type { KoreaAirspaceData, KoreaAirport } from './useDataLoading';
import {
  Route, Waypoint, Navaid, Airspace,
  formatCoord,
  POPUP_STYLE, POPUP_HEADER, POPUP_ROW, POPUP_LABEL, POPUP_VALUE
} from './korea-airspace/types';
import { renderRoutes } from './korea-airspace/renderRoutes';
import { renderWaypoints, renderNavaids } from './korea-airspace/renderWaypoints';
import { renderAirspaces, renderAirports } from './korea-airspace/renderAirspaces';
import { renderHoldings, renderTerminalWaypoints, renderProcedures } from './korea-airspace/renderProcedures';

// ---------------------------------------------------------------------------
// Layer & source IDs that need cleanup on each re-render
// ---------------------------------------------------------------------------

const ALL_LAYER_IDS = [
  'korea-routes', 'korea-routes-3d', 'korea-routes-labels',
  'korea-waypoints', 'korea-waypoint-labels',
  'korea-navaids', 'korea-navaid-labels',
  'korea-airspaces-fill', 'korea-airspaces-3d', 'korea-airspaces-outline', 'korea-airspaces-labels',
  'korea-airports', 'korea-airport-labels', 'korea-runways', 'korea-ils',
  'korea-holdings', 'korea-holdings-outline', 'korea-holdings-fix', 'korea-holding-labels',
  'korea-terminal-waypoints', 'korea-terminal-waypoint-labels',
  'korea-sids', 'korea-sids-labels',
  'korea-stars', 'korea-stars-labels',
  'korea-iaps', 'korea-iaps-labels'
];

const ALL_SOURCE_IDS = [
  'korea-routes', 'korea-routes-3d',
  'korea-waypoints', 'korea-waypoint-labels-src',
  'korea-navaids',
  'korea-airspaces',
  'korea-airports', 'korea-runways', 'korea-ils',
  'korea-holdings', 'korea-holdings-labels',
  'korea-terminal-waypoints',
  'korea-sids', 'korea-stars', 'korea-iaps'
];

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const useKoreaAirspace = (
  map: MutableRefObject<MapboxMap | null>,
  mapLoaded: boolean,
  koreaAirspaceData: KoreaAirspaceData | null,
  showKoreaRoutes: boolean,
  showKoreaWaypoints: boolean,
  showKoreaNavaids: boolean,
  showKoreaAirspaces: boolean,
  showKoreaAirports: boolean,
  is3DView: boolean,
  show3DAltitude: boolean,
  showKoreaHoldings: boolean,
  showKoreaTerminalWaypoints: boolean,
  showKoreaSids: boolean,
  showKoreaStars: boolean,
  showKoreaIaps: boolean,
  selectedKoreaAirport: string,
  isDayMode: boolean = false
): void => {
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  // -------------------------------------------------------------------------
  // Layer creation effect
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!map?.current || !mapLoaded || !koreaAirspaceData) return;
    if (!map.current.isStyleLoaded()) return;

    const m = map.current;

    ALL_LAYER_IDS.forEach(id => safeRemoveLayer(m, id));
    ALL_SOURCE_IDS.forEach(id => safeRemoveSource(m, id));

    const routes = koreaAirspaceData.routes as Route[] | undefined;
    const waypoints = koreaAirspaceData.waypoints as Waypoint[] | undefined;
    const navaids = koreaAirspaceData.navaids as Navaid[] | undefined;
    const airspaces = koreaAirspaceData.airspaces as Airspace[] | undefined;

    // Routes
    if (showKoreaRoutes && routes && routes.length > 0) {
      renderRoutes(m, routes, is3DView, show3DAltitude);
    }

    // Waypoints
    if (showKoreaWaypoints && waypoints && waypoints.length > 0) {
      renderWaypoints(m, waypoints, routes, is3DView, show3DAltitude, isDayMode);
    }

    // NAVAIDs
    if (showKoreaNavaids && navaids && navaids.length > 0) {
      renderNavaids(m, navaids);
    }

    // Airports
    if (showKoreaAirports && koreaAirspaceData.airports && koreaAirspaceData.airports.length > 0) {
      renderAirports(m, koreaAirspaceData.airports as KoreaAirport[]);
    }

    // Airspaces
    if (showKoreaAirspaces && airspaces && airspaces.length > 0) {
      renderAirspaces(m, airspaces, is3DView, show3DAltitude);
    }

    // Holdings
    const holdings = koreaAirspaceData.holdings;
    if (showKoreaHoldings && holdings && holdings.length > 0) {
      renderHoldings(m, holdings);
    }

    // Terminal waypoints
    const termWpts = koreaAirspaceData.terminalWaypoints;
    if (showKoreaTerminalWaypoints && termWpts && termWpts.length > 0) {
      renderTerminalWaypoints(m, termWpts, isDayMode);
    }

    // SID / STAR / IAP procedures
    const procedures = koreaAirspaceData.procedures;
    if (procedures && selectedKoreaAirport && (showKoreaSids || showKoreaStars || showKoreaIaps)) {
      renderProcedures({
        map: m,
        procedures,
        selectedAirport: selectedKoreaAirport,
        terminalWaypoints: koreaAirspaceData.terminalWaypoints || [],
        enrouteWaypoints: koreaAirspaceData.waypoints || [],
        navaids: koreaAirspaceData.navaids || [],
        airports: koreaAirspaceData.airports || [],
        showSids: showKoreaSids,
        showStars: showKoreaStars,
        showIaps: showKoreaIaps
      });
    }
  }, [
    map, mapLoaded, koreaAirspaceData,
    showKoreaRoutes, showKoreaWaypoints, showKoreaNavaids, showKoreaAirspaces, showKoreaAirports,
    is3DView, show3DAltitude,
    showKoreaHoldings, showKoreaTerminalWaypoints,
    showKoreaSids, showKoreaStars, showKoreaIaps,
    selectedKoreaAirport, isDayMode
  ]);

  // -------------------------------------------------------------------------
  // Click & hover interaction effect
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!map?.current || !mapLoaded) return;

    const m = map.current;
    const handlers: Array<{
      event: string;
      layer: string;
      fn: (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => void;
    }> = [];

    const removePopup = () => {
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
    };

    const showPopup = (lngLat: mapboxgl.LngLat, html: string) => {
      removePopup();
      popupRef.current = new mapboxgl.Popup({
        closeButton: true,
        maxWidth: '320px',
        className: 'korea-airspace-popup'
      })
        .setLngLat(lngLat)
        .setHTML(html)
        .addTo(m);
    };

    const setCursor = () => { m.getCanvas().style.cursor = 'pointer'; };
    const resetCursor = () => { m.getCanvas().style.cursor = ''; };

    // 외부 JSON 데이터 → setHTML() 진입 전 모두 sanitize
    const e = escapeHtml;
    const safeColor = (c: unknown, fallback: string): string =>
      typeof c === 'string' && /^#[0-9A-Fa-f]{3,8}$/.test(c) ? c : fallback;

    const addHandler = (
      layer: string,
      event: string,
      fn: (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => void
    ) => {
      try {
        if (m.getLayer(layer)) {
          m.on(event as 'click', layer, fn);
          handlers.push({ event, layer, fn });
        }
      } catch { /* layer not ready */ }
    };

    // --- Waypoint click ---
    const onWaypointClick = (ev: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const f = ev.features?.[0];
      if (!f) return;
      const p = f.properties || {};
      const coord = formatCoord(p.lat as number, p.lon as number);
      const altStr = p.alt_ft ? `${e(String(p.alt_ft))} ft` : 'N/A';
      showPopup(ev.lngLat, `
        <div style="${POPUP_STYLE}">
          <div style="${POPUP_HEADER('#00FF7F')}">WPT ${e(p.name as string)}</div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Type</span><span style="${POPUP_VALUE}">${e((p.type as string) || 'Waypoint')}</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Coord</span><span style="${POPUP_VALUE}">${e(coord)}</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">MEA</span><span style="${POPUP_VALUE}">${altStr}</span></div>
        </div>
      `);
    };
    addHandler('korea-waypoints', 'click', onWaypointClick);
    addHandler('korea-waypoint-labels', 'click', onWaypointClick);
    addHandler('korea-waypoints', 'mouseenter', setCursor);
    addHandler('korea-waypoints', 'mouseleave', resetCursor);

    // --- Navaid click ---
    const onNavaidClick = (ev: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const f = ev.features?.[0];
      if (!f) return;
      const p = f.properties || {};
      const coord = formatCoord(p.lat as number, p.lon as number);
      const freqStr = p.freq ? `${e(String(p.freq))} MHz` : 'N/A';
      const typeColor = p.type === 'NDB' ? '#FFA500' : p.type === 'DME' ? '#00CED1' : '#FF69B4';
      showPopup(ev.lngLat, `
        <div style="${POPUP_STYLE}">
          <div style="${POPUP_HEADER(typeColor)}">${e(p.type as string)} ${e(p.ident as string)}</div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Name</span><span style="${POPUP_VALUE}">${e((p.fullName as string) || (p.ident as string))}</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Type</span><span style="${POPUP_VALUE}">${e(p.type as string)}</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Freq</span><span style="${POPUP_VALUE}">${freqStr}</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Coord</span><span style="${POPUP_VALUE}">${e(coord)}</span></div>
        </div>
      `);
    };
    addHandler('korea-navaids', 'click', onNavaidClick);
    addHandler('korea-navaid-labels', 'click', onNavaidClick);
    addHandler('korea-navaids', 'mouseenter', setCursor);
    addHandler('korea-navaids', 'mouseleave', resetCursor);

    // --- Route click ---
    const onRouteClick = (ev: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const f = ev.features?.[0];
      if (!f) return;
      const p = f.properties || {};
      const color = safeColor(p.color, '#FFD700');
      const typeStr = p.type === 'RNAV' ? 'RNAV (Area Navigation)' : 'ATS (Conventional)';
      showPopup(ev.lngLat, `
        <div style="${POPUP_STYLE}">
          <div style="${POPUP_HEADER(color)}">AWY ${e(p.name as string)}</div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Type</span><span style="${POPUP_VALUE}">${typeStr}</span></div>
          ${p.pointCount ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Fixes</span><span style="${POPUP_VALUE}">${e(String(p.pointCount))}</span></div>` : ''}
        </div>
      `);
    };
    addHandler('korea-routes', 'click', onRouteClick);
    addHandler('korea-routes-labels', 'click', onRouteClick);
    addHandler('korea-routes-3d', 'click', onRouteClick);
    addHandler('korea-routes', 'mouseenter', setCursor);
    addHandler('korea-routes', 'mouseleave', resetCursor);

    // --- Airport click ---
    const onAirportClick = (ev: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const f = ev.features?.[0];
      if (!f) return;
      const p = f.properties || {};
      const coord = formatCoord(p.lat as number, p.lon as number);
      const typeColor = p.type === 'military' ? '#EF5350' : p.type === 'joint' ? '#FFB74D' : '#4FC3F7';
      const typeStr = p.type === 'military' ? 'Military' : p.type === 'joint' ? 'Joint Civil/Military' : 'Civil';
      showPopup(ev.lngLat, `
        <div style="${POPUP_STYLE}">
          <div style="${POPUP_HEADER(typeColor)}">${e(p.icao as string)}${p.iata ? ' / ' + e(p.iata as string) : ''}</div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Name</span><span style="${POPUP_VALUE}">${e(p.name as string)}</span></div>
          ${p.city ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">City</span><span style="${POPUP_VALUE}">${e(p.city as string)}</span></div>` : ''}
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Type</span><span style="${POPUP_VALUE}">${typeStr}</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Elevation</span><span style="${POPUP_VALUE}">${e(String(p.elevation_ft ?? '-'))} ft</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Coord</span><span style="${POPUP_VALUE}">${e(coord)}</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">IFR</span><span style="${POPUP_VALUE}">${p.ifr ? 'Yes' : 'No'}</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Runways</span><span style="${POPUP_VALUE}">${e(String(p.runways ?? '-'))}</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">ILS</span><span style="${POPUP_VALUE}">${e(String(p.ils_count ?? '-'))}</span></div>
          ${p.gates_count ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Gates</span><span style="${POPUP_VALUE}">${e(String(p.gates_count))}</span></div>` : ''}
          ${p.freq_count ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Frequencies</span><span style="${POPUP_VALUE}">${e(String(p.freq_count))}</span></div>` : ''}
          ${p.transition_alt ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">TA/TL</span><span style="${POPUP_VALUE}">${e(String(p.transition_alt))}ft / FL${p.transition_level ? Math.round(Number(p.transition_level) / 100) : '?'}</span></div>` : ''}
          ${p.mag_var ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Mag Var</span><span style="${POPUP_VALUE}">${Number(p.mag_var) > 0 ? 'E' : 'W'}${Math.abs(Number(p.mag_var)).toFixed(1)}</span></div>` : ''}
        </div>
      `);
    };
    addHandler('korea-airports', 'click', onAirportClick);
    addHandler('korea-airport-labels', 'click', onAirportClick);
    addHandler('korea-airports', 'mouseenter', setCursor);
    addHandler('korea-airports', 'mouseleave', resetCursor);

    // --- Airspace click ---
    const onAirspaceClick = (ev: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const f = ev.features?.[0];
      if (!f) return;
      const p = f.properties || {};
      const color = safeColor(p.color, '#808080');
      const upperStr = (p.upper_limit as number) >= 60000 ? 'UNL' : `FL${Math.round((p.upper_limit as number) / 100)}`;
      const lowerStr = (p.lower_limit as number) === 0 ? 'GND' : `${e(String(p.lower_limit))} ft`;
      showPopup(ev.lngLat, `
        <div style="${POPUP_STYLE}">
          <div style="${POPUP_HEADER(color)}">${e(p.name as string)}</div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Type</span><span style="${POPUP_VALUE}">${e((p.typeName as string) || (p.type as string))}</span></div>
          ${p.category ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Category</span><span style="${POPUP_VALUE}">${e(p.category as string)}</span></div>` : ''}
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Altitude</span><span style="${POPUP_VALUE}">${lowerStr} ~ ${upperStr}</span></div>
          ${p.active_time ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Active</span><span style="${POPUP_VALUE}">${e(p.active_time as string)}</span></div>` : ''}
        </div>
      `);
    };
    addHandler('korea-airspaces-fill', 'click', onAirspaceClick);
    addHandler('korea-airspaces-3d', 'click', onAirspaceClick);
    addHandler('korea-airspaces-outline', 'click', onAirspaceClick);
    addHandler('korea-airspaces-fill', 'mouseenter', setCursor);
    addHandler('korea-airspaces-fill', 'mouseleave', resetCursor);
    addHandler('korea-airspaces-outline', 'mouseenter', setCursor);
    addHandler('korea-airspaces-outline', 'mouseleave', resetCursor);

    // --- Holding click ---
    const onHoldingClick = (ev: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const f = ev.features?.[0];
      if (!f) return;
      const p = f.properties || {};
      const coord = formatCoord(p.lat as number, p.lon as number);
      const altStr = p.min_alt || p.max_alt
        ? `${e(String(p.min_alt || 'N/A'))} ~ ${e(String(p.max_alt || 'N/A'))} ft`
        : 'N/A';
      showPopup(ev.lngLat, `
        <div style="${POPUP_STYLE}">
          <div style="${POPUP_HEADER('#FF69B4')}">HOLD ${e(p.waypoint as string)}</div>
          ${p.name && p.name !== p.waypoint ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Name</span><span style="${POPUP_VALUE}">${e(p.name as string)}</span></div>` : ''}
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Inbound</span><span style="${POPUP_VALUE}">${e(String(p.inbound_course))}\u00B0</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Turn</span><span style="${POPUP_VALUE}">${p.turn === 'L' ? 'Left' : 'Right'}</span></div>
          ${p.leg_time ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Leg Time</span><span style="${POPUP_VALUE}">${e(String(p.leg_time))} min</span></div>` : ''}
          ${p.leg_length ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Leg Dist</span><span style="${POPUP_VALUE}">${e(String(p.leg_length))} NM</span></div>` : ''}
          ${p.speed ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Speed</span><span style="${POPUP_VALUE}">${e(String(p.speed))} kt</span></div>` : ''}
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Altitude</span><span style="${POPUP_VALUE}">${altStr}</span></div>
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Coord</span><span style="${POPUP_VALUE}">${e(coord)}</span></div>
        </div>
      `);
    };
    addHandler('korea-holdings', 'click', onHoldingClick);
    addHandler('korea-holdings-outline', 'click', onHoldingClick);
    addHandler('korea-holdings-fix', 'click', onHoldingClick);
    addHandler('korea-holding-labels', 'click', onHoldingClick);
    addHandler('korea-holdings', 'mouseenter', setCursor);
    addHandler('korea-holdings', 'mouseleave', resetCursor);
    addHandler('korea-holdings-outline', 'mouseenter', setCursor);
    addHandler('korea-holdings-outline', 'mouseleave', resetCursor);
    addHandler('korea-holdings-fix', 'mouseenter', setCursor);
    addHandler('korea-holdings-fix', 'mouseleave', resetCursor);

    // --- Terminal waypoint click ---
    const onTermWptClick = (ev: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const f = ev.features?.[0];
      if (!f) return;
      const p = f.properties || {};
      const coord = formatCoord(p.lat as number, p.lon as number);
      showPopup(ev.lngLat, `
        <div style="${POPUP_STYLE}">
          <div style="${POPUP_HEADER('#20B2AA')}">${e(p.id as string)}</div>
          ${p.name && p.name !== p.id ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Name</span><span style="${POPUP_VALUE}">${e(p.name as string)}</span></div>` : ''}
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Type</span><span style="${POPUP_VALUE}">Terminal WPT</span></div>
          ${p.region ? `<div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Region</span><span style="${POPUP_VALUE}">${e(p.region as string)}</span></div>` : ''}
          <div style="${POPUP_ROW}"><span style="${POPUP_LABEL}">Coord</span><span style="${POPUP_VALUE}">${e(coord)}</span></div>
        </div>
      `);
    };
    addHandler('korea-terminal-waypoints', 'click', onTermWptClick);
    addHandler('korea-terminal-waypoint-labels', 'click', onTermWptClick);
    addHandler('korea-terminal-waypoints', 'mouseenter', setCursor);
    addHandler('korea-terminal-waypoints', 'mouseleave', resetCursor);

    return () => {
      handlers.forEach(({ event, layer, fn }) => {
        try { m.off(event as 'click', layer, fn); } catch { /* ignore */ }
      });
      removePopup();
    };
  }, [
    map, mapLoaded,
    showKoreaRoutes, showKoreaWaypoints, showKoreaNavaids, showKoreaAirspaces, showKoreaAirports,
    showKoreaHoldings, showKoreaTerminalWaypoints, isDayMode
  ]);
};

export default useKoreaAirspace;
