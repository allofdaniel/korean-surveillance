import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xwwygmiwjlhnlfultear.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3d3lnbWl3amxobmxmdWx0ZWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTE3MDEsImV4cCI6MjEwMzA4NzcwMX0.2dwsq8yeZNwo9rEapB1IHYS4lvQsHZWPSlOvbDX196A';

const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
  'Prefer': 'return=representation,resolution=merge-duplicates'
};

export const AMHS_SAMPLE_DATA = [
  {
    "id": "sample-1",
    "name": "1. FPL 제출 비행계획서 (AMHS IPM XML, AMU821)",
    "type": "FPL",
    "callsign": "AMU821",
    "format": "XML (AMHS IPM)",
    "protocol": "AMHS IPM (X.400)",
    "content": "<?xml version=\"1.0\"?>\n                <Content>\n                  <ipm>\n                    <heading>\n                      <this-IPM>\n                        <user>\n                          <C>XX</C>\n                          <A>ICAO</A>\n                          <P>REP-KOREA</P>\n                          <O>RKSS</O>\n                          <OU>RKSI</OU>\n                          <ExtensionAttribute extension-attribute-type=\"1\">\n                            <CN>RKSIAARX</CN>\n                          </ExtensionAttribute>\n                        </user>\n                        <user-relative-identifier>SLCAMHS071600470100819770</user-relative-identifier>\n                      </this-IPM>\n                      <originator>\n                        <formal-name>\n                          <C>XX</C>\n                          <A>ICAO</A>\n                          <P>REP-KOREA</P>\n                          <O>RKSS</O>\n                          <OU>RKSI</OU>\n                          <ExtensionAttribute extension-attribute-type=\"1\">\n                            <CN>RKSIAARX</CN>\n                          </ExtensionAttribute>\n                        </formal-name>\n                      </originator>\n                      <primary-recipients>\n                        <PrimaryRecipientsSubfield>\n                          <formal-name>\n                            <C>XX</C>\n                            <A>ICAO</A>\n                            <P>REP-KOREA</P>\n                            <O>RKSS</O>\n                            <OU>RKSI</OU>\n                            <ExtensionAttribute extension-attribute-type=\"1\">\n                              <CN>RKSIZPZX</CN>\n                            </ExtensionAttribute>\n                          </formal-name>\n                        </PrimaryRecipientsSubfield>\n                      </primary-recipients>\n                    </heading>\n                    <body>\n                      <BodyPart>\n                        <ia5-text>\n                          <parameters repertoire=\"ia5\"/>\n                          <data><soh/>PRI: FF\\r\n                FT: 160047\\r\n                <stx/>(FPL-AMU821-IS\\r\n                -A321/M-SDE1FGHIRW/LB1\\r\n                -RKSI0515\\r\n                -N0465F320 DCT BOPTA Z51 BEDES Y711 MUGUS Y742 SALMI Q11 DRAKE A1\\r\n                 ELATO J101 SMT\\r\n                -VMMC0306 RCKH VHHH\\r\n                -PBN/A1B1C1D1L1O1S2T1 DOF/260716 REG/BMBA\\r\n                 EET/RJJJ0108 RCAA0122 VHHK0226 ZGZU0256 SEL/AQBM CODE/78041B\\r\n                 RMK/TCAS EQUIPPED TAIWAN OVF PERM 11502160568)</data>\n                        </ia5-text>\n                      </BodyPart>\n                    </body>\n                  </ipm>\n                </Content>"
  },
  {
    "id": "sample-2",
    "name": "2. CHG 비행계획 변경 (AMHS IPM XML, CES5072)",
    "type": "CHG",
    "callsign": "CES5072",
    "format": "XML (AMHS IPM)",
    "protocol": "AMHS IPM (X.400)",
    "content": "<?xml version=\"1.0\"?>\n                <Content>\n                  <ipm>\n                    <heading>\n                      <this-IPM>\n                        <user>\n                          <C>XX</C>\n                          <A>ICAO</A>\n                          <P>CHINA</P>\n                          <O>EC</O>\n                          <OU>ZSSS</OU>\n                          <ExtensionAttribute extension-attribute-type=\"1\">\n                            <CN>ZSSSCESX</CN>\n                          </ExtensionAttribute>\n                        </user>\n                      </this-IPM>\n                    </heading>\n                    <body>\n                      <BodyPart>\n                        <ia5-text>\n                          <parameters repertoire=\"ia5\"/>\n                          <data><soh/>PRI: FF\\r\n                FT: 160027\\r\n                OHI: \\r\n                <stx/>(CHG-CES5072-RKSI0255-ZSHC-DOF/260716\\r\n                -16/ZSHC0141 ZSWZ)</data>\n                        </ia5-text>\n                      </BodyPart>\n                    </body>\n                  </ipm>\n                </Content>"
  },
  {
    "id": "sample-3",
    "name": "3. CNL 비행계획 취소 (SOAP, KAL1847)",
    "type": "CNL",
    "callsign": "KAL1847",
    "format": "SOAP",
    "protocol": "AMHS / SIS WebService",
    "content": "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\">\n                  <soapenv:Header xmlns:wsa=\"http://www.w3.org/2005/08/addressing\">\n                    <wsa:Action>http://www.comsoft.aero/aida-ng/AIDA-NG-ServiceInterface/receiveAmhsMessageRequest</wsa:Action>\n                    <wsa:MessageID>urn:uuid:0d912830-9157-1f11-2461-000c29f0719c</wsa:MessageID>\n                  </soapenv:Header>\n                  <soapenv:Body>\n                    <n:receiveAmhsMessageResponse xmlns:n=\"http://www.comsoft.aero/aida-ng/\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">\n                      <messageId>00020260806052410207</messageId>\n                      <amhsMessageDelivery xsi:type=\"amhsMessageDeliveryType\">\n                        <ipm xsi:type=\"ipmType\">\n                          <heading xsi:type=\"headingType\">\n                            <priority>FF</priority>\n                            <filingTime>060524</filingTime>\n                          </heading>\n                          <body xsi:type=\"bodyType\">\n                            <bodyPart xsi:type=\"bodyPartType\">\n                              <atsMessageText>(CNL-KAL1847-RKSS0955-RKPU-DOF/260806)</atsMessageText>\n                            </bodyPart>\n                          </body>\n                        </ipm>\n                      </amhsMessageDelivery>\n                    </n:receiveAmhsMessageResponse>\n                  </soapenv:Body>\n                </soapenv:Envelope>"
  },
  {
    "id": "sample-4",
    "name": "4. DLA 비행 지연 (SOAP, AAR8948)",
    "type": "DLA",
    "callsign": "AAR8948",
    "format": "SOAP",
    "protocol": "AMHS / SIS WebService",
    "content": "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\">\n                  <soapenv:Body>\n                    <n:receiveAmhsMessageResponse xmlns:n=\"http://www.comsoft.aero/aida-ng/\">\n                      <amhsMessageDelivery>\n                        <ipm>\n                          <heading>\n                            <filingTime>060526</filingTime>\n                          </heading>\n                          <body>\n                            <bodyPart>\n                              <atsMessageText>(DLA-AAR8948-RKPC0540-RKSS-DOF/260806)</atsMessageText>\n                            </bodyPart>\n                          </body>\n                        </ipm>\n                      </amhsMessageDelivery>\n                    </n:receiveAmhsMessageResponse>\n                  </soapenv:Body>\n                </soapenv:Envelope>"
  },
  {
    "id": "sample-5",
    "name": "5. DEP 출발 통보 (SOAP, KAL2086)",
    "type": "DEP",
    "callsign": "KAL2086",
    "format": "SOAP",
    "protocol": "AMHS / SIS WebService",
    "content": "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\">\n                  <soapenv:Body>\n                    <n:receiveAmhsMessageResponse xmlns:n=\"http://www.comsoft.aero/aida-ng/\">\n                      <amhsMessageDelivery>\n                        <ipm>\n                          <heading>\n                            <filingTime>060526</filingTime>\n                          </heading>\n                          <body>\n                            <bodyPart>\n                              <atsMessageText>(DEP-KAL2086/A2622-RCTP0433-RKPK-DOF/260806)</atsMessageText>\n                            </bodyPart>\n                          </body>\n                        </ipm>\n                      </amhsMessageDelivery>\n                    </n:receiveAmhsMessageResponse>\n                  </soapenv:Body>\n                </soapenv:Envelope>"
  },
  {
    "id": "sample-6",
    "name": "6. ARR 도착 통보 (SOAP, CES5072)",
    "type": "ARR",
    "callsign": "CES5072",
    "format": "SOAP",
    "protocol": "AMHS / SIS WebService",
    "content": "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\">\n                  <soapenv:Body>\n                    <n:receiveAmhsMessageResponse xmlns:n=\"http://www.comsoft.aero/aida-ng/\">\n                      <amhsMessageDelivery>\n                        <ipm>\n                          <heading>\n                            <filingTime>060527</filingTime>\n                          </heading>\n                          <body>\n                            <bodyPart>\n                              <atsMessageText>(ARR-CES5072-RKSI0255-ZSHC0450)</atsMessageText>\n                            </bodyPart>\n                          </body>\n                        </ipm>\n                      </amhsMessageDelivery>\n                    </n:receiveAmhsMessageResponse>\n                  </soapenv:Body>\n                </soapenv:Envelope>"
  },
  {
    "id": "sample-7",
    "name": "7. IPN 전송결과 보고 NDR/DR (SOAP)",
    "type": "IPN",
    "callsign": "SYS_REPORT",
    "format": "SOAP",
    "protocol": "AMHS IPM Delivery Report",
    "content": "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\">\n                  <soapenv:Body>\n                    <n:receiveAmhsMessageResponse xmlns:n=\"http://www.comsoft.aero/aida-ng/\">\n                      <messageId>00020250421165836179</messageId>\n                      <amhsMessageDelivery>\n                        <report>\n                          <perRecipientFields>\n                            <perRecipientReportDeliveryFields>\n                              <actualRecipientName>\n                                <address>\n                                  <commonName>RKSSDDDD</commonName>\n                                </address>\n                              </actualRecipientName>\n                              <reportType>\n                                <nonDelivery>\n                                  <nonDeliveryReasonCode>unable-to-transfer (1)</nonDeliveryReasonCode>\n                                  <nonDeliveryDiagnosticCode>encoded-information-types-unsupported (6)</nonDeliveryDiagnosticCode>\n                                </nonDelivery>\n                              </reportType>\n                            </perRecipientReportDeliveryFields>\n                          </perRecipientFields>\n                        </report>\n                      </amhsMessageDelivery>\n                    </n:receiveAmhsMessageResponse>\n                  </soapenv:Body>\n                </soapenv:Envelope>"
  }
];

