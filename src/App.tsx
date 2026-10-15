import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { AircraftData } from './hooks/useAircraftData';

// Import Zustand stores
import {
  useMapStore,
  useUIStore,
  useAircraftStore,
  useAtcStore,
  useLayerStore,
} from './stores';

// Import constants
import { MAPBOX_ACCESS_TOKEN } from './constants/config';

import { AIRPORT_DATABASE } from './constants/airports';

// Import aircraft constants
import { getAircraftImage } from './constants/aircraft';

// Import flight utilities
import {
  detectFlightPhase,
  detectCurrentAirspace,
  findNearestWaypoints,
  detectCurrentProcedure,
} from './utils/flight';

// Import components
import {
  AircraftDetailPanel,
  MapContextMenu,
  ApiDashboardModal,
} from './components';
import NotamPanel from './components/NotamPanel';
import AccessibleAircraftList from './components/AccessibleAircraftList';
import MapShell from './shell/MapShell';

// Import hooks
import {
  useChartOverlay,
  useMapStyle,
  useAtcRadarRings,
  useAtcSectors,
  useKoreaAirspace,
  useWeatherLayers,
  useAircraftVisualization,
  useAircraftData,
  useSmoothedAircraft,
  useSelectedAircraft,
  useAircraftClickHandler,
  useProcedureRendering,
  useNotamLayer,
  useNotamData,
  useWeatherData,
  useAirspaceLayers,
  useMapInit,
  useDataLoading,
  useWindowHeight,
  useGlobalData,
  useGlobalLayers,
  useSatelliteTracking,
  useCctvLayer,
  useShipTracking,
  useVworldLayers,
} from './hooks';

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

// Boot stage marker — App chunk 가 evaluated 됐다는 증거 (lazy import 해소 OK).
(window as unknown as { __setBootStage__?: (s: string) => void }).__setBootStage__?.('app-module-evaluated');

interface AppProps {
  onNavigateToLanding?: () => void;
}

