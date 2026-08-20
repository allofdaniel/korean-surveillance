import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';
import {
  generateAsterixCat062,
  generateAsterixCat021,
  generateAsterixCat048,
  generateAsterixCat034,
  generateAsterixCat010,
} from './_utils/asterixGenerator.js';

const KOREA_CENTER = { lat: 36.5, lon: 127.8, radius: 500 };

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;
  if (await checkRateLimit(req, res)) return;

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const cat = parseInt(url.searchParams.get('cat') || '62', 10);
    const typ = url.searchParams.get('typ') || 'COMBINED_PSR_SSR';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    if (cat === 34) {
      const record = generateAsterixCat034(129, 239);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json(record);
    }

    // Fetch live aircraft from internal API or airplanes.live
    let aircraftList = [];
    try {
      const liveRes = await fetch(`https://api.airplanes.live/v2/point/${KOREA_CENTER.lat}/${KOREA_CENTER.lon}/${KOREA_CENTER.radius}`);
      if (liveRes.ok) {
        const json = await liveRes.json();
        aircraftList = json.ac || [];
      }
    } catch (e) {
      console.warn('Live ADS-B fetch error, synthesizing fallback:', e.message);
    }

    if (aircraftList.length === 0) {
      // Fallback synthetic track for test/verification
      aircraftList = [
        {
          hex: '71C072',
          flight: 'KAL853',
          lat: 37.4528,
          lon: 126.4419,
          altitude_ft: 35000,
          ground_speed: 395.4,
          track: 152.3,
          squawk: '3412',
          category: 'A3',
        },
        {
          hex: '71C244',
          flight: 'AAR8948',
          lat: 33.5113,
          lon: 126.4930,
          altitude_ft: 18000,
          ground_speed: 435.0,
          track: 185.2,
          squawk: '3412',
          category: 'A3',
        },
      ];
    }

    const filtered = aircraftList.slice(0, limit);
    let output = [];

    switch (cat) {
      case 62:
        output = filtered.map(ac => generateAsterixCat062(ac));
        break;
      case 21:
        output = filtered.map(ac => generateAsterixCat021(ac));
        break;
      case 48:
        output = filtered.map(ac => generateAsterixCat048(ac, { lat: 33.3617, lon: 126.5332 }, typ));
        break;
      case 10:
        output = filtered.map(ac => generateAsterixCat010(ac, { lat: 37.4601, lon: 126.4402 }));
        break;
      default:
        return res.status(400).json({ error: `Unsupported ASTERIX Category: ${cat}. Supported: 62, 21, 48, 34, 10` });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(output.length === 1 ? output[0] : output);
  } catch (error) {
    console.error('ASTERIX generation error:', error);
    return res.status(500).json({ error: error.message });
  }
}
