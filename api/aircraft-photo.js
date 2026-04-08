// Vercel Serverless Function - 항공기 사진 프록시
import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';

const REG_PATTERN = /^[A-Z0-9-]{3,12}$/i;
const HEX_PATTERN = /^[0-9A-F]{6}$/i;

function normalizeRegistration(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().replace(/[-\s]/g, '').toUpperCase();
  if (!REG_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeHex(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (!HEX_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

export default async function handler(req, res) {
  // DO-278A SRS-SEC-002: Use secure CORS headers
  if (setCorsHeaders(req, res)) return;
  // DO-278A SRS-SEC-003: Rate Limiting
  if (await checkRateLimit(req, res)) return;

  const { hex, reg } = req.query;
  const normalizedReg = normalizeRegistration(reg);
  const normalizedHex = normalizeHex(hex);

  if (!normalizedReg && !normalizedHex) {
    if (hex || reg) {
      return res.status(400).json({ error: 'Invalid hex or reg format' });
    }
    return res.status(400).json({ error: 'hex or reg parameter required' });
  }

  try {
    // 1차: Planespotters.net API (registration으로 검색 - 가장 정확함)
    if (normalizedReg) {
      try {
        const psRes = await fetch(`https://api.planespotters.net/pub/photos/reg/${normalizedReg}`, {
          headers: { 'User-Agent': 'RKPU-Viewer/1.0' }
        });
        if (psRes.ok) {
          const psData = await psRes.json();
          if (psData.photos && psData.photos.length > 0) {
            const photo = psData.photos[0];
            // 우선순위: large > medium > thumbnail_large > thumbnail
            const imageUrl = photo.large?.src || photo.medium?.src || photo.thumbnail_large?.src || photo.thumbnail?.src;
            return res.status(200).json({
              source: 'planespotters',
              image: imageUrl,
              photographer: photo.photographer,
              link: photo.link
            });
          }
        }
      } catch (e) {
        console.warn('Planespotters reg API error:', e);
      }
    }

    // 2차: Planespotters.net API (hex로 검색)
    if (normalizedHex) {
      try {
        const psRes = await fetch(`https://api.planespotters.net/pub/photos/hex/${normalizedHex}`, {
          headers: { 'User-Agent': 'RKPU-Viewer/1.0' }
        });
        if (psRes.ok) {
          const psData = await psRes.json();
          if (psData.photos && psData.photos.length > 0) {
            const photo = psData.photos[0];
            // 우선순위: large > medium > thumbnail_large > thumbnail
            const imageUrl = photo.large?.src || photo.medium?.src || photo.thumbnail_large?.src || photo.thumbnail?.src;
            return res.status(200).json({
              source: 'planespotters',
              image: imageUrl,
              photographer: photo.photographer,
              link: photo.link
            });
          }
        }
      } catch (e) {
        console.warn('Planespotters hex API error:', e);
      }
    }

    // 3차: JetPhotos.com API (registration으로 검색)
    if (normalizedReg) {
      try {
        // JetPhotos는 scraping이 필요하므로 airport-data로 대체
        const adRes = await fetch(`https://www.airport-data.com/api/ac_thumb.json?r=${normalizedReg}&n=1`, {
          headers: { 'User-Agent': 'RKPU-Viewer/1.0' }
        });
        if (adRes.ok) {
          const adData = await adRes.json();
          if (adData.data && adData.data.length > 0 && adData.data[0].image) {
            return res.status(200).json({
              source: 'airport-data',
              image: adData.data[0].image,
              photographer: adData.data[0].photographer
            });
          }
        }
      } catch (e) {
        console.warn('airport-data reg API error:', e);
      }
    }

    // 4차: airport-data.com (hex로 검색)
    if (normalizedHex) {
      try {
        const adRes = await fetch(`https://www.airport-data.com/api/ac_thumb.json?m=${normalizedHex}&n=1`, {
          headers: { 'User-Agent': 'RKPU-Viewer/1.0' }
        });
        if (adRes.ok) {
          const adData = await adRes.json();
          if (adData.data && adData.data.length > 0 && adData.data[0].image) {
            return res.status(200).json({
              source: 'airport-data',
              image: adData.data[0].image,
              photographer: adData.data[0].photographer
            });
          }
        }
      } catch (e) {
        console.warn('airport-data hex API error:', e);
      }
    }

    // 사진 없음
    return res.status(200).json({ source: null, image: null });

  } catch (error) {
    console.error('Photo API error:', error);
    return res.status(500).json({ error: 'Failed to fetch aircraft photo' });
  }
}
