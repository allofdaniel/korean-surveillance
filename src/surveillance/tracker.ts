/**
 * Surveillance track processing (client side), modelled on the pipeline of an ATC
 * surveillance data processing system (EUROCONTROL ARTAS / Thales TopSky / Indra iTEC class):
 *
 *   reports ──► time registration ──► association + plausibility gate ──► track filter ──► track store
 *                                                                                              │
 *                                            display ◄── smooth visual correction ◄── extrapolation to display time
 *
 * 1. Time registration. A report carries the age of its position (`seen_pos`) and the server's
 *    clock (`now`). The position is stamped with the time it was *valid*, mapped onto the client
 *    clock, not with the time it was received. (Treating a 45 s old position as "now" and then
 *    predicting ahead from it is what made aircraft run forward and then slide back.)
 * 2. Association. Reports are keyed by ICAO 24-bit address; a report whose position time is not
 *    newer than the track's last update carries no new kinematic information and only refreshes
 *    the non-kinematic fields (duplicate snapshots from edge caches, stale feeds).
 * 3. Plausibility gate. The innovation (measured − predicted at the report time) is compared with
 *    a gate; one outlier is ignored, a second consecutive one re-initialises the track.
 * 4. Track filter. Per axis a 2-state (position, velocity) Kalman filter in a local ENU frame
 *    with a white-noise-acceleration process model. ADS-B velocity (ground speed + track, which
 *    the aircraft measures with GNSS) is used as a direct velocity observation, so the velocity
 *    converges immediately instead of being differentiated from noisy positions. Turn rate comes
 *    from the reported `track_rate` or is estimated from successive tracks and is used for a
 *    coordinated-turn extrapolation (IMM-lite: constant velocity when |ω| is small).
 * 5. Track status. fresh → coasting (extrapolated, no recent report) → dropped.
 * 6. Display. Positions are extrapolated to a display time slightly behind real time; when a new
 *    report moves the estimate, the on-screen symbol is eased onto the new solution with a
 *    correction vector that decays smoothly and is rate-limited so an airborne symbol never
 *    visibly reverses.
 */

export interface Report {
  hex: string;
  lat: number;
  lon: number;
  /** position validity time on the client clock, ms */
  tPos: number;
  /** last-contact time on the client clock, ms */
  tSeen: number;
  /** knots */
  gs: number | null;
  /** degrees true */
  track: number | null;
  /** deg/s, positive clockwise */
  trackRate: number | null;
  onGround: boolean;
  /** ft, null when unknown */
  alt: number | null;
  /** ft/min */
  vs: number | null;
}

export type TrackStatus = 'init' | 'fresh' | 'coasting';

export interface DisplayState {
  lat: number;
  lon: number;
  /** degrees true, smoothed */
  track: number;
  /** knots, filtered */
  gs: number;
  /** ft, extrapolated with the vertical rate */
  alt: number | null;
  status: TrackStatus;
  /** seconds since the last position report */
  posAge: number;
}

/* ───────────────────────────── tuning ───────────────────────────── */

const KT = 0.514444;                    // m/s per knot
const FT_MIN = 0.3048 / 60;             // m/s per ft/min
const SIGMA_POS = 30;                   // m   — ADS-B position noise (NACp ≥ 8 typical)
const SIGMA_VEL = 1.5;                  // m/s — ADS-B velocity noise
const SIGMA_ACC_AIR = 1.5;              // m/s² — manoeuvre process noise, airborne
const SIGMA_ACC_GND = 1.2;              // m/s² — taxiing
const GATE_MIN_M = 400;                 // plausibility gate floor
const GATE_SIGMAS = 5;
const REINIT_JUMP_M = 5000;             // beyond this the symbol teleports instead of easing
const DISPLAY_LAG_MS = 800;             // display time runs this far behind the clock (jitter buffer)
const MAX_PREDICT_S = 70;               // never extrapolate further than this
const FRESH_S = 12;                     // position age below which the track is "fresh"
const COAST_DROP_AIR_S = 60;            // drop an airborne track after this long without a report
const COAST_DROP_GND_S = 30;
const CORR_TAU_S = 1.6;                 // visual correction time constant
const CORR_RATE_FRAC = 0.45;            // correction speed ≤ 45 % of ground speed (+ 3 m/s)
const TURN_RATE_MIN = 0.1 * Math.PI / 180;  // below 0.1°/s use the constant-velocity model

/* ───────────────────────── 2-state Kalman axis ─────────────────────── */

