import type { AircraftData } from '../hooks/useAircraftData';

interface AccessibleAircraftListProps {
  aircraft: AircraftData[];
}

export default function AccessibleAircraftList({ aircraft }: AccessibleAircraftListProps) {
  return (
    <div role="region" aria-live="polite" aria-atomic="false" className="sr-only">
      <p>현재 추적 중인 항공기 {aircraft.length}대</p>
      <ul>
        {aircraft.slice(0, 50).map(ac => (
          <li key={ac.hex}>
            {ac.callsign || ac.hex} 고도 {ac.altitude_ft}피트 속도 {ac.ground_speed}노트 침로 {Math.round(ac.track || 0)}도
          </li>
        ))}
      </ul>
    </div>
  );
}