export function parseAmhsContent(raw) {
  const result = {
    msgType: 'UNKNOWN',
    callsign: 'UNKNOWN',
    depAirport: 'RKSI',
    arrAirport: 'RKPC',
    aircraftType: 'B738',
    wakeCategory: 'M',
    flightRules: 'IFR',
    time: '',
    altitude: 'FL330',
    speed: 'N0450',
    route: '',
    ssrCode: '1200',
    remarks: '',
    bayType: 'DEPARTURE',
    status: 'SCHEDULED',
    isUrgent: false
  };

  if (!raw) return result;
  const content = String(raw);

  if (content.includes('nonDeliveryReasonCode') || content.includes('NonDeliveryReport') || content.includes('reportType')) {
    result.msgType = 'IPN';
    result.bayType = 'TRANSIT';
    result.status = 'ERROR';
    result.isUrgent = true;
    result.callsign = 'SYS_REPORT';
    const reason = content.match(/<nonDeliveryReasonCode>([^<]+)<\/nonDeliveryReasonCode>/i);
    const diag = content.match(/<nonDeliveryDiagnosticCode>([^<]+)<\/nonDeliveryDiagnosticCode>/i);
    const rcpt = content.match(/<commonName>([^<]+)<\/commonName>/i);
    result.remarks = 'NDR: ' + (reason ? reason[1] : '') + ' / ' + (diag ? diag[1] : '');
    if (rcpt) result.arrAirport = rcpt[1];
    return result;
  }

  let atsText = '';
  if (content.includes('<atsMessageText>')) {
    const m = content.match(/<atsMessageText>\(([A-Z]{3})-([\s\S]+?)\)<\/atsMessageText>/i);
    if (m) {
      result.msgType = m[1].toUpperCase();
      atsText = m[2];
    }
  } else if (content.includes('(FPL-')) {
    result.msgType = 'FPL';
    const m = content.match(/\(FPL-([\s\S]+?)\)/);
    if (m) atsText = m[1];
  } else if (content.includes('(CHG-')) {
    result.msgType = 'CHG';
    const m = content.match(/\(CHG-([\s\S]+?)\)/);
    if (m) atsText = m[1];
  }

  if (result.msgType === 'FPL') {
    result.bayType = 'DEPARTURE';
    result.status = 'TAXIOUT';
    const fplMatch = atsText.match(/^([A-Z0-9]+)-([A-Z]+)/);
    if (fplMatch) result.callsign = fplMatch[1];
    const typeMatch = atsText.match(/-([A-Z0-9]+)\/([LMHJ])/);
    if (typeMatch) {
      result.aircraftType = typeMatch[1];
      result.wakeCategory = typeMatch[2];
    }
    const depMatch = atsText.match(/-([A-Z]{4})([0-9]{4})/);
    if (depMatch) {
      result.depAirport = depMatch[1];
      result.time = depMatch[2];
    }
    const routeMatch = atsText.match(/-([NKM0-9]+)([FSAM0-9]+)\s+([\s\S]+?)-([A-Z]{4})([0-9]{4})?/);
    if (routeMatch) {
      result.speed = routeMatch[1];
      result.altitude = routeMatch[2];
      result.route = routeMatch[3].replace(/\s+/g, ' ').trim();
      result.arrAirport = routeMatch[4];
    }
    const ssrMatch = atsText.match(/CODE\/([A-Z0-9]+)/i);
    if (ssrMatch) result.ssrCode = ssrMatch[1];
    const regMatch = atsText.match(/REG\/([A-Z0-9]+)/i);
    if (regMatch) result.remarks = 'REG/' + regMatch[1];
  } else if (result.msgType === 'CHG') {
    result.bayType = 'DEPARTURE';
    result.status = 'PUSHBACK';
    const chgMatch = atsText.match(/^([A-Z0-9]+)-([A-Z]{4})([0-9]{4})?-([A-Z]{4})?/);
    if (chgMatch) {
      result.callsign = chgMatch[1];
      result.depAirport = chgMatch[2];
      if (chgMatch[3]) result.time = chgMatch[3];
      if (chgMatch[4]) result.arrAirport = chgMatch[4];
    }
    result.remarks = 'CHG: ' + (atsText.includes('-16/') ? atsText.slice(atsText.indexOf('-16/')) : atsText);
  } else if (result.msgType === 'CNL') {
    result.bayType = 'CIRCUIT';
    result.status = 'CANCELLED';
    result.isUrgent = true;
    const parts = atsText.split('-');
    if (parts.length >= 1) result.callsign = parts[0];
    if (parts.length >= 2) {
      result.depAirport = parts[1].slice(0, 4);
      if (parts[1].length > 4) result.time = parts[1].slice(4);
    }
    if (parts.length >= 3) result.arrAirport = parts[2].slice(0, 4);
    result.remarks = 'FLIGHT CANCELLED BY ATC';
  } else if (result.msgType === 'DLA') {
    result.bayType = 'CIRCUIT';
    result.status = 'DELAYED';
    result.isUrgent = true;
    const parts = atsText.split('-');
    if (parts.length >= 1) result.callsign = parts[0];
    if (parts.length >= 2) {
      result.depAirport = parts[1].slice(0, 4);
      if (parts[1].length > 4) result.time = parts[1].slice(4);
    }
    if (parts.length >= 3) result.arrAirport = parts[2].slice(0, 4);
    result.remarks = 'DLA REVISED TIME: ' + (result.time || '0540');
  } else if (result.msgType === 'DEP') {
    result.bayType = 'DEPARTURE';
    result.status = 'AIRBORNE';
    const depMatch = atsText.match(/^([A-Z0-9]+)(\/[A-Z0-9]+)?-([A-Z]{4})([0-9]{4})?-([A-Z]{4})?/);
    if (depMatch) {
      result.callsign = depMatch[1];
      if (depMatch[2]) result.ssrCode = depMatch[2].replace('/', '');
      result.depAirport = depMatch[3];
      if (depMatch[4]) result.time = depMatch[4];
      if (depMatch[5]) result.arrAirport = depMatch[5];
    }
    result.remarks = 'AIRBORNE DEP AT ' + (result.time || '0433');
  } else if (result.msgType === 'ARR') {
    result.bayType = 'ARRIVAL';
    result.status = 'FINAL';
    const arrMatch = atsText.match(/^([A-Z0-9]+)-([A-Z]{4})([0-9]{4})?-([A-Z]{4})([0-9]{4})?/);
    if (arrMatch) {
      result.callsign = arrMatch[1];
      result.depAirport = arrMatch[2];
      result.arrAirport = arrMatch[4];
      if (arrMatch[5]) result.time = arrMatch[5];
    }
    result.remarks = 'ARRIVED ATA ' + (result.time || '0450');
  }

  return result;
}


