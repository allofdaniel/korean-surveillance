import React from 'react';
import type { FlightSchedule, SectionExpandedState } from './types';

interface ScheduleSectionProps {
  flightSchedule: FlightSchedule | null;
  flightScheduleLoading: boolean;
  sectionExpanded: SectionExpandedState;
  toggleSection: (section: keyof SectionExpandedState) => void;
}

/**
 * Schedule Section
 */
const ScheduleSection: React.FC<ScheduleSectionProps> = ({
  flightSchedule, flightScheduleLoading, sectionExpanded, toggleSection
}) => {
  if (!flightSchedule && !flightScheduleLoading) return null;

  return (
    <div className="aircraft-schedule-section collapsible-section">
      <div className="collapsible-header" onClick={() => toggleSection('schedule')}>
        <div className="section-title">
          스케줄 정보
          {flightScheduleLoading && <span className="loading-dot">...</span>}
          {flightSchedule?._source === 'ubikais' && <span className="data-source ubikais"> (UBIKAIS)</span>}
          {flightSchedule?._source === 'flightradar24' && <span className="data-source fr24"> (FR24)</span>}
        </div>
        <span className={`collapsible-icon ${sectionExpanded.schedule ? 'expanded' : ''}`}>▼</span>
      </div>
      <div className={`collapsible-content ${!sectionExpanded.schedule ? 'collapsed' : ''}`}>
        {flightSchedule && (
          <div className="schedule-grid">
            <div className="schedule-item">
              <span className="schedule-label">항공편</span>
              <span className="schedule-value">{flightSchedule.flight?.iata || flightSchedule.flight?.icao || '-'}</span>
            </div>
            <div className="schedule-item">
              <span className="schedule-label">상태</span>
              <span className={`schedule-value status-${flightSchedule.flight_status}`}>
                {flightSchedule.flight_status === 'DEP' ? '출발' :
                 flightSchedule.flight_status === 'ARR' ? '도착' :
                 flightSchedule.flight_status === 'DLA' ? '지연' :
                 flightSchedule.flight_status === 'CNL' ? '취소' :
                 flightSchedule.flight_status === 'active' ? '운항중' :
                 flightSchedule.flight_status === 'scheduled' ? '예정' :
                 flightSchedule.flight_status === 'landed' ? '착륙' :
                 flightSchedule.flight_status === 'cancelled' ? '취소' :
                 flightSchedule.flight_status || '-'}
              </span>
            </div>
            {flightSchedule.schedule?.nature && (
              <div className="schedule-item">
                <span className="schedule-label">유형</span>
                <span className={`schedule-value nature-${flightSchedule.schedule.nature}`}>
                  {flightSchedule.schedule.nature === 'PAX' ? '여객' :
                   flightSchedule.schedule.nature === 'CGO' ? '화물' :
                   flightSchedule.schedule.nature === 'STP' ? '기술착륙' :
                   flightSchedule.schedule.nature === 'GEN' ? '일반' :
                   flightSchedule.schedule.nature}
                </span>
              </div>
            )}
            {flightSchedule.aircraft_info?.type && (
              <div className="schedule-item">
                <span className="schedule-label">기종</span>
                <span className="schedule-value">{flightSchedule.aircraft_info.type}</span>
              </div>
            )}
            <div className="schedule-item">
              <span className="schedule-label">출발</span>
              <span className="schedule-value">
                {flightSchedule.departure?.iata || flightSchedule.departure?.icao || '-'}
                {flightSchedule.departure?.scheduled && (
                  <span className="schedule-time">
                    {new Date(flightSchedule.departure.scheduled).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}
                  </span>
                )}
              </span>
            </div>
            <div className="schedule-item">
              <span className="schedule-label">도착</span>
              <span className="schedule-value">
                {flightSchedule.arrival?.iata || flightSchedule.arrival?.icao || '-'}
                {flightSchedule.arrival?.scheduled && (
                  <span className="schedule-time">
                    {new Date(flightSchedule.arrival.scheduled).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}
                  </span>
                )}
              </span>
            </div>
            {flightSchedule.schedule && (
              <>
                <div className="schedule-item full-width schedule-note">
                  <span className="schedule-hint">출발: {flightSchedule.departure?.iata || flightSchedule.departure?.icao} 현지시각 / 도착: {flightSchedule.arrival?.iata || flightSchedule.arrival?.icao} 현지시각</span>
                </div>
                <div className="schedule-item">
                  <span className="schedule-label">계획 출발</span>
                  <span className="schedule-value">{flightSchedule.schedule.std || '-'}</span>
                </div>
                <div className="schedule-item">
                  <span className="schedule-label">예상 출발</span>
                  <span className="schedule-value">{flightSchedule.schedule.etd || '-'}</span>
                </div>
                {flightSchedule.schedule.atd && (
                  <div className="schedule-item">
                    <span className="schedule-label">실제 출발</span>
                    <span className="schedule-value highlight">{flightSchedule.schedule.atd}</span>
                  </div>
                )}
                <div className="schedule-item">
                  <span className="schedule-label">계획 도착</span>
                  <span className="schedule-value">{flightSchedule.schedule.sta || '-'}</span>
                </div>
                <div className="schedule-item">
                  <span className="schedule-label">예상 도착</span>
                  <span className="schedule-value">{flightSchedule.schedule.eta || '-'}</span>
                </div>
              </>
            )}
            {flightSchedule.departure?.delay && (
              <div className="schedule-item full-width">
                <span className="schedule-label">지연</span>
                <span className="schedule-value delay">{flightSchedule.departure.delay}분</span>
              </div>
            )}
            {flightSchedule.departure?.gate && (
              <div className="schedule-item">
                <span className="schedule-label">출발 게이트</span>
                <span className="schedule-value">{flightSchedule.departure.gate}</span>
              </div>
            )}
            {flightSchedule.arrival?.gate && (
              <div className="schedule-item">
                <span className="schedule-label">도착 게이트</span>
                <span className="schedule-value">{flightSchedule.arrival.gate}</span>
              </div>
            )}
            {flightSchedule._lastUpdated && (
              <div className="schedule-item full-width">
                <span className="schedule-label">데이터 시각</span>
                <span className="schedule-value small">{flightSchedule._lastUpdated}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export { ScheduleSection };
export default ScheduleSection;
