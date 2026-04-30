/**
 * Vercel Serverless Function - Ship AIS Proxy
 * OpenSky-style proxy for vessel position data
 * Uses barentswatch.no (free, no key) or Marine Traffic AIS
 */
import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';

// 한반도 주변 선박 위치를 제공하는 무료 소스들
const AIS_SOURCES = {
  // data.go.kr 해양수산부 선박위치정보 (API 키 필요)
  mof: async (key) => {
    if (!key) return [];
    const url = `https://apis.data.go.kr/1192000/VesselPositionService/getVesselPositionList?serviceKey=${encodeURIComponent(key)}&numOfRows=200&pageNo=1&type=json`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) return [];
      const data = await resp.json();
      const items = data?.response?.body?.items?.item || [];
      return (Array.isArray(items) ? items : [items]).map(item => ({
        mmsi: item.mmsi || item.shipId || '',
        name: item.shipNm || item.vesselName || 'Unknown',
        lat: parseFloat(item.lat || item.latitude || 0),
        lng: parseFloat(item.lon || item.longitude || 0),
        heading: parseFloat(item.heading || 0),
        speed: parseFloat(item.speed || item.sog || 0),
        type: item.shipType || item.vesselType || 'cargo',
      })).filter(s => s.lat !== 0 && s.lng !== 0);
    } catch { return []; }
  },
};

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;
  if (await checkRateLimit(req, res)) return;

  const dataGoKrKey = process.env.VITE_DATA_GO_KR_API_KEY;

  try {
    const ships = await AIS_SOURCES.mof(dataGoKrKey);
    return res.status(200).json({
      count: ships.length,
      ships,
    });
  } catch (err) {
    const isLocalDev = process.env.NODE_ENV === 'development' && !process.env.VERCEL_ENV;
    return res.status(500).json({
      error: 'Internal server error',
      ...(isLocalDev && { details: err.message }),
    });
  }
}
