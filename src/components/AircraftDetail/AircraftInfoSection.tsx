import React from 'react';
import type { AircraftData, AircraftDetails, SectionExpandedState } from './types';

interface AircraftInfoSectionProps {
  displayAircraft: AircraftData;
  aircraftDetails: AircraftDetails | null;
  aircraftDetailsLoading: boolean;
  sectionExpanded: SectionExpandedState;
  toggleSection: (section: keyof SectionExpandedState) => void;
}

/**
 * Aircraft Info Section
 */
const AircraftInfoSection: React.FC<AircraftInfoSectionProps> = ({
  displayAircraft, aircraftDetails, aircraftDetailsLoading, sectionExpanded, toggleSection
}) => (
  <div className="aircraft-info-section collapsible-section">
    <div className="collapsible-header" onClick={() => toggleSection('aircraftInfo')}>
      <div className="section-title">
        기체 정보
        {aircraftDetailsLoading && <span className="loading-dot">...</span>}
      </div>
      <span className={`collapsible-icon ${sectionExpanded.aircraftInfo ? 'expanded' : ''}`}>▼</span>
    </div>
    <div className={`collapsible-content ${!sectionExpanded.aircraftInfo ? 'collapsed' : ''}`}>
      <div className="info-grid">
        <div className="info-item">
          <span className="info-label">기종</span>
          <span className="info-value">{aircraftDetails?.Type || displayAircraft.icao_type || displayAircraft.type || '-'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">등록번호</span>
          <span className="info-value">{aircraftDetails?.Registration || displayAircraft.registration || '-'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Mode-S Hex</span>
          <span className="info-value hex">{displayAircraft.hex?.toUpperCase() || '-'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">운항사</span>
          <span className="info-value">{aircraftDetails?.RegisteredOwners || '-'}</span>
        </div>
        {aircraftDetails?.ICAOTypeCode && (
          <div className="info-item">
            <span className="info-label">ICAO 기종코드</span>
            <span className="info-value">{aircraftDetails.ICAOTypeCode}</span>
          </div>
        )}
        {aircraftDetails?.OperatorFlagCode && (
          <div className="info-item">
            <span className="info-label">운항사 코드</span>
            <span className="info-value">{aircraftDetails.OperatorFlagCode}</span>
          </div>
        )}
        {aircraftDetails?.Manufacturer && (
          <div className="info-item full-width">
            <span className="info-label">제조사</span>
            <span className="info-value">{aircraftDetails.Manufacturer}</span>
          </div>
        )}
      </div>
    </div>
  </div>
);

export { AircraftInfoSection };
export default AircraftInfoSection;
