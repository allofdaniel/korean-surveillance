/**
 * CORS �?Rate Limiting ?�정 ?�틸리티
 * DO-278A ?�구?�항 추적: SRS-SEC-002, SRS-SEC-003
 *
 * ?�경변??기반 CORS ?�이?�리?�트 �?Rate Limiting 관�?
 * Upstash Redis 지??(분산 rate limiting)
 */

// Rate Limiting ?�정
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1�?
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX || '100', 10); // 분당 최�? ?�청 ??

// In-memory rate limit store (fallback when Redis not available)
const rateLimitStore = new Map();

// Upstash Redis ?�스?�스 (지??로딩)
let redisInstance = null;
let redisInitialized = false;

/**
 * Upstash Redis 초기??(?�경변?��? ?�을 ?�만)
 * DO-278A ?�구?�항 추적: SRS-SEC-003 (분산 Rate Limiting)
 *
 * 지?�되???�경변??
 * - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * - KV_REST_API_URL + KV_REST_API_TOKEN (Vercel KV ?�환)
 */
async function getRedisInstance() {
  if (redisInitialized) return redisInstance;
  redisInitialized = true;

  // Upstash Redis ?�경변???�인 (Vercel KV 변?�도 지??
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (redisUrl && redisToken) {
    try {
      const { Redis } = await import('@upstash/redis');
      redisInstance = new Redis({
        url: redisUrl,
        token: redisToken,
      });
      console.info('[Rate Limit] Using Upstash Redis for distributed rate limiting');
    } catch (e) {
      console.warn('[Rate Limit] Upstash Redis not available, using in-memory fallback:', e.message);
    }
  }
  return redisInstance;
}

/**
 * Rate Limit ?�리 (?�래????�� ?�거) - in-memory??
 */
function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Rate Limiting 검??(Upstash Redis 지??
 * @param {object} req - ?�청 객체
 * @param {object} res - ?�답 객체
 * @returns {Promise<boolean>} - ?�청??차단?�면 true
 */
export async function checkRateLimit(req, res) {
  // ?�라?�언???�별??(IP ?�는 X-Forwarded-For)
  const clientId = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                   req.headers['x-real-ip'] ||
                   req.socket?.remoteAddress ||
                   'unknown';

  const now = Date.now();
  const redis = await getRedisInstance();

  let count = 0;
  let windowStart = now;

  if (redis) {
    // Upstash Redis ?�용 (분산)
    const key = `ratelimit:${clientId}`;
    try {
      const data = await redis.get(key);
      if (data && (now - data.windowStart < RATE_LIMIT_WINDOW_MS)) {
        count = data.count + 1;
        windowStart = data.windowStart;
      } else {
        count = 1;
        windowStart = now;
      }
      await redis.set(key, { count, windowStart }, { ex: 120 }); // 2�?TTL
    } catch (e) {
      console.error('[Rate Limit] Redis error, falling back to in-memory:', e.message);
      // Redis ?�류 ??in-memory fallback
      return checkRateLimitInMemory(clientId, now, res);
    }
  } else {
    // In-memory fallback
    return checkRateLimitInMemory(clientId, now, res);
  }

  // Rate limit ?�더 ?�정
  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - count);
  const resetTime = Math.ceil((windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000);

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', resetTime);

  // ?�한 초과 ??차단
  if (count > RATE_LIMIT_MAX_REQUESTS) {
    res.setHeader('Retry-After', resetTime);
    res.status(429).json({
      error: 'Too Many Requests',
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Rate limit exceeded. Try again in ${resetTime} seconds.`,
      retryAfter: resetTime
    });
    return true;
  }

  return false;
}

/**
 * In-memory Rate Limiting (fallback)
 */
function checkRateLimitInMemory(clientId, now, res) {
  // ?�기???�리 (10% ?�률�?
  if (Math.random() < 0.1) {
    cleanupRateLimitStore();
  }

  let clientData = rateLimitStore.get(clientId);

  if (!clientData || (now - clientData.windowStart > RATE_LIMIT_WINDOW_MS)) {
    clientData = { windowStart: now, count: 1 };
    rateLimitStore.set(clientId, clientData);
  } else {
    clientData.count++;
  }

  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - clientData.count);
  const resetTime = Math.ceil((clientData.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000);

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', resetTime);

  if (clientData.count > RATE_LIMIT_MAX_REQUESTS) {
    res.setHeader('Retry-After', resetTime);
    res.status(429).json({
      error: 'Too Many Requests',
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Rate limit exceeded. Try again in ${resetTime} seconds.`,
      retryAfter: resetTime
    });
    return true;
  }

  return false;
}

/**
 * ?�용???�리�?목록
 * CORS_ALLOWED_ORIGINS ?�경변?�에??로드
 */
const getAllowedOrigins = () => {
  const envOrigins = process.env.CORS_ALLOWED_ORIGINS;

  // 기본 ?�용 목록
  const defaultOrigins = [
    'https://rkpu-viewer.vercel.app',
    'https://tbas.vercel.app',
    'https://koreasurveillance.com',
    'https://www.koreasurveillance.com',
    'https://korean-surveillance.vercel.app',
  ];

  // 개발 ?�경?�서??localhost ?�용
  if (process.env.NODE_ENV !== 'production') {
    defaultOrigins.push(
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173'
    );
  }

  if (envOrigins) {
    return [...new Set([...defaultOrigins, ...envOrigins.split(",").map((v) => v.trim()).filter(Boolean)])];
  }

  return defaultOrigins;
};

/**
 * ?�리�?검�?
 * @param {string} origin - ?�청 ?�리�?
 * @returns {boolean} - ?�용 ?��?
 */
export function isOriginAllowed(origin) {
  if (!origin) return false;

  const allowed = getAllowedOrigins();
  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  const normalizedOrigin = `${parsedOrigin.protocol}//${parsedOrigin.host}`;
  const hostname = parsedOrigin.hostname.toLowerCase();

  if (allowed.includes(normalizedOrigin)) {
    return true;
  }

  if (/^([a-z0-9-]+\.)?(rkpu-viewer|tbas)\.vercel\.app$/i.test(hostname)) {
    return true;
  }

  return allowed.some((allowedOrigin) => {
    return normalizedOrigin === allowedOrigin;
  });
}

/**
 * CORS ?�더 ?�정
 * @param {object} req - ?�청 객체
 * @param {object} res - ?�답 객체
 * @returns {boolean} - preflight ?�청??경우 true
 */
export function setCorsHeaders(req, res) {
  const origin = req.headers.origin;

  // ?�용???�리진인 경우?�만 ?�당 ?�리�?반환
  // DO-278A SRS-SEC-002: ?�?�드카드 금�?, 명시???�이?�리?�트�??�용
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  // 개발 ?�경?�서??localhost�??�용 (?�?�드카드 ?�용 ?�함)

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Preflight ?�청 처리
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }

  return false;
}

// Legacy function removed for security - DO-278A SRS-SEC-002
// All code should use setCorsHeaders() instead
