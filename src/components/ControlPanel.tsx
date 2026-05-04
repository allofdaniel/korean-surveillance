/**
 * ControlPanel Component
 * 메인 제어 패널 — 4대분류 구조:
 *   1. 지도 표시  (teal  #5fc6ff)
 *   2. 항공기 설정 (green #39ddff)
 *   3. 공항별     (orange #ffa040)
 *   4. 표시 설정  (purple #b690ff)
 */
import React from 'react';
import type { MutableRefObject } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';

import AltitudeLegend from './AltitudeLegend';
import CategoryGroup from './CategoryGroup';
import SubGroup from './SubGroup';
import ToggleItem from './ToggleItem';
import AircraftControlPanel from './AircraftControlPanel';
import { ProceduresPanel, ChartOverlayPanel } from './ProcedurePanel';

import type { KoreaAirspaceData } from '../hooks/useDataLoading';
import type { AtcData } from '../types';
import { useMapStore, useUIStore } from '../stores';

// ---- Shared sub-types ----

interface LabelOffset {
  x: number;
  y: number;
}

// Canonical AtcData/AtcSector — types/index.ts 의 superset 사용 (위에서 import)

type VisibleState = Record<string, boolean>;
type ColorRecord = Record<string, string>;

// ---- Charts ----
// ChartOverlayPanel expects this shape:
type ChartBounds = { bounds: [number, number][]; type?: string; name?: string };
type ChartsByAirport = Record<string, Record<string, ChartBounds>>;

// ---- Procedures data ----
interface ProcedureRecord {
  display_name: string;
}

// ---- Props interface ----

export interface ControlPanelProps {
  // Panel open/close
  isPanelOpen: boolean;
  setIsPanelOpen: (open: boolean) => void;

  // Accordion states (UI store)
  layersExpanded: boolean;
  setLayersExpanded: (v: boolean) => void;
  aircraftExpanded: boolean;
  setAircraftExpanded: (v: boolean) => void;
  sidExpanded: boolean;
  setSidExpanded: (v: boolean) => void;
  chartExpanded: boolean;
  setChartExpanded: (v: boolean) => void;
  // koreaRoutesExpanded / setKoreaRoutesExpanded — removed (unused inside ControlPanel body)
  showAtcPanel: boolean;
  setShowAtcPanel: (v: boolean) => void;
  atcExpanded: Record<string, boolean>;
  toggleAtcSection: (type: string) => void;

  // Map store
  is3DView: boolean;
  show3DAltitude: boolean;
  setShow3DAltitude: (v: boolean) => void;
  showTerrain: boolean;
  setShowTerrain: (v: boolean) => void;
  showBuildings: boolean;

  // Layer store
  showWaypoints: boolean;
  setShowWaypoints: (v: boolean) => void;
  showObstacles: boolean;
  setShowObstacles: (v: boolean) => void;
  showAirspace: boolean;
  setShowAirspace: (v: boolean) => void;
  showKoreaRoutes: boolean;
  setShowKoreaRoutes: (v: boolean) => void;
  showKoreaWaypoints: boolean;
  setShowKoreaWaypoints: (v: boolean) => void;
  showKoreaNavaids: boolean;
  setShowKoreaNavaids: (v: boolean) => void;
  showKoreaAirspaces: boolean;
  setShowKoreaAirspaces: (v: boolean) => void;
  showKoreaAirports: boolean;
  setShowKoreaAirports: (v: boolean) => void;
  showKoreaHoldings: boolean;
  setShowKoreaHoldings: (v: boolean) => void;
  showKoreaTerminalWaypoints: boolean;
  setShowKoreaTerminalWaypoints: (v: boolean) => void;
  showKoreaSids: boolean;
  // setShowKoreaSids — removed (unused inside ControlPanel body)
  showKoreaStars: boolean;
  // setShowKoreaStars — removed (unused inside ControlPanel body)
  showKoreaIaps: boolean;
  // setShowKoreaIaps — removed (unused inside ControlPanel body)
  // selectedKoreaAirport / setSelectedKoreaAirport — removed (unused inside ControlPanel body)