class Axis {
  p = 0; v = 0;
  // covariance
  P00 = SIGMA_POS * SIGMA_POS; P01 = 0; P11 = SIGMA_VEL * SIGMA_VEL * 4;

  constructor(p: number, v: number) { this.p = p; this.v = v; }

  predict(dt: number, sigmaAcc: number): void {
    if (dt <= 0) return;
    const q = sigmaAcc * sigmaAcc;
    const dt2 = dt * dt, dt3 = dt2 * dt, dt4 = dt3 * dt;
    this.p += this.v * dt;
    const P00 = this.P00 + 2 * this.P01 * dt + this.P11 * dt2 + q * dt4 / 4;
    const P01 = this.P01 + this.P11 * dt + q * dt3 / 2;
    const P11 = this.P11 + q * dt2;
    this.P00 = P00; this.P01 = P01; this.P11 = P11;
  }

  /** joint position (+ optional velocity) update, H = I */
  update(zp: number, zv: number | null): void {
    const rp = SIGMA_POS * SIGMA_POS;
    if (zv === null) {
      const S = this.P00 + rp;
      const K0 = this.P00 / S, K1 = this.P01 / S;
      const y = zp - this.p;
      this.p += K0 * y; this.v += K1 * y;
      const P00 = (1 - K0) * this.P00, P01 = (1 - K0) * this.P01, P11 = this.P11 - K1 * this.P01;
      this.P00 = P00; this.P01 = P01; this.P11 = P11;
      return;
    }
    const rv = SIGMA_VEL * SIGMA_VEL;
    // S = P + R ; K = P S⁻¹
    const S00 = this.P00 + rp, S01 = this.P01, S11 = this.P11 + rv;
    const det = S00 * S11 - S01 * S01;
    if (det <= 0) return;
    const i00 = S11 / det, i01 = -S01 / det, i11 = S00 / det;
    const K00 = this.P00 * i00 + this.P01 * i01, K01 = this.P00 * i01 + this.P01 * i11;
    const K10 = this.P01 * i00 + this.P11 * i01, K11 = this.P01 * i01 + this.P11 * i11;
    const yp = zp - this.p, yv = zv - this.v;
    this.p += K00 * yp + K01 * yv;
    this.v += K10 * yp + K11 * yv;
    // P = (I − K) P
    const P00 = (1 - K00) * this.P00 - K01 * this.P01;
    const P01 = (1 - K00) * this.P01 - K01 * this.P11;
    const P11 = -K10 * this.P01 + (1 - K11) * this.P11;
    this.P00 = P00; this.P01 = P01; this.P11 = P11;
  }

  /** predicted position variance after dt (for gating) */
  varAfter(dt: number, sigmaAcc: number): number {
    const q = sigmaAcc * sigmaAcc;
    return this.P00 + 2 * this.P01 * dt + this.P11 * dt * dt + q * dt ** 4 / 4;
  }
}

/* ───────────────────────────── track ───────────────────────────── */

export class Track {
  readonly hex: string;
  // local frame: metres east / north of (lat0, lon0)
  private lat0: number; private lon0: number; private kx: number; private readonly ky = 111_320;
  private x: Axis; private y: Axis;
  /** time the filter state is valid for (= last accepted position time) */
  tFilter: number;
  tSeen: number;
  onGround: boolean;
  alt: number | null; vs: number;
  /** rad/s, clockwise */
  omega = 0;
  private lastTrack: number | null = null;
  private outliers = 0;
  updates = 0;
  // visual correction (display frame)
  private corrX = 0; private corrY = 0; private tCorr = 0;
  private hasDisplayed = false; private dispX = 0; private dispY = 0; private tDisp = 0;

  constructor(r: Report) {
    this.hex = r.hex;
    this.lat0 = r.lat; this.lon0 = r.lon;
    this.kx = 111_320 * Math.cos(r.lat * Math.PI / 180);
    const [vx, vy] = Track.vel(r);
    this.x = new Axis(0, vx); this.y = new Axis(0, vy);
    this.tFilter = r.tPos; this.tSeen = r.tSeen;
    this.onGround = r.onGround; this.alt = r.alt; this.vs = r.vs ?? 0;
    this.lastTrack = r.track;
    this.omega = r.trackRate != null ? r.trackRate * Math.PI / 180 : 0;
  }

