import { useEffect, useMemo, useRef, useState } from 'react';
import { TrackManager } from '../surveillance/tracker';
import type { AircraftBatch, AircraftData } from './useAircraftData';

/** display refresh — 20 Hz is smooth for symbols moving a few px per frame and keeps React cheap */
const FRAME_MS = 50;

export interface SurveillanceStats { tracks: number; fresh: number; coasting: number; rejected: number }

/**
 * useSurveillance — turns polled ADS-B snapshots into continuously moving tracks.
 * Every batch is time-registered and fed to the TrackManager; a frame loop then publishes
 * the extrapolated / eased display states in the familiar AircraftData shape, so the map,
 * the chart viewer, the traffic list and the aircraft card all draw the same picture.
 */
export default function useSurveillance(batch: AircraftBatch): { aircraft: AircraftData[]; stats: SurveillanceStats } {
  const mgr = useRef(new TrackManager());
  /** latest non-kinematic record per hex (callsign, squawk, type …) */
  const latest = useRef(new Map<string, AircraftData>());
  const [aircraft, setAircraft] = useState<AircraftData[]>([]);
  const [stats, setStats] = useState<SurveillanceStats>({ tracks: 0, fresh: 0, coasting: 0, rejected: 0 });

  useEffect(() => {
    if (!batch.at) return;
    for (const ac of batch.aircraft) latest.current.set(ac.hex, ac);
    mgr.current.ingest(batch.aircraft.map(ac => ({
      hex: ac.hex, lat: ac.lat, lon: ac.lon, seen: ac.seen, seenPos: ac.seen_pos,
      gs: Number.isFinite(ac.ground_speed) ? ac.ground_speed : null,
      track: Number.isFinite(ac.track) ? ac.track : null,
      trackRate: ac.track_rate, onGround: ac.on_ground,
      alt: ac.on_ground ? 0 : (Number.isFinite(ac.altitude_ft) ? ac.altitude_ft : null),
      vs: Number.isFinite(ac.vertical_rate) ? ac.vertical_rate : null,
    })), batch.serverNow, batch.at);
  }, [batch]);

  useEffect(() => {
    let raf = 0, last = 0, stopped = false;
    const tick = (): void => {
      if (stopped) return;
      const t = performance.now();
      if (t - last >= FRAME_MS) {
        last = t;
        const now = Date.now();
        const states = mgr.current.display(now);
        const out: AircraftData[] = [];
        let fresh = 0, coasting = 0;
        for (const [hex, st] of states) {
          const base = latest.current.get(hex);
          if (!base) continue;
          if (st.status === 'coasting') coasting++; else fresh++;
          out.push({
            ...base,
            lat: st.lat, lon: st.lon, track: st.track,
            ground_speed: st.gs,
            altitude_ft: st.alt ?? base.altitude_ft,
            altitude_m: (st.alt ?? base.altitude_ft) * 0.3048,
            coasting: st.status === 'coasting', pos_age: st.posAge,
          });
        }
        for (const hex of latest.current.keys()) if (!states.has(hex)) latest.current.delete(hex);
        setAircraft(out);
        setStats(s => (s.tracks === out.length && s.fresh === fresh && s.coasting === coasting && s.rejected === mgr.current.rejected)
          ? s : { tracks: out.length, fresh, coasting, rejected: mgr.current.rejected });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { stopped = true; cancelAnimationFrame(raf); };
  }, []);

  return useMemo(() => ({ aircraft, stats }), [aircraft, stats]);
}
