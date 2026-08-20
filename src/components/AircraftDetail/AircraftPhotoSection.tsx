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
}) => {
  const photoUrl = aircraftPhoto?.image ||
    (typeof flightSchedule?.aircraft_images?.[0] === 'string'
      ? flightSchedule.aircraft_images[0]
      : flightSchedule?.aircraft_images?.[0]?.src) ||
    getAircraftImage(displayAircraft.icao_type || displayAircraft.type || '');

  return (
    <div className="aircraft-photo-section">
      {aircraftPhotoLoading && (
        <div className="aircraft-photo-loading">
          <div className="loading-spinner"></div>
        </div>
      )}
      {!aircraftPhotoLoading && photoUrl && (
        <img
          src={photoUrl}
          alt={displayAircraft.registration || displayAircraft.callsign || 'Aircraft'}
          className="aircraft-photo"
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            const fallback = getAircraftImage(displayAircraft.icao_type || displayAircraft.type || '');
            if (target.src !== fallback) {
              target.src = fallback;
            }
          }}
        />
      )}
      {aircraftPhoto?.image && aircraftPhoto?.photographer && (
        <div className="aircraft-photo-credit">
          {aircraftPhoto.link ? (
            <a href={aircraftPhoto.link} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
              📷 {aircraftPhoto.photographer}
            </a>
          ) : (
            <span>📷 {aircraftPhoto.photographer}</span>
          )}
        </div>
      )}
      {!aircraftPhoto?.image && flightSchedule?.aircraft_images && flightSchedule.aircraft_images.length > 0 && (
        <div className="aircraft-photo-credit">
          📷 FlightRadar24
        </div>
      )}
      {!aircraftPhoto?.image && (!flightSchedule?.aircraft_images || flightSchedule.aircraft_images.length === 0) && (displayAircraft.icao_type || displayAircraft.type) && (
        <div className="aircraft-photo-credit type-info">
          ✈️ {displayAircraft.icao_type || displayAircraft.type}
        </div>
      )}
    </div>
  );
};

export { AircraftPhotoSection };
export default AircraftPhotoSection;
