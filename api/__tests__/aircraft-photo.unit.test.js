/**
 * api/aircraft-photo.js — hex/reg 정규식 검증 회귀.
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

describe('aircraft-photo handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('파라미터 없음 → 400', async () => {
    const { default: handler } = await import('../aircraft-photo.js');
    const { req, res } = makeReqRes();
    await handler(req, res);
    const { statusCode, body } = res._get();
    expect(statusCode).toBe(400);
    expect(body.error).toMatch(/required/i);
  });

  it('잘못된 hex 형식 → 400', async () => {
    const { default: handler } = await import('../aircraft-photo.js');
    const { req, res } = makeReqRes({ query: { hex: 'XYZ123' } });
    await handler(req, res);
    const { statusCode } = res._get();
    expect(statusCode).toBe(400);
  });

  it('잘못된 reg 형식 → 400', async () => {
    const { default: handler } = await import('../aircraft-photo.js');
    const { req, res } = makeReqRes({ query: { reg: '<script>' } });
    await handler(req, res);
    const { statusCode } = res._get();
    expect(statusCode).toBe(400);
  });

  it('정상 reg + 외부 fetch 실패 → 200 with null', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));
    const { default: handler } = await import('../aircraft-photo.js');
    const { req, res } = makeReqRes({ query: { reg: 'HL8001' } });
    await handler(req, res);
    const { statusCode, body } = res._get();
    expect(statusCode).toBe(200);
    expect(body.image).toBeNull();
  });

  it('정상 hex + 외부 fetch 성공 → 사진 URL 반환', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        photos: [{
          large: { src: 'https://example.com/large.jpg' },
          photographer: 'John Doe',
          link: 'https://example.com/photo',
        }],
      }),
    }));
    const { default: handler } = await import('../aircraft-photo.js');
    const { req, res } = makeReqRes({ query: { hex: 'ABCDEF' } });
    await handler(req, res);
    const { statusCode, body } = res._get();
    expect(statusCode).toBe(200);
    expect(body.image).toBe('https://example.com/large.jpg');
    expect(body.source).toBe('planespotters');
  });
});
