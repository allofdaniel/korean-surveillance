import React, { useMemo, useState } from 'react';
import { Layers, Eye, ExternalLink, Route } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useLayerStore } from '../../stores';
import type { AirportMeta, AirportProcNames, ChartEntry, Metar, ProcKind, RawAllCharts } from '../data';
import { airportLabel, chartsForAirport, proceduresForChart, flightCategory, groupCharts, metarAge, metarSummary, useTaf } from '../data';

interface ChartsPanelProps {
  airports: AirportMeta[];
  allCharts: RawAllCharts;
  metars: Record<string, Metar>;
  selected: string | null;
  onSelect: (icao: string | null) => void;
  viewerChartId: string | null;
  onOpenChart: (c: ChartEntry) => void;
  overlay: Record<string, boolean>;
  onToggleOverlay: (c: ChartEntry) => void;
  /** navdata procedure names per airport, used to draw a chart's procedure on the map */
  procNames?: Record<string, AirportProcNames>;
  /** frame the drawn procedure on the map once it has rendered */
  onFitProcedure?: (kind: ProcKind) => void;
}

const AirportRow = React.memo(function AirportRow({ a, n, metar, onSelect }: { a: AirportMeta; n: number; metar?: Metar; onSelect: (icao: string) => void }): React.ReactElement {
  const cat = flightCategory(metar);
  return (
    <button type="button" className="ks-apt-row" onClick={() => onSelect(a.icao)}>
      <span className="icao">{a.icao}</span>
      <span className="name"><b>{airportLabel(a)}</b><small>{a.name}</small></span>
      <span className="meta">
        {cat ? <span className={`ks-chip ${cat}`}>{cat}</span> : <span className="ks-chip none">—</span>}
        {n > 0 && <span className="ks-count">{n}</span>}
      </span>
    </button>
  );
});

export function AirportList({ airports, allCharts, metars, onSelect }: Pick<ChartsPanelProps, 'airports' | 'allCharts' | 'metars' | 'onSelect'>): React.ReactElement {
  const [filter, setFilter] = useState('');
  const rows = useMemo(() => {
    const f = filter.trim().toUpperCase();
    return airports
      .map(a => ({ a, n: chartsForAirport(allCharts, a.icao).length }))
      .filter(({ a }) => !f || a.icao.includes(f) || a.name.toUpperCase().includes(f) || airportLabel(a).includes(filter.trim()))
      .sort((x, y) => (y.n > 0 ? 1 : 0) - (x.n > 0 ? 1 : 0) || x.a.icao.localeCompare(y.a.icao));
  }, [airports, allCharts, filter]);
  const withCharts = rows.filter(r => r.n > 0);
  const others = rows.filter(r => r.n === 0);

  return (
    <>
      <input className="ks-input" placeholder="공항 이름·ICAO 필터" value={filter} onChange={e => setFilter(e.target.value)} aria-label="공항 필터" />
      <div className="ks-section">
        <div className="ks-section-title">AIP 차트 공항 <span className="count">{withCharts.length}</span></div>
        <div className="ks-apt-list">{withCharts.map(r => <AirportRow key={r.a.icao} a={r.a} n={r.n} metar={metars[r.a.icao]} onSelect={onSelect} />)}</div>
      </div>
      {others.length > 0 && (
        <div className="ks-section">
          <div className="ks-section-title">기타 비행장 <span className="count">{others.length}</span></div>
          <div className="ks-apt-list">{others.map(r => <AirportRow key={r.a.icao} a={r.a} n={r.n} metar={metars[r.a.icao]} onSelect={onSelect} />)}</div>
        </div>
      )}
    </>
  );
}

type Tab = 'charts' | 'info' | 'wx';

