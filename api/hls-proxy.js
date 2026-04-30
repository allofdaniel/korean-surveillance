/**
 * HLS Proxy - CCTV HLS 스트림 프록시
 * CORS/포트 차단 우회하여 m3u8 및 세그먼트를 프록시
 * 302 리다이렉트, 마스터/서브 m3u8, .ts 세그먼트 모두 처리
 */
import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';

export const config = {
  maxDuration: 30,
};

const ALLOWED_HOSTS = [
  'cctvsec.ktict.co.kr',
  'itsstream.yeosu.go.kr',
];

// Private/loopback address patterns — reject if a redirect points here (SSRF)
const PRIVATE_IP_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.|fc00:|fe80:|::1)/;

function isAllowed(urlStr) {
  try {
    const u = new URL(urlStr);
    return ALLOWED_HOSTS.some(h => u.hostname === h || u.hostname.endsWith('.' + h));
  } catch {
    return false;
  }
}

function isPrivateAddress(hostname) {
  return PRIVATE_IP_RE.test(hostname);
}

function getBaseUrl(urlStr) {
  return urlStr.substring(0, urlStr.lastIndexOf('/') + 1);
}

function rewriteM3u8(body, baseUrl) {
  function proxify(url) {
    const absUrl = url.startsWith('http') ? url : baseUrl + url;
    return `/api/hls-proxy?url=${encodeURIComponent(absUrl)}`;
  }
  // Rewrite bare segment/playlist lines (non-comment lines)
  let rewritten = body.replace(/^(?!#)(\S+)$/gm, (line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    return proxify(trimmed);
  });
  // Also rewrite URI="..." and URI='...' attribute values (e.g. #EXT-X-MEDIA:URI="...") (Code MAJOR fix #12)
  rewritten = rewritten
    .replace(/URI="([^"]+)"/g, (_, url) => `URI="${proxify(url)}"`)
    .replace(/URI='([^']+)'/g, (_, url) => `URI='${proxify(url)}'`);
  return rewritten;
}

const MAX_CONTENT_LENGTH = 50_000_000; // 50 MB
const MAX_REDIRECT_HOPS = 3;

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;
  if (await checkRateLimit(req, res)) return;

  const { url } = req.query;
  if (!url || !isAllowed(url)) {
    return res.status(400).json({ error: 'Invalid or disallowed URL' });
  }

  try {
    // Manual redirect following with SSRF validation
    let currentUrl = url;
    let upstream;
    for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
      upstream = await fetch(currentUrl, {
        signal: AbortSignal.timeout(15000),
        redirect: 'manual',
        headers: { 'Accept': '*/*', 'User-Agent': 'Mozilla/5.0' },
      });

      if (upstream.status >= 300 && upstream.status < 400) {
        const location = upstream.headers.get('location');
        if (!location) {
          return res.status(502).json({ error: 'Redirect with no Location header' });
        }
        // Resolve relative redirects against current URL
        const resolved = new URL(location, currentUrl).toString();
        // Validate redirect target hostname for private addresses
        const resolvedHostname = new URL(resolved).hostname;
        if (isPrivateAddress(resolvedHostname)) {
          return res.status(502).json({ error: 'Redirect to private address blocked' });
        }
        // Validate redirect target against allowlist
        if (!isAllowed(resolved)) {
          return res.status(502).json({ error: 'Redirect to disallowed host blocked' });
        }
        if (hop === MAX_REDIRECT_HOPS) {
          return res.status(502).json({ error: 'Too many redirects' });
        }
        currentUrl = resolved;
        continue;
      }
      break;
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream ${upstream.status}` });
    }

    // Reject oversized responses
    const contentLengthHeader = upstream.headers.get('content-length');
    if (contentLengthHeader && parseInt(contentLengthHeader, 10) > MAX_CONTENT_LENGTH) {
      return res.status(502).json({ error: 'Upstream response too large' });
    }

    const contentType = upstream.headers.get('content-type') || '';
    // 최종 URL (리다이렉트 후)
    const finalUrl = currentUrl;

    // m3u8 매니페스트 (마스터 또는 서브)
    if (contentType.includes('mpegurl') || finalUrl.includes('.m3u8') || url.includes('.m3u8')) {
      const body = await upstream.text();
      const base = getBaseUrl(finalUrl);
      const rewritten = rewriteM3u8(body, base);

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache, no-store');
      return res.status(200).send(rewritten);
    }

    // .ts 세그먼트 또는 기타 바이너리
    const buffer = Buffer.from(await upstream.arrayBuffer());

    // Reject oversized buffered responses (handles chunked transfers with no Content-Length)
    if (buffer.length > MAX_CONTENT_LENGTH) {
      return res.status(502).json({ error: 'Upstream response too large' });
    }

    res.setHeader('Content-Type', contentType || 'video/mp2t');
    res.setHeader('Cache-Control', 'public, max-age=10');
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(502).json({ error: 'Proxy failed', msg: String(err?.message || '') });
  }
}
