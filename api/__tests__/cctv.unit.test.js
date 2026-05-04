/**
 * api/cctv.js — input validation 회귀 테스트.
 *
 * KR bbox 범위 외 좌표 거부, source whitelist, type whitelist 검증.
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

describe('cctv handler — input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // ITS API key 가 없으면 400 으로 빠르게 reject — bbox 검증 후
    delete process.env.VITE_ITS_API_KEY;
    delete process.env.VITE_DATA_GO_KR_API_KEY;
  });

  it('잘못된 type (its/ex 외) → 400', async () => {
    process.env.VITE_ITS_API_KEY = 'test-key';
    const { default: handler } = await import('../cctv.js');
    const { req, res } = makeReqRes({ query: { source: 'its', type: 'malicious' } });
    await handler(req, res);
    const { statusCode, body } = res._get();
    expect(statusCode).toBe(400);
    expect(body.error).toMatch(/type/);
  });

  it('알 수 없는 source → 400', async () => {
    const { default: handler } = await import('../cctv.js');
    const { req, res } = makeReqRes({ query: { source: 'unknown' } });
    await handler(req, res);
    const { statusCode } = res._get();
    expect(statusCode).toBe(400);
  });

  it('its source + API key 없음 → 400 (key not configured)', async () => {
    const { default: handler } = await import('../cctv.js');
    const { req, res } = makeReqRes({ query: { source: 'its', type: 'its' } });
    await handler(req, res);
    const { statusCode, body } = res._get();
    expect(statusCode).toBe(400);
    expect(body.error).toMatch(/key/i);
  });

  it('잘못된 bound (한반도 외) → 무시되고 KR 기본값 사용 (no error)', async () => {
    process.env.VITE_ITS_API_KEY = 'test-key';
    // fetch 가 호출되지만 mocking 안되어 실패 — 그래도 input validation 은 통과해야 함
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));
    const { default: handler } = await import('../cctv.js');
    const { req, res } = makeReqRes({
      query: { source: 'its', type: 'its', minX: '999', maxX: '999', minY: '999', maxY: '999' },
    });
    await handler(req, res);
    // 잘못된 bbox 는 거부 안 함 — 기본값으로 fallback 후 외부 호출 시도
    // status 가 400 이 *아니면* validation 통과한 것 (외부 fetch 실패는 다른 status)
    const { statusCode } = res._get();
    expect(statusCode).not.toBe(400);
  });
});
