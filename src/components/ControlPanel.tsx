/**
 * ControlPanel Component
 * 메인 제어 패널 - 레이어, ATC 구역, 항공기, 절차, 차트 오버레이 섹션 포함
 */
import React from 'react';
import type { MutableRefObject } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';

import AltitudeLegend from './AltitudeLegend';
import Accordion from './Accordion';
import ToggleItem from './ToggleItem';
import KoreaAirspacePanel from './KoreaAirspacePanel';
import AircraftControlPanel from './AircraftControlPanel';
import { ProceduresPanel, ChartOverlayPanel } from './ProcedurePanel';

import type { KoreaAirspaceData } from '../hooks/useDataLoading';
import { useMapStore } from '../stores';

// ---- Shared sub-types ----

interface LabelOffset {
  x: number;
  y: number;
}

interface AtcSector {
  id: string;
  name: string;
  color: string;
}

interface AtcData {
  ACC: AtcSector[];
  TMA: AtcSector[];
  CTR: AtcSector[];
}

type VisibleState = Record<string, boolean>;
type ColorRecord = Record<string, string>;

// ---- Charts ----
type ChartsByRunway = {
  '18': [string, unknown][];
  '36': [string, unknown][];
};

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
  koreaRoutesExpanded: boolean;
  setKoreaRoutesExpanded: (v: boolean) => void;
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
  setShowKoreaSids: (v: boolean) => void;
  showKoreaStars: boolean;
  setShowKoreaStars: (v: boolean) => void;
  showKoreaIaps: boolean;
  setShowKoreaIaps: (v: boolean) => void;
  selectedKoreaAirport: string;
  setSelectedKoreaAirport: (airport: string) => void;

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
  chartsByRunway: ChartsByRunway;
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
  koreaRoutesExpanded,
  setKoreaRoutesExpanded,
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
  setShowKoreaSids,
  showKoreaStars,
  setShowKoreaStars,
  showKoreaIaps,
  setShowKoreaIaps,
  selectedKoreaAirport,
  setSelectedKoreaAirport,
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
  chartsByRunway,
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
  return (
    <div
      id="main-control-panel"
      className={`control-panel ${isPanelOpen ? 'open' : 'closed'}`}
      role="region"
      aria-label="제어 패널"
      aria-hidden={!isPanelOpen}
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
        <AltitudeLegend />

        {/* 울산공항 레이어 */}
        <Accordion
          title="울산공항 (RKPU)"
          expanded={layersExpanded}
          onToggle={() => setLayersExpanded(!layersExpanded)}
        >
          <ToggleItem
            label="웨이포인트"
            checked={showWaypoints}
            onChange={setShowWaypoints}
            disabled={hasActiveProcedure}
            hint={hasActiveProcedure ? "(절차별)" : undefined}
          />
          <ToggleItem label="장애물" checked={showObstacles} onChange={setShowObstacles} />
          <ToggleItem label="공역" checked={showAirspace} onChange={setShowAirspace} />
          {is3DView && (
            <ToggleItem label="3D 고도 표시" checked={show3DAltitude} onChange={setShow3DAltitude} />
          )}
          {is3DView && (
            <ToggleItem label="지형" checked={showTerrain} onChange={setShowTerrain} />
          )}
          {is3DView && (
            <ToggleItem
              label="3D 건물"
              checked={showBuildings}
              onChange={(v) => useMapStore.getState().setShowBuildings(v)}
            />
          )}
        </Accordion>

        {/* 관제구역 - ATC Sectors */}
        <Accordion
          title={`관제구역${selectedAtcSectors.size > 0 ? ` (${selectedAtcSectors.size})` : ''}`}
          expanded={showAtcPanel}
          onToggle={() => setShowAtcPanel(!showAtcPanel)}
        >
          {atcData && (
            <>
              {/* 레이더 뷰 토글 */}
              <div
                className="toggle-item"
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  paddingBottom: '8px',
                  marginBottom: '8px',
                }}
              >
                <label
                  className="toggle-label"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={atcOnlyMode}
                    onChange={(e) => handleAtcModeToggle(e.target.checked)}
                  />
                  <span>레이더 뷰 ({radarRange}nm)</span>
                </label>
              </div>

              {atcOnlyMode && (
                <div
                  style={{
                    marginBottom: '12px',
                    padding: '8px',
                    background: 'rgba(0,255,0,0.1)',
                    borderRadius: '4px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      marginBottom: '4px',
                    }}
                  >
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
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '8px',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={radarBlackBackground}
                      onChange={(e) => setRadarBlackBackground(e.target.checked)}
                    />
                    검은 배경
                  </label>
                </div>
              )}

              {/* ACC/TMA/CTR 일괄 선택 */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                {(['ACC', 'TMA', 'CTR'] as const).map((type) => (
                  <button
                    key={type}
                    className={`mini-btn ${
                      atcData[type].every((s) => selectedAtcSectors.has(s.id)) ? 'active' : ''
                    }`}
                    onClick={() => toggleSectorGroup(atcData[type].map((s) => s.id))}
                  >
                    {type} ({atcData[type].length})
                  </button>
                ))}
              </div>

              {/* 섹터 목록 */}
              {(['ACC', 'TMA', 'CTR'] as const).map((type) => (
                <div key={type} style={{ marginBottom: '8px' }}>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 'bold',
                      marginBottom: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onClick={() => toggleAtcSection(type)}
                  >
                    <span>{type}</span>
                    <span style={{ fontSize: '10px' }}>{atcExpanded[type] ? '▼' : '▶'}</span>
                  </div>
                  {atcExpanded[type] && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {atcData[type].map((s) => (
                        <label
                          key={s.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 6px',
                            fontSize: '10px',
                            background: selectedAtcSectors.has(s.id)
                              ? 'rgba(0,255,0,0.3)'
                              : 'rgba(255,255,255,0.1)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                          title={s.name}
                        >
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: s.color,
                            }}
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
        </Accordion>

        {/* Korea Airspace Panel */}
        <KoreaAirspacePanel
          koreaAirspaceData={koreaAirspaceData}
          koreaRoutesExpanded={koreaRoutesExpanded}
          setKoreaRoutesExpanded={setKoreaRoutesExpanded}
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
        />

        {/* Aircraft Control Panel */}
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

        {/* 비행 절차 (SID + STAR + APCH 통합) */}
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

        {/* 차트 오버레이 */}
        <ChartOverlayPanel
          chartsByRunway={chartsByRunway}
          expanded={chartExpanded}
          onToggle={() => setChartExpanded(!chartExpanded)}
          activeCharts={activeCharts}
          toggleChart={toggleChart}
          chartOpacities={chartOpacities}
          updateChartOpacity={updateChartOpacity}
          allChartBounds={allChartBounds}
          selectedAirport={selectedChartAirport}
          setSelectedAirport={setSelectedChartAirport}
          map={map}
        />

        <div className="section">
          <button className="fly-btn" onClick={flyToAirport}>
            공항으로 이동
          </button>
        </div>
      </div>
    </div>
  );
});

ControlPanel.displayName = 'ControlPanel';

export default ControlPanel;
