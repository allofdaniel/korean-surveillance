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
    const url = new URL(req.url, `http://${req.headers.host}`);
    const type = (url.searchParams.get('type') || 'METAR').toUpperCase();
    const icao = (url.searchParams.get('icao') || url.searchParams.get('location') || 'RKSI').toUpperCase();
    const callsign = (url.searchParams.get('callsign') || 'KAL853').toUpperCase();
    const origin = (url.searchParams.get('origin') || 'RKSI').toUpperCase();
    const dest = (url.searchParams.get('dest') || 'RKPC').toUpperCase();

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
        let rawMetar = `METAR ${icao} ${day}${hour}${min}Z 30007KT 10SM SKC 30/22 A3008=`;
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
        } catch { /* fallback to default */ }

        xmlOutput = generateAmhsIpmXml({
          locId: `AMJJJPU000.M331424-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}.${hour}${min}00`,
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
        // 1. 항공날씨 (AMO domestic-airport) 실시간 우선, 2. NOAA 폴백
        let rawTaf = `TAF AMD ${icao} ${day}${hour}${min}Z ${day}${hour}/${day}12 00000KT P6SM SCT040 BKN080\n    TEMPO ${day}01/${day}03 VRB15G25KT 5SM -TSRA BR BKN040CB OVC080\n    RMK NXT FCST BY ${day}0600Z=`;
        try {
          const amoWx = await fetchLiveAmoMetarTaf(icao);
          if (amoWx.taf) {
            rawTaf = amoWx.taf.trim();
          } else {
            const tafRes = await fetch(`https://aviationweather.gov/api/data/taf?ids=${icao}&format=raw`);
            if (tafRes.ok) {
              const txt = (await tafRes.text()).trim();
              if (txt && !txt.startsWith('<')) rawTaf = txt;
            }
          }
        } catch { /* fallback to default */ }

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
        const fplText = `(FPL-${callsign}-IS\n-A321/M-SDE1FGHIRW/LB1\n-${origin}0515\n-N0465F320 DCT BOPTA Z51 BEDES Y711 MUGUS Y742 SALMI Q11 DRAKE A1\n ELATO J101 SMT\n-${dest}0306 RCKH VHHH\n-PBN/A1B1C1D1L1O1S2T1 DOF/${new Date().toISOString().slice(2, 10).replace(/-/g, '')} REG/HL8321\n EET/RJJJ0108 RCAA0122 SEL/AQBM CODE/71C072\n RMK/TCAS EQUIPPED)`;
        xmlOutput = generateAmhsIpmXml({
          locId: `SLCAMHS${day}${hour}${min}0100819770`,
          originator: { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKSI', cn: 'RKSIAARX' },
          recipients: [
            { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKSI', cn: 'RKSIZPZX' },
            { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKRR', cn: 'RKRRZQZG' },
            { c: 'XX', a: 'ICAO', p: 'REP-KOREA', o: 'RKSS', ou: 'RKDA', cn: 'RKDAZQZG' },
          ],
          priority: 'FF',
          filingTime,
          atsMessage: fplText,
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
