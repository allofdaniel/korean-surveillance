/**
 * ViewControlsBar Component
 * 뷰 컨트롤 바 (2D/3D, 다크모드, 기상 드롭다운 등)
 * 관제 패널은 좌측 패널로 이동됨, 기상레이더 제거됨
 */
import React from 'react';
import NotamPanel from './NotamPanel';

interface NotamExpandedState {
  [key: string]: boolean;
}

interface NotamDataItem {
  id?: string;
  location?: string;
  notam_number?: string;
  e_text?: string;
  qcode?: string;
  qcode_mean?: string;
  full_text?: string;
  effective_start?: string;
  effective_end?: string;
  [key: string]: unknown;
}

interface NotamDataResponse {
  data?: NotamDataItem[];
  returned?: number;
}

type ViewFilter = 'none' | 'nvg' | 'flir' | 'crt';

interface ViewControlsBarProps {
  // 2D/3D Toggle
  is3DView: boolean;
  setIs3DView: (is3D: boolean) => void;
  // Dark Mode
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean) => void;
  // Satellite
  showSatellite: boolean;
  setShowSatellite: (show: boolean) => void;
  // View Filter (NVG/FLIR/CRT)
  viewFilter: ViewFilter;
  cycleViewFilter: () => void;
  // Satellite tracking
  showSatellites: boolean;
  setShowSatellites: (show: boolean) => void;
  // CCTV
  showCctv: boolean;
  setShowCctv: (show: boolean) => void;
  // Ships
  showShips: boolean;
  setShowShips: (show: boolean) => void;
  // V-World layers
  showVwBuildings: boolean;
  setShowVwBuildings: (show: boolean) => void;
  showVwSpecial: boolean;
  setShowVwSpecial: (show: boolean) => void;
  showVwRoads: boolean;
  setShowVwRoads: (show: boolean) => void;
  // Weather (pass-through to NotamPanel)
  showLightning: boolean;
  setShowLightning: (show: boolean) => void;
  showSigmet: boolean;
  setShowSigmet: (show: boolean) => void;
  sigmetData: unknown;
  lightningData: unknown;
  // NOTAM Panel props
  showNotamPanel: boolean;
  setShowNotamPanel: (show: boolean) => void;
  notamData: NotamDataResponse | null;
  notamLoading: boolean;
  notamError: string | null;
  notamPeriod: string;
  setNotamPeriod: (period: string) => void;
  notamFilter: string;
  setNotamFilter: (filter: string) => void;
  notamExpanded: NotamExpandedState;
  setNotamExpanded: React.Dispatch<React.SetStateAction<NotamExpandedState>>;
  notamLocationsOnMap: Set<string>;
  setNotamLocationsOnMap: (locations: Set<string>) => void;
  fetchNotamData: (period: string, forceRefresh?: boolean) => void;
}

/**
 * View Controls Bar Component
 * 관제 패널은 좌측 패널로 이동됨
 * DO-278A 요구사항 추적: SRS-PERF-003
 */
