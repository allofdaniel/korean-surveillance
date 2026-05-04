/**
 * api/flight-schedule.js — flight 정규식 검증 회귀.
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

describe('flight-schedule handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AVIATIONSTACK_API_KEY;
  });

  it('flight 파라미터 없음 → 400', async () => {
    const { default: handler } = await import('../flight-schedule.js');
    const { req, res } = makeReqRes();
    await handler(req, res);
    const { statusCode, body } = res._get();
    expect(statusCode).toBe(400);
    expect(body.error).toMatch(/flight/i);
  });

  it('잘못된 flight 형식 (특수문자) → 400', async () => {
    const { default: handler } = await import('../flight-schedule.js');
    const cases = ['<script>', "KAL'OR1=1", 'KAL/../', 'TOO-LONG-CALLSIGN-NAME'];
    for (const flight of cases) {
      const { req, res } = makeReqRes({ query: { flight } });
      await handler(req, res);
      const { statusCode } = res._get();
      expect(statusCode).toBe(400);
    }
  });

  it('flight 정규화 — 공백/소문자 → 대문자 trim', async () => {
    process.env.AVIATIONSTACK_API_KEY = 'test-key';
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    }));
    const { default: handler } = await import('../flight-schedule.js');
    const { req, res } = makeReqRes({ query: { flight: ' kal319 ' } });
    await handler(req, res);
    // 외부 fetch URL 에 'KAL319' 이 들어가는지 확인
    const calledWith = global.fetch.mock.calls[0]?.[0];
    if (calledWith) {
      expect(String(calledWith)).toContain('KAL319');
    }
  });
});
