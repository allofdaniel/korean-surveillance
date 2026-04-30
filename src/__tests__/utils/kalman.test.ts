import { describe, it, expect } from 'vitest';
import { KalmanFilter1D, AircraftKalmanState, speedTrackToLatLonVelocity } from '../../utils/kalman';

describe('KalmanFilter1D', () => {
  it('converges near measurement after 30 predict+update cycles at stable position', () => {
    const filter = new KalmanFilter1D(37, 0, 3e-10, 1e-8);
    const initialP00 = filter.P00;

    for (let i = 0; i < 30; i++) {
      filter.predict(1);
      filter.update(37.0001);
    }

    // Position should be within 0.0005 of 37.0001
    expect(Math.abs(filter.pos - 37.0001)).toBeLessThan(0.0005);
    // Velocity should be finite
    expect(Number.isFinite(filter.vel)).toBe(true);
    // Covariance P00 should have decreased (filter became more certain)
    expect(filter.P00).toBeLessThan(initialP00);
  });
});

describe('speedTrackToLatLonVelocity', () => {
  it('eastbound 480kt at lat 37 produces positive vLon and near-zero vLat', () => {
    const { vLat, vLon } = speedTrackToLatLonVelocity(480, 90, 37);
    // 90 degrees track = east: vLon should be positive (moving east)
    expect(vLon).toBeGreaterThan(0);
    // vLat should be near zero for due-east heading
    expect(Math.abs(vLat)).toBeLessThan(1e-6);
  });
});

describe('AircraftKalmanState', () => {
  it('initializes correctly when measure is called with a new aircraft', () => {
    const ts = Date.now();
    const state = new AircraftKalmanState(37.5, 126.8, 0.001, 0.002, ts);

    // Verify initialization
    expect(state.latFilter.pos).toBeCloseTo(37.5, 5);
    expect(state.lonFilter.pos).toBeCloseTo(126.8, 5);
    expect(state.latFilter.vel).toBeCloseTo(0.001, 8);
    expect(state.lonFilter.vel).toBeCloseTo(0.002, 8);
    expect(state.lastPredictTs).toBe(ts);
    expect(state.lastMeasurementTs).toBe(ts);

    // Call measure to simulate new data
    const ts2 = ts + 1000;
    state.measure(37.501, 126.801, 0.001, 0.002, ts2);

    // After measure, lastPredictTs and lastMeasurementTs should be updated
    expect(state.lastPredictTs).toBe(ts2);
    expect(state.lastMeasurementTs).toBe(ts2);
    // Position should be close to measurement
    expect(Math.abs(state.latFilter.pos - 37.501)).toBeLessThan(0.001);
    expect(Math.abs(state.lonFilter.pos - 126.801)).toBeLessThan(0.001);
  });
});
