/**
 * Vercel Serverless Function - CCTV Proxy
 * V-World CCTV 위치 + data.go.kr CCTV 영상 URL 통합
 */
import { setCorsHeaders } from './_utils/cors.js';

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { source, minX, maxX, minY, maxY } = req.query;
  const vworldKey = process.env.VITE_VWORLD_API_KEY;
  const dataGoKrKey = process.env.VITE_DATA_GO_KR_API_KEY;

  try {
    if (source === 'vworld') {
      // V-World CCTV 위치 데이터
      if (!vworldKey) return res.status(400).json({ error: 'V-World key not configured' });
      const box = `BOX(${minX || 125},${minY || 33},${maxX || 132},${maxY || 39})`;
      const url = `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=LT_P_UTISCCTV&key=${vworldKey}&geomFilter=${box}&size=1000&format=json&crs=EPSG:4326`;
      const resp = await fetch(url);
      const data = await resp.json();
      return res.status(200).json(data);

    } else if (source === 'yeosu') {
      // 여수시 CCTV (HLS 스트림 URL 포함)
      if (!dataGoKrKey) return res.status(400).json({ error: 'data.go.kr key not configured' });
      const url = `https://apis.data.go.kr/4810000/YsRoadCctv/CCTVInfo?serviceKey=${encodeURIComponent(dataGoKrKey)}&pageNo=1&numOfRows=100&type=json`;
      const resp = await fetch(url);
      const data = await resp.json();
      return res.status(200).json(data);

    } else if (source === 'namhae') {
      // 남해군 CCTV
      if (!dataGoKrKey) return res.status(400).json({ error: 'data.go.kr key not configured' });
      const url = `https://apis.data.go.kr/5430000/nh_cctv/get_cctv_list?serviceKey=${encodeURIComponent(dataGoKrKey)}&pageNo=1&numOfRows=100&type=json`;
      const resp = await fetch(url);
      const data = await resp.json();
      return res.status(200).json(data);

    } else {
      return res.status(400).json({ error: 'Invalid source. Use: vworld, yeosu, namhae' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
