import React, { useEffect, useMemo, useState } from 'react';
import { X, MapPin } from 'lucide-react';
import type { AircraftData } from '../hooks/useAircraftData';
import type { ChartBounds } from './data';

/**
 * Live traffic on a georeferenced chart sheet in the viewer (Navigraph-style).
 * The overlay `bounds` are the map corners of the sheet's graticule frame (`clip`, sheet fractions);
 * both are linear in Web Mercator, so lon/lat -> sheet pixel is a 2×2 solve.
 *
 * Layout: one layer in sheet pixels that follows the viewer pan/zoom (translate + scale); symbols
 * counter-scale so they stay the same size on screen and glide between position updates.
 * Tapping a symbol opens a small info card inside the viewer (the map's aircraft card would sit
 * behind the viewer).
 */
interface ChartTrafficProps {
  aircraft: AircraftData[];
  bounds: ChartBounds;
  clip: [number, number, number, number];
  /** natural size of the sheet raster */
  width: number;
  height: number;
  /** current viewer transform */
  view: { s: number; x: number; y: number };
  /** stage size, for keeping the info card on screen */
  stage: { w: number; h: number };
  /** aerodrome / ground charts show taxiing and parked traffic; procedure charts only airborne */
  showGround: boolean;
  /** close the viewer and show this aircraft on the map */
  onShowOnMap: (ac: AircraftData) => void;
}

const merc = (lat: number): number => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * (180 / Math.PI);
const EMERG: Record<string, string> = { '7500': '불법간섭', '7600': '통신두절', '7700': '비상' };

function altLabel(ac: AircraftData): string {
  if (ac.on_ground) return 'GND';
  const ft = ac.altitude_ft;
  if (!Number.isFinite(ft)) return '';
  return ft >= 14000 ? `FL${Math.round(ft / 100).toString().padStart(3, '0')}` : `${(Math.round(ft / 100) * 100).toLocaleString()}ft`;
}
const vsArrow = (ac: AircraftData): string => (ac.on_ground ? '' : (ac.vertical_rate || 0) > 300 ? '↑' : (ac.vertical_rate || 0) < -300 ? '↓' : '');
const nameOf = (ac: AircraftData): string => (ac.callsign || '').trim() || ac.registration || ac.hex.toUpperCase();