// ---------------------------------------------------------------------------
// MRTO-DATCS-EFS-IDD v1.1 internal interfaces (I-EFS-INT-0020/0030/0040/0050/0060/0090)
//   PATCH /api/strips/{id}/status  -> route=status   (관제 상태 변경 요청)
//   PATCH /api/strips/{id}/bay     -> route=bay      (베이 재배치/순서 변경 요청)
//   POST|GET /api/runway-config    -> route=runway-config (사용 활주로 수동 배정 설정)
//   GET /api/efs/heartbeat         -> route=heartbeat (LINK_HEARTBEAT, 5 s polling)
//   Supabase Realtime broadcast topic "efs": STRIP_UPDATED, RWY_OCCUPANCY_ALERT, LINK_HEARTBEAT
// ---------------------------------------------------------------------------
export const EFS_PHASES = ['STANDBY', 'PUSHBACK', 'TAXIOUT', 'LINEUP', 'AIRBORNE', 'APPROACH', 'LANDED', 'TAXIIN',
  'ONBLOCK', 'ENTRY', 'PASSING', 'EXIT', 'BASE', 'DOWNWIND', 'CROSSWIND', 'UPWIND'];
export const EFS_BAYS = ['DEPARTURE', 'ARRIVAL', 'TRANSIT', 'CIRCUIT'];
const RWY_RE = /^(0[1-9]|[12][0-9]|3[0-6])[LRC]?$/;
const RWY_OCCUPY = ['LINEUP', 'LANDED'];

