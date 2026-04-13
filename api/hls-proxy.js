/**
 * HLS Proxy - CCTV HLS 스트림 프록시
 * CORS/포트 차단 우회하여 m3u8 및 세그먼트를 프록시
 */
import { setCorsHeaders } from './_utils/cors.js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'url parameter required' });
  }

  // URL 검증: 허용된 HLS 서버만
  const allowed = [
    'cctvsec.ktict.co.kr',
    'itsstream.yeosu.go.kr',
  ];
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (!allowed.some(h => parsed.hostname.endsWith(h))) {
    return res.status(403).json({ error: 'Domain not allowed' });
  }

  try {
    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'Accept': '*/*' },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream ${upstream.status}` });
    }

    const contentType = upstream.headers.get('content-type') || '';

    // m3u8 매니페스트: 세그먼트 URL을 프록시 URL로 리라이트
    if (contentType.includes('mpegurl') || url.includes('.m3u8')) {
      let body = await upstream.text();

      // 상대 URL을 절대 URL로 변환 후 프록시 경로로 리라이트
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      body = body.replace(/^(?!#)(.+\.ts.*)$/gm, (match) => {
        const segUrl = match.startsWith('http') ? match : baseUrl + match;
        return `/api/hls-proxy?url=${encodeURIComponent(segUrl)}`;
      });

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).send(body);
    }

    // .ts 세그먼트: 바이너리 스트림 전달
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', contentType || 'video/mp2t');
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(502).json({ error: 'Proxy failed' });
  }
}
