import React, { useCallback, useEffect, useMemo, useState, type Dispatch, type MutableRefObject, type ReactNode, type SetStateAction } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { Map as MapIcon, Plane, CloudSun, FileWarning, Layers, Wrench, ChevronLeft, X } from 'lucide-react';
import TopBar from './TopBar';
import ChartViewer from './ChartViewer';
import { AirportList, AirportPage } from './panels/ChartsPanel';
import TrafficPanel from './panels/TrafficPanel';
import WxPanel from './panels/WxPanel';
import LayersPanel from './panels/LayersPanel';
import ToolsPanel from './panels/ToolsPanel';
import type { AirportMeta, AirportProcNames, ChartEntry, ProcKind, RawAllCharts } from './data';
import { airportLabel, boundsBBox, chartsForAirport, useKoreaMetars } from './data';
import type { AircraftData } from '../hooks/useAircraftData';
import './shell.css';

type Panel = 'charts' | 'traffic' | 'wx' | 'notam' | 'layers' | 'tools';

interface MapShellProps {
  map: MutableRefObject<MapboxMap | null>;
  mapLoaded: boolean;
  dataReady: boolean;
  now: Date;
  koreaAirspaceData: unknown;
  allChartBounds: RawAllCharts;
  activeCharts: Record<string, boolean>;
  setActiveCharts: Dispatch<SetStateAction<Record<string, boolean>>>;
  chartOpacities: Record<string, number>;
  updateChartOpacity: (id: string, v: number) => void;
  selectedChartAirport: string;
  setSelectedChartAirport: (icao: string) => void;
  aircraft: AircraftData[];
  selectedAircraftHex: string | null;
  onSelectAircraft: (ac: AircraftData) => void;
  adsbHealth?: { isConnected?: boolean; lastSuccessTime?: number | null } | null;
  notamOk: boolean;
  notamCount: number;
  notamPanel: ReactNode;
  setShowNotamPanel: (v: boolean) => void;
  atcData: unknown;
  onOpenApiDashboard: () => void;
  onHome: () => void;
}

const RAIL: { key: Panel; label: string; Icon: typeof MapIcon }[] = [
  { key: 'charts', label: '차트', Icon: MapIcon },
  { key: 'traffic', label: '교통', Icon: Plane },
  { key: 'wx', label: '기상', Icon: CloudSun },
  { key: 'notam', label: 'NOTAM', Icon: FileWarning },
  { key: 'layers', label: '레이어', Icon: Layers },
];

const TABS_KEY = 'ks.chartTabs.v1';
const isMobile = (): boolean => typeof window !== 'undefined' && window.innerWidth < 900;