const RO_HEADERS = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY };

async function sbGetStrip(id) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/efs_flight_strips?id=eq.' + encodeURIComponent(id) + '&limit=1', { headers: RO_HEADERS });
  if (!r.ok) throw new Error('strip lookup failed: ' + r.status);
  const rows = await r.json();
  return rows[0] || null;
}

async function sbPatchStrip(id, data) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/efs_flight_strips?id=eq.' + encodeURIComponent(id), {
    method: 'PATCH', headers: HEADERS, body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error('strip update failed: ' + r.status);
  const rows = await r.json();
  return rows[0] || null;
}

async function sbLog(entry) {
  try {
    await fetch(SUPABASE_URL + '/rest/v1/efs_strip_logs', {
      method: 'POST',
      headers: { ...RO_HEADERS, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(entry)
    });
  } catch (e) { console.warn('[EFS API] log failed', e.message); }
}

export async function broadcast(event, payload) {
  try {
    await fetch(SUPABASE_URL + '/realtime/v1/api/broadcast', {
      method: 'POST',
      headers: { ...RO_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: 'efs', event, payload }] })
    });
  } catch (e) { console.warn('[EFS API] broadcast failed', e.message); }
}

const camel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
export function toStripMessage(row) {
  const keys = ['id', 'callsign', 'operation_type', 'status', 'aircraft_type', 'wake_category', 'beacon_code',
    'departure_airport', 'arrival_airport', 'route', 'altitude', 'assigned_altitude', 'assigned_speed',
    'assigned_heading', 'runway', 'gate', 'assigned_sid_star', 'eobt', 'eta', 'bay_type', 'bay_sequence',
    'flight_rules', 'clearance_delivery', 'clearance_ground', 'clearance_tower', 'remarks', 'is_urgent',
    'is_highlighted', 'updated_at'];
  const out = {};
  for (const k of keys) out[camel(k)] = row?.[k] ?? null;
  if (!out.beaconCode && row?.ssr_code) out.beaconCode = row.ssr_code;
  if (!out.departureAirport && row?.dep_airport) out.departureAirport = row.dep_airport;
  if (!out.arrivalAirport && row?.arr_airport) out.arrivalAirport = row.arr_airport;
  return out;
}

function bodyOf(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body;
}

