/**
 * HLS Proxy - CCTV HLS 스트림 프록시
 * CORS/포트 차단 우회하여 m3u8 및 세그먼트를 프록시
 * 302 리다이렉트, 마스터/서브 m3u8, .ts 세그먼트 모두 처리
 */
import { setCorsHeaders } from './_utils/cors.js';

export const config = {
  maxDuration: 30,
};

const ALLOWED_HOSTS = [
  'cctvsec.ktict.co.kr',
  'itsstream.yeosu.go.kr',
];

function isAllowed(urlStr) {
  try {
    const u = new URL(urlStr);
    return ALLOWED_HOSTS.some(h => u.hostname.endsWith(h));
  } catch {
    return false;
  }
}

function getBaseUrl(urlStr) {
  return urlStr.substring(0, urlStr.lastIndexOf('/') + 1);
}

function rewriteM3u8(body, baseUrl) {
  return body.replace(/^(?!#)(\S+)$/gm, (line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    // 절대 URL 또는 상대 URL → 절대 URL로 변환
    const absUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
    return `/api/hls-proxy?url=${encodeURIComponent(absUrl)}`;
  });
}

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  const { url } = req.query;
  if (!url || !isAllowed(url)) {
    return res.status(400).json({ error: 'Invalid or disallowed URL' });
  }

  try {
    // fetch는 기본적으로 redirect: 'follow' (302 자동 따라감)
    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
      headers: { 'Accept': '*/*', 'User-Agent': 'Mozilla/5.0' },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream ${upstream.status}` });
    }

    const contentType = upstream.headers.get('content-type') || '';
    // 최종 URL (리다이렉트 후)
    const finalUrl = upstream.url || url;

    // m3u8 매니페스트 (마스터 또는 서브)
    if (contentType.includes('mpegurl') || finalUrl.includes('.m3u8') || url.includes('.m3u8')) {
      const body = await upstream.text();
      const base = getBaseUrl(finalUrl);
      const rewritten = rewriteM3u8(body, base);

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache, no-store');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).send(rewritten);
    }

    // .ts 세그먼트 또는 기타 바이너리
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', contentType || 'video/mp2t');
    res.setHeader('Cache-Control', 'public, max-age=10');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(502).json({ error: 'Proxy failed', msg: String(err?.message || '') });
  }
}
