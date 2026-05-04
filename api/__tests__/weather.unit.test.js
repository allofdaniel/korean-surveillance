/**
 * api/weather.js — type whitelist + KMA API key 검증 회귀.
 *
 * type 파라미터가 whitelist 외 값을 받아들이면 임의 endpoint 라우팅 위험.
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

describe('weather handler — type whitelist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NODE_ENV;
    delete process.env.VERCEL_ENV;
  });

  it('알 수 없는 type → 400', async () => {
    const { default: handler } = await import('../weather.js');
    const cases = ['malicious', '../../etc', 'unknown', '<script>', ''];
    for (const type of cases) {
      const { req, res } = makeReqRes({ query: { type } });
      await handler(req, res);
      const { statusCode, body } = res._get();
      expect(statusCode).toBe(400);
      expect(body.error).toMatch(/Invalid type/);
    }
  });

  it('case-insensitive type 매칭 (METAR 도 metar 로 처리)', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    }));
    const { default: handler } = await import('../weather.js');
    const { req, res } = makeReqRes({ query: { type: 'METAR' } });
    await handler(req, res);
    const { statusCode } = res._get();
    expect(statusCode).not.toBe(400); // 200 이거나 다른 상태 (외부 API 결과에 따라)
  });

  it('whitespace 포함 type → trim 후 매칭', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    }));
    const { default: handler } = await import('../weather.js');
    const { req, res } = makeReqRes({ query: { type: '  metar  ' } });
    await handler(req, res);
    const { statusCode } = res._get();
    expect(statusCode).not.toBe(400);
  });

  it('KMA-required type + key 없음 → 503', async () => {
    delete process.env.KMA_API_KEY;
    const { default: handler } = await import('../weather.js');
    const { req, res } = makeReqRes({ query: { type: 'kma_metar' } });
    await handler(req, res);
    const { statusCode, body } = res._get();
    expect(statusCode).toBe(503);
    expect(body.code).toBe('KMA_API_KEY_MISSING');
  });

  it('type 미지정 시 기본값 metar', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    }));
    const { default: handler } = await import('../weather.js');
    const { req, res } = makeReqRes({ query: {} });
    await handler(req, res);
    const { statusCode } = res._get();
    expect(statusCode).not.toBe(400);
  });
});