  // ATC store
  atcOnlyMode: boolean;
  handleAtcModeToggle: (enabled: boolean) => void;
  radarRange: number;
  setRadarRange: (v: number) => void;
  radarBlackBackground: boolean;
  setRadarBlackBackground: (v: boolean) => void;
  selectedAtcSectors: Set<string>;
  setSelectedAtcSectors: (v: Set<string>) => void;
  toggleSectorGroup: (sectorIds: string[]) => void;
  atcData: AtcData | null;

  // Aircraft store
  showAircraft: boolean;
  setShowAircraft: (v: boolean) => void;
  showAircraftTrails: boolean;
  setShowAircraftTrails: (v: boolean) => void;
  show3DAircraft: boolean;
  setShow3DAircraft: (v: boolean) => void;
  trailDuration: number;
  setTrailDuration: (v: number) => void;
  headingPrediction: number;
  setHeadingPrediction: (v: number) => void;
  labelOffset: LabelOffset;
  setLabelOffset: (v: LabelOffset) => void;
  isDraggingLabel: boolean;
  setIsDraggingLabel: (v: boolean) => void;

  // Procedure data
  sidProcedures: Record<string, ProcedureRecord> | null | undefined;
  starProcedures: Record<string, ProcedureRecord> | null | undefined;
  apchProcedures: Record<string, ProcedureRecord> | null | undefined;
  sidVisible: VisibleState;
  setSidVisible: React.Dispatch<React.SetStateAction<VisibleState>>;
  starVisible: VisibleState;
  setStarVisible: React.Dispatch<React.SetStateAction<VisibleState>>;
  apchVisible: VisibleState;
  setApchVisible: React.Dispatch<React.SetStateAction<VisibleState>>;
  sidColors: ColorRecord;
  starColors: ColorRecord;
  apchColors: ColorRecord;
  hasActiveProcedure: boolean;

  // Chart overlay
  chartsByRunway?: unknown;
  activeCharts: Record<string, boolean>;
  toggleChart: (chartId: string) => void;
  chartOpacities: Record<string, number>;
  updateChartOpacity: (chartId: string, opacity: number) => void;
  allChartBounds: Record<string, Record<string, unknown>> | null;
  selectedChartAirport: string;
  setSelectedChartAirport: (airport: string) => void;
  map: MutableRefObject<MapboxMap | null>;

  // Korea airspace data
  koreaAirspaceData: KoreaAirspaceData | null;

  // Fly to airport
  flyToAirport: () => void;
}

// ---- Accent colours for the 4 major categories ----
const CAT_TEAL   = '#5fc6ff';  // 지도 표시
const CAT_GREEN  = '#39ddff';  // 항공기 설정
const CAT_ORANGE = '#ffa040';  // 공항별
const CAT_PURPLE = '#b690ff';  // 표시 설정

