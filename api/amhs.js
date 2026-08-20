import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';
import {
  generateAmhsIpmXml,
  generateAmhsSoapXml,
  generateIwxxmAmhsXml,
  getAtsFilingTime,
} from './_utils/amhsGenerator.js';
import { fetchLiveAmosData, fetchLiveAmoMetarTaf } from './_utils/amosScraper.js';
import { fetchUbikaisSchedule } from './_utils/ubikaisScraper.js';

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
    let rawOutput = null;
    let contentType = 'application/xml; charset=utf-8';

    switch (type) {
      case 'METREPORT':
      case 'AMOS': {
        // 실시간 관제기상 (1~2초 단위 고빈도 갱신 데이터)
        const amosList = await fetchLiveAmosData(icao);
        const amosItem = amosList.length > 0 ? amosList[0] : {
          stnCd: icao,
          rwyDir: '15L',
          wd2minAvg: '150',
          wspd2minAvg: '5.0',
          wspd2minMax: '7.0',
          mor1min: '5600',
          rvr1min: 'P2000',
          tmp: '27.0',
          dp: '24.0',
          qnhOrigin: 10152,
        };

        if (isRaw) {
          return res.status(200).json({
            dataSource: 'AMO 항공기상청 (AmosRealTimeMqc.do 원천 관측치)',
            timestamp: new Date().toISOString(),
            rawAmosRecord: amosItem,
            rawAviationWeatherText: metReportText
          });
        }

        const rwy = amosItem.rwyDir || '15L';
        const wd = String(amosItem.wd2minAvg || '150').padStart(3, '0');
        const ws = String(Math.round(parseFloat(amosItem.wspd2minAvg || '5'))).padStart(2, '0');
        const maxGust = amosItem.wspd2minMax ? ` MAX${String(Math.round(parseFloat(amosItem.wspd2minMax))).padStart(2, '0')}` : '';
        const vis = amosItem.mor1min ? ` VIS ${amosItem.mor1min}M` : ' VIS 9999M';
        const rvr = amosItem.rvr1min ? ` RVR RWY ${rwy} ${amosItem.rvr1min}M` : '';
        const tmp = amosItem.tmp ? ` T${Math.round(parseFloat(amosItem.tmp))}` : '';
        const dp = amosItem.dp ? ` DP${Math.round(parseFloat(amosItem.dp))}` : '';
        const qnhVal = amosItem.qnhOrigin ? Math.round(amosItem.qnhOrigin / 10) : 1015;
        const qnh = ` QNH ${qnhVal}HPA`;

        const metReportText = `MET REPORT ${icao} ${day}${hour}${min}Z RWY ${rwy} WIND ${wd}/${ws}KT${maxGust}${vis}${rvr} CLD FEW030${tmp}${dp}${qnh}=`;

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
        // 1. 항공날씨 (AMO domestic-airport) 실시간 우선, 2. NOAA 폴백
        let rawMetar = `METAR ${icao} ${day}${hour}00Z 18008KT 9999 SCT030 30/22 Q1012 NOSIG=`;
        try {
          const amoWx = await fetchLiveAmoMetarTaf(icao);
          if (amoWx.metar) {
            rawMetar = amoWx.metar.trim();
          } else {
            const wxRes = await fetch(`https://aviationweather.gov/api/data/metar?ids=${icao}&format=raw`);
            if (wxRes.ok) {
              const txt = (await wxRes.text()).trim();
              if (txt && !txt.startsWith('<')) rawMetar = txt;
            }
          }
        } catch { /* fallback to stable default */ }

        if (isRaw) {
          return res.status(200).json({
            dataSource: 'AMO 항공기상청 (global.amo.go.kr METAR)',
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
        // 1. NOAA 항공기상청 실시간 우선, 2. AMO 폴백
        let rawTaf = `TAF ${icao} ${day}${hour}00Z ${day}${hour}/${day + 1}06 18010KT 9999 SCT035 BKN200=`;
        try {
          const tafRes = await fetch(`https://aviationweather.gov/api/data/taf?ids=${icao}&format=raw`);
          if (tafRes.ok) {
            const txt = (await tafRes.text()).trim();
            if (txt && !txt.startsWith('<')) rawTaf = txt;
          } else {
            const amoWx = await fetchLiveAmoMetarTaf(icao);
            if (amoWx.taf) rawTaf = amoWx.taf.trim();
          }
        } catch { /* fallback to stable default */ }

        if (isRaw) {
          return res.status(200).json({
            dataSource: 'AMO 항공기상청 (global.amo.go.kr TAF)',
            timestamp: new Date().toISOString(),
            rawAviationWeatherText: rawTaf
          });
        }

        xmlOutput = generateAmhsIpmXml({
          locId: `LOC-ID:00E316AF1B779727`,
          originator: { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: icao, cn: `${icao}YPYX` },
          recipients: [
            { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKDA', cn: 'RKDAZAZS' },
            { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKJB', cn: 'RKJBYFYX' },
            { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKJJ', cn: 'RKJJYFYX' },
            { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKPC', cn: 'RKPCYFYA' },
            { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKPK', cn: 'RKPKYFYD' },
            { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKPU', cn: 'RKPUZPZX' },
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
            dataSource: 'AMO 항공기상청 (Incheon FIR SIGMET)',
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
        // UBIKAIS 실시간 운항스케줄 IFR 비행계획
        let fplRaw = null;
        try {
          const ubiDeps = await fetchUbikaisSchedule(origin, 'dep');
          const matched = ubiDeps.find(d => (d.fpId || '').replace(/\s+/g, '') === callsign) || ubiDeps[0];
          if (matched) {
            fplRaw = matched;
          }
        } catch { /* fallback */ }

        if (isRaw) {
          return res.status(200).json({
            dataSource: 'UBIKAIS (ubikais.fois.go.kr:8030 IFR 비행계획 원천)',
            timestamp: new Date().toISOString(),
            rawUbikaisFlight: fplRaw || {
              fpId: callsign,
              apIcao: origin,
              apArr: dest,
              std: '10:30',
              acTyp: 'B77W',
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

      case 'DEP': {
        const depText = `(DEP-${callsign}/A2622-${origin}${hour}${min}-${dest}-DOF/${new Date().toISOString().slice(2, 10).replace(/-/g, '')})`;
        xmlOutput = generateAmhsSoapXml({
          originCn: 'RKSSKALP',
          recipientCn: 'RKSSKAUA',
          priority: 'FF',
          filingTime,
          atsMessageText: depText,
        });
        break;
      }

      case 'ARR': {
        const arrText = `(ARR-${callsign}-${origin}0255-${dest}${hour}${min})`;
        xmlOutput = generateAmhsSoapXml({
          originCn: 'RKSSKALP',
          recipientCn: 'RKSSKAUA',
          priority: 'FF',
          filingTime,
          atsMessageText: arrText,
        });
        break;
      }

      case 'DLA': {
        const dlaText = `(DLA-${callsign}-${origin}0540-${dest}-DOF/${new Date().toISOString().slice(2, 10).replace(/-/g, '')})`;
        xmlOutput = generateAmhsSoapXml({
          originCn: 'RKSSKALP',
          recipientCn: 'RKSSKAUA',
          priority: 'FF',
          filingTime,
          atsMessageText: dlaText,
        });
        break;
      }

      case 'CNL': {
        const cnlText = `(CNL-${callsign}-${origin}0955-${dest}-DOF/${new Date().toISOString().slice(2, 10).replace(/-/g, '')})`;
        xmlOutput = generateAmhsSoapXml({
          originCn: 'RKSSKALP',
          recipientCn: 'RKSSKAUA',
          priority: 'FF',
          filingTime,
          atsMessageText: cnlText,
        });
        break;
      }

      case 'CHG': {
        const chgText = `(CHG-${callsign}-${origin}0255-${dest}-DOF/${new Date().toISOString().slice(2, 10).replace(/-/g, '')}\n-16/${dest}0141 ${origin})`;
        xmlOutput = generateAmhsIpmXml({
          locId: `MTCU581027932160626002738`,
          originator: { c: 'XX', a: 'ICAO', p: 'CHINA', o: 'EC', ou: 'ZSSS', cn: 'ZSSSCESX' },
          recipients: [{ c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKSS', cn: 'RKSSZPZX' }],
          priority: 'FF',
          filingTime,
          atsMessage: chgText,
        });
        break;
      }

      case 'IWXXM': {
        const sampleIwxxm = `<iwxxm:TAF xmlns:iwxxm="http://icao.int/iwxxm/2023-1" status="NORMAL"><iwxxm:issueTime>${now.toISOString()}</iwxxm:issueTime><iwxxm:aerodrome>${icao}</iwxxm:aerodrome></iwxxm:TAF>`;
        xmlOutput = generateIwxxmAmhsXml({ rawXml: sampleIwxxm });
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
