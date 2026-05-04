/**
 * api/vworld-data.js — type whitelist + size whitelist + bbox 검증.
 *
 * type/size 가 whitelist 외 값을 통과하면 외부 V-World API URL injection 위험.
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

// vworld-data.js 가 module-level 에서 process.env.VITE_VWORLD_API_KEY 를 읽으므로
// 각 테스트마다 vi.resetModules() 로 fresh import 필요
async function importHandler() {
  vi.resetModules();
  return (await import('../vworld-data.js')).default;
}

describe('vworld-data handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VITE_VWORLD_API_KEY;
  });

  it('API key 없음 → 400', async () => {
    const handler = await importHandler();
    const { req, res } = makeReqRes({ query: { type: 'buildings' } });
    await handler(req, res);
    const { statusCode, body } = res._get();
    expect(statusCode).toBe(400);
    expect(body.error).toMatch(/V-World key/i);
  });

  it('알 수 없는 type → 400', async () => {
    process.env.VITE_VWORLD_API_KEY = 'test-key';
    const handler = await importHandler();
    const cases = ['malicious', '../../etc', '', undefined];
    for (const type of cases) {
      const { req, res } = makeReqRes({ query: { type } });
      await handler(req, res);
      const { statusCode } = res._get();
      expect(statusCode).toBe(400);
    }
  });

  it('정상 type (buildings/special/roads) 통과', async () => {
    process.env.VITE_VWORLD_API_KEY = 'test-key';
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ response: { result: {} } }),
    }));
    const handler = await importHandler();

    for (const type of ['buildings', 'special', 'roads']) {
      const { req, res } = makeReqRes({ query: { type } });
      await handler(req, res);
      const { statusCode } = res._get();
      expect(statusCode).toBe(200);
    }
  });

  it('잘못된 size 무시 — whitelist 외 값은 기본값으로 fallback', async () => {
    process.env.VITE_VWORLD_API_KEY = 'test-key';
    let capturedUrl = '';
    global.fetch = vi.fn((url) => {
      capturedUrl = String(url);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    });
    const handler = await importHandler();
    const { req, res } = makeReqRes({
      query: { type: 'buildings', size: '999999/inject' },
    });
    await handler(req, res);
    expect(capturedUrl).not.toContain('999999');
    expect(capturedUrl).not.toContain('inject');
    expect(capturedUrl).toMatch(/size=1000/);
  });

  it('한반도 외 좌표 → 기본값으로 clamp', async () => {
    process.env.VITE_VWORLD_API_KEY = 'test-key';
    let capturedUrl = '';
    global.fetch = vi.fn((url) => {
      capturedUrl = String(url);
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });
    const handler = await importHandler();
    const { req, res } = makeReqRes({
      query: { type: 'buildings', minX: '999', maxX: '999', minY: '999', maxY: '999' },
    });
    await handler(req, res);
    expect(capturedUrl).toContain('BOX(126,35,128,37)');
  });
});
