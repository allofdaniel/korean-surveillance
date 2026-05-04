/**
 * mapbox paint expression validator 회귀 테스트.
 *
 * v8 에서 NotamLayer 가 ['case', ..., ['interpolate', ['linear'], ['zoom'], ...]]
 * 패턴으로 작성되어 production 에서 layer 자체가 추가 안되던 critical bug.
 * 같은 패턴이 재발하지 않도록 정적 검증.
 */

import { describe, it, expect } from 'vitest';
import {
  findZoomExpressionViolations,
  validateMapboxPaintExpressions,
} from '../../utils/mapboxValidate';

describe('findZoomExpressionViolations', () => {
  it('top-level interpolate(zoom) — valid', () => {
    const expr = ['interpolate', ['linear'], ['zoom'], 4, 1, 12, 4];
    expect(findZoomExpressionViolations(expr)).toEqual([]);
  });

  it('top-level step(zoom) — valid', () => {
    const expr = ['step', ['zoom'], 0, 5, 1, 10, 2];
    expect(findZoomExpressionViolations(expr)).toEqual([]);
  });

  it('case wrapping interpolate(zoom) — INVALID (Mapbox throws)', () => {
    const expr = [
      'case',
      ['==', ['get', 'bucket'], 'wide'],
      ['interpolate', ['linear'], ['zoom'], 4, 1, 12, 1.5],
      ['interpolate', ['linear'], ['zoom'], 4, 2.5, 12, 4.5],
    ];
    const violations = findZoomExpressionViolations(expr);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toMatch(/zoom/);
  });

  it('match wrapping interpolate(zoom) — INVALID', () => {
    const expr = [
      'match', ['get', 'type'],
      'big', ['interpolate', ['linear'], ['zoom'], 4, 1, 12, 4],
      'small', 1,
      2, // default
    ];
    const violations = findZoomExpressionViolations(expr);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('interpolate(zoom) wrapping case — VALID (correct fix)', () => {
    const expr = [
      'interpolate', ['linear'], ['zoom'],
      4, [
        'case',
        ['==', ['get', 'bucket'], 'wide'], 1,
        2.5,
      ],
      12, [
        'case',
        ['==', ['get', 'bucket'], 'wide'], 1.5,
        4.5,
      ],
    ];
    expect(findZoomExpressionViolations(expr)).toEqual([]);
  });

  it('nested case wrapping case wrapping interpolate(zoom) — INVALID', () => {
    const expr = [
      'case',
      ['==', ['get', 'a'], 1],
      [
        'case',
        ['==', ['get', 'b'], 2],
        ['interpolate', ['linear'], ['zoom'], 4, 1, 12, 4],
        2,
      ],
      3,
    ];
    expect(findZoomExpressionViolations(expr).length).toBeGreaterThan(0);
  });

  it('plain literal value — no violation', () => {
    expect(findZoomExpressionViolations(0.5)).toEqual([]);
    expect(findZoomExpressionViolations('#ff0000')).toEqual([]);
    expect(findZoomExpressionViolations([1, 2, 3])).toEqual([]);
  });

  it('case without zoom — no violation', () => {
    const expr = [
      'case',
      ['==', ['get', 'validity'], 'future'], '#2196F3',
      '#FF9800',
    ];
    expect(findZoomExpressionViolations(expr)).toEqual([]);
  });
});

describe('validateMapboxPaintExpressions — full paint object', () => {
  it('valid paint object — no violations', () => {
    const paint = {
      'fill-color': ['case', ['==', ['get', 'v'], 'a'], '#fff', '#000'],
      'fill-opacity': 0.5,
      'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1, 12, 3],
    };
    expect(validateMapboxPaintExpressions(paint)).toEqual([]);
  });

  it('regression: NotamLayer v8 broken paint — flagged', () => {
    // v8 에 production 으로 push 된 broken expression 재현
    const broken = {
      'line-width': [
        'case',
        ['==', ['get', 'radiusBucket'], 'wide'],
        ['interpolate', ['linear'], ['zoom'], 4, 1.0, 12, 1.5],
        ['interpolate', ['linear'], ['zoom'], 4, 2.5, 12, 4.5],
      ],
    };
    const violations = validateMapboxPaintExpressions(broken);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toMatch(/line-width/);
  });

  it('NotamLayer v11 fixed paint — no violations', () => {
    // v11 에서 수정된 형식
    const fixed = {
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        4, [
          'case',
          ['==', ['get', 'radiusBucket'], 'wide'], 1.0,
          ['==', ['get', 'radiusBucket'], 'large'], 1.5,
          2.5,
        ],
        12, [
          'case',
          ['==', ['get', 'radiusBucket'], 'wide'], 1.5,
          ['==', ['get', 'radiusBucket'], 'large'], 2.5,
          4.5,
        ],
      ],
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        4, [
          'case',
          ['==', ['get', 'radiusBucket'], 'point'], 6,
          ['==', ['get', 'radiusBucket'], 'small'], 8,
          11,
        ],
      ],
    };
    expect(validateMapboxPaintExpressions(fixed)).toEqual([]);
  });
});