const ControlPanel: React.FC<ControlPanelProps> = React.memo(({
  isPanelOpen,
  setIsPanelOpen,
  layersExpanded,
  setLayersExpanded,
  aircraftExpanded,
  setAircraftExpanded,
  sidExpanded,
  setSidExpanded,
  chartExpanded,
  setChartExpanded,
  // koreaRoutesExpanded and setKoreaRoutesExpanded removed from interface
  showAtcPanel,
  setShowAtcPanel,
  atcExpanded,
  toggleAtcSection,
  is3DView,
  show3DAltitude,
  setShow3DAltitude,
  showTerrain,
  setShowTerrain,
  showBuildings,
  showWaypoints,
  setShowWaypoints,
  showObstacles,
  setShowObstacles,
  showAirspace,
  setShowAirspace,
  showKoreaRoutes,
  setShowKoreaRoutes,
  showKoreaWaypoints,
  setShowKoreaWaypoints,
  showKoreaNavaids,
  setShowKoreaNavaids,
  showKoreaAirspaces,
  setShowKoreaAirspaces,
  showKoreaAirports,
  setShowKoreaAirports,
  showKoreaHoldings,
  setShowKoreaHoldings,
  showKoreaTerminalWaypoints,
  setShowKoreaTerminalWaypoints,
  showKoreaSids,
  // setShowKoreaSids, setShowKoreaStars, setShowKoreaIaps, selectedKoreaAirport, setSelectedKoreaAirport removed from interface
  showKoreaStars,
  showKoreaIaps,
  atcOnlyMode,
  handleAtcModeToggle,
  radarRange,
  setRadarRange,
  radarBlackBackground,
  setRadarBlackBackground,
  selectedAtcSectors,
  setSelectedAtcSectors,
  toggleSectorGroup,
  atcData,
  showAircraft,
  setShowAircraft,
  showAircraftTrails,
  setShowAircraftTrails,
  show3DAircraft,
  setShow3DAircraft,
  trailDuration,
  setTrailDuration,
  headingPrediction,
  setHeadingPrediction,
  labelOffset,
  setLabelOffset,
  isDraggingLabel,
  setIsDraggingLabel,
  sidProcedures,
  starProcedures,
  apchProcedures,
  sidVisible,
  setSidVisible,
  starVisible,
  setStarVisible,
  apchVisible,
  setApchVisible,
  sidColors,
  starColors,
  apchColors,
  hasActiveProcedure,
  activeCharts,
  toggleChart,
  chartOpacities,
  updateChartOpacity,
  allChartBounds,
  selectedChartAirport,
  setSelectedChartAirport,
  map,
  koreaAirspaceData,
  flyToAirport,
}) => {
  // 4분류 카테고리 상태 (UIStore)
  const catMapExpanded      = useUIStore(s => s.catMapExpanded);
  const setCatMapExpanded   = useUIStore(s => s.setCatMapExpanded);
  const catAircraftExpanded    = useUIStore(s => s.catAircraftExpanded);
  const setCatAircraftExpanded = useUIStore(s => s.setCatAircraftExpanded);
  const catAirportExpanded     = useUIStore(s => s.catAirportExpanded);
  const setCatAirportExpanded  = useUIStore(s => s.setCatAirportExpanded);
  const catDisplayExpanded     = useUIStore(s => s.catDisplayExpanded);
  const setCatDisplayExpanded  = useUIStore(s => s.setCatDisplayExpanded);

  // Local expansion state for sub-groups that don't have a UIStore entry
  // Local expansion state for sub-groups (UI-only, no store needed)
  const [navaidsSubExpanded,    setNavaidsSubExpanded]    = React.useState(false);
  const [routesSubExpanded,     setRoutesSubExpanded]     = React.useState(false);
  const [waypointsSubExpanded,  setWaypointsSubExpanded]  = React.useState(false);

  // Active-toggle counts for each major category badge
  const mapActiveCount = [
    showKoreaAirports, showKoreaNavaids,
    showKoreaAirspaces, atcOnlyMode,
    showKoreaRoutes, showKoreaHoldings,
    showKoreaWaypoints, showKoreaTerminalWaypoints,
  ].filter(Boolean).length;

  const aircraftActiveCount = [
    showAircraft, showAircraftTrails, show3DAircraft,
  ].filter(Boolean).length;

  const airportActiveCount = [
    showWaypoints, showObstacles, showAirspace,
    showKoreaSids, showKoreaStars, showKoreaIaps,
    Object.values(activeCharts).some(Boolean),
  ].filter(Boolean).length;

  const displayActiveCount = [
    show3DAltitude, showTerrain, showBuildings,
  ].filter(Boolean).length;

  return (
    <div
      id="main-control-panel"
      className={`control-panel ${isPanelOpen ? 'open' : 'closed'}`}
      role="region"
      aria-label="제어 패널"
      // inert 속성 사용 — closed 상태에서 내부 focus 와 interaction 모두 차단.
      // aria-hidden 만 사용하면 closed 패널 안의 button 에 focus 가 남아있을 때
      // "Blocked aria-hidden on focused element" 접근성 경고 발생 (Chrome 119+).
      // inert 는 focus 도 자동으로 빠져나가므로 안전.
      {...(!isPanelOpen ? { inert: '' as unknown as boolean } : {})}
    >
      <div className="panel-header">
        <span className="panel-title">대한감시</span>
        <button
          className="panel-close-btn"
          onClick={() => setIsPanelOpen(false)}
          aria-label="패널 닫기"
        >
          ✕
        </button>
      </div>

      <div className="panel-content">

        {/* ═══════════════════════════════════════════════════════════
            1. 지도 표시 — 지도에 그려지는 정적 데이터 전체
            ═══════════════════════════════════════════════════════════ */}
        <CategoryGroup
          title="지도 표시"
          accentColor={CAT_TEAL}
          expanded={catMapExpanded}
          onToggle={() => setCatMapExpanded(!catMapExpanded)}
          badge={mapActiveCount > 0 ? `${mapActiveCount} 켜짐` : undefined}
        >
          {/* 중분류 A: 공항·항법시설 */}
          <SubGroup
            title="공항 · 항법시설"
            expanded={navaidsSubExpanded}
            onToggle={() => setNavaidsSubExpanded(p => !p)}
          >
            <ToggleItem
              label="공항 / 활주로 / ILS"
              checked={showKoreaAirports}
              onChange={setShowKoreaAirports}
            />
            <ToggleItem
              label="NAVAID (VOR · DME · NDB)"
              checked={showKoreaNavaids}
              onChange={setShowKoreaNavaids}
            />
          </SubGroup>

          {/* 중분류 B: 공역·관제구역 */}
          <SubGroup
            title={`공역 · 관제구역${selectedAtcSectors.size > 0 ? ` (${selectedAtcSectors.size})` : ''}`}
            expanded={showAtcPanel}
            onToggle={() => setShowAtcPanel(!showAtcPanel)}
          >
            <ToggleItem
              label="공역 (P/R/D/MOA)"
              checked={showKoreaAirspaces}
              onChange={setShowKoreaAirspaces}
            />

            {/* 레이더 뷰 토글 */}
            <div className="toggle-item radar-toggle">
              <label className="toggle-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', width: '100%' }}>
                <input
                  type="checkbox"
                  checked={atcOnlyMode}
                  onChange={(e) => handleAtcModeToggle(e.target.checked)}
                  style={{ marginRight: 4 }}
                />
                <span>레이더 뷰 ({radarRange}nm)</span>
              </label>
            </div>

            {atcOnlyMode && (
              <div className="radar-controls">
                <div className="radar-range-row">
                  <span>범위</span>
                  <span>{radarRange}nm</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="50"
                  value={radarRange}
                  onChange={(e) => setRadarRange(parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
                <label className="radar-bg-label">
                  <input
                    type="checkbox"
                    checked={radarBlackBackground}
                    onChange={(e) => setRadarBlackBackground(e.target.checked)}
                  />
                  검은 배경
                </label>
              </div>
            )}

            {atcData && (
              <>
                {/* ACC/TMA/CTR 일괄 선택 — 카테고리는 optional 이므로 ?? [] fallback */}
                <div className="atc-group-btns">
                  {(['ACC', 'TMA', 'CTR'] as const).map((type) => {
                    const sectors = atcData[type] ?? [];
                    return (
                      <button
                        key={type}
                        className={`mini-btn ${
                          sectors.length > 0 && sectors.every((s) => selectedAtcSectors.has(s.id)) ? 'active' : ''
                        }`}
                        onClick={() => toggleSectorGroup(sectors.map((s) => s.id))}
                      >
                        {type} ({sectors.length})
                      </button>
                    );
                  })}
                </div>

                {/* 섹터 목록 */}
                {(['ACC', 'TMA', 'CTR'] as const).map((type) => (
                  <div key={type} className="atc-sector-group">
                    <div
                      className="atc-sector-type-header"
                      onClick={() => toggleAtcSection(type)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleAtcSection(type); }}
                    >
                      <span>{type}</span>
                      <span className="atc-sector-chevron">{atcExpanded[type] ? '▼' : '▶'}</span>
                    </div>
                    {atcExpanded[type] && (
                      <div className="atc-sector-chips">
                        {(atcData[type] ?? []).map((s) => (
                          <label
                            key={s.id}
                            className={`atc-chip ${selectedAtcSectors.has(s.id) ? 'active' : ''}`}
                            title={s.name}
                          >
                            <span
                              className="atc-chip-dot"
                              style={{ background: s.color }}
                            />
                            <input
                              type="checkbox"
                              checked={selectedAtcSectors.has(s.id)}
                              onChange={(e) => {
                                const newSet = new Set(selectedAtcSectors);
                                if (e.target.checked) {
                                  newSet.add(s.id);
                                } else {
                                  newSet.delete(s.id);
                                }
                                setSelectedAtcSectors(newSet);
                              }}
                              style={{ display: 'none' }}
                            />
                            <span>
                              {s.name
                                .split(' - ')
                                .pop()
                                ?.replace(/ (ACC|TMA|CTR)$/, '')
                                .substring(0, 8)}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </SubGroup>

          {/* 중분류 C: 항로·홀딩 */}
          <SubGroup
            title="항로 · 홀딩"
            expanded={routesSubExpanded}
            onToggle={() => setRoutesSubExpanded(p => !p)}
          >
            <ToggleItem
              label="항로 (ATS/RNAV)"
              checked={showKoreaRoutes}
              onChange={setShowKoreaRoutes}
            />
            <ToggleItem
              label="홀딩 패턴"
              checked={showKoreaHoldings}
              onChange={setShowKoreaHoldings}
            />
          </SubGroup>

          {/* 중분류 D: 웨이포인트 */}
          <SubGroup
            title="웨이포인트"
            expanded={waypointsSubExpanded}
            onToggle={() => setWaypointsSubExpanded(p => !p)}
          >
            <ToggleItem
              label="항로 웨이포인트"
              checked={showKoreaWaypoints}
              onChange={setShowKoreaWaypoints}
            />
            <ToggleItem
              label="터미널 웨이포인트"
              checked={showKoreaTerminalWaypoints}
              onChange={setShowKoreaTerminalWaypoints}
            />
          </SubGroup>

          {/* KoreaAirspacePanel — source metadata + AIRAC info footer */}
          {koreaAirspaceData && (
            <div className="airspace-data-footer">
              <small>eAIP Korea · AIRAC {koreaAirspaceData.metadata?.airac}</small>
            </div>
          )}
        </CategoryGroup>

        {/* ═══════════════════════════════════════════════════════════
            2. 항공기 설정 — 실시간 항공기 표시 옵션
            ═══════════════════════════════════════════════════════════ */}
        <CategoryGroup
          title="항공기 설정"
          accentColor={CAT_GREEN}
          expanded={catAircraftExpanded}
          onToggle={() => setCatAircraftExpanded(!catAircraftExpanded)}
          badge={aircraftActiveCount > 0 ? `${aircraftActiveCount} 켜짐` : undefined}
        >
          <AircraftControlPanel
            aircraftExpanded={aircraftExpanded}
            setAircraftExpanded={setAircraftExpanded}
            showAircraft={showAircraft}
            setShowAircraft={setShowAircraft}
            showAircraftTrails={showAircraftTrails}
            setShowAircraftTrails={setShowAircraftTrails}
            show3DAircraft={show3DAircraft}
            setShow3DAircraft={setShow3DAircraft}
            is3DView={is3DView}
            trailDuration={trailDuration}
            setTrailDuration={setTrailDuration}
            headingPrediction={headingPrediction}
            setHeadingPrediction={setHeadingPrediction}
            labelOffset={labelOffset}
            setLabelOffset={setLabelOffset}
            isDraggingLabel={isDraggingLabel}
            setIsDraggingLabel={setIsDraggingLabel}
          />
        </CategoryGroup>

        {/* ═══════════════════════════════════════════════════════════
            3. 공항별 — 공항 하나에 종속된 모든 데이터/도구
            ═══════════════════════════════════════════════════════════ */}
        <CategoryGroup
          title="공항별"
          accentColor={CAT_ORANGE}
          expanded={catAirportExpanded}
          onToggle={() => setCatAirportExpanded(!catAirportExpanded)}
          badge={airportActiveCount > 0 ? `${airportActiveCount} 켜짐` : undefined}
        >
          {/* 중분류 A: 공항 데이터 (RKPU 웨이포인트·장애물·공역) */}
          <SubGroup
            title="RKPU 공항 데이터"
            expanded={layersExpanded}
            onToggle={() => setLayersExpanded(!layersExpanded)}
          >
            <ToggleItem
              label="웨이포인트"
              checked={showWaypoints}
              onChange={setShowWaypoints}
              disabled={hasActiveProcedure}
              hint={hasActiveProcedure ? '(절차별)' : undefined}
            />
            <ToggleItem label="장애물" checked={showObstacles} onChange={setShowObstacles} />
            <ToggleItem label="공역"   checked={showAirspace}  onChange={setShowAirspace} />
          </SubGroup>

          {/* 중분류 B: 비행 절차 (SID/STAR/IAP) */}
          <ProceduresPanel
            sidProcedures={sidProcedures ?? null}
            starProcedures={starProcedures ?? null}
            apchProcedures={apchProcedures ?? null}
            expanded={sidExpanded}
            onToggle={() => setSidExpanded(!sidExpanded)}
            sidVisible={sidVisible}
            setSidVisible={setSidVisible}
            starVisible={starVisible}
            setStarVisible={setStarVisible}
            apchVisible={apchVisible}
            setApchVisible={setApchVisible}
            sidColors={sidColors}
            starColors={starColors}
            apchColors={apchColors}
          />

          {/* 중분류 C: 차트 오버레이 */}
          <ChartOverlayPanel
            expanded={chartExpanded}
            onToggle={() => setChartExpanded(!chartExpanded)}
            activeCharts={activeCharts}
            toggleChart={toggleChart}
            chartOpacities={chartOpacities}
            updateChartOpacity={updateChartOpacity}
            allChartBounds={allChartBounds as ChartsByAirport | null}
            selectedAirport={selectedChartAirport}
            setSelectedAirport={setSelectedChartAirport}
            map={map}
          />

          {/* 공항으로 이동 버튼 */}
          <div className="section">
            <button className="fly-btn" onClick={flyToAirport}>
              공항으로 이동
            </button>
          </div>
        </CategoryGroup>

        {/* ═══════════════════════════════════════════════════════════
            4. 표시 설정 — 지도 외관/시각화 옵션 (기본 접힘)
            ═══════════════════════════════════════════════════════════ */}
        <CategoryGroup
          title="표시 설정"
          accentColor={CAT_PURPLE}
          expanded={catDisplayExpanded}
          onToggle={() => setCatDisplayExpanded(!catDisplayExpanded)}
          badge={displayActiveCount > 0 ? `${displayActiveCount} 켜짐` : undefined}
        >
          {is3DView && (
            <SubGroup
              title="3D 보기"
              expanded
              onToggle={() => {}}
            >
              <ToggleItem label="3D 고도 표시" checked={show3DAltitude} onChange={setShow3DAltitude} />
              <ToggleItem label="지형"         checked={showTerrain}    onChange={setShowTerrain} />
              <ToggleItem
                label="3D 건물"
                checked={showBuildings}
                onChange={(v) => useMapStore.getState().setShowBuildings(v)}
              />
            </SubGroup>
          )}

          <SubGroup
            title="고도 색상 범례"
            expanded
            onToggle={() => {}}
          >
            <AltitudeLegend />
          </SubGroup>
        </CategoryGroup>

      </div>
    </div>
  );
});

ControlPanel.displayName = 'ControlPanel';

export default ControlPanel;
