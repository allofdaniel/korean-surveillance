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
import {
  MAPBOX_ACCESS_TOKEN,
  PROCEDURE_CHARTS,
} from './constants/config';

import { AIRPORT_DATABASE, AIRPORT_COORDINATES } from './constants/airports';

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
import LoadingOverlay from './components/LoadingOverlay';
import AccessibleAircraftList from './components/AccessibleAircraftList';

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

function App(): React.ReactElement | null {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

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
    chartExpanded, setChartExpanded,
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
    chartExpanded: s.chartExpanded, setChartExpanded: s.setChartExpanded,
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
    allChartBounds as Parameters<typeof useChartOverlay>[4], selectedChartAirport);

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
  const { weatherData, lightningData, sigmetData, weatherHealth } = useWeatherData(
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
    notamHealth,
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

  // Refs for stale-closure-free ESC handler (registered once, reads live state via refs)
  const showAircraftPanelRef = useRef(showAircraftPanel);
  const showNotamPanelRef = useRef(showNotamPanel);
  const isPanelOpenRef = useRef(isPanelOpen);
  useEffect(() => { showAircraftPanelRef.current = showAircraftPanel; }, [showAircraftPanel]);
  useEffect(() => { showNotamPanelRef.current = showNotamPanel; }, [showNotamPanel]);
  useEffect(() => { isPanelOpenRef.current = isPanelOpen; }, [isPanelOpen]);

  // ESC 키: 팝업 → 모바일 패널 닫기 (registered once — stable setter refs prevent stale closure)
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      // 1. Mapbox popup 닫기 (가장 최근 팝업)
      const popups = document.querySelectorAll('.mapboxgl-popup-close-button');
      if (popups.length > 0) {
        (popups[popups.length - 1] as HTMLElement).click();
        return;
      }
      // 2. NOTAM/Aircraft 패널이 열려 있으면 닫기 (read live values via refs)
      if (showNotamPanelRef.current) { setShowNotamPanel(false); return; }
      if (showAircraftPanelRef.current) { setShowAircraftPanel(false); return; }
      // 3. 모바일에서 제어 패널 열림 → 닫기
      if (window.innerWidth <= 768 && isPanelOpenRef.current) { setIsPanelOpen(false); return; }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [setShowNotamPanel, setShowAircraftPanel, setIsPanelOpen]); // setters are stable

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

  const toggleChart = useCallback((chartId: string): void =>
    setActiveCharts(prev => ({ ...prev, [chartId]: !prev[chartId] })), [setActiveCharts]);
  const updateChartOpacity = useCallback((chartId: string, opacity: number): void =>
    setChartOpacities(prev => ({ ...prev, [chartId]: opacity })), [setChartOpacities]);

  const flyToAirport = useCallback((): void => {
    // map은 ref 이므로 안정 — deps 에서 의도적으로 제외
    const coords = AIRPORT_COORDINATES[selectedKoreaAirport] ?? AIRPORT_COORDINATES['RKPU'];
    if (!coords) return;
    map.current?.flyTo({
      center: [coords.lon, coords.lat],
      zoom: 12,
      pitch: is3DView ? 60 : 0,
      bearing: is3DView ? -30 : 0,
      duration: 2000
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is3DView, selectedKoreaAirport]);

  const handleAtcModeToggle = useCallback((enabled: boolean): void => {
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

      {/* 첫 로드 시 항적 도착까지 표시 (페이드아웃 후 unmount) */}
      <LoadingOverlay ready={mapLoaded && !!data} aircraftCount={rawAircraft.length} />
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

      {/* Time & Weather Display */}
      <TimeWeatherBar
        currentTime={currentTime}
        weatherData={weatherData as Parameters<typeof TimeWeatherBar>[0]['weatherData']}
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
        showAtcPanel={showAtcPanel}
        setShowAtcPanel={setShowAtcPanel}
        atcExpanded={atcExpanded}
        toggleAtcSection={toggleAtcSection as (type: string) => void}
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
        showKoreaStars={showKoreaStars}
        showKoreaIaps={showKoreaIaps}
        atcOnlyMode={atcOnlyMode}
        handleAtcModeToggle={handleAtcModeToggle}
        radarRange={radarRange}
        setRadarRange={setRadarRange}
        radarBlackBackground={radarBlackBackground}
        setRadarBlackBackground={setRadarBlackBackground}
        selectedAtcSectors={selectedAtcSectors}
        setSelectedAtcSectors={setSelectedAtcSectors}
        toggleSectorGroup={toggleSectorGroup}
        atcData={atcData as Parameters<typeof ControlPanel>[0]['atcData']}
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
        sidProcedures={data?.procedures?.SID as Parameters<typeof ControlPanel>[0]['sidProcedures']}
        starProcedures={data?.procedures?.STAR as Parameters<typeof ControlPanel>[0]['starProcedures']}
        apchProcedures={data?.procedures?.APPROACH as Parameters<typeof ControlPanel>[0]['apchProcedures']}
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

    </div>
  );
}

export default App;
// Build trigger: 1768659592