export default function MapShell(p: MapShellProps): React.ReactElement {
  const [panel, setPanel] = useState<Panel | null>(() => (isMobile() ? null : 'charts'));
  const [airport, setAirport] = useState<string | null>(null);
  const [tabs, setTabs] = useState<ChartEntry[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const { metars, updatedAt, ok: wxOk } = useKoreaMetars();

  const airports = useMemo<AirportMeta[]>(() => {
    const list = ((p.koreaAirspaceData as { airports?: AirportMeta[] } | null)?.airports || [])
      .filter(a => /^[A-Z]{4}$/.test(a.icao) && Number.isFinite(a.lat) && Number.isFinite(a.lon));
    return list.sort((a, b) => a.icao.localeCompare(b.icao));
  }, [p.koreaAirspaceData]);
  const airportByIcao = useMemo(() => new Map(airports.map(a => [a.icao, a])), [airports]);
  const procNames = useMemo(() => {
    type Leg = { wpt?: string | null };
    const d = p.koreaAirspaceData as {
      procedures?: Record<ProcKind, Record<string, Record<string, Leg[]>>>;
      terminalWaypoints?: { id?: string; name?: string }[]; waypoints?: { name?: string }[]; navaids?: { ident?: string }[];
    } | null;
    const pr = d?.procedures;
    const out: Record<string, AirportProcNames> = {};
    if (!pr) return out;
    // only offer procedures the map can actually draw (≥ 2 legs ending at a known fix);
    // heading/vector-only departures would toggle on and show nothing
    const known = new Set<string>();
    d?.terminalWaypoints?.forEach(w => { if (w.id) known.add(w.id); if (w.name) known.add(w.name); });
    d?.waypoints?.forEach(w => { if (w.name) known.add(w.name); });
    d?.navaids?.forEach(n => { if (n.ident) known.add(n.ident); });
    (['sids', 'stars', 'iaps'] as ProcKind[]).forEach(k => Object.entries(pr[k] || {}).forEach(([icao, procs]) => {
      out[icao] ??= { sids: [], stars: [], iaps: [] };
      out[icao]![k] = Object.entries(procs)
        .filter(([, legs]) => (legs || []).filter(l => l.wpt && (known.has(l.wpt) || /^RW\d/.test(l.wpt))).length >= 2)
        .map(([name]) => name);
    }));
    return out;
  }, [p.koreaAirspaceData]);
  const chartCounts = useMemo(() => {
    const m: Record<string, number> = {};
    Object.keys(p.allChartBounds || {}).forEach(k => { m[k] = chartsForAirport(p.allChartBounds, k).length; });
    return m;
  }, [p.allChartBounds]);

  // restore open chart tabs once chart index has loaded
  useEffect(() => {
    if (!p.allChartBounds || tabs.length) return;
    try {
      const saved = JSON.parse(localStorage.getItem(TABS_KEY) || '[]') as { a: string; id: string }[];
      const restored = saved.map(s => chartsForAirport(p.allChartBounds, s.a).find(c => c.id === s.id)).filter(Boolean) as ChartEntry[];
      if (restored.length && !isMobile()) { setTabs(restored); setActiveTab(restored[0]!.id); }
    } catch { /* storage unavailable */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.allChartBounds]);
  useEffect(() => {
    try { localStorage.setItem(TABS_KEY, JSON.stringify(tabs.map(t => ({ a: t.airport, id: t.id })))); } catch { /* ignore */ }
  }, [tabs]);

  const viewerOpen = tabs.length > 0 && !!activeTab;

  // keep the map's visual centre clear of the drawer / viewer
  const mapPadding = useCallback((panelOpen: boolean, viewer: boolean) => {
    const css = getComputedStyle(document.documentElement);
    const px = (v: string): number => parseFloat(css.getPropertyValue(v)) || 0;
    return isMobile()
      ? { top: px('--ks-top'), left: 0, right: 0, bottom: 60 + (panelOpen ? window.innerHeight * 0.58 : 0) }
      : { top: px('--ks-top'), left: px('--ks-rail') + (panelOpen ? px('--ks-drawer') : 0), right: viewer ? Math.min(window.innerWidth * 0.42, 760) : 0, bottom: 0 };
  }, []);
  useEffect(() => {
    const m = p.map.current;
    if (!m || !p.mapLoaded) return;
    const pad = mapPadding(!!panel, viewerOpen);
    // never interrupt a camera move that is already flying somewhere (airport / chart / aircraft)
    if (m.isMoving() || m.isEasing()) {
      const apply = (): void => { try { m.easeTo({ padding: pad, duration: 200 }); } catch { /* ignore */ } };
      m.once('moveend', apply);
      return () => { m.off('moveend', apply); };
    }
    try { m.easeTo({ padding: pad, duration: 300 }); } catch { /* map not ready */ }
  }, [p.map, p.mapLoaded, panel, viewerOpen, mapPadding]);

  useEffect(() => {
    document.body.classList.add('ks-has-shell');
    return () => document.body.classList.remove('ks-has-shell');
  }, []);
  useEffect(() => { document.body.classList.toggle('ks-viewer-open', viewerOpen); }, [viewerOpen]);

  // NOTAM: the legacy panel renders inside the drawer
  useEffect(() => { p.setShowNotamPanel(panel === 'notam'); }, [panel, p.setShowNotamPanel]); // eslint-disable-line react-hooks/exhaustive-deps

  const flyToAirport = useCallback((icao: string): void => {
    const a = airportByIcao.get(icao);
    if (!a || !p.map.current) return;
    // the charts drawer opens alongside — fly with its padding so the airport lands in the visible part
    p.map.current.flyTo({ center: [a.lon, a.lat], zoom: 11.2, duration: 1200, essential: true, padding: mapPadding(true, viewerOpen) });
  }, [airportByIcao, p.map, mapPadding, viewerOpen]);

  const openAirport = useCallback((icao: string | null): void => {
    setAirport(icao);
    if (icao) {
      setPanel('charts');
      flyToAirport(icao);
      if (chartCounts[icao]) p.setSelectedChartAirport(icao);
    }
  }, [flyToAirport, chartCounts, p]);

  const openChart = useCallback((c: ChartEntry): void => {
    setTabs(t => (t.some(x => x.id === c.id) ? t : [...t, c].slice(-8)));
    setActiveTab(c.id);
    // drawer + viewer together leave almost no map on narrower screens — fold the list away
    // (it comes back from the rail; open charts stay as viewer tabs)
    if (isMobile() || window.innerWidth < 1440) setPanel(null);
  }, []);

  const closeTab = useCallback((id: string): void => {
    setTabs(t => {
      const next = t.filter(x => x.id !== id);
      setActiveTab(a => (a === id ? next[next.length - 1]?.id ?? null : a));
      return next;
    });
    p.setActiveCharts(a => ({ ...a, [id]: false }));
  }, [p]);

  const toggleOverlay = useCallback((c: ChartEntry): void => {
    const on = !p.activeCharts[c.id];
    p.setSelectedChartAirport(c.airport);
    // one airport's charts render at a time — drop overlays from other airports
    p.setActiveCharts(prev => {
      const keep = Object.fromEntries(Object.entries(prev).filter(([id]) => chartsForAirport(p.allChartBounds, c.airport).some(x => x.id === id)));
      return { ...keep, [c.id]: on };
    });
    if (on && !isMobile() && window.innerWidth < 1700) setPanel(null); // give the map room
    if (on && c.bounds && p.map.current) {
      const [[w, s], [e, n]] = boundsBBox(c.bounds);
      const m = p.map.current;
      // run after the drawer-padding ease so it does not cancel this camera move
      window.setTimeout(() => { try { m.fitBounds([[w, s], [e, n]], { padding: 40, duration: 900, maxZoom: 16 }); } catch { /* ignore */ } }, 380);
    }
  }, [p]);

  // frame a just-enabled procedure: wait for the layer to receive its geometry, then fit
  const fitProcedure = useCallback((kind: ProcKind): void => {
    const m = p.map.current;
    if (!m) return;
    let tries = 0;
    const attempt = (): void => {
      const src = m.getSource(`korea-${kind}`) as unknown as { _data?: GeoJSON.FeatureCollection } | undefined;
      const feats = src?._data?.features || [];
      const pts: number[][] = [];
      feats.forEach(f => {
        const g = f.geometry;
        if (g.type === 'LineString') pts.push(...g.coordinates);
        else if (g.type === 'MultiLineString') g.coordinates.forEach(c => pts.push(...c));
      });
      if (!pts.length) { if (++tries < 12) window.setTimeout(attempt, 150); return; }
      const lons = pts.map(c => c[0]!), lats = pts.map(c => c[1]!);
      try {
        m.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
          { padding: { ...mapPadding(true, true), top: 80, bottom: 60 }, duration: 900, maxZoom: 12 });
      } catch { /* ignore */ }
    };
    window.setTimeout(attempt, 200);
  }, [p.map, mapPadding]);

  const selectAircraft = useCallback((ac: AircraftData): void => {
    p.onSelectAircraft(ac);
    p.map.current?.flyTo({ center: [ac.lon, ac.lat], zoom: Math.max(p.map.current.getZoom(), 9), duration: 900 });
    if (isMobile()) setPanel(null);
  }, [p]);

  const togglePanel = (k: Panel): void => setPanel(cur => (cur === k ? null : k));
  const current = airport ? airportByIcao.get(airport) || null : null;
  const activeChart = tabs.find(t => t.id === activeTab) || null;

  const title: Record<Panel, string> = { charts: '공항 차트', traffic: '실시간 교통', wx: '기상', notam: 'NOTAM', layers: '지도 레이어', tools: '도구' };

  return (
    <div className="ks-shell">
      <TopBar
        now={p.now}
        airports={airports}
        chartCounts={chartCounts}
        aircraft={p.aircraft}
        adsbHealth={p.adsbHealth}
        wxOk={wxOk}
        notamOk={p.notamOk}
        onPickAirport={openAirport}
        onPickAircraft={selectAircraft}
        onBrand={p.onHome}
      />
      {(!p.mapLoaded || !p.dataReady) && <div className="ks-loading" role="progressbar" aria-label="지도 데이터 불러오는 중" />}

      <nav className="ks-rail" aria-label="작업 메뉴">
        {RAIL.map(({ key, label, Icon }) => (
          <button key={key} type="button" className="ks-rail-btn" aria-pressed={panel === key} onClick={() => togglePanel(key)} title={label}>
            <Icon size={20} strokeWidth={1.8} />
            {label}
            {key === 'notam' && p.notamCount > 0 && <span className="badge">{p.notamCount > 99 ? '99+' : p.notamCount}</span>}
          </button>
        ))}
        <div className="ks-rail-spacer" />
        <button type="button" className="ks-rail-btn" aria-pressed={panel === 'tools'} onClick={() => togglePanel('tools')} title="도구">
          <Wrench size={20} strokeWidth={1.8} />도구
        </button>
      </nav>

      {panel && (
        <aside className="ks-drawer" aria-label={title[panel]}>
          <div className="ks-drawer-head">
            {panel === 'charts' && current && (
              <button type="button" className="ks-icon-btn" onClick={() => setAirport(null)} aria-label="공항 목록으로"><ChevronLeft size={18} /></button>
            )}
            <h2>{panel === 'charts' && current ? `${current.icao} · ${airportLabel(current)}` : title[panel]}</h2>
            <button type="button" className="ks-icon-btn" onClick={() => setPanel(null)} aria-label="패널 닫기"><X size={17} /></button>
          </div>
          <div className="ks-drawer-body">
            {panel === 'charts' && !current && (
              <AirportList airports={airports} allCharts={p.allChartBounds} metars={metars} onSelect={openAirport} />
            )}
            {panel === 'charts' && current && (
              <AirportPage
                airport={current}
                airports={airports}
                allCharts={p.allChartBounds}
                metars={metars}
                selected={airport}
                onSelect={openAirport}
                viewerChartId={activeTab}
                onOpenChart={openChart}
                overlay={p.activeCharts}
                onToggleOverlay={toggleOverlay}
                procNames={procNames}
                onFitProcedure={fitProcedure}
              />
            )}
            {panel === 'traffic' && (
              <TrafficPanel aircraft={p.aircraft} selectedHex={p.selectedAircraftHex}
                center={current ? { lat: current.lat, lon: current.lon } : null}
                centerLabel={current ? current.icao : null}
                onSelect={selectAircraft} />
            )}
            {panel === 'wx' && <WxPanel metars={metars} updatedAt={updatedAt} airports={airports} onOpenAirport={icao => openAirport(icao)} />}
            {panel === 'notam' && p.notamPanel}
            {panel === 'layers' && <LayersPanel atcData={p.atcData as Parameters<typeof LayersPanel>[0]['atcData']} />}
            {panel === 'tools' && <ToolsPanel onOpenApiDashboard={p.onOpenApiDashboard} onHome={p.onHome} />}
          </div>
        </aside>
      )}

      {viewerOpen && activeChart && (
        <ChartViewer
          tabs={tabs}
          activeId={activeChart.id}
          onActivate={setActiveTab}
          onCloseTab={closeTab}
          onClose={() => setActiveTab(null)}
          overlayOn={!!p.activeCharts[activeChart.id] && p.selectedChartAirport === activeChart.airport}
          onToggleOverlay={() => toggleOverlay(activeChart)}
          opacity={p.chartOpacities[activeChart.id] ?? 0.7}
          onOpacity={v => p.updateChartOpacity(activeChart.id, v)}
          aircraft={p.aircraft}
          selectedHex={p.selectedAircraftHex}
          onSelectAircraft={p.onSelectAircraft}
        />
      )}
    </div>
  );
}
