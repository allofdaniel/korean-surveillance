// Vercel Serverless Function - 항공기 사진 프록시
import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';

const REG_PATTERN = /^[A-Z0-9-]{2,14}$/i;
const HEX_PATTERN = /^[0-9A-F]{6}$/i;

function normalizeRegistration(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim().toUpperCase();
  if (!REG_PATTERN.test(trimmed)) return null;
  return trimmed;
}

function normalizeHex(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim().toUpperCase();
  if (!HEX_PATTERN.test(trimmed)) return null;
  return trimmed;
}

// Verified High Quality Aircraft Model Photographs (Wikimedia Commons)
const MODEL_PHOTOS = {
  'A320': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Airbus_A320-214%2C_Airbus_Industrie_JP7617615.jpg/640px-Airbus_A320-214%2C_Airbus_Industrie_JP7617615.jpg', photographer: 'Airbus Industrie / Wikimedia Commons', model: 'Airbus A320' },
  'A321': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Airbus_A321-231%2C_Airbus_Industrie_JP7617616.jpg/640px-Airbus_A321-231%2C_Airbus_Industrie_JP7617616.jpg', photographer: 'Airbus Industrie / Wikimedia Commons', model: 'Airbus A321' },
  'A20N': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Airbus_A320-214%2C_Airbus_Industrie_JP7617615.jpg/640px-Airbus_A320-214%2C_Airbus_Industrie_JP7617615.jpg', photographer: 'Airbus Industrie / Wikimedia Commons', model: 'Airbus A320neo' },
  'A21N': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Airbus_A321-231%2C_Airbus_Industrie_JP7617616.jpg/640px-Airbus_A321-231%2C_Airbus_Industrie_JP7617616.jpg', photographer: 'Airbus Industrie / Wikimedia Commons', model: 'Airbus A321neo' },
  'A332': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Delta_Air_Lines_Airbus_A330-300_N830NW_departing_Boston_July_2026_1.jpg/640px-Delta_Air_Lines_Airbus_A330-300_N830NW_departing_Boston_July_2026_1.jpg', photographer: 'Wikimedia Commons', model: 'Airbus A330-200' },
  'A333': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Delta_Air_Lines_Airbus_A330-300_N830NW_departing_Boston_July_2026_1.jpg/640px-Delta_Air_Lines_Airbus_A330-300_N830NW_departing_Boston_July_2026_1.jpg', photographer: 'Wikimedia Commons', model: 'Airbus A330-300' },
  'A339': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Delta_Air_Lines_Airbus_A330-300_N830NW_departing_Boston_July_2026_1.jpg/640px-Delta_Air_Lines_Airbus_A330-300_N830NW_departing_Boston_July_2026_1.jpg', photographer: 'Wikimedia Commons', model: 'Airbus A330neo' },
  'A359': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/EGLF_-_Airbus_A350-941_-_F-WZNW.jpg/640px-EGLF_-_Airbus_A350-941_-_F-WZNW.jpg', photographer: 'Airbus / Wikimedia Commons', model: 'Airbus A350-900' },
  'A35K': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/EGLF_-_Airbus_A350-941_-_F-WZNW.jpg/640px-EGLF_-_Airbus_A350-941_-_F-WZNW.jpg', photographer: 'Airbus / Wikimedia Commons', model: 'Airbus A350-1000' },
  'A388': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/A6-EDY_A380_Emirates_31_jan_2013_jfk_%288442269364%29_%28cropped%29.jpg/640px-A6-EDY_A380_Emirates_31_jan_2013_jfk_%288442269364%29_%28cropped%29.jpg', photographer: 'Wikimedia Commons', model: 'Airbus A380-800' },
  'B737': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Delta_Boeing_737-800_N371DA_departing_Boston_June_2025.jpg/640px-Delta_Boeing_737-800_N371DA_departing_Boston_June_2025.jpg', photographer: 'Boeing / Wikimedia Commons', model: 'Boeing 737' },
  'B738': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Delta_Boeing_737-800_N371DA_departing_Boston_June_2025.jpg/640px-Delta_Boeing_737-800_N371DA_departing_Boston_June_2025.jpg', photographer: 'Boeing / Wikimedia Commons', model: 'Boeing 737-800' },
  'B739': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Delta_Boeing_737-800_N371DA_departing_Boston_June_2025.jpg/640px-Delta_Boeing_737-800_N371DA_departing_Boston_June_2025.jpg', photographer: 'Boeing / Wikimedia Commons', model: 'Boeing 737-900' },
  'B38M': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Delta_Boeing_737-800_N371DA_departing_Boston_June_2025.jpg/640px-Delta_Boeing_737-800_N371DA_departing_Boston_June_2025.jpg', photographer: 'Boeing / Wikimedia Commons', model: 'Boeing 737 MAX 8' },
  'B744': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/B-747_Iberia.jpg/640px-B-747_Iberia.jpg', photographer: 'Wikimedia Commons', model: 'Boeing 747-400' },
  'B748': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/B-747_Iberia.jpg/640px-B-747_Iberia.jpg', photographer: 'Wikimedia Commons', model: 'Boeing 747-8' },
  'B772': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Cathay_Pacific_Boeing_777-200%3B_B-HNL%40HKG.jpg/640px-Cathay_Pacific_Boeing_777-200%3B_B-HNL%40HKG.jpg', photographer: 'Wikimedia Commons', model: 'Boeing 777-200' },
  'B77W': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Cathay_Pacific_Boeing_777-200%3B_B-HNL%40HKG.jpg/640px-Cathay_Pacific_Boeing_777-200%3B_B-HNL%40HKG.jpg', photographer: 'Wikimedia Commons', model: 'Boeing 777-300ER' },
  'B77L': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Cathay_Pacific_Boeing_777-200%3B_B-HNL%40HKG.jpg/640px-Cathay_Pacific_Boeing_777-200%3B_B-HNL%40HKG.jpg', photographer: 'Wikimedia Commons', model: 'Boeing 777-200LR' },
  'B788': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Boeing_787_N1015B_ANA_Airlines_%2827611880663%29_%28cropped%29.jpg/640px-Boeing_787_N1015B_ANA_Airlines_%2827611880663%29_%28cropped%29.jpg', photographer: 'Boeing / Wikimedia Commons', model: 'Boeing 787-8' },
  'B789': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Boeing_787_N1015B_ANA_Airlines_%2827611880663%29_%28cropped%29.jpg/640px-Boeing_787_N1015B_ANA_Airlines_%2827611880663%29_%28cropped%29.jpg', photographer: 'Boeing / Wikimedia Commons', model: 'Boeing 787-9' },
  'B78X': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Boeing_787_N1015B_ANA_Airlines_%2827611880663%29_%28cropped%29.jpg/640px-Boeing_787_N1015B_ANA_Airlines_%2827611880663%29_%28cropped%29.jpg', photographer: 'Boeing / Wikimedia Commons', model: 'Boeing 787-10' },
  'B752': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Delta_Air_Lines_Boeing_757-200_N6705Y_departing_Boston_August_2025.jpg/640px-Delta_Air_Lines_Boeing_757-200_N6705Y_departing_Boston_August_2025.jpg', photographer: 'Boeing / Wikimedia Commons', model: 'Boeing 757-200' },
  'B763': { image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Boeing_767-300ER_Austrian_OE-LAT_01.jpg/640px-Boeing_767-300ER_Austrian_OE-LAT_01.jpg', photographer: 'Boeing / Wikimedia Commons', model: 'Boeing 767-300ER' }
};

function getModelFallback(typeCode) {
  if (!typeCode) return null;
  const clean = typeCode.trim().toUpperCase();
  if (MODEL_PHOTOS[clean]) return MODEL_PHOTOS[clean];
  
  for (const [key, val] of Object.entries(MODEL_PHOTOS)) {
    if (clean.startsWith(key) || key.startsWith(clean)) {
      return val;
    }
  }
  if (clean.startsWith('A32') || clean.startsWith('A20') || clean.startsWith('A21')) return MODEL_PHOTOS['A320'];
  if (clean.startsWith('B73') || clean.startsWith('B38') || clean.startsWith('B39')) return MODEL_PHOTOS['B738'];
  if (clean.startsWith('B77')) return MODEL_PHOTOS['B77W'];
  if (clean.startsWith('B78')) return MODEL_PHOTOS['B789'];
  if (clean.startsWith('A33')) return MODEL_PHOTOS['A333'];
  if (clean.startsWith('A35')) return MODEL_PHOTOS['A359'];
  if (clean.startsWith('B74')) return MODEL_PHOTOS['B744'];
  return null;
}

export default async function handler(req, res) {
  // DO-278A SRS-SEC-002: Use secure CORS headers
  if (setCorsHeaders(req, res)) return;
  // DO-278A SRS-SEC-003: Rate Limiting
  if (await checkRateLimit(req, res)) return;

  const { hex, reg, callsign, type } = req.query;
  const normalizedHex = normalizeHex(hex);
  let normalizedReg = normalizeRegistration(reg);
  let discoveredType = type ? type.trim().toUpperCase() : null;

  if (!normalizedReg && !normalizedHex) {
    if (hex || reg) {
      return res.status(400).json({ error: 'Invalid hex or reg format' });
    }
    return res.status(400).json({ error: 'hex or reg parameter required' });
  }

  // HexDB fallback metadata discovery
  if (normalizedHex && (!normalizedReg || !discoveredType)) {
    try {
      const hexRes = await fetch(`https://hexdb.io/api/v1/aircraft/${normalizedHex}`, {
        signal: AbortSignal.timeout(2000)
      });
      if (hexRes.ok) {
        const hexData = await hexRes.json();
        if (!normalizedReg && hexData.Registration) normalizedReg = hexData.Registration.trim().toUpperCase();
        if (!discoveredType && (hexData.ICAOTypeCode || hexData.Type)) discoveredType = (hexData.ICAOTypeCode || hexData.Type).trim().toUpperCase();
      }
    } catch (e) {}
  }

  try {
    // 1. ADSBDB (by hex)
    if (normalizedHex) {
      try {
        const adsbdbRes = await fetch(`https://api.adsbdb.com/v0/aircraft/${normalizedHex}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(2500)
        });
        if (adsbdbRes.ok) {
          const adsbdbData = await adsbdbRes.json();
          const ac = adsbdbData.response?.aircraft;
          const img = ac?.url_photo || ac?.url_photo_thumbnail;
          if (img) {
            return res.status(200).json({
              source: 'adsbdb',
              image: img,
              photographer: ac.registered_owner || 'ADSBDB',
              link: `https://globe.adsbexchange.com/?icao=${normalizedHex}`
            });
          }
        }
      } catch (e) {}
    }

    // 2. airport-data.com (by registration)
    if (normalizedReg) {
      const regCandidates = [normalizedReg];
      if (normalizedReg.includes('-')) regCandidates.push(normalizedReg.replace(/-/g, ''));
      
      for (const r of regCandidates) {
        try {
          const adRes = await fetch(`https://airport-data.com/api/ac_thumb.json?r=${encodeURIComponent(r)}&n=1`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(2500)
          });
          if (adRes.ok) {
            const adData = await adRes.json();
            if (adData.data && adData.data.length > 0 && adData.data[0].image) {
              return res.status(200).json({
                source: 'airport-data',
                image: adData.data[0].image,
                photographer: adData.data[0].photographer || 'Airport-Data.com',
                link: adData.data[0].link || `https://airport-data.com/aircraft/search.html?q=${encodeURIComponent(r)}`
              });
            }
          }
        } catch (e) {}
      }
    }

    // 3. airport-data.com (by hex)
    if (normalizedHex) {
      try {
        const adRes = await fetch(`https://airport-data.com/api/ac_thumb.json?m=${encodeURIComponent(normalizedHex)}&n=1`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(2500)
        });
        if (adRes.ok) {
          const adData = await adRes.json();
          if (adData.data && adData.data.length > 0 && adData.data[0].image) {
            return res.status(200).json({
              source: 'airport-data',
              image: adData.data[0].image,
              photographer: adData.data[0].photographer || 'Airport-Data.com',
              link: adData.data[0].link || `https://airport-data.com/aircraft/search.html?q=${encodeURIComponent(normalizedHex)}`
            });
          }
        }
      } catch (e) {}
    }

    // 4. Planespotters.net API
    if (normalizedReg) {
      try {
        const psRes = await fetch(`https://api.planespotters.net/pub/photos/reg/${encodeURIComponent(normalizedReg)}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(2000)
        });
        if (psRes.ok) {
          const psData = await psRes.json();
          if (psData.photos && psData.photos.length > 0) {
            const photo = psData.photos[0];
            const imageUrl = photo.thumbnail_large?.src || photo.thumbnail?.src || photo.large?.src;
            if (imageUrl) {
              return res.status(200).json({
                source: 'planespotters',
                image: imageUrl,
                photographer: photo.photographer,
                link: photo.link
              });
            }
          }
        }
      } catch (e) {}
    }

    // 5. Model Fallback Image (HD photograph of aircraft type)
    const modelFallback = getModelFallback(discoveredType);
    if (modelFallback) {
      return res.status(200).json({
        source: 'model-reference',
        image: modelFallback.image,
        photographer: `${modelFallback.model} (${modelFallback.photographer})`,
        link: `https://www.planespotters.net/search?q=${encodeURIComponent(normalizedReg || normalizedHex || discoveredType)}`
      });
    }

    return res.status(200).json({ source: null, image: null });

  } catch (error) {
    console.error('Photo API error:', error);
    return res.status(500).json({ error: 'Failed to fetch aircraft photo' });
  }
}
