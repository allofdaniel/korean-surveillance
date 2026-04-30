import React from 'react';
import type { AircraftData, FlightTrack, TrackPoint, GraphHoverData } from './types';

interface AltitudeGraphSectionProps {
  displayAircraft: AircraftData;
  flightTrack: FlightTrack | null;
  flightTrackLoading: boolean;
  aircraftTrails: Record<string, TrackPoint[]>;
  graphHoverData: GraphHoverData | null;
  setGraphHoverData: (data: GraphHoverData | null) => void;
}

/**
 * Altitude Graph Section
 */
const AltitudeGraphSection: React.FC<AltitudeGraphSectionProps> = ({
  displayAircraft, flightTrack, flightTrackLoading, aircraftTrails, graphHoverData, setGraphHoverData
}) => {
  const historicalData = flightTrack?.path || [];
  const realtimeData = aircraftTrails[displayAircraft.hex] || [];

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
  } else if (historicalData.length > 0) {
    trackData = historicalData;
  } else {
    trackData = realtimeData;
  }

  let startIdx = 0;
  for (let i = 0; i < Math.min(trackData.length, 20); i++) {
    const pt = trackData[i];
    if (!pt) continue;
    if (pt.on_ground === true || (pt.altitude_ft !== undefined && pt.altitude_ft < 100)) {
      startIdx = i + 1;
    } else {
      break;
    }
  }
  if (startIdx > 0 && startIdx < trackData.length) {
    trackData = trackData.slice(startIdx);
  }

  if (trackData.length < 4) return null;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>): void => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 320;
    const validAltData = trackData.filter(t => typeof t.altitude_ft === 'number' && !isNaN(t.altitude_ft) && t.altitude_ft >= 0);
    if (validAltData.length < 2 || x < 30 || x > 310) { setGraphHoverData(null); return; }
    const xScale = 280 / Math.max(validAltData.length - 1, 1);
    const idx = Math.round((x - 30) / xScale);
    const dp = validAltData[Math.max(0, Math.min(idx, validAltData.length - 1))];
    if (dp) {
      setGraphHoverData({
        time: dp.time ? new Date(dp.time * 1000).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : dp.timestamp ? new Date(dp.timestamp).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : null,
        altitude: dp.altitude_ft || 0, x: (x / 320) * 100
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>): void => {
    const touch = e.touches[0];
    if (!touch) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * 320;
    // Only block native scroll when the touch is actually over the graph area
    if (x >= 0 && x <= rect.width) {
      e.preventDefault();
    }
    const validAltData = trackData.filter(t => typeof t.altitude_ft === 'number' && !isNaN(t.altitude_ft) && t.altitude_ft >= 0);
    if (validAltData.length < 2 || x < 30 || x > 310) { setGraphHoverData(null); return; }
    const xScale = 280 / Math.max(validAltData.length - 1, 1);
    const idx = Math.round((x - 30) / xScale);
    const dp = validAltData[Math.max(0, Math.min(idx, validAltData.length - 1))];
    if (dp) {
      setGraphHoverData({
        time: dp.time ? new Date(dp.time * 1000).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : dp.timestamp ? new Date(dp.timestamp).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : null,
        altitude: dp.altitude_ft || 0, x: (x / 320) * 100
      });
    }
  };

  const renderGraph = (): React.ReactNode => {
    const validAltData = trackData.filter(t => typeof t.altitude_ft === 'number' && !isNaN(t.altitude_ft) && t.altitude_ft >= 0);
    if (validAltData.length < 2) return null;

    const altitudes = validAltData.map(t => t.altitude_ft || 0);
    const maxAlt = altitudes.reduce((m, a) => Math.max(m, a), 1000);
    const minAlt = Math.min(...altitudes.filter(a => a > 0), 0);
    const xScale = 280 / Math.max(validAltData.length - 1, 1);
    const altRange = Math.max(maxAlt - minAlt, 1000);

    const altPath = validAltData.map((t, i) => {
      const x = 30 + i * xScale;
      const y = 105 - (((t.altitude_ft || 0) - minAlt) / altRange) * 90;
      if (isNaN(x) || isNaN(y)) return '';
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).filter(p => p).join(' ');

    if (!altPath || altPath.length < 5) return null;
    const altArea = altPath + ` L310,105 L30,105 Z`;

    return (
      <>
        <path d={altArea} fill="url(#altGradient)" />
        <path d={altPath} fill="none" stroke="#64b5f6" strokeWidth="2" />
      </>
    );
  };

  const renderYAxisLabels = (): React.ReactNode => {
    if (trackData.length < 2) return null;
    const maxAlt = Math.max(...trackData.map(t => t.altitude_ft || 0), 1000);
    return (
      <>
        <text x="5" y="15" fill="#64b5f6" fontSize="8">{(maxAlt / 1000).toFixed(0)}k</text>
        <text x="5" y="108" fill="#64b5f6" fontSize="8">0</text>
        {graphHoverData && <line x1={graphHoverData.x * 3.2} y1="10" x2={graphHoverData.x * 3.2} y2="105" stroke="#fff" strokeWidth="1" strokeDasharray="3,3" />}
      </>
    );
  };

  const renderGraphSummary = (): React.ReactNode => {
    const validAltData = trackData.filter(t => typeof t.altitude_ft === 'number' && !isNaN(t.altitude_ft) && t.altitude_ft >= 0);
    if (validAltData.length < 2) return null;
    const fp = validAltData[0], lp = validAltData[validAltData.length - 1];
    if (!fp || !lp) return null;

    const fpTimestamp = fp.time ? fp.time * 1000 : fp.timestamp || 0;
    const lpTimestamp = lp.time ? lp.time * 1000 : lp.timestamp || 0;

    const startTime = fpTimestamp ? new Date(fpTimestamp).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : null;
    const isRecent = Date.now() - lpTimestamp < 120000;
    const endTime = isRecent ? '현재' : (lpTimestamp ? new Date(lpTimestamp).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : '현재');

    const durationMs = lpTimestamp - fpTimestamp;
    const durationMins = Math.round(durationMs / 60000);
    const durationHours = Math.floor(durationMins / 60);
    const durationRemMins = durationMins % 60;
    const durationStr = durationHours > 0
      ? `${durationHours}시간 ${durationRemMins}분`
      : `${durationMins}분`;

    const altChange = (lp.altitude_ft || 0) - (fp.altitude_ft || 0);

    return (
      <div className="graph-summary">
        <span className="flight-duration">{startTime || '--:--'} ~ {endTime} KST ({durationStr})</span>
        <span className={`alt-change ${altChange > 500 ? 'climbing' : altChange < -500 ? 'descending' : ''}`}>
          {fp.altitude_ft?.toLocaleString()}ft → {lp.altitude_ft?.toLocaleString()}ft ({altChange > 0 ? '+' : ''}{altChange?.toLocaleString()}ft)
        </span>
      </div>
    );
  };

  const hasHistorical = historicalData.length > 0;
  const hasRealtime = realtimeData.length > 0;
  const trinoSource = flightTrack?.source === 'trino';
  const sourceLabel = trinoSource
    ? (hasRealtime ? ' (Trino + 실시간)' : ' (Trino 전체이력)')
    : hasHistorical && hasRealtime ? ' (OpenSky + 실시간)' : hasHistorical ? ' (OpenSky)' : hasRealtime ? ' (실시간)' : '';

  return (
    <div className="aircraft-graph-section">
      <div className="section-title">
        비행 고도 그래프
        {flightTrackLoading && <span className="loading-dot">...</span>}
        <span className="graph-source">{sourceLabel}</span>
      </div>
      <div className="graph-container" style={{ position: "relative" }}>
        <svg
          viewBox="0 0 320 120"
          className="flight-graph"
          style={{ cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => setGraphHoverData(null)}
          onMouseLeave={() => setGraphHoverData(null)}
        >
          <defs>
            <linearGradient id="altGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(100,181,246,0.3)" />
              <stop offset="100%" stopColor="rgba(100,181,246,0)" />
            </linearGradient>
          </defs>
          {[0, 25, 50, 75, 100].map(y => (
            <line key={y} x1="30" y1={10 + y} x2="310" y2={10 + y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          ))}
          {renderGraph()}
          {renderYAxisLabels()}
        </svg>
        {graphHoverData && (
          <div className="graph-hover-tooltip" style={{ left: `${Math.min(Math.max(graphHoverData.x, 15), 85)}%`, transform: 'translateX(-50%)' }}>
            <div className="tooltip-altitude">{graphHoverData.altitude?.toLocaleString()} ft</div>
            {graphHoverData.time && <div className="tooltip-time">{graphHoverData.time}</div>}
          </div>
        )}
        <div className="graph-info">
          {renderGraphSummary()}
        </div>
      </div>
    </div>
  );
};

export { AltitudeGraphSection };
export default AltitudeGraphSection;
