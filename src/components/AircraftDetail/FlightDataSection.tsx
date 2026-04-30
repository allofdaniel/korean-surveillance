import React from 'react';
import type { AircraftData } from './types';

interface FlightDataSectionProps {
  displayAircraft: AircraftData;
}

/**
 * Flight Data Grid Section
 */
const FlightDataSection: React.FC<FlightDataSectionProps> = ({ displayAircraft }) => (
  <div className="aircraft-data-section">
    <div className="data-row">
      <div className="data-item">
        <span className="data-label">고도</span>
        <span className="data-value">{(displayAircraft.altitude_ft || 0).toLocaleString()} ft</span>
      </div>
      <div className="data-item">
        <span className="data-label">속도</span>
        <span className="data-value">{displayAircraft.ground_speed || 0} kt</span>
      </div>
      <div className="data-item">
        <span className="data-label">방향</span>
        <span className="data-value">{Math.round(displayAircraft.track || 0)}°</span>
      </div>
    </div>
    <div className="data-row">
      <div className="data-item">
        <span className="data-label">수직속도</span>
        <span className={`data-value ${(displayAircraft.vertical_rate || 0) > 100 ? 'climbing' : (displayAircraft.vertical_rate || 0) < -100 ? 'descending' : ''}`}>
          {(displayAircraft.vertical_rate || 0) > 0 ? '+' : ''}{displayAircraft.vertical_rate || 0} fpm
        </span>
      </div>
      <div className="data-item">
        <span className="data-label">Squawk</span>
        <span className={`data-value squawk ${['7700', '7600', '7500'].includes(displayAircraft.squawk || '') ? 'emergency' : ''}`}>
          {displayAircraft.squawk || '----'}
        </span>
      </div>
    </div>
  </div>
);

export { FlightDataSection };
export default FlightDataSection;
