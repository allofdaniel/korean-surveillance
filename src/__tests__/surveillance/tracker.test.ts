import { describe, it, expect } from 'vitest';
import { TrackManager } from '../../surveillance/tracker';

const KT = 0.514444;
/** straight flight north at 300 kt from (36, 127) — true position at time t (ms since t0) */
const truth = (t: number): { lat: number; lon: number } => ({ lat: 36 + (300 * KT * t / 1000) / 111_320, lon: 127 });
const report = (t: number, seenPos: number, extra: Record<string, unknown> = {}): Parameters<TrackManager['ingest']>[0][0] => {
  const p = truth(t - seenPos * 1000);
  return { hex: 'abc123', lat: p.lat, lon: p.lon, seen: 0, seenPos, gs: 300, track: 0, trackRate: 0, onGround: false, alt: 30000, vs: 0, ...extra };
};
const lat = (m: TrackManager, now: number): number => m.display(now).get('abc123')!.lat;

describe('surveillance tracker', () => {
  it('uses the position validity time, not the receive time', () => {
    const m = new TrackManager();
    const t0 = 1_000_000;
    m.ingest([report(t0, 40)], t0, t0);            // 40 s old position
    const d = m.display(t0 + 1000).get('abc123')!;
    // extrapolated 40 s forward: should sit near the true current position, not 6 km behind
    expect(Math.abs(d.lat - truth(t0 + 200).lat) * 111_320).toBeLessThan(250);
  });

  it('never runs backwards when stale duplicate snapshots arrive', () => {
    const m = new TrackManager();
    const t0 = 1_000_000;
    m.ingest([report(t0, 2)], t0, t0);
    let prev = -Infinity;
    for (let t = t0 + 500; t < t0 + 30_000; t += 250) {
      if (t % 2000 === 0) {
        // the edge cache serves the same 12 s old position for several polls, then a fresh one
        const seen = (t / 2000) % 3 === 0 ? 1 : 12;
        m.ingest([report(t, seen)], t, t);
      }
      const l = lat(m, t);
      expect(l).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = l;
    }
  });

  it('eases a position correction instead of jumping', () => {
    const m = new TrackManager();
    const t0 = 1_000_000;
    m.ingest([report(t0, 1)], t0, t0);
    lat(m, t0 + 1000);
    // next report says the aircraft is 150 m further east than predicted
    m.ingest([report(t0 + 2000, 1, { lon: 127 + 150 / (111_320 * Math.cos(36 * Math.PI / 180)) })], t0 + 2000, t0 + 2000);
    const lons: number[] = [];
    for (let t = t0 + 2050; t < t0 + 8000; t += 100) lons.push(m.display(t).get('abc123')!.lon);
    const steps = lons.slice(1).map((v, i) => (v - lons[i]!) * 111_320 * Math.cos(36 * Math.PI / 180));
    expect(Math.max(...steps)).toBeLessThan(25);         // no single-frame jump
    // keep reporting the offset: the filter converges onto it
    for (let t = t0 + 4000; t <= t0 + 20_000; t += 2000) m.ingest([report(t, 1, { lon: 127 + 150 / (111_320 * Math.cos(36 * Math.PI / 180)) })], t, t);
    expect((m.display(t0 + 24_000).get('abc123')!.lon - 127) * 111_320 * Math.cos(36 * Math.PI / 180)).toBeGreaterThan(90);
  });

  it('ignores one implausible report and re-initialises on the second', () => {
    const m = new TrackManager();
    const t0 = 1_000_000;
    m.ingest([report(t0, 1)], t0, t0);
    m.ingest([report(t0 + 2000, 1)], t0 + 2000, t0 + 2000);
    m.ingest([report(t0 + 4000, 1)], t0 + 4000, t0 + 4000);
    const far = { lat: 37.5, lon: 128.5 };
    m.ingest([report(t0 + 6000, 1, far)], t0 + 6000, t0 + 6000);
    expect(m.rejected).toBe(1);
    expect(Math.abs(lat(m, t0 + 6500) - truth(t0 + 5700).lat)).toBeLessThan(0.003);
    m.ingest([report(t0 + 8000, 1, far)], t0 + 8000, t0 + 8000);
    expect(Math.abs(lat(m, t0 + 8500) - 37.5)).toBeLessThan(0.01);
  });

  it('coasts, then drops a silent track', () => {
    const m = new TrackManager();
    const t0 = 1_000_000;
    m.ingest([report(t0, 1)], t0, t0);
    m.ingest([report(t0 + 2000, 1)], t0 + 2000, t0 + 2000);
    expect(m.display(t0 + 5000).get('abc123')!.status).toBe('fresh');
    expect(m.display(t0 + 30_000).get('abc123')!.status).toBe('coasting');
    expect(m.display(t0 + 70_000).has('abc123')).toBe(false);
  });

  it('follows a turn with the coordinated-turn model', () => {
    const m = new TrackManager();
    const t0 = 1_000_000;
    // 3°/s standard-rate turn at 200 kt, reports every 2 s with 1 s latency
    const s = 200 * KT, w = 3 * Math.PI / 180;
    const pos = (t: number): { lat: number; lon: number; track: number } => {
      const th = w * t / 1000;
      return { lon: 127 + (s / w) * (1 - Math.cos(th)) / (111_320 * Math.cos(36 * Math.PI / 180)), lat: 36 + (s / w) * Math.sin(th) / 111_320, track: (th * 180 / Math.PI) % 360 };
    };
    for (let t = 0; t <= 20_000; t += 2000) {
      const p = pos(t - 1000);
      m.ingest([{ hex: 'abc123', lat: p.lat, lon: p.lon, seen: 0, seenPos: 1, gs: 200, track: p.track, trackRate: 3, onGround: false, alt: 5000, vs: 0 }], t0 + t, t0 + t);
    }
    const d = m.display(t0 + 21_000).get('abc123')!;
    const tr = pos(21_000 - 800);
    const err = Math.hypot((d.lat - tr.lat) * 111_320, (d.lon - tr.lon) * 111_320 * 0.81);
    expect(err).toBeLessThan(120);
  });
});
