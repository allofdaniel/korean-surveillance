import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Search, Radar } from 'lucide-react';
import type { AirportMeta } from './data';
import { airportLabel } from './data';
import type { AircraftData } from '../hooks/useAircraftData';

interface Health { isConnected?: boolean; lastSuccessTime?: number | null }

interface TopBarProps {
  now: Date;
  airports: AirportMeta[];
  chartCounts: Record<string, number>;
  aircraft: AircraftData[];
  adsbHealth?: Health | null;
  wxOk: boolean;
  notamOk: boolean;
  onPickAirport: (icao: string) => void;
  onPickAircraft: (ac: AircraftData) => void;
  onBrand: () => void;
}

type Result = { kind: 'apt'; a: AirportMeta } | { kind: 'ac'; ac: AircraftData };

const pad = (n: number): string => String(n).padStart(2, '0');

export default function TopBar(p: TopBarProps): React.ReactElement {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo<Result[]>(() => {
    const s = q.trim().toUpperCase();
    if (s.length < 2) return [];
    const apts = p.airports
      .filter(a => a.icao.includes(s) || (a.iata || '').includes(s) || a.name.toUpperCase().includes(s) || airportLabel(a).includes(q.trim()))
      .slice(0, 6)
      .map(a => ({ kind: 'apt' as const, a }));
    const acs = p.aircraft
      .filter(ac => (ac.callsign || '').toUpperCase().includes(s) || (ac.registration || '').toUpperCase().includes(s) || ac.hex.toUpperCase() === s)
      .slice(0, 8)
      .map(ac => ({ kind: 'ac' as const, ac }));
    return [...apts, ...acs];
  }, [q, p.airports, p.aircraft]);

  useEffect(() => { setCursor(0); }, [q]);
  useEffect(() => {
    const onDoc = (e: MouseEvent): void => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (r: Result): void => {
    if (r.kind === 'apt') p.onPickAirport(r.a.icao); else p.onPickAircraft(r.ac);
    setQ(''); setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter' && results[cursor]) { pick(results[cursor]); }
    else if (e.key === 'Escape') { setOpen(false); (e.target as HTMLInputElement).blur(); }
  };

  const z = `${pad(p.now.getUTCHours())}:${pad(p.now.getUTCMinutes())}:${pad(p.now.getUTCSeconds())}Z`;
  const kst = new Date(p.now.getTime() + 9 * 3600_000);
  const k = `${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())} KST`;
  const adsbOk = (p.adsbHealth?.isConnected ?? false) && p.aircraft.length > 0;
  const apts = results.filter(r => r.kind === 'apt');
  const acs = results.filter(r => r.kind === 'ac');

  return (
    <header className="ks-top" role="banner">
      <button type="button" className="ks-brand" onClick={p.onBrand} title="홈" aria-label="홈">
        <Radar size={20} strokeWidth={1.9} />
      </button>

      <div className="ks-search" ref={boxRef}>
        <Search size={15} />
        <input
          id="ks-search"
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder="공항(ICAO·이름) 또는 편명 검색"
          aria-label="공항 또는 편명 검색"
          autoComplete="off"
          spellCheck={false}
        />
        {open && results.length > 0 && (
          <div className="ks-search-results" role="listbox">
            {apts.length > 0 && <div className="ks-search-group">공항</div>}
            {apts.map(r => {
              const i = results.indexOf(r);
              const a = (r as { a: AirportMeta }).a;
              return (
                <button key={`a-${a.icao}`} type="button" className="ks-search-item" role="option" aria-selected={cursor === i}
                  onMouseEnter={() => setCursor(i)} onClick={() => pick(r)}>
                  <span className="ks-mono">{a.icao}</span>
                  <span>{airportLabel(a)} <small>{a.name}</small></span>
                  {p.chartCounts[a.icao] ? <small style={{ marginLeft: 'auto' }}>차트 {p.chartCounts[a.icao]}</small> : null}
                </button>
              );
            })}
            {acs.length > 0 && <div className="ks-search-group">항공기</div>}
            {acs.map(r => {
              const i = results.indexOf(r);
              const ac = (r as { ac: AircraftData }).ac;
              return (
                <button key={`c-${ac.hex}`} type="button" className="ks-search-item" role="option" aria-selected={cursor === i}
                  onMouseEnter={() => setCursor(i)} onClick={() => pick(r)}>
                  <span className="ks-mono">{(ac.callsign || ac.hex).trim()}</span>
                  <span><small>{ac.icao_type || ac.type || ''} {ac.registration || ''}</small></span>
                  <small className="ks-mono" style={{ marginLeft: 'auto' }}>{ac.on_ground ? 'GND' : `${Math.round(ac.altitude_ft || 0).toLocaleString()}ft`}</small>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="ks-clock" aria-label="현재 시각">
        <span className="z">{z}</span>
        <span className="k">{k}</span>
      </div>
      <div className="ks-status" aria-label="데이터 상태">
        <span className={`ks-pill ${adsbOk ? 'ok' : 'warn'}`} title="ADS-B 실시간 항적">
          <i />ADS-B <b>{p.aircraft.length}</b>
        </span>
        <span className={`ks-pill ${p.wxOk ? 'ok' : 'warn'}`} title="METAR (aviationweather.gov)"><i />METAR</span>
        <span className={`ks-pill ${p.notamOk ? 'ok' : 'warn'}`} title="NOTAM"><i />NOTAM</span>
      </div>
    </header>
  );
}