const ViewControlsBar: React.FC<ViewControlsBarProps> = React.memo(({
  // 2D/3D Toggle
  is3DView,
  setIs3DView,
  // Dark Mode
  isDarkMode,
  setIsDarkMode,
  // Satellite
  showSatellite,
  setShowSatellite,
  // View Filter
  viewFilter,
  cycleViewFilter,
  // Satellite tracking
  showSatellites,
  setShowSatellites,
  // CCTV
  showCctv,
  setShowCctv,
  // Ships
  showShips,
  setShowShips,
  // V-World layers
  showVwBuildings,
  setShowVwBuildings,
  showVwSpecial,
  setShowVwSpecial,
  showVwRoads,
  setShowVwRoads,
  // Weather (pass-through to NotamPanel)
  showLightning,
  setShowLightning,
  showSigmet,
  setShowSigmet,
  sigmetData,
  lightningData,
  // NOTAM Panel props
  showNotamPanel,
  setShowNotamPanel,
  notamData,
  notamLoading,
  notamError,
  notamPeriod,
  setNotamPeriod,
  notamFilter,
  setNotamFilter,
  notamExpanded,
  setNotamExpanded,
  notamLocationsOnMap,
  setNotamLocationsOnMap,
  fetchNotamData
}) => {
  return (
    <div className="view-controls" role="toolbar" aria-label="지도 뷰 컨트롤">
      <button className="view-btn" onClick={() => setIs3DView(!is3DView)} aria-pressed={is3DView} aria-label={is3DView ? '2D 보기로 전환' : '3D 보기로 전환'}>{is3DView ? '3D' : '2D'}</button>
      <button
        className="view-btn icon-btn"
        onClick={() => setIsDarkMode(!isDarkMode)}
        title={isDarkMode ? '라이트 모드' : '다크 모드'}
        aria-label={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
        aria-pressed={isDarkMode}
      >
        {isDarkMode ? 'DARK' : 'LIGHT'}
      </button>
      <button
        className={`view-btn icon-btn ${showSatellite ? 'active' : ''}`}
        onClick={() => setShowSatellite(!showSatellite)}
        title="위성 사진"
        aria-label="위성 사진 표시"
        aria-pressed={showSatellite}
      >
        IMG
</button>
      <button
        className={`view-btn ${viewFilter !== 'none' ? `filter-active-${viewFilter}` : ''}`}
        onClick={cycleViewFilter}
        title={`시각 필터: ${viewFilter === 'none' ? 'OFF' : viewFilter.toUpperCase()}`}
        aria-label="시각 필터 전환 (NVG/FLIR/CRT)"
      >
        {viewFilter === 'none' ? 'FX' : viewFilter === 'nvg' ? 'NVG' : viewFilter === 'flir' ? 'FLIR' : 'CRT'}
      </button>
      <button
        className={`view-btn ${showSatellites ? 'active' : ''}`}
        onClick={() => setShowSatellites(!showSatellites)}
        title="위성 궤도 추적"
        aria-label="위성 궤도 표시"
        aria-pressed={showSatellites}
        style={showSatellites ? { background: 'rgba(255, 107, 107, 0.3)', borderColor: '#ff6b6b', color: '#ff6b6b' } : {}}
      >
        SAT
      </button>
      <button
        className={`view-btn ${showCctv ? 'active' : ''}`}
        onClick={() => setShowCctv(!showCctv)}
        title="실시간 CCTV"
        aria-label="CCTV 카메라 표시"
        aria-pressed={showCctv}
        style={showCctv ? { background: 'rgba(255, 215, 0, 0.3)', borderColor: '#FFD700', color: '#FFD700' } : {}}
      >
        CCTV
      </button>
      <button
        className={`view-btn ${showShips ? 'active' : ''}`}
        onClick={() => setShowShips(!showShips)}
        title="선박 AIS 추적"
        aria-label="선박 위치 표시"
        aria-pressed={showShips}
        style={showShips ? { background: 'rgba(3, 169, 244, 0.3)', borderColor: '#03A9F4', color: '#03A9F4' } : {}}
      >
        AIS
      </button>
      <button
        className={`view-btn ${showVwBuildings || showVwSpecial || showVwRoads ? 'active' : ''}`}
        onClick={() => {
          const allOn = showVwBuildings && showVwSpecial && showVwRoads;
          setShowVwBuildings(!allOn);
          setShowVwSpecial(!allOn);
          setShowVwRoads(!allOn);
        }}
        title="V-World 건물/도로 (줌 11+)"
        aria-label="V-World 공간데이터 표시"
        style={(showVwBuildings || showVwSpecial || showVwRoads) ? { background: 'rgba(229, 62, 62, 0.3)', borderColor: '#e53e3e', color: '#fc8181' } : {}}
      >
        MAP
      </button>

      <NotamPanel
        showNotamPanel={showNotamPanel}
        setShowNotamPanel={setShowNotamPanel}
        notamData={notamData}
        notamLoading={notamLoading}
        notamError={notamError}
        notamPeriod={notamPeriod}
        setNotamPeriod={setNotamPeriod}
        notamFilter={notamFilter}
        setNotamFilter={setNotamFilter}
        notamExpanded={notamExpanded}
        setNotamExpanded={setNotamExpanded}
        notamLocationsOnMap={notamLocationsOnMap}
        setNotamLocationsOnMap={setNotamLocationsOnMap}
        fetchNotamData={fetchNotamData}
        showLightning={showLightning}
        setShowLightning={setShowLightning}
        showSigmet={showSigmet}
        setShowSigmet={setShowSigmet}
        sigmetData={sigmetData as never}
        lightningData={lightningData as never}
      />
    </div>
  );
});
ViewControlsBar.displayName = 'ViewControlsBar';

export default ViewControlsBar;
