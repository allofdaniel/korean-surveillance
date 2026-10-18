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
  /** Full-sheet raster for the viewer ('' for link-only charts). */
  file: string;
  /** Transparent, frame-cropped raster draped on the map (falls back to `file`). */
  overlayFile?: string;
  bounds?: ChartBounds;
  method?: string;
  chartNo?: string;
  /** Source PDF on the eAIP. */
  pdf?: string;
  page?: number;
  /** Georeference residual (m) from the graticule fit. */
  rmsM?: number;
  /** Overlay frame on the sheet as fractions [x0, y0, x1, y1] — `bounds` are its corners on the map. */
  clip?: [number, number, number, number];
  order?: number;
}

export type ChartGroupKey = 'airport' | 'departure' | 'arrival' | 'approach' | 'other';

export const CHART_GROUPS: { key: ChartGroupKey; label: string; types: string[] }[] = [
  { key: 'airport', label: '공항', types: ['ADC', 'PDC', 'GMC'] },
  { key: 'departure', label: '출발 SID', types: ['SID'] },
  { key: 'arrival', label: '도착 STAR', types: ['STAR', 'AREA'] },
  { key: 'approach', label: '접근', types: ['IAC', 'VAC', 'ATCSMAC'] },
  { key: 'other', label: '참고', types: ['AOC-A', 'AOC-B', 'AOC-C', 'PATC', 'BIRD', 'OTHER'] },
];

const TYPE_ORDER = ['ADC', 'PDC', 'GMC', 'SID', 'AREA', 'STAR', 'IAC', 'VAC', 'ATCSMAC', 'AOC-A', 'AOC-B', 'AOC-C', 'PATC', 'BIRD', 'OTHER'];
const typeRank = (t: string): number => { const i = TYPE_ORDER.indexOf(t); return i < 0 ? TYPE_ORDER.length : i; };

type RawChart = {
  file?: string; overlayFile?: string; bounds?: ChartBounds; type?: string; name?: string; method?: string;
  chartNo?: string; pdf?: string; page?: number; rmsM?: number; order?: number; clip?: [number, number, number, number];
};
export type RawAllCharts = Record<string, Record<string, RawChart>> | null | undefined;

