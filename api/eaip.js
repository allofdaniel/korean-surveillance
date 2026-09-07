/**
 * e-AIP Synchronization and Aeronautical Navigation Data Engine API
 * Endpoint: /api/eaip
 * Source: Ministry of Land, Infrastructure and Transport (KOCA) Official e-AIP
 * Update Schedule: 7-day continuous verification cycle + 28-day AIRAC package sync
 */

import { setCorsHeaders } from './_utils/cors.js';
import { recordEaipSyncPackage } from './_utils/supabase.js';
import fs from 'fs';
import path from 'path';

let inMemoryFixesCache = null;
let lastSyncTime = new Date().toISOString();
let currentAiracVersion = '2026-08-20';

function parseDms(latStr, lonStr) {
  const mLat = (latStr || '').match(/(\d{2})(\d{2})(\d{2})N/);
  const mLon = (lonStr || '').match(/(\d{3})(\d{2})(\d{2})E/);
  if (!mLat || !mLon) return null;
  const lat = parseInt(mLat[1], 10) + parseInt(mLat[2], 10)/60 + parseInt(mLat[3], 10)/3600;
  const lon = parseInt(mLon[1], 10) + parseInt(mLon[2], 10)/60 + parseInt(mLon[3], 10)/3600;
  return { lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)) };
}

async function loadOrSyncFixes(forceSync = false) {
  if (inMemoryFixesCache && !forceSync && Object.keys(inMemoryFixesCache).length > 0) {
    return inMemoryFixesCache;
  }

  // 1. Try local JSON first
  try {
    const localPath = path.join(process.cwd(), 'public', 'data', 'korean_navdata_fixes.json');
    if (fs.existsSync(localPath) && !forceSync) {
      const data = JSON.parse(fs.readFileSync(localPath, 'utf8'));
      inMemoryFixesCache = data;
      return inMemoryFixesCache;
    }
  } catch (e) {
    // fallback to fetch
  }

  // 2. Fetch directly from official KOCA e-AIP
  try {
    const r44 = await fetch('https://aim.koca.go.kr/eaipPub/Package/' + currentAiracVersion + '/html/eAIP/KR-ENR-4.4-en-GB.html', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(10000)
    });

    if (r44.ok) {
      const html44 = await r44.text();
      const fixes = {};
      const rowRegex = /<tr[^>]*id="SP-[^"]*"[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<p[^>]*>(\d{6}N)<\/p>\s*<p[^>]*>(\d{7}E)<\/p>[\s\S]*?(?:<td[^>]*>([\s\S]*?)<\/td>)?[\s\S]*?<\/tr>/g;
      
      let m;
      while ((m = rowRegex.exec(html44)) !== null) {
        const rawName = m[1].replace(/<[^>]+>/g, '').trim();
        const cleanCode = rawName.replace(/\([^)]*\)/g, '').trim();
        const latStr = m[2];
        const lonStr = m[3];
        const airways = (m[4] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const coords = parseDms(latStr, lonStr);

        if (cleanCode && coords) {
          fixes[cleanCode] = {
            name: rawName,
            lat: coords.lat,
            lon: coords.lon,
            dms: latStr + ' ' + lonStr,
            airways: airways,
            type: cleanCode.length <= 3 ? 'VOR/NDB' : 'WPT',
            source: 'e-AIP KOCA ' + currentAiracVersion + ' ENR 4.4'
          };
        }
      }

      inMemoryFixesCache = fixes;
      lastSyncTime = new Date().toISOString();

      // Record to Supabase DB
      recordEaipSyncPackage({
        package_date: currentAiracVersion,
        airac_cycle: '2608',
        total_waypoints: Object.keys(fixes).length,
        sync_interval_days: 7,
        metadata: { source_url: 'https://aim.koca.go.kr/eaipPub/Package/history-en-GB.html' }
      }).catch(err => console.warn('[supabase-bg] eaip sync record failed:', err.message));

      return inMemoryFixesCache;
    }
  } catch (e) {
    console.error('e-AIP sync failed:', e);
  }

  return inMemoryFixesCache || {};
}

