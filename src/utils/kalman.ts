import { logger } from './logger';

/**
 * 1D Constant-Velocity Kalman Filter
 *
 * State vector: x = [position, velocity]
 *   position - degrees (lat or lon)
 *   velocity - degrees / second
 *
 * Model (continuous-discrete white-noise acceleration):
 *   F = [[1, dt], [0, 1]]                            // 상태 천이
 *   Q = q * [[dt^4/4, dt^3/2], [dt^3/2, dt^2]]       // 프로세스 잡음
 *   H = [1, 0]                                       // 위치만 관측
 *   R = r                                            // 측정 잡음 분산
 *
 * 항공기 위경도가 lat/lon 축에서 거의 독립적이므로 두 축에 대해 각각
 * 1D 필터를 돌리면 4D Kalman과 동일한 효과를 얻으면서 계산이 단순해진다.
 */
export class KalmanFilter1D {
  // 상태
  pos: number;
  vel: number;
  // 공분산 P (대칭, 4개 원소만 저장)
  P00: number;
  P01: number;
  P11: number;
  // 잡음 파라미터
  readonly Q: number; // 가속도 분산 (deg^2 / s^4)
  readonly R: number; // 위치 측정 분산 (deg^2)

  constructor(initialPos: number, initialVel: number, Q: number, R: number) {
    this.pos = initialPos;
    this.vel = initialVel;
    // 초기 불확실성: 위치는 거의 확실, 속도는 큰 불확실성
    this.P00 = 1e-6;
    this.P01 = 0;
    this.P11 = 1e-2;
    this.Q = Q;
    this.R = R;
  }

  /** 예측 단계 — dt(초) 후의 상태를 추정 */
  predict(dt: number): void {
    if (dt <= 0) return;

    // x = F x
    this.pos += this.vel * dt;

    // P = F P F^T + Q_d
    const dt2 = dt * dt;
    const dt3 = dt2 * dt;
    const dt4 = dt3 * dt;
    const qPP = this.Q * dt4 / 4;
    const qPV = this.Q * dt3 / 2;
    const qVV = this.Q * dt2;

    // F P F^T
    //   [[P00 + dt(P10+P01) + dt^2 P11,  P01 + dt P11],
    //    [P10 + dt P11,                  P11]]
    // (P10 = P01)
    const newP00 = this.P00 + 2 * this.P01 * dt + this.P11 * dt2 + qPP;
    const newP01 = this.P01 + this.P11 * dt + qPV;
    const newP11 = this.P11 + qVV;
    this.P00 = newP00;
    this.P01 = newP01;
    this.P11 = newP11;
  }

  /** 위치 측정 z 로 갱신 단계 */
  update(z: number): void {
    const y = z - this.pos;
    const S = this.P00 + this.R;
    if (S <= 0) return;
    const K0 = this.P00 / S;
    const K1 = this.P01 / S;

    this.pos += K0 * y;
    this.vel += K1 * y;

    const oldP00 = this.P00;
    const oldP01 = this.P01;
    this.P00 = (1 - K0) * oldP00;
    this.P01 = (1 - K0) * oldP01;
    this.P11 = this.P11 - K1 * oldP01;
  }

  /** 직접 측정된 속도(예: ADS-B gs+track)를 약하게 융합 — 필터 수렴 가속용 */
  fuseVelocity(measuredVel: number, weight: number): void {
    if (weight <= 0) return;
    const w = Math.min(1, Math.max(0, weight));
    this.vel = this.vel + w * (measuredVel - this.vel);
    // 외부 속도 측정으로 인한 불확실성 반영 — 이후 update 시 K 최적성 유지
    this.P11 = this.P11 * (1 - w * 0.5) + w * this.R;
  }
}

/**
 * 한 항공기의 위경도 추적 상태.
 * 두 개의 1D Kalman filter를 묶어 lat/lon을 동시에 다룬다.
 */
export class AircraftKalmanState {
  latFilter: KalmanFilter1D;
  lonFilter: KalmanFilter1D;
  /** 마지막 predict 호출 시각(ms) — 다음 dt 계산용 */
  lastPredictTs: number;
  /** 마지막 측정 시각(ms) */
  lastMeasurementTs: number;

