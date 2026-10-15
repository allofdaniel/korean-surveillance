import React, { useMemo, useState } from 'react';
import type { AircraftData } from '../../hooks/useAircraftData';

interface TrafficPanelProps {
  aircraft: AircraftData[];
  selectedHex: string | null;
  center: { lat: number; lon: number } | null;
  centerLabel: string | null;
  onSelect: (ac: AircraftData) => void;
}

type Sort = 'near' | 'alt' | 'cs';
const EMERG = new Set(['7500', '7600', '7700']);

function distNm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 3440.065, t = Math.PI / 180;
  const dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function TrafficPanel({ aircraft, selectedHex, center, centerLabel, onSelect }: TrafficPanelProps): React.ReactElement {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>(center ? 'near' : 'alt');
  const [airborneOnly, setAirborneOnly] = useState(true);

  const rows = useMemo(() => {
    const s = q.trim().toUpperCase();
    const list = aircraft.filter(a => (!airborneOnly || !a.on_ground)
      && (!s || (a.callsign || '').toUpperCase().includes(s) || (a.registration || '').toUpperCase().includes(s) || (a.icao_type || '').toUpperCase().includes(s) || a.hex.toUpperCase().includes(s)));
    const withD = list.map(a => ({ a, d: center ? distNm(center, a) : null }));
    if (sort === 'near' && center) withD.sort((x, y) => (x.d ?? 0) - (y.d ?? 0));
    else if (sort === 'alt') withD.sort((x, y) => (y.a.altitude_ft || 0) - (x.a.altitude_ft || 0));
    else withD.sort((x, y) => (x.a.callsign || 'ZZZ').localeCompare(y.a.callsign || 'ZZZ'));
    return withD.slice(0, 300);
  }, [aircraft, q, sort, airborneOnly, center]);

  const emergencies = aircraft.filter(a => EMERG.has(a.squawk));

  return (
    <>
      <input className="ks-input" placeholder="편명·등록부호·기종 검색" value={q} onChange={e => setQ(e.target.value)} aria-label="항공기 검색" />
      <div className="ks-row" style={{ padding: '10px 2px 2px', flexWrap: 'wrap', gap: 8 }}>
        <div className="ks-seg" role="group" aria-label="정렬">
          {center && <button type="button" aria-pressed={sort === 'near'} onClick={() => setSort('near')}>{centerLabel ? `${centerLabel} 근접` : '근접'}</button>}
          <button type="button" aria-pressed={sort === 'alt'} onClick={() => setSort('alt')}>고도</button>
          <button type="button" aria-pressed={sort === 'cs'} onClick={() => setSort('cs')}>편명</button>
        </div>
        <button type="button" className="ks-overlay-toggle" aria-pressed={airborneOnly} onClick={() => setAirborneOnly(v => !v)} style={{ marginLeft: 'auto' }}>비행 중만</button>
      </div>

      {emergencies.length > 0 && (
        <div className="ks-section">
          <div className="ks-section-title" style={{ color: 'var(--ks-ifr)' }}>비상 스쿽 <span className="count">{emergencies.length}</span></div>
          {emergencies.map(a => (
            <button key={a.hex} type="button" className="ks-ac-row" onClick={() => onSelect(a)}>
              <span className="cs">{(a.callsign || a.hex).trim()}</span>
              <span className="alt sq emerg">{a.squawk}</span>
            </button>
          ))}
        </div>
      )}

      <div className="ks-section">
        <div className="ks-section-title">항공기 <span className="count">{rows.length}{rows.length === 300 ? '+' : ''} / {aircraft.length}</span></div>
        {rows.length === 0 && <div className="ks-empty">{aircraft.length === 0 ? '항적 데이터를 기다리는 중입니다.' : '조건에 맞는 항공기가 없습니다.'}</div>}
        {rows.map(({ a, d }) => {
          const vs = a.vertical_rate || 0;
          return (
            <button key={a.hex} type="button" className="ks-ac-row" aria-current={selectedHex === a.hex} onClick={() => onSelect(a)}>
              <span className="cs">{(a.callsign || '').trim() || a.hex.toUpperCase()}</span>
              <span className="alt">
                {a.on_ground ? 'GND' : `${Math.round(a.altitude_ft || 0).toLocaleString()}`}
                {!a.on_ground && Math.abs(vs) > 300 && <span className={vs > 0 ? 'ks-vs-up' : 'ks-vs-dn'}> {vs > 0 ? '▲' : '▼'}</span>}
              </span>
              <small>{[a.icao_type || a.type, a.registration, a.origin && a.destination ? `${a.origin}→${a.destination}` : ''].filter(Boolean).join(' · ') || '—'}</small>
              <small style={{ textAlign: 'right' }}>{Math.round(a.ground_speed || 0)}kt{d != null ? ` · ${d.toFixed(0)}nm` : ''}</small>
            </button>
          );
        })}
      </div>
    </>
  );
}
