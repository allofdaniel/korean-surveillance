import React from 'react';
import type { AircraftData, FlightSchedule, FlightTrack, TrackPoint, AirportDatabase } from './types';

interface TakeoffLandingSectionProps {
  flightSchedule: FlightSchedule | null;
  flightTrack: FlightTrack | null;
  flightTrackLoading: boolean;
  aircraftTrails: Record<string, TrackPoint[]>;
  aircraftHex: string;
  displayAircraft: AircraftData;
  AIRPORT_DATABASE: AirportDatabase;
}

/**
 * Takeoff/Landing Time Section
 */
const TakeoffLandingSection: React.FC<TakeoffLandingSectionProps> = ({
  flightSchedule, flightTrack, flightTrackLoading, aircraftTrails, aircraftHex, displayAircraft, AIRPORT_DATABASE
}) => {
  const getActualTakeoffTime = (): number | null => {
    const historicalData = flightTrack?.path || [];
    const realtimeData = aircraftTrails?.[aircraftHex] || [];

    if (historicalData.length === 0) return null;

    let trackData: TrackPoint[] = [];

    if (historicalData.length > 0 && realtimeData.length > 0) {
      const lastHistorical = historicalData[historicalData.length - 1];
      if (!lastHistorical) return null;
      const lastHistTime = lastHistorical.time ? lastHistorical.time * 1000 : lastHistorical.timestamp || 0;

      const newerRealtimeData = realtimeData.filter(rt => {
        const rtTime = rt.timestamp || 0;
        return rtTime > lastHistTime;
      });

      trackData = [...historicalData, ...newerRealtimeData];
    } else {
      trackData = historicalData;
    }

    let startIdx = 0;
    for (let i = 0; i < Math.min(trackData.length, 20); i++) {
      const pt = trackData[i];
      if (!pt) continue;
      const altFt = pt.altitude_ft !== undefined ? pt.altitude_ft : (pt.altitude_m ? pt.altitude_m * 3.28084 : 0);
      if (pt.on_ground === true || altFt < 100) {
        startIdx = i + 1;
      } else {
        break;
      }
    }
    if (startIdx > 0 && startIdx < trackData.length) {
      trackData = trackData.slice(startIdx);
    }

    if (trackData.length > 0) {
      const firstPoint = trackData[0];
      if (!firstPoint) return null;
      const timestamp = firstPoint.time ? firstPoint.time * 1000 : firstPoint.timestamp;
      return timestamp || null;
    }
    return null;
  };

  const getDistanceToDestination = (): number | null => {
    const destIcao = flightSchedule?.arrival?.icao;
    const dest = destIcao ? AIRPORT_DATABASE[destIcao] : null;
    if (!destIcao || !dest) return null;

    const lat1 = displayAircraft?.lat;
    const lon1 = displayAircraft?.lon;
    const lat2 = dest.lat;
    const lon2 = dest.lon;

    if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) return null;

    // All four are confirmed finite numbers after guard — cast to satisfy TS strict index types
    const lat1n = lat1 as number;
    const lon1n = lon1 as number;
    const lat2n = lat2 as number;
    const lon2n = lon2 as number;

    const R = 3440.065;
    const dLat = (lat2n - lat1n) * Math.PI / 180;
    const dLon = (lon2n - lon1n) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1n * Math.PI / 180) * Math.cos(lat2n * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getEstimatedArrival = (): Date | null => {
    const distanceNM = getDistanceToDestination();
    const groundSpeed = displayAircraft?.ground_speed;

    if (!distanceNM || !groundSpeed || groundSpeed < 50) return null;

    const DESCENT_BUFFER_MIN = 15; // descent + approach + landing buffer
    const hoursRemaining = distanceNM / groundSpeed;
    const totalMinutes = hoursRemaining * 60 + DESCENT_BUFFER_MIN;

    const arrivalTime = new Date(Date.now() + totalMinutes * 60 * 1000);
    return arrivalTime;
  };

  const actualTakeoffTime = getActualTakeoffTime();
  const estimatedArrival = getEstimatedArrival();
  const distanceToDestNM = getDistanceToDestination();

  if (flightTrackLoading) {
    return (
      <div className="takeoff-landing-section loading">
        <div className="takeoff-landing-grid">
          <div className="tl-item takeoff">
            <span className="tl-label">이륙</span>
            <span className="tl-time loading-placeholder">--:--</span>
          </div>
          <div className="tl-item landing">
            <span className="tl-label">착륙 예정</span>
            <span className="tl-time loading-placeholder">--:--</span>
          </div>
        </div>
      </div>
    );
  }

  if (!actualTakeoffTime && !estimatedArrival) return null;

  const takeoffTimeStr = actualTakeoffTime
    ? new Date(actualTakeoffTime).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})
    : '--:--';

  const arrivalTimeStr = estimatedArrival
    ? estimatedArrival.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})
    : '--:--';

  const getTimeRemaining = (): string | null => {
    if (!distanceToDestNM || !displayAircraft?.ground_speed || displayAircraft.ground_speed < 50) return null;
    const minutes = Math.round((distanceToDestNM / displayAircraft.ground_speed) * 60);
    if (minutes < 60) return `${minutes}분`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}시간 ${mins}분`;
  };

  return (
    <div className="takeoff-landing-section">
      <div className="takeoff-landing-grid">
        <div className={`tl-item takeoff ${actualTakeoffTime ? '' : 'estimated'}`}>
          <span className="tl-label">이륙</span>
          <span className="tl-time">{takeoffTimeStr}</span>
        </div>
        <div className="tl-item landing estimated">
          <span className="tl-label">착륙 예정</span>
          <span className="tl-time">{arrivalTimeStr}</span>
          {getTimeRemaining() && (
            <span className="tl-remaining">({getTimeRemaining()} 후)</span>
          )}
        </div>
      </div>
      {distanceToDestNM && (
        <div className="distance-remaining">
          도착까지 {Math.round(distanceToDestNM)} NM
        </div>
      )}
    </div>
  );
};

export { TakeoffLandingSection };
export default TakeoffLandingSection;
