import React from 'react';
import type {
  AircraftData,
  AirportInfo,
  AtcData,
  SectionExpandedState,
  AirspaceInfo,
  WaypointInfo,
  ProcedureInfo,
  FlightPhaseInfo,
  DataWithAirport,
} from './types';

interface FlightStatusSectionProps {
  displayAircraft: AircraftData;
  data: DataWithAirport | null;
  atcData: AtcData | null;
  sectionExpanded: SectionExpandedState;
  toggleSection: (section: keyof SectionExpandedState) => void;
  detectFlightPhase: (aircraft: AircraftData, airport?: AirportInfo) => FlightPhaseInfo;
  detectCurrentAirspace: (aircraft: AircraftData, atcData: AtcData | null) => AirspaceInfo[];
  findNearestWaypoints: (aircraft: AircraftData, waypoints: Record<string, unknown> | undefined, count: number) => WaypointInfo[];
  detectCurrentProcedure: (aircraft: AircraftData, procedures: unknown, phase: string) => ProcedureInfo | null;
}

/**
 * Flight Status Section
 */
const FlightStatusSection: React.FC<FlightStatusSectionProps> = ({
  displayAircraft, data, atcData, sectionExpanded, toggleSection,
  detectFlightPhase, detectCurrentAirspace, findNearestWaypoints, detectCurrentProcedure
}) => {
  const flightPhase = detectFlightPhase(displayAircraft, data?.airport);
  const currentAirspaces = detectCurrentAirspace(displayAircraft, atcData);
  const nearestWaypoints = findNearestWaypoints(displayAircraft, data?.waypoints, 3);
  const currentProcedure = detectCurrentProcedure(displayAircraft, data?.procedures, flightPhase.phase);

  return (
    <div className="flight-status-section collapsible-section">
      <div className="collapsible-header" onClick={() => toggleSection('flightStatus')}>
        <div className="section-title">비행 상태</div>
        <span className={`collapsible-icon ${sectionExpanded.flightStatus ? 'expanded' : ''}`}>▼</span>
      </div>
      <div className={`collapsible-content ${!sectionExpanded.flightStatus ? 'collapsed' : ''}`}>
        <div className="status-item flight-phase">
          <span className="status-label">비행 단계</span>
          <span className="status-value" style={{ color: flightPhase.color }}>
            {flightPhase.icon} {flightPhase.phase_kr}
          </span>
        </div>

        {currentAirspaces.length > 0 && (
          <div className="status-item airspace-info">
            <span className="status-label">현재 공역</span>
            <div className="status-value-list">
              {currentAirspaces.slice(0, 3).map((as, idx) => (
                <div key={idx} className="airspace-chip" style={{ borderColor: as.color || '#64b5f6' }}>
                  <span className="airspace-type">{as.type}</span>
                  <span className="airspace-name">{as.name}</span>
                  {as.frequencies && as.frequencies[0] && (
                    <span className="airspace-freq">{as.frequencies[0]}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {currentProcedure && (
          <div className="status-item procedure-info">
            <span className="status-label">현재 절차</span>
            <span className="status-value procedure">
              <span className="procedure-type">{currentProcedure.type}</span>
              {currentProcedure.name}
            </span>
          </div>
        )}

        {nearestWaypoints.length > 0 && (
          <div className="status-item waypoint-info">
            <span className="status-label">다음 경유지</span>
            <div className="waypoint-list">
              {nearestWaypoints.map((wp, idx) => (
                <div key={idx} className="waypoint-item">
                  <span className="waypoint-ident">{wp.ident}</span>
                  <span className="waypoint-dist">{wp.distance_nm.toFixed(1)} NM</span>
                  {wp.etaMinutes && (
                    <span className="waypoint-eta">
                      {wp.etaMinutes < 1 ? '<1분' : `${Math.round(wp.etaMinutes)}분`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { FlightStatusSection };
export default FlightStatusSection;
