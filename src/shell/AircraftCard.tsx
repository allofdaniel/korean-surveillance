import React, { useEffect, useMemo, useState, type MutableRefObject } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { X, Crosshair, Plane } from 'lucide-react';
import type { AircraftData, TrailPoint } from '../hooks/useAircraftData';
import type { AircraftPhoto, FlightScheduleData } from '../hooks/useSelectedAircraft';
import { AIRPORT_DATABASE } from '../constants/airports';
import { KOREAN_NAMES } from './data';

interface AircraftCardProps {
  map: MutableRefObject<MapboxMap | null>;
  /** live record (updates every poll) */
  ac: AircraftData;
  photo: AircraftPhoto | null;
  schedule: FlightScheduleData | null;
  trail: TrailPoint[] | undefined;
  onClose: () => void;
}

const EMERG: Record<string, string> = { '7500': '불법간섭', '7600': '통신두절', '7700': '비상' };

function fl(ft: number): string {
  if (!Number.isFinite(ft)) return '—';
  return ft >= 14000 ? `FL${Math.round(ft / 100).toString().padStart(3, '0')}` : `${Math.round(ft).toLocaleString()} ft`;
}

function phase(ac: AircraftData): string {
  if (ac.on_ground) return ac.ground_speed > 40 ? '이착륙 활주' : '지상';
  const vs = ac.vertical_rate || 0;
  if (vs > 400) return ac.altitude_ft < 10000 ? '이륙 상승' : '상승';
  if (vs < -400) return ac.altitude_ft < 10000 ? '접근' : '강하';
  return '순항';
}

function airportName(code?: string): string {
  if (!code) return '';
  const k = KOREAN_NAMES[code];
  if (k) return k;
  const a = (AIRPORT_DATABASE as Record<string, { name?: string }>)[code];
  return a?.name || '';
}

/** Small altitude profile from the trail (last ≤ 30 min). */
function Profile({ trail }: { trail: TrailPoint[] }): React.ReactElement | null {
  const pts = trail.filter(p => Number.isFinite(p.altitude_ft ?? p.altitude_m));
  if (pts.length < 3) return null;
  const t0 = pts[0]!.timestamp, t1 = pts[pts.length - 1]!.timestamp;
  const alt = (p: TrailPoint): number => p.altitude_ft ?? p.altitude_m * 3.28084;
  const maxA = Math.max(1000, ...pts.map(alt));
  const W = 300, H = 56;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(((p.timestamp - t0) / Math.max(1, t1 - t0)) * W).toFixed(1)},${(H - (alt(p) / maxA) * (H - 6) - 3).toFixed(1)}`).join('');
  return (
    <div className="ks-ac-profile" aria-label="고도 변화">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
        <path d={`${d}L${W},${H}L0,${H}Z`} className="area" />
        <path d={d} className="line" />
      </svg>
      <div className="ks-ac-profile-k"><span>{Math.round((t1 - t0) / 60000)}분 전</span><span>최고 {fl(maxA)}</span><span>지금</span></div>
    </div>
  );
}

export default function AircraftCard({ map, ac, photo, schedule, trail, onClose }: AircraftCardProps): React.ReactElement {
  const [follow, setFollow] = useState(false);

  // follow mode: keep the aircraft centred as it moves (any manual drag cancels it)
  useEffect(() => {
    const m = map.current;
    if (!follow || !m) return;
    m.easeTo({ center: [ac.lon, ac.lat], duration: 900, essential: true });
  }, [follow, ac.lat, ac.lon, map]);
  useEffect(() => {
    const m = map.current;
    if (!follow || !m) return;
    const stop = (): void => setFollow(false);
    m.on('dragstart', stop);
    return () => { m.off('dragstart', stop); };
  }, [follow, map]);
  useEffect(() => { setFollow(false); }, [ac.hex]);

  const orig = schedule?.departure?.icao || schedule?.origin?.icao || ac.origin || '';
  const dest = schedule?.arrival?.icao || schedule?.destination?.icao || ac.destination || '';
  const emerg = EMERG[ac.squawk];
  const vs = ac.vertical_rate || 0;
  const recent = useMemo(() => (trail || []).filter(p => Date.now() - p.timestamp < 30 * 60 * 1000), [trail]);
  const callsign = (ac.callsign || '').trim() || ac.hex.toUpperCase();
  // some feeds (MLAT / partial ADS-B) carry no velocity — show a dash instead of a fake 0 kt / 000°
  const noVector = !ac.on_ground && !(ac.ground_speed > 0);

  return (
    <aside className={`ks-ac-card ${emerg ? 'emerg' : ''}`} aria-label={`${callsign} 항공기 정보`}>
      <header className="ks-ac-head">
        <div className="t">
          <b className="ks-mono">{callsign}</b>
          <small>{[ac.icao_type || ac.type, ac.registration, ac.operator].filter(v => v && v !== 'Unknown').join(' · ') || ac.hex.toUpperCase()}</small>
        </div>
        <button type="button" className="ks-icon-btn" aria-pressed={follow} onClick={() => setFollow(f => !f)} title={follow ? '따라가기 끄기' : '지도에서 따라가기'} aria-label="따라가기">
          <Crosshair size={16} />
        </button>
        <button type="button" className="ks-icon-btn" onClick={onClose} aria-label="닫기"><X size={17} /></button>
      </header>

      {emerg && <div className="ks-ac-emerg">SQUAWK {ac.squawk} · {emerg}</div>}

      {photo?.image && (
        <figure className="ks-ac-photo">
          <img src={photo.image} alt={`${ac.registration || callsign} 사진`} loading="lazy" />
          {photo.photographer && <figcaption>© {photo.photographer}</figcaption>}
        </figure>
      )}

      {(orig || dest) && (
        <div className="ks-ac-route">
          <div><b className="ks-mono">{orig || '—'}</b><small>{airportName(orig)}</small></div>
          <Plane size={15} className="arrow" />
          <div className="r"><b className="ks-mono">{dest || '—'}</b><small>{airportName(dest)}</small></div>
        </div>
      )}

      <div className="ks-ac-grid">
        <div><small>고도</small><b className="ks-mono">{ac.on_ground ? 'GND' : fl(ac.altitude_ft)}</b></div>
        <div><small>속도</small><b className="ks-mono">{noVector ? '—' : <>{Math.round(ac.ground_speed)}<i> kt</i></>}</b></div>
        <div><small>방향</small><b className="ks-mono">{noVector ? '—' : `${Math.round(ac.track || 0).toString().padStart(3, '0')}°`}</b></div>
        <div><small>수직</small><b className={`ks-mono ${vs > 300 ? 'up' : vs < -300 ? 'dn' : ''}`}>{vs > 0 ? '+' : ''}{Math.round(vs).toLocaleString()}<i> fpm</i></b></div>
        <div><small>스쿽</small><b className={`ks-mono ${emerg ? 'dn' : ''}`}>{ac.squawk || '—'}</b></div>
        <div><small>단계</small><b>{phase(ac)}</b></div>
      </div>

      {recent.length > 2 && <Profile trail={recent} />}

      <footer className="ks-ac-foot ks-mono">
        {ac.lat.toFixed(4)}°N {ac.lon.toFixed(4)}°E · {ac.hex.toUpperCase()}
        {ac.pos_age != null && <span className={ac.coasting ? 'dn' : ''}> · {ac.coasting ? '추정 위치' : '위치'} {Math.round(ac.pos_age)}초 전</span>}
      </footer>
    </aside>
  );
}
