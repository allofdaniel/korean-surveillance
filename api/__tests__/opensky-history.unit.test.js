/**
 * api/opensky-history.js — icao24 정규식 검증 회귀.
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

describe('opensky-history handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENSKY_CLIENT_ID;
    delete process.env.OPENSKY_CLIENT_SECRET;
  });

  it('icao24 없으면 400', async () => {
    const { default: handler } = await import('../opensky-history.js');
    const { req, res } = makeReqRes();
    await handler(req, res);
    const { statusCode, body } = res._get();
    expect(statusCode).toBe(400);
    expect(body.error).toMatch(/icao24/i);
  });

  it('잘못된 icao24 (6자 hex 외) → 400', async () => {
    const { default: handler } = await import('../opensky-history.js');
    const cases = [
      'XYZ123',  // hex 아님
      '12345',   // 5자
      '1234567', // 7자
      'GGGGGG',  // hex 아님
      '<script>',
      '../../etc',
    ];
    for (const icao24 of cases) {
      const { req, res } = makeReqRes({ query: { icao24 } });
      await handler(req, res);
      const { statusCode } = res._get();
      expect(statusCode).toBe(400);
    }
  });

  it('정상 icao24 (대소문자 무관) → fetch 호출', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ path: [] }),
      text: () => Promise.resolve(''),
    }));
    const { default: handler } = await import('../opensky-history.js');
    const { req, res } = makeReqRes({ query: { icao24: 'ABCDEF' } });
    await handler(req, res);
    // 소문자로 정규화 후 외부 호출
    const calls = global.fetch.mock.calls.map(c => String(c[0]));
    const hasIcao = calls.some(url => url.includes('abcdef'));
    expect(hasIcao).toBe(true);
  });
});