export function AirportPage(p: ChartsPanelProps & { airport: AirportMeta }): React.ReactElement {
  const { airport: a } = p;
  const [tab, setTab] = useState<Tab>('charts');
  const charts = useMemo(() => chartsForAirport(p.allCharts, a.icao), [p.allCharts, a.icao]);
  const groups = useMemo(() => groupCharts(charts), [charts]);
  const metar = p.metars[a.icao];
  const cat = flightCategory(metar);
  const longest = Math.max(0, ...(a.runways || []).map(r => r.length_m || 0));

  return (
    <>
      <div className="ks-apt-head">
        <div className="row1">
          <span className="icao">{a.icao}</span>
          {a.iata && <span className="iata">{a.iata}</span>}
          {cat && <span className={`ks-chip ${cat}`} style={{ marginLeft: 'auto' }}>{cat}</span>}
        </div>
        <div className="nm">{airportLabel(a)} · {a.name}</div>
        <div className="ks-facts">
          <div className="ks-fact"><small>표고</small><b>{a.elevation_ft ?? '—'} ft</b></div>
          <div className="ks-fact"><small>최장 활주로</small><b>{longest ? `${longest.toLocaleString()} m` : '—'}</b></div>
          <div className="ks-fact"><small>전이고도</small><b>{a.transition_alt ? `${(a.transition_alt / 1000).toFixed(0)},000 ft` : '—'}</b></div>
        </div>
      </div>

      <div className="ks-tabs" role="tablist">
        {([['charts', `차트 ${charts.length}`], ['wx', '기상'], ['info', '정보']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} type="button" role="tab" className="ks-tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'charts' && <ChartsTab {...p} groups={groups} />}
      {tab === 'wx' && <WxTab icao={a.icao} metar={metar} />}
      {tab === 'info' && <InfoTab a={a} />}
    </>
  );
}

function ChartsTab(p: ChartsPanelProps & { airport: AirportMeta; groups: ReturnType<typeof groupCharts> }): React.ReactElement {
  const raw = useLayerStore(useShallow(s => ({
    showSids: s.showKoreaSids, showStars: s.showKoreaStars, showIaps: s.showKoreaIaps,
    setSids: s.setShowKoreaSids, setStars: s.setShowKoreaStars, setIaps: s.setShowKoreaIaps,
    sel: s.procSelection, setSel: s.setProcSelection, selectedApt: s.selectedKoreaAirport, setApt: s.setSelectedKoreaAirport,
  })));
  const st = {
    show: { sids: raw.showSids, stars: raw.showStars, iaps: raw.showIaps } as Record<ProcKind, boolean>,
    set: { sids: raw.setSids, stars: raw.setStars, iaps: raw.setIaps } as Record<ProcKind, (v: boolean) => void>,
    sel: raw.sel, setSel: raw.setSel, selectedApt: raw.selectedApt, setApt: raw.setApt,
  };
  const icao = p.airport.icao;
  const here = st.selectedApt === icao;
  const names = p.procNames?.[icao];
  const KINDS: ProcKind[] = ['sids', 'stars', 'iaps'];

  /** switch the procedure layer to this airport, clearing whatever another airport had drawn */
  const claim = (): typeof st.sel => {
    if (here) return st.sel;
    st.setApt(icao);
    KINDS.forEach(k => st.set[k](false));
    return { sids: null, stars: null, iaps: null };
  };
  // "SID / STAR / 접근" buttons: every procedure of that type
  const toggleAll = (k: ProcKind): void => {
    const on = here && st.show[k] && st.sel[k] === null;
    const sel = claim();
    st.setSel({ ...sel, [k]: null });
    st.set[k](!on);
  };
  const isAllOn = (k: ProcKind): boolean => here && st.show[k] && st.sel[k] === null;
  // per chart: just the procedures that chart depicts
  const chartProcOn = (m: { kind: ProcKind; names: string[] }): boolean =>
    here && st.show[m.kind] && (st.sel[m.kind] === null || m.names.every(n => st.sel[m.kind]!.includes(n)));
  const toggleChartProc = (m: { kind: ProcKind; names: string[] }): void => {
    const on = chartProcOn(m);
    const sel = claim();
    const cur = here && st.show[m.kind] ? sel[m.kind] : [];
    if (on) {
      const next = (cur ?? names?.[m.kind] ?? []).filter(n => !m.names.includes(n));
      st.setSel({ ...sel, [m.kind]: next });
      if (!next.length) st.set[m.kind](false);
    } else {
      st.setSel({ ...sel, [m.kind]: Array.from(new Set([...(cur ?? []), ...m.names])) });
      st.set[m.kind](true);
      p.onFitProcedure?.(m.kind);
    }
  };
  // opening a procedure chart draws its route too (Navigraph-style), unless it is already shown
  const openChart = (c: ChartEntry): void => {
    p.onOpenChart(c);
    const m = proceduresForChart(c, names);
    if (m && !chartProcOn(m)) toggleChartProc(m);
  };

  return (
    <>
      <div className="ks-section">
        <div className="ks-section-title">절차를 지도에 그리기 <span className="count">차트별 <Route size={10} /> 버튼</span></div>
        <div className="ks-proc-toggles">
          <button type="button" className="ks-overlay-toggle" aria-pressed={isAllOn('sids')} onClick={() => toggleAll('sids')}>SID 전체</button>
          <button type="button" className="ks-overlay-toggle" aria-pressed={isAllOn('stars')} onClick={() => toggleAll('stars')}>STAR 전체</button>
          <button type="button" className="ks-overlay-toggle" aria-pressed={isAllOn('iaps')} onClick={() => toggleAll('iaps')}>접근 전체</button>
        </div>
      </div>

      {p.groups.length === 0 && <div className="ks-empty">이 비행장은 eAIP에 게시된 차트가 없습니다.</div>}
      {p.groups.map(g => (
        <div className="ks-chart-group ks-section" key={g.key}>
          <div className="ks-chart-group-head">{g.label} <span className="k">{g.charts.length}</span></div>
          {g.charts.map(c => (!c.file && c.pdf) ? (
            <a key={c.id} className="ks-chart-row" href={c.pdf} target="_blank" rel="noopener noreferrer" title="eAIP 원본 PDF (새 탭)">
              <span className="ty">{c.type}</span>
              <span className="nm">{c.name}{c.chartNo && <small> {c.chartNo}</small>}</span>
              <ExternalLink size={13} color="var(--ks-text-3)" />
            </a>
          ) : (
            <div key={c.id} className="ks-chart-row" role="button" tabIndex={0} aria-current={p.viewerChartId === c.id}
              onClick={() => openChart(c)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openChart(c); } }}>
              <span className="ty">{c.type}</span>
              <span className="nm" title={c.name}>{c.name}{c.chartNo && <small> {c.chartNo}</small>}</span>
              <ChartActions c={c} overlayOn={!!p.overlay[c.id]} onOverlay={() => p.onToggleOverlay(c)}
                proc={proceduresForChart(c, names)} procOn={chartProcOn} onProc={toggleChartProc} />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function ChartActions({ c, overlayOn, onOverlay, proc, procOn, onProc }: {
  c: ChartEntry; overlayOn: boolean; onOverlay: () => void;
  proc: { kind: ProcKind; names: string[] } | null;
  procOn: (m: { kind: ProcKind; names: string[] }) => boolean; onProc: (m: { kind: ProcKind; names: string[] }) => void;
}): React.ReactElement {
  if (!c.bounds && !proc) return <Eye size={14} color="var(--ks-text-3)" />;
  return (
    <span className="ks-chart-actions">
      {proc && (
        <button type="button" className="ks-overlay-toggle" aria-pressed={procOn(proc)}
          title={`이 차트의 절차 경로를 지도에 그리기 (${proc.names.map(n => n.split('.')[0]).filter((v, i, a) => a.indexOf(v) === i).join(', ')})`}
          onClick={e => { e.stopPropagation(); onProc(proc); }}>
          <Route size={12} />{procOn(proc) ? '경로' : ''}
        </button>
      )}
      {c.bounds && (
        <button type="button" className="ks-overlay-toggle" aria-pressed={overlayOn} title="차트 이미지를 지도에 겹치기"
          onClick={e => { e.stopPropagation(); onOverlay(); }}>
          <Layers size={12} />{overlayOn ? '차트' : ''}
        </button>
      )}
    </span>
  );
}

function WxTab({ icao, metar }: { icao: string; metar?: Metar }): React.ReactElement {
  const { taf, loading } = useTaf(icao);
  const cat = flightCategory(metar);
  const s = metar ? metarSummary(metar) : null;
  return (
    <>
      <div className="ks-section">
        <div className="ks-section-title">METAR</div>
        {metar && s ? (
          <div className="ks-metar">
            <div className="ks-metar-top">
              {cat && <span className={`ks-chip ${cat}`}>{cat}</span>}
              <small>{metarAge(metar)}</small>
            </div>
            <div className="ks-raw">{metar.rawOb}</div>
            <div className="ks-wx-grid">
              <div><small>바람</small><b>{s.wind}</b></div>
              <div><small>시정</small><b>{s.vis}</b></div>
              <div><small>운저</small><b>{s.ceiling}</b></div>
              <div><small>QNH</small><b>{s.qnh}</b></div>
            </div>
          </div>
        ) : <div className="ks-empty">이 공항의 METAR가 발표되지 않았거나 아직 수신되지 않았습니다.</div>}
      </div>
      <div className="ks-section">
        <div className="ks-section-title">TAF <span className="count">AMO</span></div>
        <div className="ks-metar">
          {loading ? <div className="ks-empty" style={{ padding: 6 }}>불러오는 중…</div>
            : taf ? <div className="ks-raw">{taf}</div>
            : <div className="ks-empty" style={{ padding: 6 }}>TAF 없음</div>}
        </div>
      </div>
    </>
  );
}

function InfoTab({ a }: { a: AirportMeta }): React.ReactElement {
  const ilsByRwy = new Map((a.ils || []).map(i => [i.runway, i]));
  return (
    <>
      <div className="ks-section">
        <div className="ks-section-title">활주로 <span className="count">{a.runways?.length || 0}</span></div>
        {(a.runways || []).map(r => {
          const ils = ilsByRwy.get(r.id);
          return (
            <div className="ks-rwy" key={r.id}>
              <span className="id">{r.id.replace(/^RW/, 'RWY ')}</span>
              <small>{r.length_m.toLocaleString()} × {Math.round(r.width_m * 0.3048)} m · {r.surface || ''} · {Math.round(r.heading_mag)}°M</small>
              {ils ? <span className="ks-chip MVFR" title={`ILS ${ils.ident} ${ils.freq}`}>ILS {ils.category ? `CAT${ils.category}` : ''}</span> : <span />}
            </div>
          );
        })}
      </div>
      {(a.ils?.length || 0) > 0 && (
        <div className="ks-section">
          <div className="ks-section-title">ILS</div>
          {a.ils!.map(i => (
            <div className="ks-freq" key={i.ident}>
              <span className="t">{i.runway.replace(/^RW/, '')}</span>
              <span>{i.ident} · CRS {i.course ?? '—'}° · GS {i.gs_angle ?? '—'}°</span>
              <span className="f">{i.freq.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="ks-section">
        <div className="ks-section-title">주파수</div>
        {(a.frequencies || []).length === 0 && <div className="ks-empty">주파수 정보 없음</div>}
        {(a.frequencies || []).map((f, i) => (
          <div className="ks-freq" key={`${f.type}-${f.freq}-${i}`}>
            <span className="t">{f.type}</span>
            <span>{f.callsign || ''}</span>
            <span className="f">{f.freq.toFixed(3)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
