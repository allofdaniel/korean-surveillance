/**
 * Shell data helpers — chart grouping, airport metadata, METAR decoding.
 */
import { useEffect, useState } from 'react';

// ── Charts ─────────────────────────────────────────────────────────────
export type ChartBounds = [[number, number], [number, number], [number, number], [number, number]];

export interface ChartEntry {
  id: string;
  airport: string;
  type: string;
  name: string;
  file: string;
  bounds?: ChartBounds;
  method?: string;
}

export type ChartGroupKey = 'airport' | 'departure' | 'arrival' | 'approach' | 'other';

export const CHART_GROUPS: { key: ChartGroupKey; label: string; types: string[] }[] = [
  { key: 'airport', label: '공항', types: ['ADC', 'PDC', 'GMC', 'AOC-A', 'AOC-B'] },
  { key: 'departure', label: '출발 SID', types: ['SID'] },
  { key: 'arrival', label: '도착 STAR', types: ['STAR'] },
  { key: 'approach', label: '접근', types: ['IAC', 'VAC'] },
  { key: 'other', label: '기타', types: ['BIRD', 'OTHER'] },
];

const TYPE_ORDER = ['ADC', 'PDC', 'GMC', 'AOC-A', 'AOC-B', 'SID', 'STAR', 'IAC', 'VAC', 'BIRD', 'OTHER'];

type RawChart = { file?: string; bounds?: ChartBounds; type?: string; name?: string; method?: string };
export type RawAllCharts = Record<string, Record<string, RawChart>> | null | undefined;

export function chartsForAirport(all: RawAllCharts, icao: string): ChartEntry[] {
  const src = all?.[icao];
  if (!src) return [];
  const list = Object.entries(src)
    .filter(([, c]) => !!c?.file)
    .map(([id, c]) => ({
      id,
      airport: icao,
      type: (c.type || 'OTHER').toUpperCase(),
      name: prettyChartName(c.name || id),
      file: c.file as string,
      bounds: c.bounds,
      method: c.method,
    }))
    .sort((a, b) => {
      const d = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
      return d !== 0 ? d : a.name.localeCompare(b.name, 'ko') || a.file.localeCompare(b.file);
    });
  return numberDuplicates(list);
}

/** Same-named sheets (e.g. two "AD CHART" pages) get "(1)", "(2)" so the list is unambiguous. */
function numberDuplicates(list: ChartEntry[]): ChartEntry[] {
  const total = new Map<string, number>();
  list.forEach(c => total.set(c.name, (total.get(c.name) || 0) + 1));
  const seen = new Map<string, number>();
  return list.map(c => {
    if ((total.get(c.name) || 0) < 2) return c;
    const n = (seen.get(c.name) || 0) + 1;
    seen.set(c.name, n);
    return { ...c, name: `${c.name} (${n})` };
  });
}

export function groupCharts(charts: ChartEntry[]): { key: ChartGroupKey; label: string; charts: ChartEntry[] }[] {
  return CHART_GROUPS.map(g => ({
    key: g.key,
    label: g.label,
    charts: charts.filter(c => (g.key === 'other' ? !CHART_GROUPS.slice(0, 4).some(x => x.types.includes(c.type)) : g.types.includes(c.type))),
  })).filter(g => g.charts.length > 0);
}

