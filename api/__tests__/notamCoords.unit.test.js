/**
 * api/_utils/notamCoords.js — Q-line 파서 회귀 테스트.
 *
 * api/notam.js + 향후 다른 api 가 동일 정규식을 reimplement 하지 않도록
 * 단일 소스로 통합. 이 helper 가 깨지면 NOTAM 좌표/반경/QCODE 가 모두 잘못됨.
 */

import { describe, it, expect } from 'vitest';
import {
  parseQLineCoords,
  parseQLine,
  extractQCode,
} from '../_utils/notamCoords.js';

describe('parseQLineCoords', () => {
  it('표준 Q-line 좌표 파싱', () => {
    const ft = 'Q)RKRR/QMRLC/IV/NBO/A/000/100/3536N12921E005';
    const c = parseQLineCoords(ft);
    expect(c).not.toBeNull();
    // 35°36' = 35 + 36/60 = 35.6
    expect(c.lat).toBeCloseTo(35.6, 2);
    // 129°21' = 129 + 21/60 = 129.35
    expect(c.lon).toBeCloseTo(129.35, 2);
  });

  it('남위/서경 부호 처리', () => {
    const ft = 'Q)YBBB/QMRLC/IV/BO/A/000/100/3459S15123W050';
    const c = parseQLineCoords(ft);
    expect(c.lat).toBeLessThan(0);
    expect(c.lon).toBeLessThan(0);
  });

  it('Q-line 없으면 null', () => {
    expect(parseQLineCoords('A)RKSI B)2604150440')).toBeNull();
    expect(parseQLineCoords(null)).toBeNull();
    expect(parseQLineCoords('')).toBeNull();
  });
});

describe('parseQLine — 좌표 + 반경 + 고도 통합', () => {
  it('전체 필드 추출', () => {
    const ft = 'Q)RKRR/QMAHW/IV/BO/A/000/999/3459N12623E005';
    const q = parseQLine(ft);
    expect(q).not.toBeNull();
    expect(q.lat).toBeCloseTo(34.983, 2);
    expect(q.lon).toBeCloseTo(126.383, 2);
    expect(q.radius).toBe(5);
    expect(q.lowerFL).toBe(0);
    expect(q.upperFL).toBe(999);
  });

  it('999 NM (FIR-wide) NOTAM', () => {
    const ft = 'Q)RKRR/QMRLC/IV/NBO/A/000/999/3500N12900E999';
    const q = parseQLine(ft);
    expect(q.radius).toBe(999);
  });

  it('Q-line 없으면 null', () => {
    expect(parseQLine('not a notam')).toBeNull();
    expect(parseQLine(null)).toBeNull();
  });
});

describe('extractQCode', () => {
  it('표준 QCODE 추출 (QMRLC/QMAHW/QRTCA 등)', () => {
    expect(extractQCode('Q)RKRR/QMRLC/IV/NBO/A/000/100/3500N12900E005')).toBe('QMRLC');
    expect(extractQCode('Q)RKRR/QMAHW/IV/BO/A/000/999/3459N12623E005')).toBe('QMAHW');
    expect(extractQCode('Q)RKRR/QRTCA/IV/BO/W/000/005/3632N12620E002')).toBe('QRTCA');
  });

  it('Q-line 또는 qcode 없으면 빈 문자열', () => {
    expect(extractQCode('A)RKSI B)2604150440')).toBe('');
    expect(extractQCode(null)).toBe('');
    expect(extractQCode('')).toBe('');
  });
});