function App({ onNavigateToLanding }: AppProps = {}): React.ReactElement | null {
  // Boot stage marker — App component 가 첫 render 시작.
  // 이 stage 만 도달하고 'app-mounted' 가 안 도달하면 useEffect 도달 전에 hang.
  (window as unknown as { __setBootStage__?: (s: string) => void }).__setBootStage__?.('app-render-start');

  const mapContainer = useRef<HTMLDivElement | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isApiDashboardOpen, setIsApiDashboardOpen] = useState<boolean>(false);

  // App 가 정상 mount 되면 boot screen 이 사라진다는 증거.
  useEffect(() => {
    (window as unknown as { __setBootStage__?: (s: string) => void }).__setBootStage__?.('app-mounted');

    // Auto open dashboard if URL contains dashboard keyword
    if (window.location.pathname.includes('dashboard') || window.location.search.includes('dashboard')) {
      setIsApiDashboardOpen(true);
    }
  }, []);

  // ============================================
  // Zustand Stores
  // ============================================

  // Map store
  const {
    is3DView, setIs3DView,
    isDarkMode,
    showSatellite,
    showBuildings,
    showTerrain,
    show3DAltitude,
    viewFilter,
    showSatellites,
    showCctv,
    showShips,
    showVwBuildings,
    showVwSpecial,
    showVwRoads,
  } = useMapStore(useShallow(s => ({
    is3DView: s.is3DView, setIs3DView: s.setIs3DView,
    isDarkMode: s.isDarkMode,
    showSatellite: s.showSatellite,
    showBuildings: s.showBuildings,
    showTerrain: s.showTerrain,
    show3DAltitude: s.show3DAltitude,
    viewFilter: s.viewFilter,
    showSatellites: s.showSatellites,
    showCctv: s.showCctv,
    showShips: s.showShips,
    showVwBuildings: s.showVwBuildings,
    showVwSpecial: s.showVwSpecial,
    showVwRoads: s.showVwRoads,
  })));

  // UI store
  const {
    showWxPanel,
    showNotamPanel, setShowNotamPanel,
    sectionExpanded, toggleSection,
  } = useUIStore(useShallow(s => ({
    showWxPanel: s.showWxPanel,
    showNotamPanel: s.showNotamPanel, setShowNotamPanel: s.setShowNotamPanel,
    sectionExpanded: s.sectionExpanded, toggleSection: s.toggleSection,
  })));

  // Aircraft store
  const {
    showAircraft,
    showAircraftTrails,
    show3DAircraft,
    trailDuration,
    headingPrediction,
    labelOffset,
    selectedAircraft, setSelectedAircraft,
    graphHoverData, setGraphHoverData,
  } = useAircraftStore(useShallow(s => ({
    showAircraft: s.showAircraft,
    showAircraftTrails: s.showAircraftTrails,
    show3DAircraft: s.show3DAircraft,
    trailDuration: s.trailDuration,
    headingPrediction: s.headingPrediction,
    labelOffset: s.labelOffset,
    selectedAircraft: s.selectedAircraft, setSelectedAircraft: s.setSelectedAircraft,
    graphHoverData: s.graphHoverData, setGraphHoverData: s.setGraphHoverData,
  })));

  // ATC store
  const {
    atcOnlyMode,
    radarRange,
    radarBlackBackground,
    selectedAtcSectors,
  } = useAtcStore(useShallow(s => ({
    atcOnlyMode: s.atcOnlyMode,
    radarRange: s.radarRange,
    radarBlackBackground: s.radarBlackBackground,
    selectedAtcSectors: s.selectedAtcSectors,
  })));

  // Layer store
  const {
    showWaypoints,
    showObstacles,
    showAirspace,
    showLightning, setShowLightning,
    showSigmet, setShowSigmet,
    showKoreaRoutes,
    showKoreaWaypoints,
    showKoreaNavaids,
    showKoreaAirspaces,
    showKoreaAirports,
    showKoreaHoldings,
    showKoreaTerminalWaypoints,
    showKoreaSids,
    showKoreaStars,
    showKoreaIaps,
    selectedKoreaAirport,
    showGlobalAirports,
    showGlobalNavaids,
    showGlobalHeliports,
    showGlobalWaypoints,
    showGlobalAirways,
    showGlobalHoldings,
    showGlobalCtrlAirspace,
    showGlobalRestrAirspace,
    showGlobalFirUir,
  } = useLayerStore(useShallow(s => ({
    showWaypoints: s.showWaypoints,
    showObstacles: s.showObstacles,
    showAirspace: s.showAirspace,
    showLightning: s.showLightning, setShowLightning: s.setShowLightning,
    showSigmet: s.showSigmet, setShowSigmet: s.setShowSigmet,
    showKoreaRoutes: s.showKoreaRoutes,
    showKoreaWaypoints: s.showKoreaWaypoints,
    showKoreaNavaids: s.showKoreaNavaids,
    showKoreaAirspaces: s.showKoreaAirspaces,
    showKoreaAirports: s.showKoreaAirports,
    showKoreaHoldings: s.showKoreaHoldings,
    showKoreaTerminalWaypoints: s.showKoreaTerminalWaypoints,
    showKoreaSids: s.showKoreaSids,
    showKoreaStars: s.showKoreaStars,
    showKoreaIaps: s.showKoreaIaps,
    selectedKoreaAirport: s.selectedKoreaAirport,
    showGlobalAirports: s.showGlobalAirports,
    showGlobalNavaids: s.showGlobalNavaids,
    showGlobalHeliports: s.showGlobalHeliports,
    showGlobalWaypoints: s.showGlobalWaypoints,
    showGlobalAirways: s.showGlobalAirways,
    showGlobalHoldings: s.showGlobalHoldings,
    showGlobalCtrlAirspace: s.showGlobalCtrlAirspace,
    showGlobalRestrAirspace: s.showGlobalRestrAirspace,
    showGlobalFirUir: s.showGlobalFirUir,
  })));

  // ============================================
  // Local State (남은 것들 - 데이터 관련)
  // ============================================

  const [activeCharts, setActiveCharts] = useState<Record<string, boolean>>({});
  const [selectedChartAirport, setSelectedChartAirport] = useState<string>('RKPU');

  // ============================================
  // Custom Hooks
  // ============================================

  // Map initialization hook
  const { map, mapLoaded, setMapLoaded } = useMapInit(mapContainer);

  // Data loading hook
  const {
    data,
    sidVisible,
    starVisible,
    apchVisible,
    procColors,
    allChartBounds,
    chartOpacities, setChartOpacities,
    atcData,
    koreaAirspaceData,
  } = useDataLoading();

  // Window height hook (Android WebView fix)
  const windowHeight = useWindowHeight();

  // Satellite tracking hook (CelesTrak TLE)
  useSatelliteTracking(map, mapLoaded, showSatellites);

  // CCTV layer hook (ITS + 고정 CCTV)
  useCctvLayer(map, mapLoaded, showCctv);

  // Ship AIS tracking hook
  useShipTracking(map, mapLoaded, showShips);

  // V-World spatial data layers (buildings, special buildings, roads)
  useVworldLayers(map, mapLoaded, showVwBuildings, showVwSpecial, showVwRoads);


  // Map style hook
  useMapStyle({
    map, mapLoaded, setMapLoaded,
    isDarkMode, showSatellite, radarBlackBackground,
    is3DView, setIs3DView, showTerrain, show3DAltitude
  });

  // Chart overlay hook
  // allChartBounds from useDataLoading is Record<string, Record<string, unknown>>; hook expects AllChartBounds.
  // FIXME: Align AllChartBounds between useDataLoading return type and useChartOverlay parameter.
  useChartOverlay(map, mapLoaded, activeCharts, chartOpacities,
    allChartBounds as Parameters<typeof useChartOverlay>[4], selectedChartAirport, isDarkMode && !showSatellite);

  // ATC hooks
  useAtcRadarRings(map, mapLoaded, atcOnlyMode, radarRange, radarBlackBackground);
  // atcData is unknown from useDataLoading; hook expects its own AtcData shape (ACC/TMA/CTR arrays).
  // FIXME: Export AtcData type from useAtcSectors or useDataLoading and align.
  useAtcSectors(map, mapLoaded, atcData as Parameters<typeof useAtcSectors>[2], selectedAtcSectors);
  useKoreaAirspace(map, mapLoaded, koreaAirspaceData, showKoreaRoutes, showKoreaWaypoints, showKoreaNavaids, showKoreaAirspaces, showKoreaAirports, is3DView, show3DAltitude, showKoreaHoldings, showKoreaTerminalWaypoints, showKoreaSids, showKoreaStars, showKoreaIaps, selectedKoreaAirport, !isDarkMode);

  // Aircraft data hook
  const { aircraft: rawAircraft, aircraftTrails, dataHealth } = useAircraftData(data, mapLoaded, showAircraft, trailDuration);
  // Kalman 필터로 위치 평활화 (RAF 30Hz로 보간 — 시각적 점프 제거)
  const aircraft = useSmoothedAircraft(rawAircraft);

  // Selected aircraft details hook
  // SelectedAircraft (store) is structurally compatible with AircraftData at runtime;
  // the store type is looser (optional fields + index sig). Cast is safe.
  const {
    aircraftPhoto, aircraftPhotoLoading,
    aircraftDetails, aircraftDetailsLoading,
    flightSchedule, flightScheduleLoading,
    flightTrack, flightTrackLoading,
    showAircraftPanel, setShowAircraftPanel,
  } = useSelectedAircraft(selectedAircraft as AircraftData | null);

  // Debug logging for procedure rendering (DEV only)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.debug('[App] State check:', {
      mapLoaded,
      hasData: !!data,
      sidCount: Object.keys(data?.procedures?.SID || {}).length,
      starCount: Object.keys(data?.procedures?.STAR || {}).length,
      apchCount: Object.keys(data?.procedures?.APPROACH || {}).length,
    });
  }, [mapLoaded, data]);

  // Procedure rendering hook
  // data (AviationData) is structurally compatible with hook's internal ProcedureData at runtime.
  // FIXME: Align ProcedureData in useProcedureRendering with AviationData from useDataLoading.
  const { hasActiveProcedure } = useProcedureRendering(
    map, mapLoaded, data as Parameters<typeof useProcedureRendering>[2],
    sidVisible, starVisible, apchVisible, procColors, is3DView, show3DAltitude
  );

  // Aircraft visualization hook
  // selectedAircraft from store is SelectedAircraft | null; hook expects AircraftData | null.
  useAircraftVisualization(
    map, mapLoaded, aircraft, aircraftTrails, showAircraft, showAircraftTrails,
    show3DAircraft, is3DView, show3DAltitude, trailDuration, headingPrediction,
    selectedAircraft as AircraftData | null, labelOffset
  );

  // Aircraft click handler hook
  // setSelectedAircraft from store is (SelectedAircraft | null) => void; hook expects AircraftData dispatch.
  // Cast is safe because AircraftData satisfies SelectedAircraft's index signature at runtime.
  useAircraftClickHandler(map, mapLoaded, aircraft, selectedAircraft as AircraftData | null,
    setSelectedAircraft as React.Dispatch<React.SetStateAction<AircraftData | null>>);

  // Weather data hook
  // data?.airport is typed as unknown in AviationData; hook expects { lat: number; lon: number } | null.
  // FIXME: AviationData.airport should be typed more precisely in useDataLoading.
  const { weatherData, lightningData, sigmetData } = useWeatherData(
    data?.airport as { lat: number; lon: number } | null | undefined ?? null,
    false, false, showLightning, showSigmet, showWxPanel
  );

  // NOTAM data hook
  const {
    notamData, notamLoading, notamError,
    notamPeriod, setNotamPeriod,
    notamFilter, setNotamFilter,
    notamExpanded: notamItemExpanded, setNotamExpanded: setNotamItemExpanded,
    notamLocationsOnMap, setNotamLocationsOnMap,
    fetchNotamData,
  } = useNotamData();

  // Weather layers hook
  // lightningData/sigmetData are typed as unknown from useWeatherData; hooks accept their own internal types.
  // FIXME: useWeatherData should export LightningDataState and SigmetDataState for proper typing.
  useWeatherLayers(map, mapLoaded, weatherData, data,
    false, showLightning, lightningData as Parameters<typeof useWeatherLayers>[6],
    showSigmet, sigmetData as Parameters<typeof useWeatherLayers>[8]);

  // NOTAM layer hook
  useNotamLayer(map, mapLoaded, notamLocationsOnMap, notamData, is3DView);

  // Airspace layers hook - pass isDarkMode for Navigraph Charts waypoint styling
  // data (AviationData) is structurally compatible with hook's internal AirspaceData at runtime.
  // FIXME: Align AirspaceData in useAirspaceLayers with AviationData from useDataLoading.
  useAirspaceLayers(map, mapLoaded, data as Parameters<typeof useAirspaceLayers>[2],
    showWaypoints, showObstacles, showAirspace, show3DAltitude, is3DView, hasActiveProcedure, !isDarkMode);

  // Global data hooks
  const { data: globalData } = useGlobalData(
    showGlobalAirports, showGlobalNavaids, showGlobalHeliports, showGlobalWaypoints,
    showGlobalAirways, showGlobalHoldings, showGlobalCtrlAirspace, showGlobalRestrAirspace, showGlobalFirUir
  );
  useGlobalLayers(
    map, mapLoaded, globalData,
    showGlobalAirports, showGlobalNavaids, showGlobalHeliports, showGlobalWaypoints,
    showGlobalAirways, showGlobalHoldings, showGlobalCtrlAirspace, showGlobalRestrAirspace, showGlobalFirUir,
    !isDarkMode // pass isDayMode for Navigraph Charts waypoint styling
  );

  // ============================================
  // Effects
  // ============================================

  // Current time update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ESC: close the newest Mapbox popup, then the aircraft detail panel.
  const showAircraftPanelRef = useRef(showAircraftPanel);
  useEffect(() => { showAircraftPanelRef.current = showAircraftPanel; }, [showAircraftPanel]);
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      const popups = document.querySelectorAll('.mapboxgl-popup-close-button');
      if (popups.length > 0) {
        (popups[popups.length - 1] as HTMLElement).click();
        return;
      }
      if (showAircraftPanelRef.current) setShowAircraftPanel(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [setShowAircraftPanel]);

  // Handle terrain toggle (showTerrain 체크박스로만 제어)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    try {
      if (!map.current.getSource('mapbox-dem')) return;
      if (showTerrain) {
        map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 2.5 });
      } else {
        map.current.setTerrain(null);
      }
    } catch { /* ignore */ }
  }, [map, mapLoaded, showTerrain]);

  // Handle 3D buildings visibility
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    try {
      if (map.current.getLayer('3d-buildings')) {
        map.current.setLayoutProperty('3d-buildings', 'visibility', showBuildings && is3DView ? 'visible' : 'none');
      }
    } catch (error) {
      console.warn('Failed to update 3D buildings visibility:', error);
    }
  }, [map, mapLoaded, showBuildings, is3DView]);

  // ============================================
  // Handlers
  // ============================================

  const updateChartOpacity = useCallback((chartId: string, opacity: number): void =>
    setChartOpacities(prev => ({ ...prev, [chartId]: opacity })), [setChartOpacities]);

  const goHome = useCallback((): void => {
    if (onNavigateToLanding) onNavigateToLanding(); else window.location.href = '/';
  }, [onNavigateToLanding]);

  const notamCount = (notamData as { data?: unknown[] } | null)?.data?.length ?? 0;

  // ============================================
  // Render
  // ============================================

  // Mapbox 토큰 검증
  if (!MAPBOX_ACCESS_TOKEN) {
    return (
      <div
        className="app-container dark-mode"
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a2e',
          color: '#fff',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <h2 style={{ color: '#ff6b6b', marginBottom: '1rem' }}>Mapbox 설정 오류</h2>
        <p style={{ marginBottom: '0.5rem' }}>VITE_MAPBOX_ACCESS_TOKEN 환경변수가 설정되지 않았습니다.</p>
        <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
          .env 파일에 Mapbox 토큰을 추가하세요.
        </p>
        <code style={{
          backgroundColor: '#2a2a3e',
          padding: '1rem',
          borderRadius: '8px',
          marginTop: '1rem',
          fontSize: '0.85rem'
        }}>
          VITE_MAPBOX_ACCESS_TOKEN=pk.your_token_here
        </code>
      </div>
    );
  }

  return (
    <div
      className={`app-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}
      style={{
        height: `${windowHeight}px`,
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        overflow: 'hidden'
      }}
    >
      <div
        ref={mapContainer}
        id="map"
        role="application"
        aria-label="대한민국 저고도 항공 감시 지도"
        style={{ height: `${windowHeight}px` }}
      />

      <AccessibleAircraftList aircraft={rawAircraft} />

      {/* Visual Filter Overlays (NVG/FLIR/CRT) */}
      {viewFilter === 'nvg' && <div id="nvg-overlay" />}
      {viewFilter === 'flir' && <div id="flir-overlay" />}
      {viewFilter === 'crt' && (
        <>
          <div id="crt-vignette" />
          <div id="crt-overlay" />
        </>
      )}

      {/* Navigraph-style workspace: top bar · rail · drawer · chart viewer */}
      <MapShell
        map={map}
        mapLoaded={mapLoaded}
        dataReady={!!data}
        now={currentTime}
        koreaAirspaceData={koreaAirspaceData}
        allChartBounds={allChartBounds as Parameters<typeof MapShell>[0]['allChartBounds']}
        activeCharts={activeCharts}
        setActiveCharts={setActiveCharts}
        chartOpacities={chartOpacities}
        updateChartOpacity={updateChartOpacity}
        selectedChartAirport={selectedChartAirport}
        setSelectedChartAirport={setSelectedChartAirport}
        aircraft={rawAircraft}
        selectedAircraftHex={(selectedAircraft as AircraftData | null)?.hex ?? null}
        onSelectAircraft={ac => setSelectedAircraft(ac as unknown as Parameters<typeof setSelectedAircraft>[0])}
        adsbHealth={dataHealth as Parameters<typeof MapShell>[0]['adsbHealth']}
        notamOk={!notamError && !!notamData}
        notamCount={notamCount}
        setShowNotamPanel={setShowNotamPanel}
        atcData={atcData}
        onOpenApiDashboard={() => setIsApiDashboardOpen(true)}
        onHome={goHome}
        notamPanel={
          <NotamPanel
            showNotamPanel={showNotamPanel}
            setShowNotamPanel={setShowNotamPanel}
            notamData={notamData as Parameters<typeof NotamPanel>[0]['notamData']}
            notamLoading={notamLoading}
            notamError={notamError}
            notamPeriod={notamPeriod}
            setNotamPeriod={setNotamPeriod}
            notamFilter={notamFilter}
            setNotamFilter={setNotamFilter}
            notamExpanded={notamItemExpanded}
            setNotamExpanded={setNotamItemExpanded}
            notamLocationsOnMap={notamLocationsOnMap}
            setNotamLocationsOnMap={setNotamLocationsOnMap}
            fetchNotamData={fetchNotamData}
            showLightning={showLightning}
            setShowLightning={setShowLightning}
            showSigmet={showSigmet}
            setShowSigmet={setShowSigmet}
            sigmetData={sigmetData as Parameters<typeof NotamPanel>[0]['sigmetData']}
            lightningData={lightningData as Parameters<typeof NotamPanel>[0]['lightningData']}
          />
        }
      />

      {/* Aircraft Detail Panel */}
      {/* AircraftDetailPanel uses its own AircraftData (sparse optional fields from AircraftDetail/types.ts).
          SelectedAircraft (store) and AircraftData (useAircraftData) are cast to satisfy that local type.
          FIXME: Unify AircraftData types across stores, hooks, and components. */}
      <AircraftDetailPanel
        showAircraftPanel={showAircraftPanel}
        setShowAircraftPanel={setShowAircraftPanel}
        selectedAircraft={selectedAircraft as Parameters<typeof AircraftDetailPanel>[0]['selectedAircraft']}
        setSelectedAircraft={setSelectedAircraft as Parameters<typeof AircraftDetailPanel>[0]['setSelectedAircraft']}
        aircraft={aircraft as unknown as Parameters<typeof AircraftDetailPanel>[0]['aircraft']}
        aircraftPhoto={aircraftPhoto}
        aircraftPhotoLoading={aircraftPhotoLoading}
        aircraftDetails={aircraftDetails}
        aircraftDetailsLoading={aircraftDetailsLoading}
        flightSchedule={flightSchedule as Parameters<typeof AircraftDetailPanel>[0]['flightSchedule']}
        flightScheduleLoading={flightScheduleLoading}
        flightTrack={flightTrack as Parameters<typeof AircraftDetailPanel>[0]['flightTrack']}
        flightTrackLoading={flightTrackLoading}
        aircraftTrails={aircraftTrails}
        sectionExpanded={sectionExpanded}
        toggleSection={toggleSection}
        graphHoverData={graphHoverData as Parameters<typeof AircraftDetailPanel>[0]['graphHoverData']}
        setGraphHoverData={setGraphHoverData as Parameters<typeof AircraftDetailPanel>[0]['setGraphHoverData']}
        data={data as Parameters<typeof AircraftDetailPanel>[0]['data']}
        atcData={atcData as Parameters<typeof AircraftDetailPanel>[0]['atcData']}
        getAircraftImage={getAircraftImage}
        detectFlightPhase={detectFlightPhase as unknown as Parameters<typeof AircraftDetailPanel>[0]['detectFlightPhase']}
        detectCurrentAirspace={detectCurrentAirspace as unknown as Parameters<typeof AircraftDetailPanel>[0]['detectCurrentAirspace']}
        findNearestWaypoints={findNearestWaypoints as unknown as Parameters<typeof AircraftDetailPanel>[0]['findNearestWaypoints']}
        detectCurrentProcedure={detectCurrentProcedure as unknown as Parameters<typeof AircraftDetailPanel>[0]['detectCurrentProcedure']}
        AIRPORT_DATABASE={AIRPORT_DATABASE}
      />

      {/* Map Context Menu */}
      <MapContextMenu
        onCenterMap={(lat: number, lon: number) => {
          map.current?.flyTo({
            center: [lon, lat],
            zoom: 14,
            pitch: is3DView ? 60 : 0,
            bearing: is3DView ? -30 : 0,
            duration: 1500
          });
        }}
        onAddMarker={(lat: number, lon: number) => {
          if (map.current) {
            // 핀 마커 생성
            const el = document.createElement('div');
            el.className = 'context-menu-marker';
            el.innerHTML = `
              <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="pointer-events: none;">
                <path d="M16 0C7.16 0 0 7.16 0 16C0 28 16 40 16 40S32 28 32 16C32 7.16 24.84 0 16 0Z" fill="#E53935"/>
                <path d="M16 0C7.16 0 0 7.16 0 16C0 28 16 40 16 40S32 28 32 16C32 7.16 24.84 0 16 0Z" fill="url(#paint0_linear)" fill-opacity="0.3"/>
                <circle cx="16" cy="14" r="6" fill="white"/>
                <defs>
                  <linearGradient id="paint0_linear" x1="16" y1="0" x2="16" y2="40" gradientUnits="userSpaceOnUse">
                    <stop stop-color="white" stop-opacity="0.4"/>
                    <stop offset="1" stop-color="black" stop-opacity="0.2"/>
                  </linearGradient>
                </defs>
              </svg>
            `;
            el.style.cssText = `
              cursor: pointer;
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
              transition: filter 0.15s ease;
            `;
            el.title = `${lat.toFixed(6)}, ${lon.toFixed(6)}\n클릭하여 삭제`;

            const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
              .setLngLat([lon, lat])
              .addTo(map.current);

            // AbortController: cleanup all listeners when marker is removed
            const markerAc = new AbortController();
            const markerSignal = markerAc.signal;

            // 마커 클릭 시 삭제 (이벤트 캡처링 사용)
            el.addEventListener('click', (e: MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              marker.remove();
              markerAc.abort(); // remove all remaining listeners
            }, { capture: true, signal: markerSignal });

            // 마커 호버 효과 (밝기 + 그림자 강조)
            el.addEventListener('mouseenter', () => {
              el.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.6)) brightness(1.2)';
            }, { signal: markerSignal });
            el.addEventListener('mouseleave', () => {
              el.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))';
            }, { signal: markerSignal });
          }
        }}
      />

      {/* 23개 연계 인터페이스 종합 대시보드 모달 */}
      <ApiDashboardModal
        isOpen={isApiDashboardOpen}
        onClose={() => setIsApiDashboardOpen(false)}
      />

    </div>
  );
}

export default App;

// Build trigger: 1768659592
