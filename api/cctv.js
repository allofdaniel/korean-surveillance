/**
 * Vercel Serverless Function - CCTV Proxy
 * V-World CCTV 위치 + data.go.kr CCTV 영상 URL 통합
 */
import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;
  if (await checkRateLimit(req, res)) return;

  const { source, minX, maxX, minY, maxY, type } = req.query;
  const itsKey = process.env.VITE_ITS_API_KEY;
  const dataGoKrKey = process.env.VITE_DATA_GO_KR_API_KEY;

  // KR bbox coverage [122,132] x [33,43]
  const KR_MIN_X = 122, KR_MAX_X = 132, KR_MIN_Y = 33, KR_MAX_Y = 43;

  // Validate bounds as floats in KR coverage; default to KR-wide if missing/invalid
  function parseBound(val, min, max, def) {
    const n = parseFloat(val);
    if (!Number.isFinite(n) || n < min || n > max) return def;
    return n;
  }
  const safeMinX = parseBound(minX, KR_MIN_X, KR_MAX_X, KR_MIN_X);
  const safeMaxX = parseBound(maxX, KR_MIN_X, KR_MAX_X, KR_MAX_X);
  const safeMinY = parseBound(minY, KR_MIN_Y, KR_MAX_Y, KR_MIN_Y);
  const safeMaxY = parseBound(maxY, KR_MIN_Y, KR_MAX_Y, KR_MAX_Y);

  try {
    if (source === 'its') {
      // ITS 국가교통정보센터 CCTV (전국 고속도로/국도, HTTPS HLS)
      if (!itsKey) return res.status(400).json({ error: 'ITS API key not configured' });
      const roadType = type || 'its'; // its: 국도, ex: 고속도로
      // Whitelist road type to prevent URL injection
      if (!['its', 'ex'].includes(roadType)) {
        return res.status(400).json({ error: "Invalid type. Must be 'its' or 'ex'." });
      }
      const url = `https://openapi.its.go.kr:9443/cctvInfo?apiKey=${itsKey}&type=${roadType}&cctvType=4&minX=${safeMinX}&maxX=${safeMaxX}&minY=${safeMinY}&maxY=${safeMaxY}&getType=json`;
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'Accept': 'application/json' },
      });
      if (!resp.ok) return res.status(resp.status).json({ error: `ITS API returned ${resp.status}` });
      const data = await resp.json();
      return res.status(200).json(data);

    } else if (source === 'yeosu') {
      // 여수시 CCTV
      if (!dataGoKrKey) return res.status(400).json({ error: 'data.go.kr key not configured' });
      const url = `https://apis.data.go.kr/4810000/YsRoadCctv/CCTVInfo?serviceKey=${encodeURIComponent(dataGoKrKey)}&pageNo=1&numOfRows=100&type=json`;
      const resp = await fetch(url);
      const data = await resp.json();
      return res.status(200).json(data);

    } else {
      return res.status(400).json({ error: 'Invalid source. Use: its, yeosu' });
    }
  } catch (err) {
    // VERCEL_ENV 도 함께 체크 — preview deployment 에서 leak 방지
    const isLocalDev = process.env.NODE_ENV === 'development' && !process.env.VERCEL_ENV;
    return res.status(500).json({
      error: 'Internal server error',
      ...(isLocalDev && { details: err.message, cause: err.cause?.message || null }),
    });
  }
}
