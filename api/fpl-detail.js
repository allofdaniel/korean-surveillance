import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';
import { authenticateUbikais } from './_utils/ubikaisAuthScraper.js';

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;
  if (await checkRateLimit(req, res)) return;

  const parsedUrl = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
  const amsRecPk = parsedUrl.searchParams.get('amsRecPk') || req.query?.amsRecPk || '';
  const amsRecPkCha = parsedUrl.searchParams.get('amsRecPkCha') || req.query?.amsRecPkCha || '';
  const vfrPk = parsedUrl.searchParams.get('vfrPk') || req.query?.vfrPk || '';
  const fpCls = (parsedUrl.searchParams.get('fpCls') || req.query?.fpCls || 'IFR').toUpperCase();
  const flt = (parsedUrl.searchParams.get('flt') || req.query?.flt || '').toUpperCase();

  try {
    const cookieHeader = await authenticateUbikais();

    let rawTelegram = '';
    let recordObj = null;

    if (vfrPk || fpCls === 'VFR') {
      const url = `https://ubikais.fois.go.kr:8030/sysUbikais/biz/fpl/selectViewVfrFpl.fois?vfrPk=${encodeURIComponent(vfrPk)}`;
      const response = await fetch(url, {
        headers: {
          'Cookie': cookieHeader,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/javascript, */*; q=0.01'
        },
        signal: AbortSignal.timeout(8000)
      });

      if (response.ok) {
        const json = await response.json();
        if (json.records && json.records.length > 0) {
          recordObj = json.records[0];
          rawTelegram = (recordObj.amsOriginal || '').trim();
          if (recordObj.updLastDate9) {
            rawTelegram = `Input Time : ${recordObj.updLastDate9}\n${rawTelegram}`;
          }
        }
      }
    } else {
      const targetPk = amsRecPkCha || amsRecPk;
      if (targetPk) {
        const url = `https://ubikais.fois.go.kr:8030/sysUbikais/biz/fpl/selectViewFpl.fois?amsRecPk=${encodeURIComponent(targetPk)}`;
        const response = await fetch(url, {
          headers: {
            'Cookie': cookieHeader,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json, text/javascript, */*; q=0.01'
          },
          signal: AbortSignal.timeout(8000)
        });

        if (response.ok) {
          const json = await response.json();
          if (json.records && json.records.length > 0) {
            recordObj = json.records[0];
            rawTelegram = (recordObj.amsOriginal || '').trim();
          }
        }
      }
    }

    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
    return res.status(200).json({
      status: 'success',
      flt,
      fpCls,
      amsRecPk,
      amsRecPkCha,
      vfrPk,
      rawTelegram: rawTelegram || '(FPL 수신 대기 / 원문 미수신)',
      record: recordObj,
      timestamp: new Date().toISOString()
    });

  } catch (e) {
    console.error(`[fpl-detail] Failed to query FPL detail:`, e.message);
    return res.status(200).json({
      status: 'error',
      message: e.message,
      flt,
      fpCls,
      rawTelegram: `(비행계획서 조회 오류: ${e.message})`,
      timestamp: new Date().toISOString()
    });
  }
}
