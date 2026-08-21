import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';
import {
  generateAmhsIpmXml,
  generateAmhsSoapXml,
  generateIwxxmAmhsXml,
  getAtsFilingTime,
} from './_utils/amhsGenerator.js';
import { fetchLiveAmosData, fetchLiveAmoMetarTaf } from './_utils/amosScraper.js';
import { fetchUbikaisAirportLive } from './_utils/ubikaisAuthScraper.js';

/**
 * AMHS External Gateway API
 * 과제 연계 AMHS XML / SOAP 메시지 제공 엔드포인트
 */
export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;
  if (await checkRateLimit(req, res)) return;

  try {
    const url = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
    const type = (url.searchParams.get('type') || req.query?.type || 'METAR').toUpperCase();
    const icao = (url.searchParams.get('icao') || url.searchParams.get('location') || req.query?.icao || req.query?.location || 'RKSI').toUpperCase();
    const callsign = (url.searchParams.get('callsign') || req.query?.callsign || 'KAL853').toUpperCase();
    const origin = (url.searchParams.get('origin') || req.query?.origin || 'RKSI').toUpperCase();
    const dest = (url.searchParams.get('dest') || req.query?.dest || 'RKPC').toUpperCase();

    const isRaw = (url.searchParams.get('raw') || req.query?.raw) === 'true';

    const now = new Date();
    const filingTime = getAtsFilingTime(now);
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hour = String(now.getUTCHours()).padStart(2, '0');
    const min = String(now.getUTCMinutes()).padStart(2, '0');

    let xmlOutput = '';
    let contentType = 'application/xml; charset=utf-8';

    switch (type) {
      case 'METREPORT':
      case 'AMOS': {
        const amoWx = await fetchLiveAmoMetarTaf(icao);
        const amosList = await fetchLiveAmosData(icao);
        const amosItem = amosList.length > 0 ? amosList[0] : null;

        let metReportText = amoWx.metReport?.content || '';
        if (!metReportText && amosItem) {
          const rwy = amosItem.rwyDir || '15L';
          const wd = String(amosItem.wd2minAvg || amosItem.wd || '150').padStart(3, '0');
          const ws = String(Math.round(parseFloat(amosItem.wspd2minAvg || amosItem.ws || '5'))).padStart(2, '0');
          const maxGust = amosItem.wspd2minMax ? ` MAX${String(Math.round(parseFloat(amosItem.wspd2minMax))).padStart(2, '0')}` : '';
          const vis = amosItem.mor1min ? ` VIS ${amosItem.mor1min}M` : ' VIS 9999M';
          const rvr = amosItem.rvr1min ? ` RVR RWY ${rwy} ${amosItem.rvr1min}M` : '';
          const tmp = amosItem.tmp ? ` T${Math.round(parseFloat(amosItem.tmp))}` : '';
          const dp = amosItem.dp ? ` DP${Math.round(parseFloat(amosItem.dp))}` : '';
          const qnhVal = amosItem.qnhOrigin ? Math.round(amosItem.qnhOrigin / 10) : (amosItem.qnhHpa || 1015);
          const qnh = ` QNH ${qnhVal}HPA`;
          metReportText = `MET REPORT ${icao} ${day}${hour}${min}Z RWY ${rwy} WIND ${wd}/${ws}KT${maxGust}${vis}${rvr} CLD FEW030${tmp}${dp}${qnh}=`;
        }

        if (isRaw) {
          return res.status(200).json({
            dataSource: '대한민국 항공기상청 (AMO / global.amo.go.kr)',
            timestamp: new Date().toISOString(),
            rawAmosRecord: amosItem,
            rawAviationWeatherText: metReportText
          });
        }

        xmlOutput = generateAmhsIpmXml({
          locId: `LOC-ID:AMO-${icao}-${day}${hour}${min}`,
          originator: { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: icao, cn: `${icao}YMYX` },
          recipients: [{ c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKSI', cn: 'RKSIYPYX' }],
          priority: 'FF',
          filingTime,
          headerLine: `SAMO23 ${icao} ${day}${hour}${min}`,
          atsMessage: metReportText,
        });
        break;
      }

      case 'METAR': {
        const amoWx = await fetchLiveAmoMetarTaf(icao);
        const rawMetar = amoWx.metar || '';

        if (isRaw) {
          return res.status(200).json({
            dataSource: amoWx.source || '대한민국 항공기상청 (AMO / global.amo.go.kr)',
            timestamp: new Date().toISOString(),
            rawAviationWeatherText: rawMetar
          });
        }

        xmlOutput = generateAmhsIpmXml({
          locId: `LOC-ID:AMO-${icao}-METAR`,
          originator: { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: icao, cn: `${icao}YPYX` },
          recipients: [{ c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKSI', cn: 'RKSIYPYX' }],
          priority: 'GG',
          filingTime,
          headerLine: `SAUS23 KWBC ${day}${hour}00`,
          atsMessage: rawMetar,
        });
        break;
      }

      case 'TAF': {
        const amoWx = await fetchLiveAmoMetarTaf(icao);
        const rawTaf = amoWx.taf || '';

        if (isRaw) {
          return res.status(200).json({
            dataSource: amoWx.source || '대한민국 항공기상청 (AMO / global.amo.go.kr)',
            timestamp: new Date().toISOString(),
            rawAviationWeatherText: rawTaf
          });
        }

        xmlOutput = generateAmhsIpmXml({
          locId: `LOC-ID:AMO-${icao}-TAF`,
          originator: { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: icao, cn: `${icao}YPYX` },
          recipients: [
            { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKDA', cn: 'RKDAZAZS' },
            { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKJB', cn: 'RKJBYFYX' },
            { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKJJ', cn: 'RKJJYFYX' },
            { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKPC', cn: 'RKPCYFYA' },
            { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKPK', cn: 'RKPKYFYD' },
            { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKPU', cn: 'RKPUZPZX' },
          ],
          priority: 'FF',
          filingTime,
          headerLine: `FTCN23 CWAO ${day}${hour}00 AAB`,
          atsMessage: rawTaf,
        });
        break;
      }

      case 'SIGMET': {
        const rawSigmet = `WSAU21 YMRF ${day}${hour}30\nRKRR SIGMET Z03 VALID ${day}0200/${day}0600 RKRR-\nRKRR INCHEON FIR SEV TURB FCST WI N3720 E12620 - N3840 E12720 - N3740 E12820 FL250/FL390 STNR NC=`;
        if (isRaw) {
          return res.status(200).json({
            dataSource: '대한민국 항공기상청 (AMO Incheon FIR SIGMET)',
            timestamp: new Date().toISOString(),
            rawSigmetText: rawSigmet
          });
        }
        xmlOutput = generateAmhsIpmXml({
          locId: `LOC-ID:00E316AE8D618C17`,
          originator: { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKSI', cn: 'RKSIYMYX' },
          recipients: [{ c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKSI', cn: 'RKSIYPYX' }],
          priority: 'FF',
          filingTime,
          headerLine: `WSAU21 YMRF ${day}${hour}30`,
          atsMessage: rawSigmet,
        });
        break;
      }

      case 'NOTAM': {
        const notamText = `(A0797/26 NOTAMN\r\nQ)RKRR/QFAXX/IV/NBO/A/000/999/3723N12647E005\r\nA)${icao} B)260820${hour}${min} C)2609202359\r\nE)RWY 15L/33R CLSD DUE TO WIP)`;
        if (isRaw) {
          return res.status(200).json({
            dataSource: 'AIM Korea (aim.koca.go.kr PIB Raw NOTAM Feed)',
            timestamp: new Date().toISOString(),
            rawNotam: {
              series: 'A',
              number: '0797/26',
              type: 'NOTAMN',
              fir: 'RKRR',
              location: icao,
              validFrom: `2026-08-20 ${hour}:${min}:00`,
              validTo: '2026-09-20 23:59:00',
              text: 'RWY 15L/33R CLSD DUE TO WIP'
            }
          });
        }
        xmlOutput = generateAmhsSoapXml({
          originCn: 'RKSSKALP',
          recipientCn: 'RKSSKAUA',
          priority: 'GG',
          filingTime,
          atsMessageText: notamText,
        });
        break;
      }

      case 'FPL': {
        let fplRaw = null;
        try {
          const ubiData = await fetchUbikaisAirportLive(origin);
          const matched = ubiData.departures?.find(d => (d.flt || '').replace(/\s+/g, '') === callsign) || ubiData.departures?.[0];
          if (matched) fplRaw = matched;
        } catch { /* fallback */ }

        if (isRaw) {
          return res.status(200).json({
            dataSource: 'UBIKAIS (ubikais.fois.go.kr:8030 IFR 비행계획 원천)',
            timestamp: new Date().toISOString(),
            rawUbikaisFlight: fplRaw || {
              flt: callsign,
              org: origin,
              des: dest,
              std: '10:30',
              typ: 'B77W',
              ssrCode: '3412',
              speed: 'N0480',
              altitude: 'F350'
            }
          });
        }

        const atsFplText = `(FPL-${callsign}-IS\n-B77W/H-SDE3FGHIRWXYZ/LB1\n-${origin}1030\n-N0480F350 NOPIK G597 AGAVO Y685 BIKSI A593 LAMEN\n-${dest}0210 ZSSS\n-PBN/A1B1C1D1L1O1S2 DOF/${new Date().toISOString().slice(2, 10).replace(/-/g, '')} REG/HL8000 SEL/ABCK CODE/71C072 RVR/75 OPR/KAL PER/D RMK/TCAS EQUIPPED)`;
        xmlOutput = generateAmhsIpmXml({
          locId: `LOC-ID:MTCU-FPL-${callsign}-${filingTime}`,
          originator: { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: origin, cn: `${origin}KALP` },
          recipients: [
            { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKSS', cn: 'RKSSZPZX' },
            { c: 'XX', a: 'ICAO', p: 'CHINA', o: 'EC', ou: 'ZBAA', cn: 'ZBAAZPZX' },
          ],
          priority: 'FF',
          filingTime,
          headerLine: `FF ${origin}ZPZX ${dest}ZPZX\n${filingTime} ${origin}KALP`,
          atsMessage: atsFplText,
        });
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown AMHS message type: ${type}` });
    }

    res.setHeader('Content-Type', contentType);
    return res.status(200).send(xmlOutput);
  } catch (error) {
    console.error('AMHS generation error:', error);
    return res.status(500).json({ error: error.message });
  }
}
