/**
 * api/radar-tile.js — Path Traversal 방어 회귀.
 *
 * 잘못된 경로가 정규식을 통과하면 외부 host (rainviewer) 외 임의 경로 접근 가능.
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
    send: (data) => { body = data; return res; },
    _get: () => ({ statusCode, body }),
  };
  return { req, res };
}

vi.mock('../_utils/cors.js', () => ({
  setCorsHeaders: vi.fn(() => false),
  checkRateLimit: vi.fn(async () => false),
}));

describe('radar-tile handler — path validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('path 파라미터 없음 → 400', async () => {
    const { default: handler } = await import('../radar-tile.js');
    const { req, res } = makeReqRes();
    await handler(req, res);
    const { statusCode, body } = res._get();
    expect(statusCode).toBe(400);
    expect(body.error).toMatch(/path/i);
  });

  it('path traversal (../) 차단', async () => {
    const { default: handler } = await import('../radar-tile.js');
    const cases = [
      '/../etc/passwd',
      '/v2/radar/../secret',
      '/v2/radar/foo/../bar',
      '//other.com/v2/radar/x/0/0/0/0.png',
    ];
    for (const path of cases) {
      const { req, res } = makeReqRes({ query: { path } });
      await handler(req, res);
      const { statusCode } = res._get();
      expect(statusCode).toBe(400);
    }
  });

  it('허용 패턴 외 경로 → 400', async () => {
    const { default: handler } = await import('../radar-tile.js');
    const cases = [
      '/admin',
      '/v2/cctv/foo.png',
      '/v2/radar/../../../etc',
      '/v2/radar/abc/0/0/0/0.txt', // .txt extension
      '/v2/radar/0/0/0/0.png', // missing layer name
    ];
    for (const path of cases) {
      const { req, res } = makeReqRes({ query: { path } });
      await handler(req, res);
      const { statusCode } = res._get();
      expect(statusCode).toBe(400);
    }
  });

  it('정상 path (regex 매칭) → fetch 호출', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => 'image/png' },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }));
    const { default: handler } = await import('../radar-tile.js');
    // validatePath regex: /^\/v2\/radar\/[a-z0-9_]+\/\d+\/\d+\/\d+\/\d+\.png$/i
    // 4개 숫자 + .png 가 마지막에 와야 함
    const { req, res } = makeReqRes({
      query: { path: '/v2/radar/abc123/256/5/10/15.png' },
    });
    await handler(req, res);
    const { statusCode } = res._get();
    expect(statusCode).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('tilecache.rainviewer.com/v2/radar/abc123'),
      expect.anything()
    );
  });

  it('upstream 에러 → status 그대로 전파', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: false,
      status: 404,
      headers: { get: () => null },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      json: () => Promise.resolve({ error: 'not found' }),
    }));
    const { default: handler } = await import('../radar-tile.js');
    const { req, res } = makeReqRes({
      query: { path: '/v2/radar/abc123/256/5/10/15.png' },
    });
    await handler(req, res);
    const { statusCode } = res._get();
    expect(statusCode).toBe(404);
  });
});