function prettyChartName(n: string): string {
  return n.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

export function boundsBBox(b: ChartBounds): [[number, number], [number, number]] {
  const lons = b.map(p => p[0]);
  const lats = b.map(p => p[1]);
  return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
}

// ── Airports ───────────────────────────────────────────────────────────
export interface Runway {
  id: string; lat: number; lon: number; length_m: number; width_m: number;
  heading_mag: number; heading_true: number; elevation_ft: number; surface?: string;
  ils_ident?: string | null; ils_cat?: string | null;
}
export interface AirportMeta {
  icao: string; iata?: string; name: string; city?: string; lat: number; lon: number;
  elevation_ft?: number; mag_var?: number; transition_alt?: number; transition_level?: number;
  type?: string; ifr?: boolean; runways?: Runway[];
  ils?: { runway: string; ident: string; freq: number; category?: string; course?: number; gs_angle?: number }[];
  frequencies?: { type: string; freq: number; callsign?: string | null }[];
}

export const KOREAN_NAMES: Record<string, string> = {
  RKSI: '인천', RKSS: '김포', RKPC: '제주', RKPK: '김해', RKPU: '울산', RKTU: '청주', RKTN: '대구',
  RKJJ: '광주', RKJB: '무안', RKJY: '여수', RKNY: '양양', RKNW: '원주', RKPS: '사천', RKTH: '포항경주',
  RKTL: '울진', RKSM: '서울', RKJK: '군산', RKSO: '오산', RKSG: '평택', RKTE: '성무', RKPD: '정석',
  RKSD: '수원', RKTI: '중원', RKTP: '서산', RKTY: '예천', RKNN: '강릉',
};

export function airportLabel(a: Pick<AirportMeta, 'icao' | 'name'>): string {
  return KOREAN_NAMES[a.icao] ? `${KOREAN_NAMES[a.icao]}` : titleCase(a.name);
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ── METAR ──────────────────────────────────────────────────────────────
export interface Metar {
  icaoId: string; rawOb: string; fltCat?: string; obsTime?: number; reportTime?: string;
  temp?: number | null; dewp?: number | null; wdir?: number | string | null; wspd?: number | null; wgst?: number | null;
  visib?: number | string | null; altim?: number | null; clouds?: { cover: string; base: number | null }[]; name?: string;
}

export function useKoreaMetars(intervalMs = 5 * 60_000): { metars: Record<string, Metar>; updatedAt: number | null; ok: boolean } {
  const [state, setState] = useState<{ metars: Record<string, Metar>; updatedAt: number | null; ok: boolean }>({ metars: {}, updatedAt: null, ok: false });
  useEffect(() => {
    let alive = true;
    const load = async (): Promise<void> => {
      try {
        const r = await fetch('/api/weather?type=metar');
        if (!r.ok) throw new Error(String(r.status));
        const list = (await r.json()) as Metar[];
        if (!alive || !Array.isArray(list)) return;
        const map: Record<string, Metar> = {};
        for (const m of list) if (m?.icaoId) map[m.icaoId] = m;
        setState({ metars: map, updatedAt: Date.now(), ok: true });
      } catch {
        if (alive) setState(s => ({ ...s, ok: false }));
      }
    };
    void load();
    const t = setInterval(load, intervalMs);
    return () => { alive = false; clearInterval(t); };
  }, [intervalMs]);
  return state;
}

export function useTaf(icao: string | null): { taf: string | null; loading: boolean } {
  const [s, setS] = useState<{ taf: string | null; loading: boolean }>({ taf: null, loading: false });
  useEffect(() => {
    if (!icao) return;
    let alive = true;
    setS({ taf: null, loading: true });
    fetch(`/api/weather?type=taf&icao=${icao}`)
      .then(r => (r.ok ? r.json() : null))
      .then((j: { taf?: string | null } | null) => { if (alive) setS({ taf: j?.taf || null, loading: false }); })
      .catch(() => { if (alive) setS({ taf: null, loading: false }); });
    return () => { alive = false; };
  }, [icao]);
  return s;
}

/** Flight category from METAR fields when the source omits it. */
export function flightCategory(m?: Metar | null): 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | null {
  if (!m) return null;
  if (m.fltCat && ['VFR', 'MVFR', 'IFR', 'LIFR'].includes(m.fltCat)) return m.fltCat as 'VFR';
  const vis = typeof m.visib === 'number' ? m.visib : parseFloat(String(m.visib ?? '10')) || 10;
  const ceil = (m.clouds || []).filter(c => ['BKN', 'OVC', 'OVX'].includes(c.cover) && c.base != null).map(c => c.base as number);
  const c = ceil.length ? Math.min(...ceil) : 99999;
  if (vis < 1 || c < 500) return 'LIFR';
  if (vis < 3 || c < 1000) return 'IFR';
  if (vis <= 5 || c <= 3000) return 'MVFR';
  return 'VFR';
}

export function metarSummary(m: Metar): { wind: string; vis: string; ceiling: string; qnh: string; temp: string } {
  const wdir = m.wdir === 'VRB' ? 'VRB' : m.wdir != null ? String(m.wdir).padStart(3, '0') : '---';
  const wind = m.wspd != null ? (m.wspd === 0 ? 'CALM' : `${wdir}°/${m.wspd}${m.wgst ? `G${m.wgst}` : ''}kt`) : '—';
  const visStr = m.visib == null ? '' : String(m.visib);
  const visNum = typeof m.visib === 'number' ? m.visib : parseFloat(visStr);
  const vis = /\+$/.test(visStr) || (Number.isFinite(visNum) && visNum >= 6) ? '10km+'
    : Number.isFinite(visNum) ? `${(visNum * 1.609).toFixed(1)}km` : (visStr || '—');
  const ceilLayer = (m.clouds || []).find(c => ['BKN', 'OVC', 'OVX'].includes(c.cover));
  const ceiling = ceilLayer?.base != null ? `${ceilLayer.cover} ${ceilLayer.base.toLocaleString()}ft` : (m.clouds?.[0]?.cover === 'CAVOK' || /CAVOK/.test(m.rawOb) ? 'CAVOK' : 'NSC');
  const qnh = m.altim != null ? `Q${Math.round(m.altim)}` : '—';
  const temp = m.temp != null ? `${m.temp}/${m.dewp ?? '—'}°C` : '—';
  return { wind, vis, ceiling, qnh, temp };
}

export function metarAge(m: Metar): string {
  const t = m.obsTime ? m.obsTime * 1000 : m.reportTime ? Date.parse(m.reportTime) : NaN;
  if (!Number.isFinite(t)) return '';
  const min = Math.round((Date.now() - t) / 60000);
  return min < 1 ? '방금' : min < 60 ? `${min}분 전` : `${Math.floor(min / 60)}시간 전`;
}