  private static vel(r: Report): [number, number] {
    if (r.gs == null || r.track == null || !Number.isFinite(r.gs) || !Number.isFinite(r.track)) return [0, 0];
    const s = r.gs * KT, th = r.track * Math.PI / 180;
    return [s * Math.sin(th), s * Math.cos(th)];
  }
  private toLocal(lat: number, lon: number): [number, number] {
    return [(lon - this.lon0) * this.kx, (lat - this.lat0) * this.ky];
  }
  private toGeo(x: number, y: number): [number, number] {
    return [this.lat0 + y / this.ky, this.lon0 + x / this.kx];
  }
  private get sigmaAcc(): number { return this.onGround ? SIGMA_ACC_GND : SIGMA_ACC_AIR; }

  /** coordinated-turn / constant-velocity extrapolation of the filtered state by dt seconds */
  private extrapolate(dt: number): [number, number] {
    const vx = this.x.v, vy = this.y.v;
    const w = this.omega;
    if (Math.abs(w) < TURN_RATE_MIN || dt <= 0) return [this.x.p + vx * dt, this.y.p + vy * dt];
    const s = Math.hypot(vx, vy), th = Math.atan2(vx, vy);
    const th2 = th + w * dt;
    return [this.x.p + (s / w) * (Math.cos(th) - Math.cos(th2)), this.y.p + (s / w) * (Math.sin(th2) - Math.sin(th))];
  }

  /** returns false when the report was rejected as an outlier */
  update(r: Report): boolean {
    this.tSeen = Math.max(this.tSeen, r.tSeen);
    // non-kinematic refresh is free
    this.onGround = r.onGround;
    if (r.alt != null) { this.alt = r.alt; }
    if (r.vs != null) this.vs = r.vs;
    if (r.tPos <= this.tFilter) return true;         // no new position — keep the filter where it is

    const dt = (r.tPos - this.tFilter) / 1000;
    const [zx, zy] = this.toLocal(r.lat, r.lon);
    const [px, py] = this.extrapolate(dt);
    const inno = Math.hypot(zx - px, zy - py);
    const gate = Math.max(GATE_MIN_M, GATE_SIGMAS * Math.sqrt(this.x.varAfter(dt, this.sigmaAcc) + this.y.varAfter(dt, this.sigmaAcc)));
    if (this.updates >= 2 && inno > gate && dt < 30) {
      if (++this.outliers < 2) return false;          // one implausible report: ignore
      this.reinit(r);                                 // two in a row: the track really is there
      return true;
    }
    this.outliers = 0;

    // predict to the report time, then update with position + velocity
    this.x.predict(dt, this.sigmaAcc); this.y.predict(dt, this.sigmaAcc);
    // the CT model moved the mean along the arc; the CV predict above used a straight line — align
    this.x.p = px; this.y.p = py;
    const hasVel = r.gs != null && r.track != null && Number.isFinite(r.gs) && Number.isFinite(r.track);
    const [vx, vy] = Track.vel(r);
    this.x.update(zx, hasVel ? vx : null);
    this.y.update(zy, hasVel ? vy : null);

    // turn rate: reported, else from successive tracks (EWMA)
    if (r.trackRate != null && Number.isFinite(r.trackRate)) {
      this.omega = r.trackRate * Math.PI / 180;
    } else if (r.track != null && this.lastTrack != null && dt > 0.5) {
      let d = r.track - this.lastTrack;
      d = ((d + 540) % 360) - 180;
      const w = (d / dt) * Math.PI / 180;
      this.omega = this.updates ? 0.6 * this.omega + 0.4 * w : w;
    }
    if (r.track != null) this.lastTrack = r.track;
    if (this.onGround || (r.gs ?? 0) < 5) this.omega = 0;

    this.tFilter = r.tPos;
    this.updates++;
    this.rebaseCorrection();
    return true;
  }

  private reinit(r: Report): void {
    const [zx, zy] = this.toLocal(r.lat, r.lon);
    const jump = Math.hypot(zx - this.x.p, zy - this.y.p);
    const [vx, vy] = Track.vel(r);
    this.x = new Axis(zx, vx); this.y = new Axis(zy, vy);
    this.tFilter = r.tPos; this.outliers = 0; this.updates = 1;
    this.lastTrack = r.track; this.omega = 0;
    if (jump > REINIT_JUMP_M) { this.hasDisplayed = false; this.corrX = this.corrY = 0; }
    else this.rebaseCorrection();
  }

  /** after the estimate moved: keep the symbol where it was and let it ease onto the new solution */
  private rebaseCorrection(): void {
    if (!this.hasDisplayed) return;
    const dt = Math.min(MAX_PREDICT_S, Math.max(-2, (this.tDisp - this.tFilter) / 1000));
    const [px, py] = this.extrapolate(dt);
    this.corrX = this.dispX - px; this.corrY = this.dispY - py; this.tCorr = this.tDisp;
    const mag = Math.hypot(this.corrX, this.corrY);
    if (mag > REINIT_JUMP_M) { this.corrX = this.corrY = 0; }
  }

