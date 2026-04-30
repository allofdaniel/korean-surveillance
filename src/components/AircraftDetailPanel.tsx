/**
 * AircraftDetailPanel Component
 * 항공기 상세 정보 패널 (FR24 스타일)
 * DO-278A 요구사항 추적: SRS-PERF-002
 */
import React, { useMemo } from 'react';
import type {
  AircraftData,
  AircraftPhoto,
  AircraftDetails,
  FlightSchedule,
  FlightTrack,
  TrackPoint,
  SectionExpandedState,
  GraphHoverData,
  DataWithAirport,
  AtcData,
  AirportDatabase,
  AirportInfo,
  AirspaceInfo,
  WaypointInfo,
  ProcedureInfo,
  FlightPhaseInfo,
} from './AircraftDetail/types';
import {
  AircraftPhotoSection,
  RouteSection,
  TakeoffLandingSection,
  FlightDataSection,
  FlightStatusSection,
  AircraftInfoSection,
  ScheduleSection,
  AltitudeGraphSection,
  PositionSection,
} from './AircraftDetail';

interface AircraftDetailPanelProps {
  showAircraftPanel: boolean;
  setShowAircraftPanel: (show: boolean) => void;
  selectedAircraft: AircraftData | null;
  setSelectedAircraft: (aircraft: AircraftData | null) => void;
  aircraft: AircraftData[];
  aircraftPhoto: AircraftPhoto | null;
  aircraftPhotoLoading: boolean;
  aircraftDetails: AircraftDetails | null;
  aircraftDetailsLoading: boolean;
  flightSchedule: FlightSchedule | null;
  flightScheduleLoading: boolean;
  flightTrack: FlightTrack | null;
  flightTrackLoading: boolean;
  aircraftTrails: Record<string, TrackPoint[]>;
  sectionExpanded: SectionExpandedState;
  toggleSection: (section: keyof SectionExpandedState) => void;
  graphHoverData: GraphHoverData | null;
  setGraphHoverData: (data: GraphHoverData | null) => void;
  data: DataWithAirport | null;
  atcData: AtcData | null;
  getAircraftImage: (type: string) => string;
  detectFlightPhase: (aircraft: AircraftData, airport?: AirportInfo) => FlightPhaseInfo;
  detectCurrentAirspace: (aircraft: AircraftData, atcData: AtcData | null) => AirspaceInfo[];
  findNearestWaypoints: (aircraft: AircraftData, waypoints: Record<string, unknown> | undefined, count: number) => WaypointInfo[];
  detectCurrentProcedure: (aircraft: AircraftData, procedures: unknown, phase: string) => ProcedureInfo | null;
  AIRPORT_DATABASE: AirportDatabase;
}

// React.memo removed — was no-op due to unstable ref props (refs change every render)
const AircraftDetailPanel: React.FC<AircraftDetailPanelProps> = ({
  showAircraftPanel,
  setShowAircraftPanel,
  selectedAircraft,
  setSelectedAircraft,
  aircraft,
  aircraftPhoto,
  aircraftPhotoLoading,
  aircraftDetails,
  aircraftDetailsLoading,
  flightSchedule,
  flightScheduleLoading,
  flightTrack,
  flightTrackLoading,
  aircraftTrails,
  sectionExpanded,
  toggleSection,
  graphHoverData,
  setGraphHoverData,
  data,
  atcData,
  getAircraftImage,
  detectFlightPhase,
  detectCurrentAirspace,
  findNearestWaypoints,
  detectCurrentProcedure,
  AIRPORT_DATABASE,
}) => {
  const liveAircraft = useMemo(
    () => aircraft.find(a => a.hex === selectedAircraft?.hex),
    [aircraft, selectedAircraft?.hex]
  );
  const displayAircraft = selectedAircraft ? liveAircraft || selectedAircraft : null;
  // 사진 또는 상세정보 로딩 중일 때만 로딩 표시 (데이터 없음으로 무한 로딩 방지)
  const isLoading = aircraftPhotoLoading || aircraftDetailsLoading;

  return (
    <div className={`aircraft-panel ${showAircraftPanel && displayAircraft ? 'open' : ''}`}>
      {showAircraftPanel && displayAircraft && (
        <div className="aircraft-panel-content">
          <div className="aircraft-panel-header">
            <div className="aircraft-header-main">
              <span className="aircraft-callsign">{displayAircraft.callsign || displayAircraft.hex}</span>
              <span className="aircraft-reg">{displayAircraft.registration || 'N/A'}</span>
            </div>
            <button className="aircraft-close-btn" onClick={() => { setShowAircraftPanel(false); setSelectedAircraft(null); }}>×</button>
          </div>

          {isLoading && (
            <div className="aircraft-panel-loading">
              <div className="spinner"></div>
              <span>항공기 정보 불러오는 중...</span>
            </div>
          )}

          <AircraftPhotoSection
            displayAircraft={displayAircraft}
            aircraftPhoto={aircraftPhoto}
            aircraftPhotoLoading={aircraftPhotoLoading}
            flightSchedule={flightSchedule}
            getAircraftImage={getAircraftImage}
          />

          <RouteSection
            displayAircraft={displayAircraft}
            flightSchedule={flightSchedule}
            flightScheduleLoading={flightScheduleLoading}
            AIRPORT_DATABASE={AIRPORT_DATABASE}
          />

          <TakeoffLandingSection
            flightSchedule={flightSchedule}
            flightTrack={flightTrack}
            flightTrackLoading={flightTrackLoading}
            aircraftTrails={aircraftTrails}
            aircraftHex={displayAircraft.hex}
            displayAircraft={displayAircraft}
            AIRPORT_DATABASE={AIRPORT_DATABASE}
          />

          <FlightDataSection displayAircraft={displayAircraft} />

          <FlightStatusSection
            displayAircraft={displayAircraft}
            data={data}
            atcData={atcData}
            sectionExpanded={sectionExpanded}
            toggleSection={toggleSection}
            detectFlightPhase={detectFlightPhase}
            detectCurrentAirspace={detectCurrentAirspace}
            findNearestWaypoints={findNearestWaypoints}
            detectCurrentProcedure={detectCurrentProcedure}
          />

          <AircraftInfoSection
            displayAircraft={displayAircraft}
            aircraftDetails={aircraftDetails}
            aircraftDetailsLoading={aircraftDetailsLoading}
            sectionExpanded={sectionExpanded}
            toggleSection={toggleSection}
          />

          <ScheduleSection
            flightSchedule={flightSchedule}
            flightScheduleLoading={flightScheduleLoading}
            sectionExpanded={sectionExpanded}
            toggleSection={toggleSection}
          />

          <AltitudeGraphSection
            displayAircraft={displayAircraft}
            flightTrack={flightTrack}
            flightTrackLoading={flightTrackLoading}
            aircraftTrails={aircraftTrails}
            graphHoverData={graphHoverData}
            setGraphHoverData={setGraphHoverData}
          />

          <PositionSection displayAircraft={displayAircraft} />
        </div>
      )}
    </div>
  );
};

AircraftDetailPanel.displayName = 'AircraftDetailPanel';

export default AircraftDetailPanel;