async function checkRunwayOccupancy(row, originId) {
  const rwy = row.runway || row.assigned_runway;
  if (!rwy || !RWY_OCCUPY.includes(row.status)) return null;
  const q = SUPABASE_URL + '/rest/v1/efs_flight_strips?select=id,callsign,status,updated_at&runway=eq.' +
    encodeURIComponent(rwy) + '&status=in.(' + RWY_OCCUPY.join(',') + ')&id=neq.' + encodeURIComponent(row.id) +
    '&updated_at=gt.' + encodeURIComponent(new Date(Date.now() - 180000).toISOString());
  const r = await fetch(q, { headers: RO_HEADERS });
  if (!r.ok) return null;
  const others = await r.json();
  if (!others.length) return null;
  const first = others.sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at))[0];
  const now = new Date();
  const alert = {
    type: 'RWY_OCCUPANCY_ALERT',
    alertId: 'ALT-' + now.toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(now.getTime()).slice(-4),
    state: 'RAISED',
    severity: 'WARNING',
    runway: rwy,
    stripIds: [first.id, row.id],
    callsigns: [first.callsign, row.callsign],
    occupiedSec: Math.max(0, Math.round((now - Date.parse(first.updated_at)) / 1000)),
    message: 'RWY ' + rwy + ' 점유 중 ' + row.status + ' 지시 (' + first.callsign + ')',
    raisedAt: now.toISOString(),
    originId: originId || null
  };
  await broadcast('RWY_OCCUPANCY_ALERT', alert);
  return alert;
}

async function handleStatus(req, res, id) {
  const b = bodyOf(req);
  if (!id) return res.status(400).json({ error: 'Missing strip id' });
  if (!EFS_PHASES.includes(b.toStatus)) return res.status(400).json({ error: 'Invalid toStatus', allowed: EFS_PHASES });
  const cur = await sbGetStrip(id);
  if (!cur) return res.status(404).json({ error: 'Strip not found', id });
  if (b.fromStatus && cur.status && b.fromStatus !== cur.status) {
    return res.status(409).json({ error: 'fromStatus mismatch', id, status: cur.status, updatedAt: cur.updated_at });
  }
  const operatedAt = b.operatedAt || new Date().toISOString();
  const row = await sbPatchStrip(id, { status: b.toStatus, updated_at: new Date().toISOString() });
  await sbLog({ strip_id: id, callsign: cur.callsign, action_type: 'STATUS_CHANGE', from_bay: cur.bay_type, to_bay: cur.bay_type,
    from_status: cur.status, to_status: b.toStatus, details: b.details || '', operated_at: operatedAt,
    metadata: { operatorId: b.operatorId || null, interfaceId: 'I-EFS-INT-0020' } });
  const sentAt = new Date().toISOString();
  await broadcast('STRIP_UPDATED', { type: 'STRIP_UPDATED', action: 'UPDATED', sentAt, strip: toStripMessage(row), originId: b.originId || null });
  const alert = await checkRunwayOccupancy(row || { ...cur, status: b.toStatus }, b.originId);
  return res.status(200).json({ id, status: row?.status || b.toStatus, updatedAt: row?.updated_at || sentAt, alert });
}

async function handleBay(req, res, id) {
  const b = bodyOf(req);
  if (!id) return res.status(400).json({ error: 'Missing strip id' });
  if (!EFS_BAYS.includes(b.toBay)) return res.status(409).json({ error: 'Bay assignment not allowed', allowed: EFS_BAYS });
  const seq = Number.isInteger(b.baySequence) && b.baySequence >= 0 ? b.baySequence : 0;
  const cur = await sbGetStrip(id);
  if (!cur) return res.status(404).json({ error: 'Strip not found', id });
  if (b.fromBay && cur.bay_type && b.fromBay !== cur.bay_type) {
    return res.status(409).json({ error: 'fromBay mismatch', id, bayType: cur.bay_type });
  }
  const row = await sbPatchStrip(id, { bay_type: b.toBay, bay_sequence: seq, updated_at: new Date().toISOString() });
  await sbLog({ strip_id: id, callsign: cur.callsign, action_type: 'BAY_CHANGE', from_bay: cur.bay_type, to_bay: b.toBay,
    from_status: cur.status, to_status: cur.status, details: b.details || ('bay_sequence=' + seq),
    operated_at: b.operatedAt || new Date().toISOString(), metadata: { operatorId: b.operatorId || null, interfaceId: 'I-EFS-INT-0030' } });
  await broadcast('STRIP_UPDATED', { type: 'STRIP_UPDATED', action: 'UPDATED', sentAt: new Date().toISOString(), strip: toStripMessage(row), originId: b.originId || null });
  return res.status(200).json({ id, bayType: row?.bay_type || b.toBay, baySequence: row?.bay_sequence ?? seq });
}

async function handleRunwayConfig(req, res, airport) {
  if (req.method === 'GET') {
    const r = await fetch(SUPABASE_URL + '/rest/v1/efs_strip_logs?select=metadata,operated_at&action_type=eq.ASSIGN_RWY&strip_id=eq.' +
      encodeURIComponent('RWY-CONFIG-' + airport) + '&order=operated_at.desc&limit=1', { headers: RO_HEADERS });
    const rows = r.ok ? await r.json() : [];
    const m = rows[0]?.metadata || {};
    return res.status(200).json({ airport, activeRunways: m.activeRunways || [], mode: m.mode || 'AUTO', appliedAt: rows[0]?.operated_at || null });
  }
  const b = bodyOf(req);
  const ap = String(b.airport || airport).toUpperCase();
  const rwys = Array.isArray(b.activeRunways) ? b.activeRunways.map(x => String(x).toUpperCase()) : [];
  const mode = b.mode === 'AUTO' ? 'AUTO' : 'MANUAL';
  if (!/^[A-Z]{4}$/.test(ap) || (mode === 'MANUAL' && (!rwys.length || !rwys.every(x => RWY_RE.test(x))))) {
    return res.status(400).json({ result: 'ERROR', error: 'Invalid airport or runway designator' });
  }
  const appliedAt = new Date().toISOString();
  await sbLog({ strip_id: 'RWY-CONFIG-' + ap, callsign: '-', action_type: 'ASSIGN_RWY', from_bay: null, to_bay: null,
    from_status: null, to_status: mode, details: 'active runways: ' + rwys.join(',') , operated_at: b.appliedAt || appliedAt,
    metadata: { airport: ap, activeRunways: rwys, mode, operatorId: b.operatorId || null, interfaceId: 'I-EFS-INT-0060' } });
  return res.status(200).json({ result: 'OK', appliedAt });
}

