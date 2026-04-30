import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseNotamDateString } from '../../utils/format';
import {
  parseNotamCoordinates,
  parseNotamPolygon,
  parseNotamCircleFromText,
  getNotamType,
  getCancelledNotamRef,
  getNotamValidity,
} from '../../utils/notam';
import { resolveNotamGeometry } from '../../utils/notamGeometry';

describe('parseNotamDateString', () => {
  it('parses YYMMDDHHMM format: "2601081600" → 2026-01-08T16:00Z', () => {
    const result = parseNotamDateString('2601081600');
    expect(result).not.toBeNull();
    expect(result!.getUTCFullYear()).toBe(2026);
    expect(result!.getUTCMonth()).toBe(0); // January
    expect(result!.getUTCDate()).toBe(8);
    expect(result!.getUTCHours()).toBe(16);
    expect(result!.getUTCMinutes()).toBe(0);
  });

  it('parses ISO 8601 branch: "2026-01-08T16:00:00Z" → 2026-01-08T16:00Z', () => {
    const result = parseNotamDateString('2026-01-08T16:00:00Z');
    expect(result).not.toBeNull();
    expect(result!.getUTCFullYear()).toBe(2026);
    expect(result!.getUTCMonth()).toBe(0);
    expect(result!.getUTCDate()).toBe(8);
    expect(result!.getUTCHours()).toBe(16);
    expect(result!.getUTCMinutes()).toBe(0);
  });

  it('returns null for invalid input "invalid"', () => {
    const result = parseNotamDateString('invalid');
    expect(result).toBeNull();
  });
});

describe('parseNotamCoordinates', () => {
  it('parses Q-line coordinates: 3536N12921E005 → lat≈35.6, lon≈129.35, radiusNM=5', () => {
    const qLine = 'Q)RKRR/QMRLC/IV/NBO/A/000/999/3536N12921E005';
    const result = parseNotamCoordinates(qLine);
    expect(result).not.toBeNull();
    // 35deg 36min = 35 + 36/60 = 35.6
    expect(result!.lat).toBeCloseTo(35.6, 1);
    // 129deg 21min = 129 + 21/60 = 129.35
    expect(result!.lon).toBeCloseTo(129.35, 1);
    expect(result!.radiusNM).toBe(5);
  });
});

describe('parseNotamPolygon', () => {
  it('parses 5-point DMS string with \\r\\n mid-sequence → returns closed ring', () => {
    // 5 DMS points in hyphen-separated format with a \r\n in the middle
    const fullText =
      'E) POLYGON AREA\r\n' +
      '363910N1272105E-363909N1272110E-3\r\n' +
      '63905N1272115E-363905N1272100E-363910N1272105E';
    const result = parseNotamPolygon(fullText);
    expect(result).not.toBeNull();
    const ring = result![0]!;
    // 5 points + closing point = 6, or already closed = 5
    expect(ring.length).toBeGreaterThanOrEqual(5);
    // Ring should be closed: first point === last point
    const first = ring[0]!;
    const last = ring[ring.length - 1]!;
    expect(first[0]).toBeCloseTo(last[0], 5);
    expect(first[1]).toBeCloseTo(last[1], 5);
    // Each element is [lon, lat]
    ring.slice(0, -1).forEach(([lon, lat]) => {
      expect(typeof lon).toBe('number');
      expect(typeof lat).toBe('number');
    });
  });
});

describe('getNotamValidity', () => {
  beforeEach(() => {
    // Mock system time to 2026-04-30T00:00:00Z
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-30T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "expired" when effective_end is 60 days in the past', () => {
    // 2026-04-30 - 60 days = 2026-03-01
    const notam = {
      notam_number: 'A0001/26',
      effective_start: '2601010000', // 2026-01-01 00:00Z
      effective_end: '2603010000',   // 2026-03-01 00:00Z — well past 2026-04-30
      full_text: 'NOTAMN\nB) 2601010000\nC) 2603010000'
    };
    const result = getNotamValidity(notam);
    expect(result).toBe('expired');
  });
});

// =====================================================================
// 추가 회귀 테스트 — 핵심 파서들 (DO-278A SRS-DATA-DISP)
// =====================================================================

describe('parseNotamCoordinates 추가 케이스', () => {
  it('null/undefined/empty → null', () => {
    expect(parseNotamCoordinates(null)).toBeNull();
    expect(parseNotamCoordinates(undefined)).toBeNull();
    expect(parseNotamCoordinates('')).toBeNull();
  });

  it('Q-line 없는 문자열 → null', () => {
    expect(parseNotamCoordinates('A)RKSI B)2604150440')).toBeNull();
  });

  it('잘못된 위도(91도) → null (유효성 검증)', () => {
    const ft = 'Q)RKRR/QMAHW/IV/BO/A/000/999/9100N12623E005';
    expect(parseNotamCoordinates(ft)).toBeNull();
  });

  it('남위/서경 처리', () => {
    const ft = 'Q)YBBB/QMRLC/IV/BO/A/000/100/3459S15123W050';
    const c = parseNotamCoordinates(ft);
    expect(c!.lat).toBeLessThan(0);
    expect(c!.lon).toBeLessThan(0);
  });
});

