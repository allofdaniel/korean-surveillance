/**
 * Vercel Serverless Function - V-World 2D Data Proxy
 * 건물, 특수건물, 도로망 등 V-World 공간데이터 프록시
 */
import { setCorsHeaders } from './_utils/cors.js';

const VWORLD_KEY = process.env.VITE_VWORLD_API_KEY;

const DATA_CODES = {
  buildings: 'LT_C_UQ111',      // 건물 (58K)
  special: 'LT_C_SPBD',         // 특수건물 (이름/층수)
  roads: 'LT_L_MOCTLINK',       // 도로망 (1.5M)
};

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  const { type, minX, maxX, minY, maxY, size } = req.query;
  if (!VWORLD_KEY) return res.status(400).json({ error: 'V-World key not configured' });

  const dataCode = DATA_CODES[type];
  if (!dataCode) return res.status(400).json({ error: `Invalid type. Use: ${Object.keys(DATA_CODES).join(', ')}` });

  const boxSize = size || (type === 'roads' ? '500' : '1000');
  const box = `BOX(${minX || 126},${minY || 35},${maxX || 128},${maxY || 37})`;

  try {
    const url = `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=${dataCode}&key=${VWORLD_KEY}&geomFilter=${box}&size=${boxSize}&format=json&crs=EPSG:4326`;
    const resp = await fetch(url);
    if (!resp.ok) return res.status(resp.status).json({ error: `V-World returned ${resp.status}` });
    const data = await resp.json();
    return res.status(200).json(data);
  } catch (err) {
    const isDev = process.env.NODE_ENV === 'development';
    return res.status(500).json({
      error: 'Internal server error',
      ...(isDev && { details: err.message }),
    });
  }
}
