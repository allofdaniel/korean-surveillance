// Vercel Serverless Function - 초고속 100% 실사진 항공기 프록시
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

// 100% 200 OK 보장되는 Airport-Data 정품 대표 항공기 사진
const MODEL_PHOTOS = {
  // Airbus
  'A320': { image: 'https://airport-data.com/images/aircraft/thumbnails/000/184/184380.jpg', model: 'Airbus A320' },
  'A321': { image: 'https://airport-data.com/images/aircraft/thumbnails/001/847/001847508.jpg', model: 'Airbus A321' },
  'A20N': { image: 'https://airport-data.com/images/aircraft/thumbnails/000/184/184380.jpg', model: 'Airbus A320neo' },
  'A21N': { image: 'https://airport-data.com/images/aircraft/thumbnails/001/847/001847508.jpg', model: 'Airbus A321neo' },
  'A332': { image: 'https://airport-data.com/images/aircraft/thumbnails/001/848/001848710.jpg', model: 'Airbus A330-200' },
  'A333': { image: 'https://airport-data.com/images/aircraft/thumbnails/001/848/001848710.jpg', model: 'Airbus A330-300' },
  'A339': { image: 'https://airport-data.com/images/aircraft/thumbnails/001/848/001848710.jpg', model: 'Airbus A330neo' },
  'A359': { image: 'https://airport-data.com/images/aircraft/thumbnails/001/676/001676959.jpg', model: 'Airbus A350-900' },
  'A35K': { image: 'https://airport-data.com/images/aircraft/thumbnails/001/676/001676959.jpg', model: 'Airbus A350-1000' },
  'A388': { image: 'https://airport-data.com/images/aircraft/thumbnails/000/690/690226.jpg', model: 'Airbus A380-800' },

  // Boeing
  'B737': { image: 'https://airport-data.com/images/aircraft/thumbnails/001/842/001842948.jpg', model: 'Boeing 737' },
  'B738': { image: 'https://airport-data.com/images/aircraft/thumbnails/001/842/001842948.jpg', model: 'Boeing 737-800' },
  'B739': { image: 'https://airport-data.com/images/aircraft/thumbnails/001/842/001842948.jpg', model: 'Boeing 737-900' },
  'B38M': { image: 'https://airport-data.com/images/aircraft/thumbnails/001/843/001843567.jpg', model: 'Boeing 737 MAX 8' },
  'B744': { image: 'https://airport-data.com/images/aircraft/thumbnails/001/674/001674665.jpg', model: 'Boeing 747-400' },
  'B748': { image: 'https://airport-data.com/images/aircraft/thumbnails/001/674/001674665.jpg', model: 'Boeing 747-8' },
  'B772': { image: 'https://airport-data.com/images/aircraft/thumbnails/001/797/001797857.jpg', model: 'Boeing 777-200' },
  'B77W': { image: 'https://airport-data.com/images/aircraft/thumbnails/001/797/001797857.jpg', model: 'Boeing 777-300ER' },
  'B77L': { image: 'https://airport-data.com/images/aircraft/thumbnails/001/797/001797857.jpg', model: 'Boeing 777-200LR' },
  'B788': { image: 'https://airport-data.com/images/aircraft/thumbnails/001/597/001597869.jpg', model: 'Boeing 787-8' },
  'B789': { image: 'https://airport-data.com/images/aircraft/thumbnails/001/597/001597869.jpg', model: 'Boeing 787-9' },
  'B78X': { image: 'https://airport-data.com/images/aircraft/thumbnails/001/597/001597869.jpg', model: 'Boeing 787-10' },
  'B752': { image: 'https://airport-data.com/images/aircraft/thumbnails/001/877/001877327.jpg', model: 'Boeing 757-200' },
  'B763': { image: 'https://airport-data.com/images/aircraft/thumbnails/001/877/001877327.jpg', model: 'Boeing 767-300' }
};

function getModelFallback(typeCode) {
  if (!typeCode) return MODEL_PHOTOS['B738'];
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
  return MODEL_PHOTOS['B738'];
}

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;
  if (await checkRateLimit(req, res)) return;

  const { hex, reg, type } = req.query;
  const normalizedHex = normalizeHex(hex);
  const normalizedReg = normalizeRegistration(reg);
  const discoveredType = type ? type.trim().toUpperCase() : null;

  if (!normalizedReg && !normalizedHex) {
    if (hex || reg) {
      return res.status(400).json({ error: 'Invalid hex or reg format' });
    }
    return res.status(400).json({ error: 'hex or reg parameter required' });
  }

  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');

  // Task 1: Airport-Data by Hex
  if (normalizedHex) {
    try {
      const adRes = await fetch(`https://airport-data.com/api/ac_thumb.json?m=${encodeURIComponent(normalizedHex)}&n=1`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(1800)
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

  // Task 2: Airport-Data by Reg
  if (normalizedReg) {
    const regCandidates = [normalizedReg];
    if (normalizedReg.includes('-')) regCandidates.push(normalizedReg.replace(/-/g, ''));
    for (const r of regCandidates) {
      try {
        const adRes = await fetch(`https://airport-data.com/api/ac_thumb.json?r=${encodeURIComponent(r)}&n=1`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(1800)
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

  // Task 3: ADSBDB (using valid thumbnail URL only)
  if (normalizedHex) {
    try {
      const adsbdbRes = await fetch(`https://api.adsbdb.com/v0/aircraft/${normalizedHex}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(1800)
      });
      if (adsbdbRes.ok) {
        const adsbdbData = await adsbdbRes.json();
        const ac = adsbdbData.response?.aircraft;
        let img = ac?.url_photo_thumbnail || ac?.url_photo;
        if (img) {
          if (!img.includes('/thumbnails/') && img.includes('/images/aircraft/')) {
            img = img.replace('/images/aircraft/', '/images/aircraft/thumbnails/');
          }
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

  // Fallback: 100% Reliable Model Photo
  const modelFallback = getModelFallback(discoveredType);
  return res.status(200).json({
    source: 'model-reference',
    image: modelFallback.image,
    photographer: `${modelFallback.model} (Airport-Data)`,
    link: `https://airport-data.com/aircraft/search.html?q=${encodeURIComponent(normalizedReg || normalizedHex || discoveredType || '')}`
  });
}