  // 잡음 파라미터 — 1Hz 폴링 환경 가정
  // dt 가 1초로 짧기 때문에 prediction 외삽이 적고, 측정을 빨리 반영해도 큰 점프 없음.
  // Q: 항공기 가속도 ~2 m/s² → 1.8e-5 deg/s² → Q ≈ 3e-10
  // R: ADS-B 노미널 정확도 ~10m → 1e-4 deg → R ≈ 1e-8 (작게 두어 빠른 보정)
  static readonly Q_LAT = 3e-10;
  static readonly Q_LON = 3e-10;
  static readonly R_LAT = 1e-8;
  static readonly R_LON = 1e-8;

  constructor(lat: number, lon: number, vLat: number, vLon: number, ts: number) {
    this.latFilter = new KalmanFilter1D(lat, vLat, AircraftKalmanState.Q_LAT, AircraftKalmanState.R_LAT);
    this.lonFilter = new KalmanFilter1D(lon, vLon, AircraftKalmanState.Q_LON, AircraftKalmanState.R_LON);
    this.lastPredictTs = ts;
    this.lastMeasurementTs = ts;
  }

  /** 새 측정으로 갱신 — 위치 update + 속도 약하게 fuse */
  measure(lat: number, lon: number, vLat: number, vLon: number, ts: number): void {
    // 측정 시각까지 predict — 마지막 predict 이후 경과 시간만큼
    const dt = (ts - this.lastPredictTs) / 1000;
    if (dt > 0) {
      this.latFilter.predict(dt);
      this.lonFilter.predict(dt);
    }
    // 위치 갱신
    this.latFilter.update(lat);
    this.lonFilter.update(lon);
    // 속도 약하게 융합 (ADS-B 보고된 gs+track 은 신뢰도 높지만 노이즈도 있음)
    this.latFilter.fuseVelocity(vLat, 0.3);
    this.lonFilter.fuseVelocity(vLon, 0.3);
    this.lastPredictTs = ts;
    this.lastMeasurementTs = ts;
  }

  /** 임의 시각 ts 의 보간 위치 — 외부 변경 없이 임시 prediction */
  positionAt(ts: number): { lat: number; lon: number } {
    const dt = (ts - this.lastPredictTs) / 1000;
    if (dt <= 0) return { lat: this.latFilter.pos, lon: this.lonFilter.pos };
    // 비파괴 예측: pos + vel * dt (P 갱신 없음)
    return {
      lat: this.latFilter.pos + this.latFilter.vel * dt,
      lon: this.lonFilter.pos + this.lonFilter.vel * dt,
    };
  }

  /** 시각 ts 까지 필터 상태를 진행시킴 (RAF 루프에서 호출) */
  advance(ts: number): void {
    const dt = (ts - this.lastPredictTs) / 1000;
    if (dt <= 0) return;
    this.latFilter.predict(dt);
    this.lonFilter.predict(dt);
    this.lastPredictTs = ts;
  }
}

/**
 * ADS-B `ground_speed` (knots) + `track` (degrees) 를 lat/lon 축
 * 속도(deg/s)로 변환.
 */
export function speedTrackToLatLonVelocity(
  groundSpeedKt: number,
  trackDeg: number,
  lat: number
): { vLat: number; vLon: number } {
  if (!Number.isFinite(groundSpeedKt) || !Number.isFinite(trackDeg)) {
    return { vLat: 0, vLon: 0 };
  }
  const KT_TO_MS = 0.514444;
  const speedMs = groundSpeedKt * KT_TO_MS;
  const trackRad = (trackDeg * Math.PI) / 180;
  // 항공 track: 0=북, 90=동 (표준)
  const vEastMs = speedMs * Math.sin(trackRad);
  const vNorthMs = speedMs * Math.cos(trackRad);
  // 미터 → 도 변환
  const vLat = vNorthMs / 110540;
  const cosLat = Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  // 극지방(|lat|>85)에서 경도 속도 계산 불가 — 극 근사 무효
  if (Math.abs(lat) > 85) {
    logger.warn('kalman', `speedTrackToLatLonVelocity: lat=${lat} > 85°, vLon 강제 0 (극 근사 무효)`);
    return { vLat, vLon: 0 };
  }
  const vLon = vEastMs / (111320 * cosLat);
  return { vLat, vLon };
}
