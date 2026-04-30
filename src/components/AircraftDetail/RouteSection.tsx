import React from 'react';
import type { AircraftData, FlightSchedule, AirportDatabase } from './types';

interface RouteSectionProps {
  displayAircraft: AircraftData;
  flightSchedule: FlightSchedule | null;
  flightScheduleLoading: boolean;
  AIRPORT_DATABASE: AirportDatabase;
}

/**
 * Route Display Section
 */
const RouteSection: React.FC<RouteSectionProps> = ({ displayAircraft, flightSchedule, flightScheduleLoading, AIRPORT_DATABASE }) => (
  <div className="aircraft-route-section">
    <div className="route-display">
      <div className="route-airport origin">
        <span className="route-code">
          {flightSchedule?.departure?.iata || displayAircraft.origin || '???'}
        </span>
        <span className="route-name">
          {flightSchedule?.departure?.airport || AIRPORT_DATABASE[displayAircraft.origin || '']?.name || ''}
        </span>
        {(flightSchedule?.schedule?.std || flightSchedule?.schedule?.etd || flightSchedule?.departure?.scheduled) && (
          <span className="route-time">
            {flightSchedule?.schedule?.std || flightSchedule?.schedule?.etd ||
             (flightSchedule?.departure?.scheduled ? new Date(flightSchedule.departure.scheduled).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : '')}
          </span>
        )}
      </div>
      <div className="route-arrow">
        <div className="route-line"></div>
        <span className="route-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 6h8M7 3l3 3-3 3"/>
          </svg>
        </span>
        <div className="route-line"></div>
      </div>
      <div className="route-airport destination">
        <span className="route-code">
          {flightSchedule?.arrival?.iata || displayAircraft.destination || '???'}
        </span>
        <span className="route-name">
          {flightSchedule?.arrival?.airport || AIRPORT_DATABASE[displayAircraft.destination || '']?.name || ''}
        </span>
        {(flightSchedule?.schedule?.sta || flightSchedule?.schedule?.eta || flightSchedule?.arrival?.scheduled) && (
          <span className="route-time">
            {flightSchedule?.schedule?.sta || flightSchedule?.schedule?.eta ||
             (flightSchedule?.arrival?.scheduled ? new Date(flightSchedule.arrival.scheduled).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : '')}
          </span>
        )}
      </div>
    </div>
    {flightScheduleLoading && (
      <div className="route-loading">스케줄 조회중...</div>
    )}
  </div>
);

export { RouteSection };
export default RouteSection;
