/**
 * Vercel Serverless Function - CCTV Proxy
 * V-World CCTV 위치 + data.go.kr CCTV 영상 URL 통합
 */
import { setCorsHeaders } from './_utils/cors.js';

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  const { source, minX, maxX, minY, maxY, type } = req.query;
  const itsKey = process.env.VITE_ITS_API_KEY;
  const dataGoKrKey = process.env.VITE_DATA_GO_KR_API_KEY;

  try {
    if (source === 'its') {
      // ITS 국가교통정보센터 CCTV (전국 고속도로/국도, HTTPS HLS)
      if (!itsKey) return res.status(400).json({ error: 'ITS API key not configured' });
      const roadType = type || 'its'; // its: 국도, ex: 고속도로
      const url = `https://openapi.its.go.kr:9443/cctvInfo?apiKey=${itsKey}&type=${roadType}&cctvType=4&minX=${minX || 125}&maxX=${maxX || 132}&minY=${minY || 33}&maxY=${maxY || 39}&getType=json`;
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
    return res.status(500).json({ error: err.message, cause: err.cause?.message || null });
  }
}
