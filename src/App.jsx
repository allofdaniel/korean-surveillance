import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Import Zustand stores
import {
  useMapStore,
  useUIStore,
  useAircraftStore,
  useAtcStore,
  useLayerStore,
} from './stores';

// Import constants
import {
  MAPBOX_ACCESS_TOKEN,
  PROCEDURE_CHARTS,
} from './constants/config';

import { AIRPORT_DATABASE } from './constants/airports';

// 모듈 상수: runway별 차트 (한 번만 계산)
const CHARTS_BY_RUNWAY = {
  '18': Object.entries(PROCEDURE_CHARTS).filter(([, c]) => c.runway === '18'),
  '36': Object.entries(PROCEDURE_CHARTS).filter(([, c]) => c.runway === '36'),
};

// Import weather utilities
import { parseMetar, parseMetarTime } from './utils/weather';

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
  TimeWeatherBar,
  ViewControlsBar,
  MapContextMenu,
  ControlPanel,
} from './components';

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

function App() {
  const mapContainer = useRef(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // ============================================
  // Zustand Stores
  // ============================================

  // Map store
  const {
    is3DView, setIs3DView,
    isDarkMode, setIsDarkMode,
    showSatellite, setShowSatellite,
    showBuildings,
    showTerrain, setShowTerrain,
    show3DAltitude, setShow3DAltitude,
    viewFilter, cycleViewFilter,
    showSatellites, setShowSatellites,
    showCctv, setShowCctv,
    showShips, setShowShips,
    showVwBuildings, setShowVwBuildings,
    showVwSpecial, setShowVwSpecial,
    showVwRoads, setShowVwRoads,
  } = useMapStore(useShallow(s => ({
    is3DView: s.is3DView, setIs3DView: s.setIs3DView,
    isDarkMode: s.isDarkMode, setIsDarkMode: s.setIsDarkMode,
    showSatellite: s.showSatellite, setShowSatellite: s.setShowSatellite,
    showBuildings: s.showBuildings,
    showTerrain: s.showTerrain, setShowTerrain: s.setShowTerrain,
    show3DAltitude: s.show3DAltitude, setShow3DAltitude: s.setShow3DAltitude,
    viewFilter: s.viewFilter, cycleViewFilter: s.cycleViewFilter,
    showSatellites: s.showSatellites, setShowSatellites: s.setShowSatellites,
    showCctv: s.showCctv, setShowCctv: s.setShowCctv,
    showShips: s.showShips, setShowShips: s.setShowShips,
    showVwBuildings: s.showVwBuildings, setShowVwBuildings: s.setShowVwBuildings,
    showVwSpecial: s.showVwSpecial, setShowVwSpecial: s.setShowVwSpecial,
    showVwRoads: s.showVwRoads, setShowVwRoads: s.setShowVwRoads,
  })));

  // UI store
  const {
    isPanelOpen, setIsPanelOpen,
    layersExpanded, setLayersExpanded,
    aircraftExpanded, setAircraftExpanded,
    sidExpanded, setSidExpanded,
    starExpanded, setStarExpanded,
    apchExpanded, setApchExpanded,
    chartExpanded, setChartExpanded,
    koreaRoutesExpanded, setKoreaRoutesExpanded,
    showAtcPanel, setShowAtcPanel,
    atcExpanded, toggleAtcSection,
    showWxPanel,
    showNotamPanel, setShowNotamPanel,
    showMetarPopup, setShowMetarPopup,
    showTafPopup, setShowTafPopup,
    metarPinned, setMetarPinned,
    tafPinned, setTafPinned,
    sectionExpanded, toggleSection,
  } = useUIStore(useShallow(s => ({
    isPanelOpen: s.isPanelOpen, setIsPanelOpen: s.setIsPanelOpen,
    layersExpanded: s.layersExpanded, setLayersExpanded: s.setLayersExpanded,
    aircraftExpanded: s.aircraftExpanded, setAircraftExpanded: s.setAircraftExpanded,
    sidExpanded: s.sidExpanded, setSidExpanded: s.setSidExpanded,
    starExpanded: s.starExpanded, setStarExpanded: s.setStarExpanded,
    apchExpanded: s.apchExpanded, setApchExpanded: s.setApchExpanded,
    chartExpanded: s.chartExpanded, setChartExpanded: s.setChartExpanded,
    koreaRoutesExpanded: s.koreaRoutesExpanded, setKoreaRoutesExpanded: s.setKoreaRoutesExpanded,
    showAtcPanel: s.showAtcPanel, setShowAtcPanel: s.setShowAtcPanel,
    atcExpanded: s.atcExpanded, toggleAtcSection: s.toggleAtcSection,
    showWxPanel: s.showWxPanel,
    showNotamPanel: s.showNotamPanel, setShowNotamPanel: s.setShowNotamPanel,
    showMetarPopup: s.showMetarPopup, setShowMetarPopup: s.setShowMetarPopup,
    showTafPopup: s.showTafPopup, setShowTafPopup: s.setShowTafPopup,
    metarPinned: s.metarPinned, setMetarPinned: s.setMetarPinned,
    tafPinned: s.tafPinned, setTafPinned: s.setTafPinned,
    sectionExpanded: s.sectionExpanded, toggleSection: s.toggleSection,
  })));

  // Aircraft store
  const {
    showAircraft, setShowAircraft,
    showAircraftTrails, setShowAircraftTrails,
    show3DAircraft, setShow3DAircraft,
    trailDuration, setTrailDuration,
    headingPrediction, setHeadingPrediction,
    labelOffset, setLabelOffset,
    isDraggingLabel, setIsDraggingLabel,
    selectedAircraft, setSelectedAircraft,
    graphHoverData, setGraphHoverData,
  } = useAircraftStore(useShallow(s => ({
    showAircraft: s.showAircraft, setShowAircraft: s.setShowAircraft,
    showAircraftTrails: s.showAircraftTrails, setShowAircraftTrails: s.setShowAircraftTrails,
    show3DAircraft: s.show3DAircraft, setShow3DAircraft: s.setShow3DAircraft,
    trailDuration: s.trailDuration, setTrailDuration: s.setTrailDuration,
    headingPrediction: s.headingPrediction, setHeadingPrediction: s.setHeadingPrediction,
    labelOffset: s.labelOffset, setLabelOffset: s.setLabelOffset,
    isDraggingLabel: s.isDraggingLabel, setIsDraggingLabel: s.setIsDraggingLabel,
    selectedAircraft: s.selectedAircraft, setSelectedAircraft: s.setSelectedAircraft,
    graphHoverData: s.graphHoverData, setGraphHoverData: s.setGraphHoverData,
  })));

  // ATC store
  const {
    atcOnlyMode, setAtcOnlyMode,
    radarRange, setRadarRange,
    radarBlackBackground, setRadarBlackBackground,
    selectedAtcSectors, setSelectedAtcSectors,
    toggleSectorGroup,
  } = useAtcStore(useShallow(s => ({
    atcOnlyMode: s.atcOnlyMode, setAtcOnlyMode: s.setAtcOnlyMode,
    radarRange: s.radarRange, setRadarRange: s.setRadarRange,
    radarBlackBackground: s.radarBlackBackground, setRadarBlackBackground: s.setRadarBlackBackground,
    selectedAtcSectors: s.selectedAtcSectors, setSelectedAtcSectors: s.setSelectedAtcSectors,
    toggleSectorGroup: s.toggleSectorGroup,
  })));

  // Layer store
  const {
    showWaypoints, setShowWaypoints,
    showObstacles, setShowObstacles,
    showAirspace, setShowAirspace,
    showLightning, setShowLightning,
    showSigmet, setShowSigmet,
    showKoreaRoutes, setShowKoreaRoutes,
    showKoreaWaypoints, setShowKoreaWaypoints,
    showKoreaNavaids, setShowKoreaNavaids,
    showKoreaAirspaces, setShowKoreaAirspaces,
    showKoreaAirports, setShowKoreaAirports,
    showKoreaHoldings, setShowKoreaHoldings,
    showKoreaTerminalWaypoints, setShowKoreaTerminalWaypoints,
    showKoreaSids, setShowKoreaSids,
    showKoreaStars, setShowKoreaStars,
    showKoreaIaps, setShowKoreaIaps,
    selectedKoreaAirport, setSelectedKoreaAirport,
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
    showWaypoints: s.showWaypoints, setShowWaypoints: s.setShowWaypoints,
    showObstacles: s.showObstacles, setShowObstacles: s.setShowObstacles,
    showAirspace: s.showAirspace, setShowAirspace: s.setShowAirspace,
    showLightning: s.showLightning, setShowLightning: s.setShowLightning,
    showSigmet: s.showSigmet, setShowSigmet: s.setShowSigmet,
    showKoreaRoutes: s.showKoreaRoutes, setShowKoreaRoutes: s.setShowKoreaRoutes,
    showKoreaWaypoints: s.showKoreaWaypoints, setShowKoreaWaypoints: s.setShowKoreaWaypoints,
    showKoreaNavaids: s.showKoreaNavaids, setShowKoreaNavaids: s.setShowKoreaNavaids,
    showKoreaAirspaces: s.showKoreaAirspaces, setShowKoreaAirspaces: s.setShowKoreaAirspaces,
    showKoreaAirports: s.showKoreaAirports, setShowKoreaAirports: s.setShowKoreaAirports,
    showKoreaHoldings: s.showKoreaHoldings, setShowKoreaHoldings: s.setShowKoreaHoldings,
    showKoreaTerminalWaypoints: s.showKoreaTerminalWaypoints, setShowKoreaTerminalWaypoints: s.setShowKoreaTerminalWaypoints,
    showKoreaSids: s.showKoreaSids, setShowKoreaSids: s.setShowKoreaSids,
    showKoreaStars: s.showKoreaStars, setShowKoreaStars: s.setShowKoreaStars,
    showKoreaIaps: s.showKoreaIaps, setShowKoreaIaps: s.setShowKoreaIaps,
    selectedKoreaAirport: s.selectedKoreaAirport, setSelectedKoreaAirport: s.setSelectedKoreaAirport,
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

  const [activeCharts, setActiveCharts] = useState({});
  const [selectedChartAirport, setSelectedChartAirport] = useState('RKPU');

  // ============================================
  // Custom Hooks
  // ============================================

  // Map initialization hook
  const { map, mapLoaded, setMapLoaded } = useMapInit(mapContainer);

  // Data loading hook
  const {
    data,
    sidVisible, setSidVisible,
    starVisible, setStarVisible,
    apchVisible, setApchVisible,
    procColors,
    allChartBounds,
    chartOpacities, setChartOpacities,
    atcData,
    koreaAirspaceData,
  } = useDataLoading();

  // Window height hook (Android WebView fix)
  const windowHeight = useWindowHeight(map);

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
  useChartOverlay(map, mapLoaded, activeCharts, chartOpacities, allChartBounds, selectedChartAirport);

  // ATC hooks
  useAtcRadarRings(map, mapLoaded, atcOnlyMode, radarRange, radarBlackBackground);
  useAtcSectors(map, mapLoaded, atcData, selectedAtcSectors);
  useKoreaAirspace(map, mapLoaded, koreaAirspaceData, showKoreaRoutes, showKoreaWaypoints, showKoreaNavaids, showKoreaAirspaces, showKoreaAirports, is3DView, show3DAltitude, showKoreaHoldings, showKoreaTerminalWaypoints, showKoreaSids, showKoreaStars, showKoreaIaps, selectedKoreaAirport, !isDarkMode);

  // Aircraft data hook
  const { aircraft, aircraftTrails, dataHealth } = useAircraftData(data, mapLoaded, showAircraft, trailDuration);

  // Selected aircraft details hook
  const {
    aircraftPhoto, aircraftPhotoLoading,
    aircraftDetails, aircraftDetailsLoading,
    flightSchedule, flightScheduleLoading,
    flightTrack, flightTrackLoading,
    showAircraftPanel, setShowAircraftPanel,
  } = useSelectedAircraft(selectedAircraft);

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
  const { hasActiveProcedure } = useProcedureRendering(
    map, mapLoaded, data, sidVisible, starVisible, apchVisible, procColors, is3DView, show3DAltitude
  );

  // Aircraft visualization hook
  useAircraftVisualization(
    map, mapLoaded, aircraft, aircraftTrails, showAircraft, showAircraftTrails,
    show3DAircraft, is3DView, show3DAltitude, trailDuration, headingPrediction, selectedAircraft, labelOffset
  );

  // Aircraft click handler hook
  useAircraftClickHandler(map, mapLoaded, aircraft, selectedAircraft, setSelectedAircraft);

  // Weather data hook
  const { weatherData, lightningData, sigmetData, weatherHealth } = useWeatherData(
    data?.airport, false, false, showLightning, showSigmet, showWxPanel
  );

  // NOTAM data hook
  const {
    notamData, notamLoading, notamError,
    notamPeriod, setNotamPeriod,
    notamFilter, setNotamFilter,
    notamExpanded: notamItemExpanded, setNotamExpanded: setNotamItemExpanded,
    notamLocationsOnMap, setNotamLocationsOnMap,
    fetchNotamData,
    notamHealth,
  } = useNotamData();

  // Weather layers hook
  useWeatherLayers(map, mapLoaded, weatherData, data, false, showLightning, lightningData, showSigmet, sigmetData);

  // NOTAM layer hook
  useNotamLayer(map, mapLoaded, notamLocationsOnMap, notamData, is3DView);

  // Airspace layers hook - pass isDarkMode for Navigraph Charts waypoint styling
  useAirspaceLayers(map, mapLoaded, data, showWaypoints, showObstacles, showAirspace, show3DAltitude, is3DView, hasActiveProcedure, !isDarkMode);

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

  // ESC 키: 팝업 → 모바일 패널 닫기
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== 'Escape') return;
      // 1. Mapbox popup 닫기 (가장 최근 팝업)
      const popups = document.querySelectorAll('.mapboxgl-popup-close-button');
      if (popups.length > 0) {
        popups[popups.length - 1].click();
        return;
      }
      // 2. NOTAM/Aircraft 패널이 열려 있으면 닫기
      if (showNotamPanel) { setShowNotamPanel(false); return; }
      if (showAircraftPanel) { setShowAircraftPanel(false); return; }
      // 3. 모바일에서 제어 패널 열림 → 닫기
      if (window.innerWidth <= 768 && isPanelOpen) { setIsPanelOpen(false); return; }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isPanelOpen, setIsPanelOpen, showNotamPanel, setShowNotamPanel, showAircraftPanel, setShowAircraftPanel]);

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

  const toggleChart = useCallback((chartId) =>
    setActiveCharts(prev => ({ ...prev, [chartId]: !prev[chartId] })), [setActiveCharts]);
  const updateChartOpacity = useCallback((chartId, opacity) =>
    setChartOpacities(prev => ({ ...prev, [chartId]: opacity })), [setChartOpacities]);

  const flyToAirport = useCallback(() => {
    map.current?.flyTo({
      center: [129.3518, 35.5934],
      zoom: 12,
      pitch: is3DView ? 60 : 0,
      bearing: is3DView ? -30 : 0,
      duration: 2000
    });
  }, [is3DView]);

  const handleAtcModeToggle = useCallback((enabled) => {
    setAtcOnlyMode(enabled);
  }, [setAtcOnlyMode]);

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

      {/* Visual Filter Overlays (NVG/FLIR/CRT) */}
      {viewFilter === 'nvg' && <div id="nvg-overlay" />}
      {viewFilter === 'flir' && <div id="flir-overlay" />}
      {viewFilter === 'crt' && (
        <>
          <div id="crt-vignette" />
          <div id="crt-overlay" />
        </>
      )}

      {/* Time & Weather Display */}
      <TimeWeatherBar
        currentTime={currentTime}
        weatherData={weatherData}
        dataHealth={dataHealth}
        weatherHealth={weatherHealth}
        notamHealth={notamHealth}
        showMetarPopup={showMetarPopup}
        setShowMetarPopup={setShowMetarPopup}
        metarPinned={metarPinned}
        setMetarPinned={setMetarPinned}
        showTafPopup={showTafPopup}
        setShowTafPopup={setShowTafPopup}
        tafPinned={tafPinned}
        setTafPinned={setTafPinned}
        parseMetar={parseMetar}
        parseMetarTime={parseMetarTime}
      />

      {/* View Controls */}
      <ViewControlsBar
        is3DView={is3DView}
        setIs3DView={setIs3DView}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        showSatellite={showSatellite}
        setShowSatellite={setShowSatellite}
        viewFilter={viewFilter}
        cycleViewFilter={cycleViewFilter}
        showSatellites={showSatellites}
        setShowSatellites={setShowSatellites}
        showCctv={showCctv}
        setShowCctv={setShowCctv}
        showShips={showShips}
        setShowShips={setShowShips}
        showVwBuildings={showVwBuildings}
        setShowVwBuildings={setShowVwBuildings}
        showVwSpecial={showVwSpecial}
        setShowVwSpecial={setShowVwSpecial}
        showVwRoads={showVwRoads}
        setShowVwRoads={setShowVwRoads}
        showLightning={showLightning}
        setShowLightning={setShowLightning}
        showSigmet={showSigmet}
        setShowSigmet={setShowSigmet}
        sigmetData={sigmetData}
        lightningData={lightningData}
        showNotamPanel={showNotamPanel}
        setShowNotamPanel={setShowNotamPanel}
        notamData={notamData}
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
      />

      {/* Hamburger Menu Toggle Button */}
      {!isPanelOpen && (
        <button
          className="mobile-menu-toggle"
          onClick={() => setIsPanelOpen(true)}
          aria-label="메뉴 열기"
          aria-expanded={isPanelOpen}
          aria-controls="main-control-panel"
        >
          ☰
        </button>
      )}

      {/* 모바일 백드롭 (패널 열려있을 때) */}
      {isPanelOpen && (
        <div className="panel-backdrop" onClick={() => setIsPanelOpen(false)} />
      )}

      {/* Control Panel */}
      <ControlPanel
        isPanelOpen={isPanelOpen}
        setIsPanelOpen={setIsPanelOpen}
        layersExpanded={layersExpanded}
        setLayersExpanded={setLayersExpanded}
        aircraftExpanded={aircraftExpanded}
        setAircraftExpanded={setAircraftExpanded}
        sidExpanded={sidExpanded}
        setSidExpanded={setSidExpanded}
        chartExpanded={chartExpanded}
        setChartExpanded={setChartExpanded}
        koreaRoutesExpanded={koreaRoutesExpanded}
        setKoreaRoutesExpanded={setKoreaRoutesExpanded}
        showAtcPanel={showAtcPanel}
        setShowAtcPanel={setShowAtcPanel}
        atcExpanded={atcExpanded}
        toggleAtcSection={toggleAtcSection}
        is3DView={is3DView}
        show3DAltitude={show3DAltitude}
        setShow3DAltitude={setShow3DAltitude}
        showTerrain={showTerrain}
        setShowTerrain={setShowTerrain}
        showBuildings={showBuildings}
        showWaypoints={showWaypoints}
        setShowWaypoints={setShowWaypoints}
        showObstacles={showObstacles}
        setShowObstacles={setShowObstacles}
        showAirspace={showAirspace}
        setShowAirspace={setShowAirspace}
        showKoreaRoutes={showKoreaRoutes}
        setShowKoreaRoutes={setShowKoreaRoutes}
        showKoreaWaypoints={showKoreaWaypoints}
        setShowKoreaWaypoints={setShowKoreaWaypoints}
        showKoreaNavaids={showKoreaNavaids}
        setShowKoreaNavaids={setShowKoreaNavaids}
        showKoreaAirspaces={showKoreaAirspaces}
        setShowKoreaAirspaces={setShowKoreaAirspaces}
        showKoreaAirports={showKoreaAirports}
        setShowKoreaAirports={setShowKoreaAirports}
        showKoreaHoldings={showKoreaHoldings}
        setShowKoreaHoldings={setShowKoreaHoldings}
        showKoreaTerminalWaypoints={showKoreaTerminalWaypoints}
        setShowKoreaTerminalWaypoints={setShowKoreaTerminalWaypoints}
        showKoreaSids={showKoreaSids}
        setShowKoreaSids={setShowKoreaSids}
        showKoreaStars={showKoreaStars}
        setShowKoreaStars={setShowKoreaStars}
        showKoreaIaps={showKoreaIaps}
        setShowKoreaIaps={setShowKoreaIaps}
        selectedKoreaAirport={selectedKoreaAirport}
        setSelectedKoreaAirport={setSelectedKoreaAirport}
        atcOnlyMode={atcOnlyMode}
        handleAtcModeToggle={handleAtcModeToggle}
        radarRange={radarRange}
        setRadarRange={setRadarRange}
        radarBlackBackground={radarBlackBackground}
        setRadarBlackBackground={setRadarBlackBackground}
        selectedAtcSectors={selectedAtcSectors}
        setSelectedAtcSectors={setSelectedAtcSectors}
        toggleSectorGroup={toggleSectorGroup}
        atcData={atcData}
        showAircraft={showAircraft}
        setShowAircraft={setShowAircraft}
        showAircraftTrails={showAircraftTrails}
        setShowAircraftTrails={setShowAircraftTrails}
        show3DAircraft={show3DAircraft}
        setShow3DAircraft={setShow3DAircraft}
        trailDuration={trailDuration}
        setTrailDuration={setTrailDuration}
        headingPrediction={headingPrediction}
        setHeadingPrediction={setHeadingPrediction}
        labelOffset={labelOffset}
        setLabelOffset={setLabelOffset}
        isDraggingLabel={isDraggingLabel}
        setIsDraggingLabel={setIsDraggingLabel}
        sidProcedures={data?.procedures?.SID}
        starProcedures={data?.procedures?.STAR}
        apchProcedures={data?.procedures?.APPROACH}
        sidVisible={sidVisible}
        setSidVisible={setSidVisible}
        starVisible={starVisible}
        setStarVisible={setStarVisible}
        apchVisible={apchVisible}
        setApchVisible={setApchVisible}
        sidColors={procColors.SID}
        starColors={procColors.STAR}
        apchColors={procColors.APPROACH}
        hasActiveProcedure={hasActiveProcedure}
        chartsByRunway={CHARTS_BY_RUNWAY}
        activeCharts={activeCharts}
        toggleChart={toggleChart}
        chartOpacities={chartOpacities}
        updateChartOpacity={updateChartOpacity}
        allChartBounds={allChartBounds}
        selectedChartAirport={selectedChartAirport}
        setSelectedChartAirport={setSelectedChartAirport}
        map={map}
        koreaAirspaceData={koreaAirspaceData}
        flyToAirport={flyToAirport}
      />

      {/* Aircraft Detail Panel */}
      <AircraftDetailPanel
        showAircraftPanel={showAircraftPanel}
        setShowAircraftPanel={setShowAircraftPanel}
        selectedAircraft={selectedAircraft}
        setSelectedAircraft={setSelectedAircraft}
        aircraft={aircraft}
        aircraftPhoto={aircraftPhoto}
        aircraftPhotoLoading={aircraftPhotoLoading}
        aircraftDetails={aircraftDetails}
        aircraftDetailsLoading={aircraftDetailsLoading}
        flightSchedule={flightSchedule}
        flightScheduleLoading={flightScheduleLoading}
        flightTrack={flightTrack}
        flightTrackLoading={flightTrackLoading}
        aircraftTrails={aircraftTrails}
        sectionExpanded={sectionExpanded}
        toggleSection={toggleSection}
        graphHoverData={graphHoverData}
        setGraphHoverData={setGraphHoverData}
        data={data}
        atcData={atcData}
        getAircraftImage={getAircraftImage}
        detectFlightPhase={detectFlightPhase}
        detectCurrentAirspace={detectCurrentAirspace}
        findNearestWaypoints={findNearestWaypoints}
        detectCurrentProcedure={detectCurrentProcedure}
        AIRPORT_DATABASE={AIRPORT_DATABASE}
      />

      {/* Map Context Menu */}
      <MapContextMenu
        onCenterMap={(lat, lon) => {
          map.current?.flyTo({
            center: [lon, lat],
            zoom: 14,
            pitch: is3DView ? 60 : 0,
            bearing: is3DView ? -30 : 0,
            duration: 1500
          });
        }}
        onAddMarker={(lat, lon) => {
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

            // 마커 클릭 시 삭제 (이벤트 캡처링 사용)
            el.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              marker.remove();
            }, true);

            // 마커 호버 효과 (밝기 + 그림자 강조)
            el.addEventListener('mouseenter', () => {
              el.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.6)) brightness(1.2)';
            });
            el.addEventListener('mouseleave', () => {
              el.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))';
            });
          }
        }}
      />

    </div>
  );
}

export default App;
// Build trigger: 1768659592