export function chartsForAirport(all: RawAllCharts, icao: string): ChartEntry[] {
  const src = all?.[icao];
  if (!src) return [];
  const list = Object.entries(src)
    .filter(([, c]) => !!(c?.file || c?.pdf))
    .map(([id, c]): ChartEntry => ({
      id,
      airport: icao,
      type: (c.type || 'OTHER').toUpperCase(),
      name: prettyChartName(c.name || id),
      file: c.file || '',
      overlayFile: c.overlayFile,
      bounds: c.bounds,
      method: c.method,
      chartNo: c.chartNo,
      pdf: c.pdf,
      page: c.page,
      rmsM: c.rmsM,
      clip: c.clip,
      order: c.order,
    }))
    .sort((a, b) => {
      const d = typeRank(a.type) - typeRank(b.type);
      if (d !== 0) return d;
      if (a.order != null && b.order != null) return a.order - b.order;
      return a.name.localeCompare(b.name, 'ko') || a.file.localeCompare(b.file);
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

// ── Chart → navdata procedures ─────────────────────────────────────────
export type ProcKind = 'sids' | 'stars' | 'iaps';
export type AirportProcNames = Record<ProcKind, string[]>;

/** Runways named on a chart, e.g. "RNAV SID RWY 14L/14R" -> ['14L','14R']. */
function chartRunways(name: string): string[] {
  const m = name.toUpperCase().match(/RWY\s*([0-9]{2}[LRC]?(?:\s*\/\s*[0-9]{2}[LRC]?)*)/);
  return m?.[1] ? m[1].split('/').map(s => s.trim()) : [];
}

/** Does a navdata transition/runway suffix (".RW14L", ".RW14B", ".RW14") serve one of these runways? */
function suffixServes(suffix: string, rwys: string[]): boolean {
  const m = suffix.match(/^RW(\d{2})([LRCB]?)$/);
  if (!m) return true; // enroute transition (".GONAV") or common segment — part of every runway's procedure
  return rwys.some(r => r.slice(0, 2) === m[1] && (!m[2] || m[2] === 'B' || r.slice(2) === '' || r.slice(2) === m[2]));
}

/**
 * Which navdata procedures a chart depicts. SID/STAR charts match by runway; approach charts by
 * approach type, runway and Y/Z variant (navdata ids: I=ILS, L=LOC, R=RNAV/RNP, D/V=VOR, N=NDB).
 */
export function proceduresForChart(c: Pick<ChartEntry, 'type' | 'name'>, names: AirportProcNames | null | undefined): { kind: ProcKind; names: string[] } | null {
  if (!names) return null;
  const n = c.name.toUpperCase();
  const rwys = chartRunways(n);
  if (c.type === 'SID' || c.type === 'STAR') {
    const kind: ProcKind = c.type === 'SID' ? 'sids' : 'stars';
    const byRunway = (p: string): boolean => {
      if (!rwys.length) return true;
      const dot = p.indexOf('.');
      return dot < 0 ? true : suffixServes(p.slice(dot + 1), rwys);
    };
    // named procedures on the chart ("RNAV BINIL 3C", "SEL 1S") -> navdata idents (BINI3C, SEL1S)
    const wanted = Array.from(n.matchAll(/\b([A-Z]{3,7})\s?(\d[A-Z]?)\b/g))
      .filter(m => m[1] !== 'RWY')
      .map(m => ({ word: m[1]!, num: m[2]! }));
    const isNamed = (p: string): boolean => {
      const m = (p.split('.')[0] ?? '').match(/^([A-Z]+)(\d[A-Z]?)$/);
      if (!m) return false;
      return wanted.some(w => w.num === m[2] && (m[1] === w.word || (m[1]!.length >= 3 && w.word.startsWith(m[1]!))));
    };
    const named = wanted.length ? names[kind].filter(p => isNamed(p) && byRunway(p)) : [];
    const list = named.length ? named : names[kind].filter(byRunway);
    return list.length ? { kind, names: list } : null;
  }
  // circling-only approaches ("VOR/DME A", "RNAV B"): navdata idents VDMA / VORA / RNVB / NDBA
  const circ = c.type === 'IAC' ? n.match(/\b(VOR\/DME|VOR|RNAV|RNP|NDB)\s+([A-H])$/) : null;
  if (circ) {
    const pre = { 'VOR/DME': ['VDM', 'VOR'], VOR: ['VOR', 'VDM'], RNAV: ['RNV'], RNP: ['RNV'], NDB: ['NDB'] }[circ[1]!] ?? [];
    const list = names.iaps.filter(p => pre.some(x => (p.split('.')[0] ?? '') === x + circ[2]));
    return list.length ? { kind: 'iaps', names: list } : null;
  }
  if (c.type === 'IAC' && rwys.length) {
    const prefixes: string[] = [];
    if (/\bILS\b/.test(n)) prefixes.push('I');
    if (/\bLOC\b/.test(n)) prefixes.push('L', 'I');
    if (/\bRNP\b|\bRNAV\b|\bGNSS\b/.test(n)) prefixes.push('R', 'H');
    if (/\bVOR\b/.test(n)) prefixes.push('D', 'V', 'S');
    if (/\bNDB\b/.test(n)) prefixes.push('N', 'Q');
    if (/\bTACAN\b/.test(n)) prefixes.push('T', 'D');
    if (!prefixes.length) return null;
    const variant = n.match(/\b(?:ILS|LOC|RNP|RNAV|VOR|NDB)(?:\/DME)?\s+([W-Z])\b/)?.[1] ?? '';
    const pick = (withVariant: boolean): string[] => names.iaps.filter(p => {
      const base = p.split('.')[0] ?? p;
      const m = base.match(/^([A-Z])(\d{2}[LRC]?)-?([A-Z]?)$/);
      if (!m) return false;
      const [, t, r, v] = m;
      return prefixes.includes(t!) && rwys.includes(r!) && (!withVariant || !variant || v === variant);
    });
    // navdata sometimes drops the Y/Z suffix the chart carries — fall back to type + runway
    let list = pick(true);
    if (!list.length && variant) list = pick(false);
    return list.length ? { kind: 'iaps', names: list } : null;
  }
  return null;
}
