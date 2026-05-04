/**
 * Mapbox GL JS expression validator — 우리 코드가 만든 paint/layout
 * expression 이 Mapbox 의 알려진 제약을 위반하는지 정적 검증.
 *
 * 가장 흔한 위반:
 *   1. zoom expression 은 top-level interpolate/step 안에서만 사용 가능.
 *      "zoom" expression may only be used as input to a top-level
 *      "step" or "interpolate" expression
 *
 * v8 에서 NotamLayer 의 line-width 가 ['case', ..., ['interpolate', ['linear'], ['zoom'], ...]]
 * 패턴으로 작성되어 production 에서 NOTAM layer 자체가 추가 안되던 버그 발생.
 * 회귀 테스트로 같은 패턴 재발 차단.
 */

type Expr = unknown;

/**
 * Mapbox 규칙: ['zoom'] expression 은 paint property 의 TOP-LEVEL interpolate/step
 * 의 input 위치 에서만 사용 가능. nested 된 위치 (case 안의 interpolate(zoom) 등)
 * 는 모두 invalid → Mapbox addLayer 시 throw.
 *
 * 알고리즘:
 *   1. paint property 의 top-level expression 검사
 *   2. 만약 top-level 이 interpolate/step 이고 input 이 ['zoom'] 이면 → input 위치는 OK
 *      (이후 자식 expression 들은 "이미 nested" 상태라 zoom 사용 불가)
 *   3. top-level 이 interpolate/step 이 아니거나 input 이 zoom 아니면 → 모든 zoom 사용 invalid
 *
 * 핵심: 한 번 nested 들어가면 그 안의 모든 zoom 사용이 위반.
 */
export function findZoomExpressionViolations(
  expr: Expr,
  path: string = '',
): string[] {
  if (!Array.isArray(expr)) return [];

  const op = expr[0];
  const isInterpolate =
    op === 'interpolate' || op === 'interpolate-hcl' || op === 'interpolate-lab';
  const isStep = op === 'step';

  // top-level interpolate/step 인지 검사
  if (isInterpolate || isStep) {
    const inputIdx = isInterpolate ? 2 : 1;
    const inputExpr = expr[inputIdx];
    const inputIsZoom =
      Array.isArray(inputExpr) && inputExpr[0] === 'zoom' && inputExpr.length === 1;

    if (inputIsZoom) {
      // input 은 valid. 다른 자식들에서 zoom 이 등장하면 위반 (nested 이므로).
      const violations: string[] = [];
      for (let i = 0; i < expr.length; i++) {
        if (i === inputIdx) continue;
        violations.push(...containsZoom(expr[i], `${path}[${i}]`));
      }
      return violations;
    }
    // input 이 zoom 이 아닌 interpolate/step (예: feature-state, get) — 모든 자식 일반 재귀
  }

  // 일반 op (case/match/literal/get 등) — 자식들에서 zoom 모두 위반.
  const violations: string[] = [];
  for (let i = 0; i < expr.length; i++) {
    violations.push(...containsZoom(expr[i], `${path}[${i}]`));
  }
  return violations;
}

/**
 * expression 트리 안에서 ['zoom'] (또는 자기 자신을 input 으로 가지는 nested
 * interpolate(zoom)) 이 등장하는지 검사. 발견되면 위반 메시지 반환.
 */
function containsZoom(expr: Expr, path: string): string[] {
  if (!Array.isArray(expr)) return [];
  const op = expr[0];

  // ['zoom'] 단독 — 위반
  if (op === 'zoom' && expr.length === 1) {
    return [
      `${path || '<root>'}: "zoom" expression must be input to top-level interpolate/step (not nested)`,
    ];
  }

  // nested interpolate(zoom) — 위반 (top-level 이 아닌 위치이므로)
  if (
    (op === 'interpolate' || op === 'interpolate-hcl' || op === 'interpolate-lab' || op === 'step')
  ) {
    const inputIdx = op === 'step' ? 1 : 2;
    const inputExpr = expr[inputIdx];
    if (Array.isArray(inputExpr) && inputExpr[0] === 'zoom') {
      return [
        `${path || '<root>'}: nested interpolate/step with zoom input — must be top-level only`,
      ];
    }
  }

  // 자식들 재귀
  const violations: string[] = [];
  for (let i = 0; i < expr.length; i++) {
    violations.push(...containsZoom(expr[i], `${path}[${i}]`));
  }
  return violations;
}

/**
 * paint/layout 객체 전체 검증 — 각 property 의 expression 별로 위반 수집.
 *
 * @returns 빈 배열이면 valid, 아니면 위반 메시지 배열.
 */
export function validateMapboxPaintExpressions(
  paint: Record<string, unknown>,
): string[] {
  const all: string[] = [];
  for (const [key, value] of Object.entries(paint)) {
    const violations = findZoomExpressionViolations(value, key);
    all.push(...violations);
  }
  return all;
}
