/**
 * api/flight-route.js — callsign/reg/hex 정규식 검증 회귀.
 *
 * 잘못된 패턴이 정규식을 통과하면 외부 API 에 임의 string 이 주입될 수 있으므로
 * 핵심 input sanitizer 의 동작을 보장.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

function makeReqRes({ query = {} } = {}) {
  const req = { method: 'GET', headers: { host: 'localhost' }, query };
  let statusCode = 200;
  let body = null;
  const res = {
    setHeader: vi.fn(),
    status: (code) => { statusCode = code; return res; },
    json: (data) => { body = data; return res; },
    _get: () => ({ statusCode, body }),
  };
  return { req, res };
}

vi.mock('../_utils/cors.js', () => ({
  setCorsHeaders: vi.fn(() => false),
  checkRateLimit: vi.fn(async () => false),
}));

describe('flight-route handler — input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));
  });

  it('파라미터 없으면 400', async () => {
    const { default: handler } = await import('../flight-route.js');
    const { req, res } = makeReqRes({ query: {} });
    await handler(req, res);
    const { statusCode, body } = res._get();
    expect(statusCode).toBe(400);
    expect(body.error).toMatch(/parameter required/i);
  });

  it('잘못된 callsign 형식 (특수문자 포함) → 400', async () => {
    const { default: handler } = await import('../flight-route.js');
    const { req, res } = makeReqRes({ query: { callsign: 'KAL<script>' } });
    await handler(req, res);
    const { statusCode, body } = res._get();
    expect(statusCode).toBe(400);
    expect(body.error).toMatch(/Invalid/i);
  });

  it('잘못된 hex 형식 (6자 hex 아님) → 400', async () => {
    const { default: handler } = await import('../flight-route.js');
    const { req, res } = makeReqRes({ query: { hex: 'XYZNOTHEX' } });
    await handler(req, res);
    const { statusCode } = res._get();
    expect(statusCode).toBe(400);
  });

  it('잘못된 reg 형식 (너무 짧음) → 400', async () => {
    const { default: handler } = await import('../flight-route.js');
    const { req, res } = makeReqRes({ query: { reg: 'X' } });
    await handler(req, res);
    const { statusCode } = res._get();
    expect(statusCode).toBe(400);
  });

  it('정상 callsign + 외부 fetch 실패 → 200 with null source', async () => {
    const { default: handler } = await import('../flight-route.js');
    const { req, res } = makeReqRes({ query: { callsign: 'KAL319' } });
    await handler(req, res);
    const { statusCode, body } = res._get();
    // 외부 API 모두 실패해도 200 (callsign 검증 통과)
    expect(statusCode).toBe(200);
    expect(body.source).toBeNull();
  });

  it('SQL injection 시도 callsign → 400', async () => {
    const { default: handler } = await import('../flight-route.js');
    const { req, res } = makeReqRes({ query: { callsign: "KAL' OR 1=1--" } });
    await handler(req, res);
    const { statusCode } = res._get();
    expect(statusCode).toBe(400);
  });
});