describe('parseNotamPolygon 추가 케이스', () => {
  it('번호 매긴 소수점-DMS 목록', () => {
    const ft = `E)WIP IN AREA BOUNDED BY
 1. 345839.64N 1262251.89E
 2. 345839.64N 1262300.25E
 3. 345833.09N 1262300.25E
 4. 345833.09N 1262252.99E
 5. 345833.51N 1262252.24E
 6. 345839.64N 1262251.89E`;
    const poly = parseNotamPolygon(ft);
    expect(poly).not.toBeNull();
    const ring = poly![0]!;
    expect(ring.length).toBeGreaterThanOrEqual(6);
    // 첫 vertex: 34°58'39.64"N → ≈34.9777
    expect(ring[0]![1]).toBeCloseTo(34.9777, 3);
  });

  it('DMS 체인 — 실제 NOTAM E2015/26 line wrap 패턴', () => {
    const ft = `E)AREA BOUNDED BY
372500N1295000E-372500N1310000E-365200N1310000E-365200N1305500E-36441
8N1305500E-365200N1304018E-365200N1300000E-365802N1300000E-370244N129
5000E-372500N1295000E
F)SFC`;
    const poly = parseNotamPolygon(ft);
    expect(poly).not.toBeNull();
    // 9 vertices + closing == 10 (혹은 이미 닫혀있음)
    expect(poly![0]!.length).toBeGreaterThanOrEqual(9);
  });

  it('2개 좌표만 있으면 폴리곤 아님 → null', () => {
    expect(parseNotamPolygon('362000N1262000E-363000N1263000E')).toBeNull();
  });

  it('null/undefined → null', () => {
    expect(parseNotamPolygon(null)).toBeNull();
    expect(parseNotamPolygon(undefined)).toBeNull();
  });
});

describe('parseNotamCircleFromText', () => {
  it('표준 NM 단위 (소수)', () => {
    const ft = 'E)TEMPO RESTRICTED AREA ACT AS FLW\nA CIRCLE RADIUS 1.8NM CENTERED ON 363144N1261938E';
    const c = parseNotamCircleFromText(ft);
    expect(c).not.toBeNull();
    expect(c!.radiusNM).toBeCloseTo(1.8, 2);
    // 36°31'44"N ≈ 36.529
    expect(c!.lat).toBeCloseTo(36.529, 2);
    // 126°19'38"E ≈ 126.327
    expect(c!.lon).toBeCloseTo(126.327, 2);
  });

  it('정수 NM', () => {
    expect(parseNotamCircleFromText('A CIRCLE RADIUS 4NM CENTERED ON 350845N1290743E')!.radiusNM).toBe(4);
  });

  it('미터(M) → NM 변환 (100M ≈ 0.054 NM)', () => {
    const c = parseNotamCircleFromText('A CIRCLE RADIUS 100M CENTERED ON 373547N1264720E');
    expect(c!.radiusNM).toBeCloseTo(0.054, 3);
  });

  it('km → NM 변환', () => {
    const c = parseNotamCircleFromText('CIRCLE RADIUS 5KM CENTERED ON 373547N1264720E');
    expect(c!.radiusNM).toBeCloseTo(2.7, 1);
  });

  it('"OF" 변형 (CIRCLE OF RADIUS)', () => {
    const c = parseNotamCircleFromText('CIRCLE OF RADIUS 2NM CENTERED ON 350845N1290743E');
    expect(c!.radiusNM).toBe(2);
  });

  it('CIRCLE 없으면 null', () => {
    expect(parseNotamCircleFromText('E)RWY 18 CLSD')).toBeNull();
    expect(parseNotamCircleFromText(null)).toBeNull();
    expect(parseNotamCircleFromText(undefined)).toBeNull();
  });

  it('잘못된 단위(MILES) → null', () => {
    expect(parseNotamCircleFromText('CIRCLE RADIUS 5MILES CENTERED ON 350845N1290743E')).toBeNull();
  });
});

describe('getNotamType', () => {
  it('NOTAMN/R/C 감지', () => {
    expect(getNotamType('(A1234/26 NOTAMN  \nQ)...')).toBe('N');
    expect(getNotamType('(A1234/26 NOTAMR A1230/26\nQ)...')).toBe('R');
    expect(getNotamType('(A1234/26 NOTAMC A1230/26\nQ)...')).toBe('C');
  });

  it('빈/null 입력 → N (default)', () => {
    expect(getNotamType('')).toBe('N');
    expect(getNotamType(null)).toBe('N');
    expect(getNotamType(undefined)).toBe('N');
  });
});

