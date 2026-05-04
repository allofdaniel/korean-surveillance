/**
 * api/aircraft-trace.js — hex 정규식 검증 + error response gate 회귀.
 *
 * 정규식이 깨지면 임의 string 이 외부 API URL 에 주입될 수 있음 (ICAO injection).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

describe('aircraft-trace handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VERCEL_ENV;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hex 파라미터 없으면 400', async () => {
    const { default: handler } = await import('../aircraft-trace.js');
    const { req, res } = makeReqRes({ query: {} });
    await handler(req, res);
    const { statusCode, body } = res._get();
    expect(statusCode).toBe(400);
    expect(body.error).toMatch(/hex/i);
  });

  it('hex 가 6자 hex 아니면 400', async () => {
    const { default: handler } = await import('../aircraft-trace.js');
    const cases = ['XYZ', '12345', '1234567', 'GGGGGG', '../../etc/passwd'];
    for (const hex of cases) {
      const { req, res } = makeReqRes({ query: { hex } });
      await handler(req, res);
      const { statusCode } = res._get();
      expect(statusCode).toBe(400);
    }
  });

  it('정상 hex (소문자) 통과 — 외부 fetch 호출됨', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ac: [] }),
    }));
    const { default: handler } = await import('../aircraft-trace.js');
    const { req, res } = makeReqRes({ query: { hex: '7c7c7c' } });
    await handler(req, res);
    const { statusCode } = res._get();
    expect(statusCode).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('hex/7c7c7c'));
  });

  it('정상 hex (대문자도 허용) → 소문자로 정규화', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ac: [] }),
    }));
    const { default: handler } = await import('../aircraft-trace.js');
    const { req, res } = makeReqRes({ query: { hex: 'ABCDEF' } });
    await handler(req, res);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('hex/abcdef'));
  });

  it('production 환경에서 error details leak 안됨', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('SECRET INTERNAL DETAIL')));
    process.env.NODE_ENV = 'production';

    const { default: handler } = await import('../aircraft-trace.js');
    const { req, res } = makeReqRes({ query: { hex: 'abcdef' } });
    await handler(req, res);
    const { statusCode, body } = res._get();
    expect(statusCode).toBe(500);
    // production 에서는 details 가 응답에 포함되지 않아야 함
    expect(body.details).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('SECRET INTERNAL DETAIL');
  });
});
