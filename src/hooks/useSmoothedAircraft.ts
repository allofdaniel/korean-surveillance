import { useEffect, useRef, useState } from 'react';
import { AircraftKalmanState, speedTrackToLatLonVelocity } from '../utils/kalman';
import type { AircraftData } from './useAircraftData';

// 화면 갱신 주기 — 100+ 항공기 환경에서 30Hz 는 시각화 훅 재실행 비용이 크다.
// 15Hz 로 낮춰도 일반 cruise 속도에서 1프레임당 ~1px 이라 시각적으로 분간 안 됨.
const SMOOTH_UPDATE_INTERVAL_MS = 66; // ≈ 15 FPS

/**
 * useSmoothedAircraft - 항공기 위치 평활화 훅
 *
 * 백엔드는 ~15s 마다 최신 위치를 보내는데, 그대로 렌더하면 항공기가 점프한다.
 * 각 항공기에 1D Kalman filter 두 개(lat/lon)를 두고
 *  - 새 측정이 오면 update + 속도 fuse
 *  - 매 프레임 predict 로 위치 외삽
 * 결과는 `aircraft` 와 동일한 shape 의 배열(lat/lon만 평활화)이라 기존
 * 시각화 훅이 그대로 사용 가능하다.
 */
export default function useSmoothedAircraft(aircraft: AircraftData[]): AircraftData[] {
  // hex → Kalman 상태
  const filtersRef = useRef<Map<string, AircraftKalmanState>>(new Map());
  // 최신 raw aircraft 를 ref 로 보관 (RAF 루프에서 항상 최신값 사용)
  const aircraftRef = useRef<AircraftData[]>(aircraft);
  aircraftRef.current = aircraft;

  const [smoothed, setSmoothed] = useState<AircraftData[]>(aircraft);

  // 새 측정이 들어올 때마다 필터에 반영
  useEffect(() => {
    const filters = filtersRef.current;
    const now = Date.now();
    const activeHexes = new Set<string>();

    for (const ac of aircraft) {
      if (!ac.hex) continue;
      activeHexes.add(ac.hex);
      const ts = ac.timestamp || now;
      const { vLat, vLon } = speedTrackToLatLonVelocity(ac.ground_speed, ac.track, ac.lat);

      const existing = filters.get(ac.hex);
      if (!existing) {
        // 신규 항공기 — 직접 초기화 (속도는 ADS-B 보고값 사용)
        filters.set(ac.hex, new AircraftKalmanState(ac.lat, ac.lon, vLat, vLon, ts));
      } else {
        existing.measure(ac.lat, ac.lon, vLat, vLon, ts);
      }
    }

    // 더 이상 관측되지 않는 항공기 정리
    for (const hex of filters.keys()) {
      if (!activeHexes.has(hex)) filters.delete(hex);
    }
  }, [aircraft]);

  // 30 FPS RAF 루프로 평활화된 배열 갱신
  useEffect(() => {
    if (aircraft.length === 0) {
      setSmoothed(aircraft);
      return;
    }

    let rafId = 0;
    let lastEmit = 0;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      const now = performance.now();
      if (now - lastEmit >= SMOOTH_UPDATE_INTERVAL_MS) {
        lastEmit = now;
        const filters = filtersRef.current;
        const tsMs = Date.now();
        const next: AircraftData[] = aircraftRef.current.map(ac => {
          const f = filters.get(ac.hex);
          if (!f) return ac;
          // 지상 항공기는 평활화 의미 없음 — 원본 그대로
          if (ac.on_ground) return ac;
          const { lat, lon } = f.positionAt(tsMs);
          // lat/lon만 교체 — 다른 필드는 raw 유지
          return { ...ac, lat, lon };
        });
        setSmoothed(next);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [aircraft]);

  return smoothed;
}
