/**
 * ViewControlsBar Component
 * 우측 상단 패널 — NOTAM 버튼만 남김.
 * 다른 9개 토글 (2D/DARK/IMG/FX/SAT/CCTV/AIS/MAP) 은 햄버거 메뉴 안의
 * "보기 & 오버레이" 카테고리로 통합 (2026-05).
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

interface ViewControlsBarProps {
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
  showLightning,
  setShowLightning,
  showSigmet,
  setShowSigmet,
  sigmetData,
  lightningData,
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
    <div className="view-controls" role="toolbar" aria-label="NOTAM 패널">
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