describe('getCancelledNotamRef', () => {
  it('NOTAMC 참조 추출', () => {
    expect(getCancelledNotamRef('(A1234/26 NOTAMC A1045/24\nQ)RKRR/QMAHW')).toBe('A1045/24');
  });

  it('참조 없음 → null', () => {
    expect(getCancelledNotamRef('(A1234/26 NOTAMN')).toBeNull();
  });
});

// =====================================================================
// resolveNotamGeometry — 우선순위 통합 함수 (가장 중요)
// =====================================================================
describe('resolveNotamGeometry priority chain', () => {
  it('1순위: E-text 폴리곤 (Q-line 도 있어도 폴리곤 채택)', () => {
    const ft = `(A0464/26 NOTAMN
Q)RKRR/QMAHW/IV/BO/A/000/999/3459N12623E005
E)WIP IN AREA BOUNDED BY
370050N1261446E-365407N1261433E-365232N1261728E-365324N1262509E-370050N1261446E`;
    const g = resolveNotamGeometry({ full_text: ft, location: 'RKJB' });
    expect(g).not.toBeNull();
    expect(g!.kind).toBe('polygon');
    expect(g!.source).toBe('polygon-text');
  });

  it('2순위: E-text circle (Q-line 보다 정확한 center/radius 사용)', () => {
    const ft = `(E2150/26 NOTAMN
Q)RKRR/QRTCA/IV/BO/W/000/005/3632N12620E002
E)TEMPO RESTRICTED AREA ACT AS FLW
A CIRCLE RADIUS 1.8NM CENTERED ON 363144N1261938E
F)SFC G)500FT AMSL`;
    const g = resolveNotamGeometry({ full_text: ft });
    expect(g!.source).toBe('text-circle');
    expect(g!.radiusNM).toBeCloseTo(1.8, 2);
    // E-text 의 정확한 중심 (Q-line 의 36.533 이 아니라 36.529)
    expect(g!.center.lat).toBeCloseTo(36.529, 2);
  });

  it('3순위: Q-line 만 있는 경우', () => {
    const ft = `(A1234/26 NOTAMN
Q)RKRR/QMRLC/IV/NBO/A/000/100/3729N12626E005
E)RWY 18/36 CLSD DUE TO MAINT`;
    const g = resolveNotamGeometry({ full_text: ft });
    expect(g!.source).toBe('qline');
  });

  it('4순위: q_lat/q_lon DB 컬럼 fallback', () => {
    const g = resolveNotamGeometry({
      q_lat: 37.46, q_lon: 126.44, q_radius: 5, location: 'RKSI',
    });
    expect(g!.source).toBe('qlat-lon');
    expect(g!.center.lat).toBe(37.46);
  });

  it('5순위: 공항 좌표 fallback', () => {
    const g = resolveNotamGeometry({ location: 'RKSI' });
    expect(g!.source).toBe('airport-fallback');
    expect(g!.radiusNM).toBe(5);
  });

  it('아무 정보 없으면 null', () => {
    expect(resolveNotamGeometry({})).toBeNull();
    expect(resolveNotamGeometry({ location: 'XXXX' })).toBeNull();
  });

  it('radiusBucket 경계값 정확성', () => {
    const point = resolveNotamGeometry({
      full_text: 'CIRCLE RADIUS 100M CENTERED ON 350845N1290743E',
    });
    expect(point!.radiusBucket).toBe('point');

    const small = resolveNotamGeometry({
      full_text: 'Q)RKRR/QMRLC/IV/NBO/A/000/100/3729N12626E003',
    });
    expect(small!.radiusBucket).toBe('small');

    const wide = resolveNotamGeometry({
      full_text: 'Q)RKRR/QMRLC/IV/NBO/A/000/999/3729N12626E150',
    });
    expect(wide!.radiusBucket).toBe('wide');
  });

  it('fillCoordinates 항상 valid GeoJSON Polygon coordinates', () => {
    const g = resolveNotamGeometry({
      full_text: 'Q)RKRR/QMRLC/IV/NBO/A/000/100/3729N12626E005',
    });
    const coords = g!.fillCoordinates;
    expect(Array.isArray(coords)).toBe(true);
    expect(Array.isArray(coords[0])).toBe(true);
    expect(coords[0]!.length).toBeGreaterThanOrEqual(4);
  });

  it('regression: Z0248/26 fireworks — Q-line 1NM 이 아니라 E-text 100M(point) 사용', () => {
    // 실제 RKRR NOTAM Z0248/26 — 이전에는 1NM 원으로 그려졌으나 실제는 100m 반경
    const ft = `(Z0248/26 NOTAMN
Q)RKRR/QWMLW/IV/BO/W/000/030/3735N12647E001
E)FIREWORKS WILL TAKE PLACE AS FLW :
A CIRCLE RADIUS 100M CENTERED ON 373547N1264720E`;
    const g = resolveNotamGeometry({ full_text: ft });
    expect(g!.source).toBe('text-circle');
    expect(g!.radiusNM).toBeLessThan(0.1);
    expect(g!.radiusBucket).toBe('point');
    expect(g!.kind).toBe('point');
  });
});
