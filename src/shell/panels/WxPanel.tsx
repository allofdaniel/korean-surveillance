import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayerStore } from '../../stores';
import type { AirportMeta, Metar } from '../data';
import { KOREAN_NAMES, flightCategory, metarAge, metarSummary } from '../data';
import { Toggle } from './LayersPanel';

interface WxPanelProps {
  metars: Record<string, Metar>;
  updatedAt: number | null;
  airports: AirportMeta[];
  onOpenAirport: (icao: string) => void;
}

const CAT_ORDER = { LIFR: 0, IFR: 1, MVFR: 2, VFR: 3 } as Record<string, number>;

export default function WxPanel({ metars, updatedAt, onOpenAirport }: WxPanelProps): React.ReactElement {
  const { showLightning, setShowLightning, showSigmet, setShowSigmet } = useLayerStore(useShallow(s => ({
    showLightning: s.showLightning, setShowLightning: s.setShowLightning, showSigmet: s.showSigmet, setShowSigmet: s.setShowSigmet,
  })));

  const list = useMemo(() => Object.values(metars).sort((a, b) => {
    const ca = CAT_ORDER[flightCategory(a) || 'VFR'] ?? 3, cb = CAT_ORDER[flightCategory(b) || 'VFR'] ?? 3;
    return ca - cb || a.icaoId.localeCompare(b.icaoId);
  }), [metars]);

  const counts = list.reduce<Record<string, number>>((m, x) => { const c = flightCategory(x) || 'VFR'; m[c] = (m[c] || 0) + 1; return m; }, {});

  return (
    <>
      <div className="ks-section">
        <div className="ks-section-title">기상 레이어</div>
        <Toggle label="낙뢰" hint="KMA 실시간 낙뢰" on={showLightning} set={setShowLightning} />
        <Toggle label="SIGMET" hint="국내·국제 SIGMET 영역" on={showSigmet} set={setShowSigmet} />
      </div>

      <div className="ks-section">
        <div className="ks-section-title">
          국내 공항 METAR <span className="count">{list.length}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 4, letterSpacing: 0 }}>
            {(['VFR', 'MVFR', 'IFR', 'LIFR'] as const).filter(c => counts[c]).map(c => <span key={c} className={`ks-chip ${c}`}>{c} {counts[c]}</span>)}
          </span>
        </div>
        {list.length === 0 && <div className="ks-empty">METAR를 불러오는 중입니다…</div>}
        {list.map(m => {
          const cat = flightCategory(m);
          const s = metarSummary(m);
          return (
            <button key={m.icaoId} type="button" className="ks-wx-card" onClick={() => onOpenAirport(m.icaoId)}>
              <div className="h">
                <span className="icao">{m.icaoId}</span>
                <span style={{ color: 'var(--ks-text-2)', fontSize: 12 }}>{KOREAN_NAMES[m.icaoId] || ''}</span>
                {cat && <span className={`ks-chip ${cat}`}>{cat}</span>}
                <small>{metarAge(m)}</small>
              </div>
              <div className="ks-wx-grid" style={{ marginTop: 0 }}>
                <div><small>바람</small><b>{s.wind}</b></div>
                <div><small>시정</small><b>{s.vis}</b></div>
                <div><small>운저</small><b>{s.ceiling}</b></div>
                <div><small>QNH</small><b>{s.qnh}</b></div>
              </div>
            </button>
          );
        })}
        {updatedAt && <div className="ks-empty" style={{ padding: '6px 0' }}>출처 aviationweather.gov · {new Date(updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 갱신</div>}
      </div>
    </>
  );
}
