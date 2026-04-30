/**
 * Unit tests for api/aircraft.js
 * Uses vitest with dynamic import and vi.stubGlobal for fetch mocking
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Helper: create a minimal req/res mock
function makeReqRes(query = {}) {
  const req = {
    method: 'GET',
    query,
    headers: { host: 'localhost', 'x-forwarded-for': '127.0.0.1' },
    url: `/api/aircraft?${new URLSearchParams(query).toString()}`,
  };
  const headers = {};
  let statusCode = 200;
  let body = null;
  const res = {
    setHeader: (k, v) => { headers[k] = v; },
    status: (code) => { statusCode = code; return res; },
    json: (data) => { body = data; return res; },
    _get: () => ({ statusCode, headers, body }),
  };
  return { req, res };
}

// Minimal CORS/rate-limit mock — allows all requests through
vi.mock('../_utils/cors.js', () => ({
  setCorsHeaders: vi.fn(() => false),
  checkRateLimit: vi.fn(async () => false),
}));

describe('aircraft handler — parameter validation', () => {
  let handler;

  beforeEach(async () => {
    // Reset module registry so module-level state resets between tests
    vi.resetModules();
    vi.mock('../_utils/cors.js', () => ({
      setCorsHeaders: vi.fn(() => false),
      checkRateLimit: vi.fn(async () => false),
    }));
    const mod = await import('../aircraft.js');
    handler = mod.default;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 with "required" when lat and lon are missing', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { req, res } = makeReqRes({});
    await handler(req, res);
    const { statusCode, body } = res._get();
    expect(statusCode).toBe(400);
    expect(body.error).toMatch(/required/i);
  });

  it('returns 400 when radius=600 (out of range)', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { req, res } = makeReqRes({ lat: '37', lon: '127', radius: '600' });
    await handler(req, res);
    const { statusCode, body } = res._get();
    expect(statusCode).toBe(400);
    expect(body.error).toBeTruthy();
  });
});

describe('aircraft handler — data merging', () => {
  let handler;

  beforeEach(async () => {
    vi.resetModules();
    vi.mock('../_utils/cors.js', () => ({
      setCorsHeaders: vi.fn(() => false),
      checkRateLimit: vi.fn(async () => false),
    }));
    const mod = await import('../aircraft.js');
    handler = mod.default;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with 3 aircraft from airplanes.live when OpenSky times out', async () => {
    const mockAircraft = [
      { hex: 'abc001', lat: 37.1, lon: 127.1, alt_baro: 10000, gs: 450, track: 90, flight: 'KAL001' },
      { hex: 'abc002', lat: 37.2, lon: 127.2, alt_baro: 20000, gs: 400, track: 180, flight: 'OZA002' },
      { hex: 'abc003', lat: 37.3, lon: 127.3, alt_baro: 30000, gs: 500, track: 270, flight: 'JNA003' },
    ];

    // airplanes.live: returns 3 aircraft
    // OpenSky: never resolves (simulates timeout that will be caught by AbortController in 5s)
    // We mock fetch to return different responses based on URL
    vi.stubGlobal('fetch', vi.fn(async (url, options) => {
      const urlStr = String(url);
      if (urlStr.includes('airplanes.live')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({ ac: mockAircraft }),
        };
      }
      if (urlStr.includes('opensky-network.org') || urlStr.includes('auth.opensky-network.org')) {
        // Simulate timeout by checking abort signal
        if (options?.signal) {
          return new Promise((_, reject) => {
            options.signal.addEventListener('abort', () => {
              reject(new Error('The operation was aborted'));
            });
          });
        }
        // No signal — just hang forever (shouldn't reach here)
        return new Promise(() => {});
      }
      // Default
      return { ok: false, status: 404, json: async () => ({}) };
    }));

    const { req, res } = makeReqRes({ lat: '37', lon: '127', radius: '100' });

    const start = Date.now();
    await handler(req, res);
    const elapsed = Date.now() - start;

    const { statusCode, body } = res._get();
    expect(statusCode).toBe(200);
    expect(body.ac).toBeDefined();
    expect(body.total).toBe(3);
    expect(body.sources.opensky).toBe(0);
    // Should complete within 7 seconds (OpenSky has 5s timeout)
    expect(elapsed).toBeLessThan(7000);
  }, 10000);

  it('mergeAndFilter: deduplicates by hex — primary coords win over secondary', async () => {
    // Import the handler and test the mergeAndFilter indirectly through the handler
    // Both sources return abc123 with different coords
    const primaryAircraft = [
      { hex: 'abc123', lat: 37.0, lon: 127.0, alt_baro: 10000, gs: 300, track: 0, flight: 'PRIMARY' },
    ];
    // Note: secondaryAircraft (same hex 'abc123' but different coords) is encoded
    // directly into the OpenSky `states` array below — kept inline to match wire format.

    // Mock OpenSky to return an aircraft with same hex
    vi.stubGlobal('fetch', vi.fn(async (url, options) => {
      const urlStr = String(url);
      if (urlStr.includes('airplanes.live')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({ ac: primaryAircraft }),
        };
      }
      if (urlStr.includes('auth.opensky-network.org')) {
        return { ok: false, status: 401, json: async () => ({}) };
      }
      if (urlStr.includes('opensky-network.org')) {
        if (options?.signal) {
          return new Promise((_, reject) => {
            options.signal.addEventListener('abort', () => {
              reject(new Error('aborted'));
            });
          });
        }
        // Return secondary data (in opensky format: array of state vectors)
        // [icao24, callsign, country, ts, last_contact, lon, lat, baro_alt_m, on_ground, vel_ms, track, vr, sensors, geo_alt_m, squawk, spi, pos_src, category]
        return {
          ok: true,
          status: 200,
          json: async () => ({
            states: [
              ['abc123', 'SECONDARY', 'Korea', 1000, 1000, 128.0, 38.0, 6096, false, 200, 90, 0, null, 6096, '1234', false, 0, 0]
            ]
          }),
        };
      }
      return { ok: false, status: 404 };
    }));

    const { req, res } = makeReqRes({ lat: '37.5', lon: '127.5', radius: '200' });
    await handler(req, res);
    const { statusCode, body } = res._get();

    expect(statusCode).toBe(200);
    // Should only contain one entry for abc123
    const abc123Entries = body.ac.filter(a => a.hex === 'abc123');
    expect(abc123Entries.length).toBe(1);
    // Primary coords should win (lat≈37 not 38)
    expect(abc123Entries[0].lat).toBeCloseTo(37.0, 1);
  }, 10000);
});
