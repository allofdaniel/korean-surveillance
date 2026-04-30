import React from 'react';
import type { AircraftData } from './types';

interface PositionSectionProps {
  displayAircraft: AircraftData;
}

/**
 * Position Info Section
 */
const PositionSection: React.FC<PositionSectionProps> = ({ displayAircraft }) => (
  <div className="aircraft-position-section">
    <div className="section-title">위치 정보</div>
    <div className="position-data">
      <div className="position-item">
        <span className="pos-label">LAT</span>
        <span className="pos-value">{displayAircraft.lat?.toFixed(5) || '-'}</span>
      </div>
      <div className="position-item">
        <span className="pos-label">LON</span>
        <span className="pos-value">{displayAircraft.lon?.toFixed(5) || '-'}</span>
      </div>
    </div>
    <div className="data-source">
      <span>ADS-B: airplanes.live | 기체DB: hexdb.io</span>
    </div>
  </div>
);

export { PositionSection };
export default PositionSection;