async function timed(fn) {
  const t0 = Date.now();
  try { const v = await fn(); return { ok: true, ms: Date.now() - t0, v }; } catch (e) { return { ok: false, ms: Date.now() - t0, err: e.message }; }
}

async function handleHeartbeat(req, res) {
  const sentAt = new Date();
  const db = await timed(async () => {
    const r = await fetch(SUPABASE_URL + '/rest/v1/efs_flight_strips?select=updated_at&order=updated_at.desc&limit=1', { headers: RO_HEADERS });
    if (!r.ok) throw new Error('db ' + r.status);
    const d = r.headers.get('date');
    return { last: (await r.json())[0]?.updated_at || null, date: d };
  });
  const amhs = await timed(async () => {
    const r = await fetch(SUPABASE_URL + '/rest/v1/efs_amhs_messages?select=created_at&order=created_at.desc&limit=1', { headers: RO_HEADERS });
    if (!r.ok) throw new Error('amhs ' + r.status);
    return (await r.json())[0]?.created_at || null;
  });
  const host = req.headers?.host;
  const fids = await timed(async () => {
    if (!host) throw new Error('no host');
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch('https://' + host + '/api/crawler?status=true', { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error('fids ' + r.status);
    return new Date().toISOString();
  });
  const st = (x, staleMin) => !x.ok ? 'DOWN' : (staleMin && x.v && (Date.now() - Date.parse(x.v)) > staleMin * 60000 ? 'DEGRADED' : 'UP');
  let ntpOffsetMs = null;
  if (db.ok && db.v.date) ntpOffsetMs = Date.parse(db.v.date) + Math.round(db.ms / 2) - Date.now();
  const msg = {
    type: 'LINK_HEARTBEAT',
    sentAt: sentAt.toISOString(),
    links: [
      { name: 'AMHS', interfaceIds: 'I-EFS-EXT-0010 ~ 0070', state: st(amhs, 24 * 60), lastReceivedAt: amhs.ok ? amhs.v : null, latencyMs: amhs.ms },
      { name: 'FIDS', interfaceIds: 'I-EFS-EXT-0080', state: st(fids), lastReceivedAt: fids.ok ? fids.v : null, latencyMs: fids.ms },
      { name: 'DB', interfaceIds: 'I-EFS-INT-0070 · 0080', state: db.ok ? 'UP' : 'DOWN', lastReceivedAt: db.ok ? new Date().toISOString() : null, latencyMs: db.ms }
    ],
    ntpOffsetMs
  };
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(msg);
}

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;
  if (await checkRateLimit(req, res)) return;

  const { method } = req;
  const url = new URL(req.url, 'http://' + (req.headers?.host || 'localhost'));
  const action = url.searchParams.get('action') || req.query?.action || '';
  const airport = (url.searchParams.get('airport') || req.query?.airport || 'RKSI').toUpperCase();

  const route = url.searchParams.get('route') || req.query?.route || '';
  const routeId = url.searchParams.get('id') || req.query?.id || '';

  try {
    if (route === 'status' && (method === 'PATCH' || method === 'POST')) return await handleStatus(req, res, routeId);
    if (route === 'bay' && (method === 'PATCH' || method === 'POST')) return await handleBay(req, res, routeId);
    if (route === 'runway-config') return await handleRunwayConfig(req, res, airport);
    if (route === 'heartbeat') return await handleHeartbeat(req, res);

    if (action === 'samples' || action === 'sample-data') {
      return res.status(200).json({
        success: true,
        count: AMHS_SAMPLE_DATA.length,
        data: AMHS_SAMPLE_DATA
      });
    }

    if (action === 'ingest' || (method === 'POST' && req.body?.rawMessage)) {
      const body = req.body || {};
      const rawContent = body.rawMessage || body.content || '';
      const parsed = parseAmhsContent(rawContent);

      const stripId = parsed.msgType + '-' + (parsed.callsign || 'FLT') + '-' + Date.now().toString().slice(-4);
      const now = new Date().toISOString();

      const newStrip = {
        id: stripId,
        callsign: parsed.callsign || 'UNKNOWN',
        operation_type: parsed.msgType === 'ARR' ? 'ARRIVAL' : 'DEPARTURE',
        status: parsed.status,
        aircraft_type: parsed.aircraftType,
        wake_category: parsed.wakeCategory,
        beacon_code: parsed.ssrCode,
        ssr_code: parsed.ssrCode,
        departure_airport: parsed.depAirport || airport,
        arrival_airport: parsed.arrAirport || 'RKPC',
        dep_airport: parsed.depAirport || airport,
        arr_airport: parsed.arrAirport || 'RKPC',
        route: parsed.route,
        altitude: parsed.altitude,
        assigned_altitude: parsed.altitude,
        assigned_speed: parsed.speed,
        assigned_runway: parsed.msgType === 'ARR' ? '33R' : '33L',
        assigned_gate: '101',
        eobt: parsed.time || '1200',
        bay_type: parsed.bayType,
        bay_sequence: 0,
        flight_rules: parsed.flightRules,
        remarks: parsed.remarks,
        is_urgent: parsed.isUrgent,
        is_highlighted: true,
        raw_message: rawContent.slice(0, 4000),
        metadata: {
          msgType: parsed.msgType,
          parsedAt: now,
          protocol: body.protocol || 'AMHS/XML'
        },
        created_at: now,
        updated_at: now
      };

      await fetch(SUPABASE_URL + '/rest/v1/efs_flight_strips', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(newStrip)
      });

      const amhsLog = {
        message_type: parsed.msgType,
        msg_type: parsed.msgType,
        callsign: parsed.callsign,
        filing_time: now,
        originator: 'RKSIAFTN',
        recipient: parsed.arrAirport ? (parsed.arrAirport + 'AMHS') : 'RKSIAMHS',
        raw_content: rawContent.slice(0, 4000),
        raw_telegram: parsed.route || '',
        parsed_payload: parsed,
        parsed_data: parsed,
        status: parsed.status === 'ERROR' ? 'FAILED' : 'PROCESSED',
        created_at: now
      };

      await fetch(SUPABASE_URL + '/rest/v1/efs_amhs_messages', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(amhsLog)
      });

      return res.status(200).json({
        success: true,
        message: 'AMHS ' + parsed.msgType + ' message successfully ingested',
        strip: newStrip,
        parsed: parsed
      });
    }

    if (action === 'reset-demo' || (method === 'POST' && action === 'reset')) {
      await fetch(SUPABASE_URL + '/rest/v1/efs_flight_strips?id=neq.NULL_VAL', {
        method: 'DELETE',
        headers: HEADERS
      });

      const now = new Date().toISOString();
      const demoStrips = [
        {
          id: 'FPL-AMU821-RKSI',
          callsign: 'AMU821',
          operation_type: 'DEPARTURE',
          status: 'TAXIOUT',
          aircraft_type: 'A321',
          wake_category: 'M',
          beacon_code: '78041B',
          ssr_code: '78041B',
          departure_airport: 'RKSI',
          arrival_airport: 'VMMC',
          dep_airport: 'RKSI',
          arr_airport: 'VMMC',
          flight_rules: 'IFR',
          flight_type: 'S',
          eobt: '0515',
          altitude: 'F320',
          assigned_altitude: 'FL320',
          assigned_speed: 'N0465',
          assigned_heading: '330',
          runway: '33L',
          assigned_runway: '33L',
          gate: '224',
          assigned_gate: '224',
          assigned_sid_star: 'BOPTA2',
          route: 'DCT BOPTA Z51 BEDES Y711 MUGUS Y742 SALMI Q11 DRAKE A1 ELATO J101 SMT',
          bay_type: 'DEPARTURE',
          bay_sequence: 0,
          clearance_delivery: true,
          clearance_ground: true,
          clearance_tower: false,
          clearance_departure: false,
          is_urgent: false,
          is_highlighted: false,
          remarks: 'REG/BMBA DOF/260716',
          created_at: now,
          updated_at: now
        },
        {
          id: 'CHG-CES5072-RKSI',
          callsign: 'CES5072',
          operation_type: 'DEPARTURE',
          status: 'PUSHBACK',
          aircraft_type: 'A320',
          wake_category: 'M',
          beacon_code: '7104',
          ssr_code: '7104',
          departure_airport: 'RKSI',
          arrival_airport: 'ZSHC',
          dep_airport: 'RKSI',
          arr_airport: 'ZSHC',
          flight_rules: 'IFR',
          flight_type: 'S',
          eobt: '0255',
          altitude: 'FL280',
          assigned_altitude: 'FL280',
          assigned_speed: 'N0440',
          assigned_heading: '240',
          runway: '34R',
          assigned_runway: '34R',
          gate: '118',
          assigned_gate: '118',
          assigned_sid_star: 'EGOBA1A',
          route: 'EGOBA Y711 AGAVO Y722 NIRAT',
          bay_type: 'DEPARTURE',
          bay_sequence: 1,
          clearance_delivery: true,
          clearance_ground: true,
          clearance_tower: false,
          clearance_departure: false,
          is_urgent: false,
          is_highlighted: true,
          remarks: 'CHG TO EOBT 0255 ZSHC0141',
          created_at: now,
          updated_at: now
        },
        {
          id: 'DEP-KAL2086-RCTP',
          callsign: 'KAL2086',
          operation_type: 'DEPARTURE',
          status: 'LINEUP',
          aircraft_type: 'A333',
          wake_category: 'H',
          beacon_code: 'A2622',
          ssr_code: 'A2622',
          departure_airport: 'RCTP',
          arrival_airport: 'RKPK',
          dep_airport: 'RCTP',
          arr_airport: 'RKPK',
          flight_rules: 'IFR',
          flight_type: 'S',
          eobt: '0433',
          altitude: 'FL310',
          assigned_altitude: 'FL310',
          assigned_speed: 'N0470',
          assigned_heading: '125',
          runway: '15R',
          assigned_runway: '15R',
          gate: '253',
          assigned_gate: '253',
          assigned_sid_star: 'MALPA1',
          route: 'MALPA Y782 LANAT G597 KAE',
          bay_type: 'DEPARTURE',
          bay_sequence: 2,
          clearance_delivery: true,
          clearance_ground: true,
          clearance_tower: true,
          clearance_departure: false,
          is_urgent: false,
          is_highlighted: false,
          remarks: 'DEP ATD/0433 DOF/260806',
          created_at: now,
          updated_at: now
        },
        {
          id: 'ARR-CES5072-RKSI',
          callsign: 'CES5072',
          operation_type: 'ARRIVAL',
          status: 'FINAL',
          aircraft_type: 'A320',
          wake_category: 'M',
          beacon_code: '5512',
          ssr_code: '5512',
          departure_airport: 'RKSI',
          arrival_airport: 'ZSHC',
          dep_airport: 'RKSI',
          arr_airport: 'ZSHC',
          flight_rules: 'IFR',
          flight_type: 'S',
          eobt: '0255',
          altitude: '3000FT',
          assigned_altitude: '3000FT',
          assigned_speed: '160KT',
          assigned_heading: '330',
          runway: '33R',
          assigned_runway: '33R',
          gate: '112',
          assigned_gate: '112',
          assigned_sid_star: 'GOMKA1',
          route: 'NIRAT Y722 AGAVO Y711 GOMKA',
          bay_type: 'ARRIVAL',
          bay_sequence: 0,
          clearance_delivery: true,
          clearance_ground: false,
          clearance_tower: true,
          clearance_departure: false,
          is_urgent: false,
          is_highlighted: false,
          remarks: 'ARR ATA/0450 RNAV ILS Z 33R',
          created_at: now,
          updated_at: now
        },
        {
          id: 'DLA-AAR8948-RKPC',
          callsign: 'AAR8948',
          operation_type: 'DEPARTURE',
          status: 'CLEARANCE',
          aircraft_type: 'A321',
          wake_category: 'M',
          beacon_code: '3341',
          ssr_code: '3341',
          departure_airport: 'RKPC',
          arrival_airport: 'RKSS',
          dep_airport: 'RKPC',
          arr_airport: 'RKSS',
          flight_rules: 'IFR',
          flight_type: 'S',
          eobt: '0540',
          altitude: 'FL220',
          assigned_altitude: 'FL220',
          assigned_speed: 'N0420',
          assigned_heading: '190',
          runway: '34L',
          assigned_runway: '34L',
          gate: '42',
          assigned_gate: '42',
          assigned_sid_star: 'BOPTA1',
          route: 'BOPTA Y782 BIGRO DOTOP',
          bay_type: 'CIRCUIT',
          bay_sequence: 0,
          clearance_delivery: false,
          clearance_ground: false,
          clearance_tower: false,
          clearance_departure: false,
          is_urgent: true,
          is_highlighted: true,
          remarks: 'DLA NEW EOBT/0540 DOF/260806',
          created_at: now,
          updated_at: now
        },
        {
          id: 'TRANS-CSN327-RKSI',
          callsign: 'CSN327',
          operation_type: 'TRANSIT',
          status: 'ENROUTE',
          aircraft_type: 'B77W',
          wake_category: 'H',
          beacon_code: '6122',
          ssr_code: '6122',
          departure_airport: 'ZBAA',
          arrival_airport: 'KLAX',
          dep_airport: 'ZBAA',
          arr_airport: 'KLAX',
          flight_rules: 'IFR',
          flight_type: 'S',
          eobt: '0900',
          altitude: 'FL370',
          assigned_altitude: 'FL370',
          assigned_speed: 'M084',
          assigned_heading: '095',
          runway: '',
          assigned_runway: '',
          gate: '',
          assigned_gate: '',
          assigned_sid_star: 'GOMKA',
          route: 'AGAVO Y711 GOMKA B467 KAE ALADI',
          bay_type: 'TRANSIT',
          bay_sequence: 0,
          clearance_delivery: false,
          clearance_ground: false,
          clearance_tower: false,
          clearance_departure: true,
          is_urgent: false,
          is_highlighted: false,
          remarks: 'OVERFLIGHT INCHEON FIR EST KAE 1058',
          created_at: now,
          updated_at: now
        }
      ];

      await fetch(SUPABASE_URL + '/rest/v1/efs_flight_strips', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(demoStrips)
      });

      return res.status(200).json({
        success: true,
        message: 'EFS demo strips re-initialized',
        count: demoStrips.length,
        data: demoStrips
      });
    }

    if (method === 'PATCH' || (method === 'POST' && req.body?.id && (req.body.bay_type || req.body.status || req.body.clearance !== undefined))) {
      const body = req.body;
      const stripId = body.id || url.searchParams.get('id');
      if (!stripId) {
        return res.status(400).json({ error: 'Missing strip id' });
      }

      const updateData = {
        ...body,
        updated_at: new Date().toISOString()
      };

      const patchRes = await fetch(SUPABASE_URL + '/rest/v1/efs_flight_strips?id=eq.' + encodeURIComponent(stripId), {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify(updateData)
      });

      const updated = await patchRes.json();
      return res.status(200).json({
        success: true,
        data: updated
      });
    }

    const stripsRes = await fetch(SUPABASE_URL + '/rest/v1/efs_flight_strips?order=bay_sequence.asc,updated_at.desc&limit=100', {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      }
    });

    let strips = [];
    if (stripsRes.ok) {
      strips = await stripsRes.json();
    }

    return res.status(200).json({
      success: true,
      airport: airport,
      timestamp: new Date().toISOString(),
      total: strips.length,
      strips: strips
    });
  } catch (err) {
    console.error('[EFS API] Error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message
    });
  }
}
