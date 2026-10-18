import React, { useMemo } from 'react';
import type { AircraftData } from '../hooks/useAircraftData';
import type { ChartBounds } from './data';

/**
 * Live traffic drawn on a georeferenced chart sheet in the viewer (Navigraph-style).
 * The overlay `bounds` are the map corners of the sheet's graticule frame (`clip`, sheet fractions);
 * both are linear in Web Mercator, so lon/lat -> sheet pixel is a 2×2 solve.
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
  selectedHex: string | null;
  /** aerodrome / ground charts show taxiing and parked traffic; procedure charts only airborne */
  showGround: boolean;
  onSelect: (ac: AircraftData) => void;
}

const merc = (lat: number): number => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * (180 / Math.PI);

function flLabel(ac: AircraftData): string {
  if (ac.on_ground) return 'GND';
  const ft = ac.altitude_ft;
  if (!Number.isFinite(ft)) return '';
  return ft >= 14000 ? `FL${Math.round(ft / 100).toString().padStart(3, '0')}` : `${Math.round(ft / 100) * 100}`;
}

export default function ChartTraffic(p: ChartTrafficProps): React.ReactElement | null {
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
    const out: { ac: AircraftData; x: number; y: number; rot: number }[] = [];
    for (const ac of p.aircraft) {
      if (!Number.isFinite(ac.lat) || !Number.isFinite(ac.lon)) continue;
      if (ac.on_ground && !p.showGround) continue;
      const [x, y, u, v] = toPx(ac.lon, ac.lat);
      if (u < -0.01 || u > 1.01 || v < -0.01 || v > 1.01) continue;
      // heading on the sheet: project a point ~200 m ahead along track
      const tr = ((ac.track || 0) * Math.PI) / 180;
      const [x2, y2] = toPx(ac.lon + (Math.sin(tr) * 0.002) / Math.cos((ac.lat * Math.PI) / 180), ac.lat + Math.cos(tr) * 0.002);
      out.push({ ac, x, y, rot: (Math.atan2(x2 - x, -(y2 - y)) * 180) / Math.PI });
    }
    return out;
  }, [p.aircraft, p.showGround, toPx]);

  if (!items.length) return null;
  const { s, x, y } = p.view;
  return (
    <div className="ks-chart-traffic" style={{ transform: `translate(${x}px, ${y}px)` }} aria-label="차트 위 실시간 항공기">
      {items.map(({ ac, x: px, y: py, rot }) => {
        const sel = ac.hex === p.selectedHex;
        const cs = (ac.callsign || '').trim();
        // parked aircraft without a callsign: icon only (hex codes are noise on a ground chart)
        const label = cs || (ac.on_ground ? '' : (ac.registration || ac.hex.toUpperCase()));
        return (
          <button type="button" key={ac.hex} className={`ks-ct-ac ${sel ? 'sel' : ''} ${ac.on_ground ? 'gnd' : ''}`}
            style={{ left: px * s, top: py * s }}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); p.onSelect(ac); }}
            title={`${cs || ac.registration || ac.hex.toUpperCase()} ${flLabel(ac)}`}>
            <svg viewBox="-10 -10 20 20" width="18" height="18" style={{ transform: `rotate(${rot}deg)` }} aria-hidden="true">
              <path d="M0,-9 L1.6,-2.5 L8,1.5 L8,3 L1.6,1.2 L1,6 L3.2,7.6 L3.2,8.8 L0,8 L-3.2,8.8 L-3.2,7.6 L-1,6 L-1.6,1.2 L-8,3 L-8,1.5 L-1.6,-2.5 Z" />
            </svg>
            {(label || sel) && <span className="lbl ks-mono">{label || ac.hex.toUpperCase()}<i>{flLabel(ac)}</i></span>}
          </button>
        );
      })}
    </div>
  );
}
