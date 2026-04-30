/**
 * notamGeometry — resolveNotamGeometry() 의 동작/속성 테스트.
 *
 * priority chain 의 각 분기, 반환 객체의 invariant (fillCoordinates 가 항상
 * 닫힌 ring, centroid 가 polygon 의 평균, radiusBucket 경계값) 보장.
 */

import { describe, it, expect } from 'vitest';
import { resolveNotamGeometry } from '../../utils/notamGeometry';

describe('resolveNotamGeometry — invariants', () => {
  it('polygon kind: fillCoordinates 는 닫힌 ring 이며 centroid 는 vertex 평균', () => {
    const ft = `(A0001/26 NOTAMN
Q)RKRR/QMAHW/IV/BO/A/000/100/3700N12700E010
E)AREA BOUNDED BY
370000N1270000E-371000N1270000E-371000N1271000E-370000N1271000E-370000N1270000E`;
    const g = resolveNotamGeometry({ full_text: ft });
    expect(g!.kind).toBe('polygon');
    expect(g!.source).toBe('polygon-text');

    const ring = g!.fillCoordinates[0]!;
    expect(ring.length).toBeGreaterThanOrEqual(4);

    // 닫혀있어야 함
    const first = ring[0]!;
    const last = ring[ring.length - 1]!;
    expect(first[0]).toBeCloseTo(last[0], 6);
    expect(first[1]).toBeCloseTo(last[1], 6);

    // centroid 는 ring 의 vertex 평균 (closing vertex 포함). 5개 vertex 평균:
    //   lat: (37 + 37.1667 + 37.1667 + 37 + 37) / 5 ≈ 37.0667
    //   lon: (127 + 127 + 127.1667 + 127.1667 + 127) / 5 ≈ 127.0667
    expect(g!.centroid.lat).toBeCloseTo(37.067, 2);
    expect(g!.centroid.lon).toBeCloseTo(127.067, 2);
  });

  it('text-circle: center 와 radiusNM 이 E-text 와 일치 (Q-line 무시)', () => {
    const ft = `Q)RKRR/QMRLC/IV/NBO/A/000/100/3500N12900E020
E)A CIRCLE RADIUS 1.5NM CENTERED ON 351530N1293000E`;
    const g = resolveNotamGeometry({ full_text: ft });
    expect(g!.source).toBe('text-circle');
    expect(g!.radiusNM).toBeCloseTo(1.5, 2);
    expect(g!.center.lat).toBeCloseTo(35.258, 2); // 35°15'30"
    expect(g!.center.lon).toBeCloseTo(129.5, 2);  // 129°30'00"
  });

  it('qline: q_radius 가 0 일 때 fallback 5 NM 사용 (graceful 그리기)', () => {
    const ft = 'Q)RKRR/QMRLC/IV/NBO/A/000/100/3500N12900E000';
    const g = resolveNotamGeometry({ full_text: ft });
    expect(g!.source).toBe('qline');
    // radiusNM 0 은 falsy → fallback 5 적용 (작도 안되는 0NM 방지)
    expect(g!.radiusNM).toBe(5);
    expect(g!.radiusBucket).toBe('small');
  });

  it('qlat-lon: full_text 없어도 q_lat/q_lon 으로 작동', () => {
    const g = resolveNotamGeometry({
      q_lat: 36.5, q_lon: 128, q_radius: 10,
    });
    expect(g!.source).toBe('qlat-lon');
    expect(g!.center.lat).toBe(36.5);
    expect(g!.radiusNM).toBe(10);
  });

  it('airport-fallback: 알려진 ICAO 공항만 작동', () => {
    const known = resolveNotamGeometry({ location: 'RKSI' });
    expect(known!.source).toBe('airport-fallback');

    const unknown = resolveNotamGeometry({ location: 'XXXX' });
    expect(unknown).toBeNull();
  });
});

describe('radiusBucket 경계값 분류', () => {
  const cases: Array<{ rNM: number; bucket: 'point' | 'small' | 'medium' | 'large' | 'wide' }> = [
    { rNM: 0, bucket: 'point' },
    { rNM: 0.49, bucket: 'point' },
    { rNM: 0.5, bucket: 'small' },
    { rNM: 5, bucket: 'small' },
    { rNM: 5.01, bucket: 'medium' },
    { rNM: 25, bucket: 'medium' },
    { rNM: 25.01, bucket: 'large' },
    { rNM: 100, bucket: 'large' },
    { rNM: 100.01, bucket: 'wide' },
    { rNM: 500, bucket: 'wide' },
  ];

  for (const { rNM, bucket } of cases) {
    it(`radiusNM=${rNM} → ${bucket}`, () => {
      const g = resolveNotamGeometry({
        q_lat: 35, q_lon: 128, q_radius: rNM,
      });
      expect(g!.radiusBucket).toBe(bucket);
    });
  }
});

describe('알려진 실제 NOTAM regression cases', () => {
  it('Z0248/26 (fireworks 100M) — text-circle 사용, point bucket', () => {
    const ft = `(Z0248/26 NOTAMN
Q)RKRR/QWMLW/IV/BO/W/000/030/3735N12647E001
E)FIREWORKS WILL TAKE PLACE AS FLW :
A CIRCLE RADIUS 100M CENTERED ON 373547N1264720E`;
    const g = resolveNotamGeometry({ full_text: ft });
    expect(g!.source).toBe('text-circle');
    expect(g!.radiusNM).toBeLessThan(0.1);
    expect(g!.kind).toBe('point');
    expect(g!.radiusBucket).toBe('point');
  });

  it('E2150/26 (TEMPO RESTRICTED 1.8NM) — Q-line 의 2NM 이 아닌 E-text 1.8NM 사용', () => {
    const ft = `(E2150/26 NOTAMN
Q)RKRR/QRTCA/IV/BO/W/000/005/3632N12620E002
E)TEMPO RESTRICTED AREA ACT AS FLW
A CIRCLE RADIUS 1.8NM CENTERED ON 363144N1261938E
F)SFC G)500FT AMSL`;
    const g = resolveNotamGeometry({ full_text: ft });
    expect(g!.source).toBe('text-circle');
    expect(g!.radiusNM).toBeCloseTo(1.8, 2);
    expect(g!.center.lat).toBeCloseTo(36.529, 2);
  });

  it('FIR-wide NOTAM (radius 999) — 결과 반환은 하되 호출처가 filtering', () => {
    const ft = 'Q)RKRR/QMRLC/IV/NBO/A/000/999/3500N12900E999';
    const g = resolveNotamGeometry({ full_text: ft });
    expect(g!.radiusNM).toBe(999);
    expect(g!.radiusBucket).toBe('wide');
    // 호출처가 (radiusNM >= 999) 로 직접 필터링해야 함 — resolver 는 원시 데이터 보존
  });

  it('lowerAlt/upperAlt 는 Q-line 에서 추출 (FL → feet 변환)', () => {
    const ft = 'Q)RKRR/QMRLC/IV/NBO/A/000/100/3500N12900E010';
    const g = resolveNotamGeometry({ full_text: ft });
    // FL000 = 0 ft, FL100 = 10000 ft
    expect(g!.lowerAlt).toBe(0);
    expect(g!.upperAlt).toBe(10000);
  });
});
