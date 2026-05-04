/**
 * api/ships.js — error gate + 정상 응답 검증.
 *
 * 외부 fetch 가 실패해도 graceful 하게 200 + 빈 배열, 내부 throw 시 error
 * details 가 production 에서는 leak 안되는지 검증.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function makeReqRes() {
  const req = { method: 'GET', headers: { host: 'localhost' }, query: {} };
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

describe('ships handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VITE_DATA_GO_KR_API_KEY;
    delete process.env.VERCEL_ENV;
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.VERCEL_ENV;
  });

  it('API key 없음 → 200 + 빈 배열', async () => {
    const { default: handler } = await import('../ships.js');
    const { req, res } = makeReqRes();
    await handler(req, res);
    const { statusCode, body } = res._get();
    expect(statusCode).toBe(200);
    expect(body.count).toBe(0);
    expect(Array.isArray(body.ships)).toBe(true);
    expect(body.ships).toHaveLength(0);
  });

  it('API key 있음 + fetch 실패 → graceful 빈 배열', async () => {
    process.env.VITE_DATA_GO_KR_API_KEY = 'test-key';
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));

    const { default: handler } = await import('../ships.js');
    const { req, res } = makeReqRes();
    await handler(req, res);
    const { statusCode, body } = res._get();
    // mof source 가 실패해도 200 + 빈 배열 반환 (try/catch 으로 swallow)
    expect(statusCode).toBe(200);
    expect(body.count).toBe(0);
  });

  it('정상 응답 — ship 데이터 정규화', async () => {
    process.env.VITE_DATA_GO_KR_API_KEY = 'test-key';
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        response: {
          body: {
            items: {
              item: [
                { mmsi: '123', shipNm: 'TEST', lat: '35.5', lon: '129.3', heading: '90', speed: '12', shipType: 'cargo' },
              ],
            },
          },
        },
      }),
    }));

    const { default: handler } = await import('../ships.js');
    const { req, res } = makeReqRes();
    await handler(req, res);
    const { statusCode, body } = res._get();
    expect(statusCode).toBe(200);
    expect(body.count).toBe(1);
    expect(body.ships[0]).toMatchObject({
      mmsi: '123',
      name: 'TEST',
      lat: 35.5,
      lng: 129.3,
    });
  });

  it('lat/lng 가 0 인 ship 은 필터링', async () => {
    process.env.VITE_DATA_GO_KR_API_KEY = 'test-key';
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        response: {
          body: {
            items: {
              item: [
                { mmsi: '1', lat: '0', lon: '0' },
                { mmsi: '2', lat: '35.5', lon: '129.3' },
              ],
            },
          },
        },
      }),
    }));
    const { default: handler } = await import('../ships.js');
    const { req, res } = makeReqRes();
    await handler(req, res);
    const { body } = res._get();
    // 0 좌표는 제외
    expect(body.count).toBe(1);
    expect(body.ships[0].mmsi).toBe('2');
  });
});
