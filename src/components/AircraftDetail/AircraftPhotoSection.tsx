import React from 'react';
import type { AircraftData, AircraftPhoto, FlightSchedule } from './types';

interface AircraftPhotoSectionProps {
  displayAircraft: AircraftData;
  aircraftPhoto: AircraftPhoto | null;
  aircraftPhotoLoading: boolean;
  flightSchedule: FlightSchedule | null;
  getAircraftImage: (type: string) => string;
}

/**
 * Aircraft Photo Section
 */
const AircraftPhotoSection: React.FC<AircraftPhotoSectionProps> = ({
  displayAircraft,
  aircraftPhoto,
  aircraftPhotoLoading,
  flightSchedule,
  getAircraftImage
}) => (
  <div className="aircraft-photo-section">
    {aircraftPhotoLoading && (
      <div className="aircraft-photo-loading">
        <div className="loading-spinner"></div>
      </div>
    )}
    {!aircraftPhotoLoading && (aircraftPhoto?.image || (flightSchedule?.aircraft_images && flightSchedule.aircraft_images.length > 0)) && (
      <img
        src={aircraftPhoto?.image || (typeof flightSchedule?.aircraft_images?.[0] === 'string' ? flightSchedule.aircraft_images[0] : flightSchedule?.aircraft_images?.[0]?.src)}
        alt={displayAircraft.registration || displayAircraft.callsign}
        className="aircraft-photo"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.src = getAircraftImage(displayAircraft.icao_type || displayAircraft.type || '');
          target.onerror = null;
        }}
      />
    )}
    {!aircraftPhotoLoading && !aircraftPhoto?.image && (!flightSchedule?.aircraft_images || flightSchedule.aircraft_images.length === 0) && (
      <img
        src={getAircraftImage(displayAircraft.icao_type || displayAircraft.type || '')}
        alt={displayAircraft.type || 'Aircraft'}
        className="aircraft-photo aircraft-photo-default"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    )}
    {aircraftPhoto?.image && aircraftPhoto?.photographer && (
      <div className="aircraft-photo-credit">
        {aircraftPhoto.photographer}
      </div>
    )}
    {!aircraftPhoto?.image && flightSchedule?.aircraft_images && flightSchedule.aircraft_images.length > 0 && (
      <div className="aircraft-photo-credit">
        FlightRadar24
      </div>
    )}
    {!aircraftPhoto?.image && (!flightSchedule?.aircraft_images || flightSchedule.aircraft_images.length === 0) && (displayAircraft.icao_type || displayAircraft.type) && (
      <div className="aircraft-photo-credit type-info">
        {displayAircraft.icao_type || displayAircraft.type}
      </div>
    )}
  </div>
);

export { AircraftPhotoSection };
export default AircraftPhotoSection;