  status(now: number): TrackStatus | 'dropped' {
    const age = (now - this.tSeen) / 1000;
    const posAge = (now - this.tFilter) / 1000;
    if (age > (this.onGround ? COAST_DROP_GND_S : COAST_DROP_AIR_S) || posAge > MAX_PREDICT_S + 30) return 'dropped';
    if (this.updates < 1) return 'init';
    return posAge <= FRESH_S ? 'fresh' : 'coasting';
  }

  display(now: number): DisplayState {
    const tDisp = now - DISPLAY_LAG_MS;
    const dt = Math.min(MAX_PREDICT_S, Math.max(-2, (tDisp - this.tFilter) / 1000));
    let [x, y] = this.extrapolate(dt);
    // ease the residual correction away, rate-limited relative to the ground speed
    if (this.hasDisplayed && (this.corrX || this.corrY)) {
      const el = Math.max(0, (tDisp - this.tCorr) / 1000);
      const spd = Math.hypot(this.x.v, this.y.v);
      const mag = Math.hypot(this.corrX, this.corrY);
      const tau = Math.max(CORR_TAU_S, mag / (CORR_RATE_FRAC * spd + 3));
      const k = Math.exp(-el / tau);
      if (k < 0.02) { this.corrX = this.corrY = 0; }
      else { x += this.corrX * k; y += this.corrY * k; }
    }
    this.hasDisplayed = true; this.dispX = x; this.dispY = y; this.tDisp = tDisp;
    const [lat, lon] = this.toGeo(x, y);
    const vx = this.x.v, vy = this.y.v;
    const spdKt = Math.hypot(vx, vy) / KT;
    let track = spdKt > 8 ? (Math.atan2(vx, vy) * 180 / Math.PI + 360) % 360 : (this.lastTrack ?? 0);
    if (Math.abs(this.omega) >= TURN_RATE_MIN && spdKt > 8) track = (track + this.omega * dt * 180 / Math.PI + 720) % 360;
    const posAge = Math.max(0, (now - this.tFilter) / 1000);
    const alt = this.alt == null ? null : this.onGround ? this.alt : Math.max(0, this.alt + this.vs * FT_MIN * dt / 0.3048);
    const st = this.status(now);
    return { lat, lon, track, gs: spdKt, alt, status: st === 'dropped' ? 'coasting' : st, posAge };
  }
}

/* ─────────────────────────── track store ─────────────────────────── */

export class TrackManager {
  readonly tracks = new Map<string, Track>();
  /** client − server clock offset estimate, ms */
  private clockOffset: number | null = null;
  rejected = 0;

  /** map a server-stamped report batch onto the client clock and update the tracks */
  ingest(reports: { hex: string; lat: number; lon: number; seen: number | null; seenPos: number | null; gs: number | null; track: number | null;
    trackRate: number | null; onGround: boolean; alt: number | null; vs: number | null }[], serverNow: number | null, clientNow = Date.now()): void {
    if (serverNow != null && Number.isFinite(serverNow)) {
      const off = clientNow - serverNow;
      // network delay only ever makes the offset look larger — track the smaller values
      this.clockOffset = this.clockOffset == null ? off : Math.min(this.clockOffset * 0.9 + off * 0.1, off + 2000);
    }
    const base = serverNow != null && this.clockOffset != null ? serverNow + this.clockOffset : clientNow;
    for (const r of reports) {
      if (!r.hex || !Number.isFinite(r.lat) || !Number.isFinite(r.lon)) continue;
      const rep: Report = {
        hex: r.hex, lat: r.lat, lon: r.lon,
        tPos: base - Math.max(0, r.seenPos ?? r.seen ?? 0) * 1000,
        tSeen: base - Math.max(0, r.seen ?? 0) * 1000,
        gs: r.gs, track: r.track, trackRate: r.trackRate, onGround: r.onGround, alt: r.alt, vs: r.vs,
      };
      const t = this.tracks.get(r.hex);
      if (!t) this.tracks.set(r.hex, new Track(rep));
      else if (!t.update(rep)) this.rejected++;
    }
  }

  /** display states for all live tracks; dropped tracks are removed */
  display(now = Date.now()): Map<string, DisplayState> {
    const out = new Map<string, DisplayState>();
    for (const [hex, t] of this.tracks) {
      if (t.status(now) === 'dropped') { this.tracks.delete(hex); continue; }
      out.set(hex, t.display(now));
    }
    return out;
  }
}
