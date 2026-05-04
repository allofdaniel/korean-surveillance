/**
 * api/hls-proxy.js — SSRF 방어 + URL allowlist 회귀 테스트.
 *
 * 이 helper 는 외부 m3u8 스트림을 프록시하므로 SSRF (private IP 리다이렉트)
 * 와 임의 host 우회를 차단해야 함. 정규식이 깨지면 심각한 보안 결함 노출.
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

describe('hls-proxy handler — SSRF & allowlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('url 파라미터 없으면 400', async () => {
    const { default: handler } = await import('../hls-proxy.js');
    const { req, res } = makeReqRes();
    await handler(req, res);
    const { statusCode, body } = res._get();
    expect(statusCode).toBe(400);
    expect(body.error).toMatch(/Invalid|disallowed/i);
  });

  it('allowlist 외 host → 400', async () => {
    const { default: handler } = await import('../hls-proxy.js');
    const cases = [
      'https://evil.com/stream.m3u8',
      'http://localhost/admin',
      'http://127.0.0.1/foo',
      'http://10.0.0.1/foo',
      'file:///etc/passwd',
    ];
    for (const url of cases) {
      const { req, res } = makeReqRes({ query: { url } });
      await handler(req, res);
      const { statusCode } = res._get();
      expect(statusCode).toBe(400);
    }
  });

  it('allowlist host (cctvsec.ktict.co.kr) 통과', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: (k) => k === 'content-type' ? 'application/vnd.apple.mpegurl' : null },
      text: () => Promise.resolve('#EXTM3U\nseg1.ts'),
    }));
    const { default: handler } = await import('../hls-proxy.js');
    const { req, res } = makeReqRes({
      query: { url: 'https://cctvsec.ktict.co.kr/path/stream.m3u8' },
    });
    await handler(req, res);
    const { statusCode } = res._get();
    expect(statusCode).toBe(200);
  });

  it('redirect to private IP → 502 (SSRF 차단)', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: false,
      status: 302,
      headers: {
        get: (k) => k === 'location' ? 'http://192.168.1.1/secret' : null,
      },
    }));
    const { default: handler } = await import('../hls-proxy.js');
    const { req, res } = makeReqRes({
      query: { url: 'https://cctvsec.ktict.co.kr/redirect.m3u8' },
    });
    await handler(req, res);
    const { statusCode, body } = res._get();
    expect(statusCode).toBe(502);
    expect(body.error).toMatch(/private address/i);
  });

  it('redirect to disallowed host → 502', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: false,
      status: 302,
      headers: {
        get: (k) => k === 'location' ? 'https://evil.example.com/foo' : null,
      },
    }));
    const { default: handler } = await import('../hls-proxy.js');
    const { req, res } = makeReqRes({
      query: { url: 'https://cctvsec.ktict.co.kr/redirect.m3u8' },
    });
    await handler(req, res);
    const { statusCode, body } = res._get();
    expect(statusCode).toBe(502);
    expect(body.error).toMatch(/disallowed host/i);
  });

  it('subdomain (ktict.co.kr 의 host suffix) 통과', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => null },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }));
    const { default: handler } = await import('../hls-proxy.js');
    const { req, res } = makeReqRes({
      query: { url: 'https://sub.cctvsec.ktict.co.kr/seg.ts' },
    });
    await handler(req, res);
    const { statusCode } = res._get();
    // allowlist 의 endsWith('.' + h) 매칭으로 통과해야 함
    expect(statusCode).toBe(200);
  });
});