export default async function handler(req, res) {
  if (setCorsHeaders && setCorsHeaders(req, res)) return;

  const parsedUrl = new URL(req.url, 'http://' + (req.headers?.host || 'localhost'));
  const action = parsedUrl.searchParams.get('action') || req.query?.action || 'status';
  const query = parsedUrl.searchParams.get('query') || req.query?.query || '';
  const airport = (parsedUrl.searchParams.get('airport') || req.query?.airport || 'RKSI').toUpperCase();
  const force = (parsedUrl.searchParams.get('force') || req.query?.force || 'false') === 'true';

  try {
    const fixes = await loadOrSyncFixes(force || action === 'sync');

    if (action === 'status' || action === 'sync') {
      return res.status(200).json({
        success: true,
        airacPackage: currentAiracVersion,
        syncIntervalDays: 7,
        totalFixes: Object.keys(fixes).length,
        lastSync: lastSyncTime,
        databaseTarget: 'supabase_db (navdata_fixes, eaip_sync_packages)',
        source: 'https://aim.koca.go.kr/eaipPub/Package/history-en-GB.html',
        samplePoints: {
          AGAVO: fixes['AGAVO'],
          LAMEN: fixes['LAMEN'],
          MUGUS: fixes['MUGUS'],
          ATOTI: fixes['ATOTI'],
          BEDAR: fixes['BEDAR'],
          ONIKU: fixes['ONIKU'],
          RUGMA: fixes['RUGMA'],
          SAMDO: fixes['SAMDO'],
          BESNA: fixes['BESNA'],
          APELA: fixes['APELA'],
          INVOK: fixes['INVOK'],
          KALEK: fixes['KALEK'],
          SAPRA: fixes['SAPRA'],
          LANAT: fixes['LANAT'],
          IGRAS: fixes['IGRAS'],
          ANDOL: fixes['ANDOL'],
          KANSU: fixes['KANSU']
        }
      });
    }

    if (action === 'fixes') {
      if (query) {
        const qUpper = query.toUpperCase().trim();
        const results = {};
        for (const [k, v] of Object.entries(fixes)) {
          if (k.includes(qUpper) || (v.name && v.name.toUpperCase().includes(qUpper))) {
            results[k] = v;
          }
        }
        return res.status(200).json({ success: true, count: Object.keys(results).length, fixes: results });
      }
      return res.status(200).json({ success: true, count: Object.keys(fixes).length, fixes });
    }

    if (action === 'charts') {
      const chartsCatalog = {
        RKSI: [
          { type: 'ADC', title: 'Aerodrome Chart (ICAO)', code: 'RKSI_AD2_ADC', url: 'https://aim.koca.go.kr/eaipPub/Package/' + currentAiracVersion + '/pdf/KR-AD-2.RKSI-en-GB.pdf' },
          { type: 'PDC', title: 'Aircraft Parking / Docking Chart', code: 'RKSI_AD2_PDC', url: 'https://aim.koca.go.kr/eaipPub/Package/' + currentAiracVersion + '/pdf/KR-AD-2.RKSI-en-GB.pdf' },
          { type: 'SID', title: 'Standard Departure Chart - Instrument (BOPTA / SEL / NOPIK)', code: 'RKSI_AD2_SID', url: 'https://aim.koca.go.kr/eaipPub/Package/' + currentAiracVersion + '/pdf/KR-AD-2.RKSI-en-GB.pdf' },
          { type: 'STAR', title: 'Standard Arrival Chart - Instrument (GUKDO / KARAS / OLMEN)', code: 'RKSI_AD2_STAR', url: 'https://aim.koca.go.kr/eaipPub/Package/' + currentAiracVersion + '/pdf/KR-AD-2.RKSI-en-GB.pdf' },
          { type: 'IAC', title: 'Instrument Approach Chart - ILS/DME RWY 15L/15R/16L/16R', code: 'RKSI_AD2_IAC', url: 'https://aim.koca.go.kr/eaipPub/Package/' + currentAiracVersion + '/pdf/KR-AD-2.RKSI-en-GB.pdf' }
        ],
        RKSS: [
          { type: 'ADC', title: 'Gimpo Aerodrome Chart', code: 'RKSS_AD2_ADC', url: 'https://aim.koca.go.kr/eaipPub/Package/' + currentAiracVersion + '/pdf/KR-AD-2.RKSS-en-GB.pdf' },
          { type: 'SID', title: 'Gimpo SID (BUMAN / BOPTA / EGOBA)', code: 'RKSS_AD2_SID', url: 'https://aim.koca.go.kr/eaipPub/Package/' + currentAiracVersion + '/pdf/KR-AD-2.RKSS-en-GB.pdf' },
          { type: 'IAC', title: 'ILS/DME RWY 14L/14R/32L/32R', code: 'RKSS_AD2_IAC', url: 'https://aim.koca.go.kr/eaipPub/Package/' + currentAiracVersion + '/pdf/KR-AD-2.RKSS-en-GB.pdf' }
        ],
        RKPC: [
          { type: 'ADC', title: 'Jeju Aerodrome Chart', code: 'RKPC_AD2_ADC', url: 'https://aim.koca.go.kr/eaipPub/Package/' + currentAiracVersion + '/pdf/KR-AD-2.RKPC-en-GB.pdf' },
          { type: 'STAR', title: 'Jeju STAR (DOTOL / SOSDO / TAMNA)', code: 'RKPC_AD2_STAR', url: 'https://aim.koca.go.kr/eaipPub/Package/' + currentAiracVersion + '/pdf/KR-AD-2.RKPC-en-GB.pdf' },
          { type: 'IAC', title: 'ILS/DME RWY 07/25', code: 'RKPC_AD2_IAC', url: 'https://aim.koca.go.kr/eaipPub/Package/' + currentAiracVersion + '/pdf/KR-AD-2.RKPC-en-GB.pdf' }
        ],
        RKJY: [
          { type: 'ADC', title: 'Yeosu Aerodrome Chart', code: 'RKJY_AD2_ADC', url: 'https://aim.koca.go.kr/eaipPub/Package/' + currentAiracVersion + '/pdf/KR-AD-2.RKJY-en-GB.pdf' },
          { type: 'STAR', title: 'Yeosu STAR (POVOR / UPGOS / ANUBA)', code: 'RKJY_AD2_STAR', url: 'https://aim.koca.go.kr/eaipPub/Package/' + currentAiracVersion + '/pdf/KR-AD-2.RKJY-en-GB.pdf' },
          { type: 'IAC', title: 'ILS/DME RWY 17/35', code: 'RKJY_AD2_IAC', url: 'https://aim.koca.go.kr/eaipPub/Package/' + currentAiracVersion + '/pdf/KR-AD-2.RKJY-en-GB.pdf' }
        ]
      };

      return res.status(200).json({
        success: true,
        airport,
        charts: chartsCatalog[airport] || [
          { type: 'ADC', title: airport + ' Aerodrome Chart', code: airport + '_AD2_ADC', url: 'https://aim.koca.go.kr/eaipPub/Package/' + currentAiracVersion + '/pdf/KR-AD-2.' + airport + '-en-GB.pdf' }
        ]
      });
    }

    return res.status(400).json({ error: 'Invalid action parameter' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