export default function ChartTraffic(p: ChartTrafficProps): React.ReactElement | null {
  const [pick, setPick] = useState<string | null>(null);

  const toPx = useMemo(() => {
    const [TL, TR, , BL] = p.bounds;
    const t = [TL[0], merc(TL[1])], ex = [TR[0] - TL[0], merc(TR[1]) - t[1]!], ey = [BL[0] - TL[0], merc(BL[1]) - t[1]!];
    const det = ex[0]! * ey[1]! - ey[0]! * ex[1]!;
    if (!det) return null;
    const [cx0, cy0, cx1, cy1] = p.clip;
    return (lon: number, lat: number): [number, number, number, number] => {
      const dx = lon - t[0]!, dy = merc(lat) - t[1]!;
      const u = (dx * ey[1]! - ey[0]! * dy) / det;
      const v = (ex[0]! * dy - dx * ex[1]!) / det;
      return [(cx0 + u * (cx1 - cx0)) * p.width, (cy0 + v * (cy1 - cy0)) * p.height, u, v];
    };
  }, [p.bounds, p.clip, p.width, p.height]);

  const items = useMemo(() => {
    if (!toPx) return [];
    const out: { ac: AircraftData; x: number; y: number; rot: number; vx: number; vy: number }[] = [];
    for (const ac of p.aircraft) {
      if (!Number.isFinite(ac.lat) || !Number.isFinite(ac.lon)) continue;
      if (ac.on_ground && !p.showGround) continue;
      const [x, y, u, v] = toPx(ac.lon, ac.lat);
      if (u < -0.01 || u > 1.01 || v < -0.01 || v > 1.01) continue;
      const tr = ((ac.track || 0) * Math.PI) / 180;
      const coslat = Math.cos((ac.lat * Math.PI) / 180);
      // heading on the sheet from a point ~200 m ahead; predictor = 1 minute at ground speed
      const [hx, hy] = toPx(ac.lon + (Math.sin(tr) * 0.002) / coslat, ac.lat + Math.cos(tr) * 0.002);
      const nm = ac.on_ground ? 0 : Math.max(0, ac.ground_speed || 0) / 60;
      const deg = nm / 60;
      const [vx, vy] = toPx(ac.lon + (Math.sin(tr) * deg) / coslat, ac.lat + Math.cos(tr) * deg);
      out.push({ ac, x, y, rot: (Math.atan2(hx - x, -(hy - y)) * 180) / Math.PI, vx, vy });
    }
    return out;
  }, [p.aircraft, p.showGround, toPx]);

  // the picked aircraft left the sheet / the feed: drop the card
  useEffect(() => { if (pick && !items.some(i => i.ac.hex === pick)) setPick(null); }, [items, pick]);

  if (!items.length) return null;
  const { s, x, y } = p.view;
  const inv = 1 / s;
  const sel = items.find(i => i.ac.hex === pick);

  // info card: right of the symbol, flipped / clamped to stay inside the stage
  let card: React.ReactElement | null = null;
  if (sel) {
    const ac = sel.ac;
    const sx = x + sel.x * s, sy = y + sel.y * s;
    const W = 248, H = 190;
    const left = sx + 22 + W > p.stage.w - 8 ? Math.max(8, sx - 22 - W) : sx + 22;
    const top = Math.min(Math.max(8, sy - 30), Math.max(8, p.stage.h - H - 56));
    const emerg = EMERG[ac.squawk];
    const route = [ac.origin, ac.destination].some(Boolean) ? `${ac.origin || '—'} → ${ac.destination || '—'}` : '';
    card = (
      <div className={`ks-ct-card ${emerg ? 'emerg' : ''}`} style={{ left, top }} onPointerDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
        <div className="h">
          <b className="ks-mono">{nameOf(ac)}</b>
          <button type="button" className="x" onClick={() => setPick(null)} aria-label="닫기"><X size={14} /></button>
        </div>
        <small>{[ac.icao_type || ac.type, ac.registration, ac.operator].filter(v => v && v !== 'Unknown').join(' · ') || ac.hex.toUpperCase()}</small>
        {emerg && <div className="em">SQUAWK {ac.squawk} · {emerg}</div>}
        {route && <div className="rt ks-mono">{route}</div>}
        <div className="g ks-mono">
          <span><i>고도</i>{altLabel(ac) || '—'}</span>
          <span><i>속도</i>{ac.ground_speed > 0 ? `${Math.round(ac.ground_speed)}kt` : '—'}</span>
          <span><i>수직</i>{ac.on_ground ? '—' : `${(ac.vertical_rate || 0) > 0 ? '+' : ''}${Math.round(ac.vertical_rate || 0)}`}</span>
          <span><i>방향</i>{ac.ground_speed > 0 ? `${Math.round(ac.track || 0).toString().padStart(3, '0')}°` : '—'}</span>
          <span><i>스쿽</i>{ac.squawk || '—'}</span>
        </div>
        <button type="button" className="go" onClick={() => { setPick(null); p.onShowOnMap(ac); }}><MapPin size={13} /> 지도에서 보기</button>
      </div>
    );
  }

  return (
    <>
      <div className="ks-chart-traffic" style={{ width: p.width, height: p.height, transform: `translate(${x}px, ${y}px) scale(${s})` }} aria-label="차트 위 실시간 항공기">
        <svg className="vec" width={p.width} height={p.height} aria-hidden="true">
          {items.filter(i => !i.ac.on_ground).map(i => (
            <line key={i.ac.hex} x1={i.x} y1={i.y} x2={i.vx} y2={i.vy} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {items.map(({ ac, x: px, y: py, rot }) => {
          const isSel = ac.hex === pick;
          const cs = (ac.callsign || '').trim();
          // parked aircraft without a callsign: symbol only (hex codes are noise on a ground chart)
          const label = cs || (ac.on_ground ? '' : nameOf(ac));
          return (
            <div key={ac.hex} className={`ks-ct-ac ${isSel ? 'sel' : ''} ${ac.on_ground ? 'gnd' : ''} ${EMERG[ac.squawk] ? 'emerg' : ''}`}
              style={{ left: px, top: py, transform: `scale(${inv})` }}>
              <button type="button" className="sym" onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); setPick(h => (h === ac.hex ? null : ac.hex)); }}
                aria-label={`${nameOf(ac)} ${altLabel(ac)}`}>
                <svg viewBox="-12 -12 24 24" width="28" height="28" style={{ transform: `rotate(${rot}deg)` }} aria-hidden="true">
                  <path d="M0,-11 L1.9,-3 L10,1.8 L10,3.8 L1.9,1.6 L1.2,7.2 L3.8,9.2 L3.8,10.6 L0,9.6 L-3.8,10.6 L-3.8,9.2 L-1.2,7.2 L-1.9,1.6 L-10,3.8 L-10,1.8 L-1.9,-3 Z" />
                </svg>
              </button>
              {(label || isSel) && (
                <span className="lbl ks-mono" onPointerDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); setPick(h => (h === ac.hex ? null : ac.hex)); }}>
                  <b>{label || nameOf(ac)}</b>
                  <i>{altLabel(ac)}{vsArrow(ac)}{!ac.on_ground && ac.ground_speed > 0 ? ` ${Math.round(ac.ground_speed)}` : ''}</i>
                </span>
              )}
            </div>
          );
        })}
      </div>
      {card}
    </>
  );
}
