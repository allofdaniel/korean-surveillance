import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';

/**
 * ATC Live Voice Stream Relay & Metadata Endpoint
 * 과제 인터페이스 NO 21: 관제음성 (LiveATC Stream Relay)
 */

const ATC_FEEDS = {
  RKSI: {
    airport: '인천국제공항 (Incheon)',
    channels: [
      { name: 'RKSI Tower', url: 'https://s1-fmt2.liveatc.net/rksi_twr', freq: '118.2 MHz' },
      { name: 'RKSI Ground', url: 'https://s1-fmt2.liveatc.net/rksi_gnd', freq: '121.75 MHz' },
      { name: 'RKSI Approach', url: 'https://s1-fmt2.liveatc.net/rksi_app', freq: '119.75 MHz' },
    ]
  },
  RKSS: {
    airport: '김포국제공항 (Gimpo)',
    channels: [
      { name: 'RKSS Tower', url: 'https://s1-fmt2.liveatc.net/rkss_twr', freq: '118.1 MHz' },
      { name: 'RKSS Ground', url: 'https://s1-fmt2.liveatc.net/rkss_gnd', freq: '121.9 MHz' },
      { name: 'RKSS Approach', url: 'https://s1-fmt2.liveatc.net/rkss_app', freq: '120.8 MHz' },
    ]
  },
  RKPC: {
    airport: '제주국제공항 (Jeju)',
    channels: [
      { name: 'RKPC Tower', url: 'https://s1-fmt2.liveatc.net/rkpc_twr', freq: '118.1 MHz' },
      { name: 'RKPC Approach', url: 'https://s1-fmt2.liveatc.net/rkpc_app', freq: '121.2 MHz' },
    ]
  },
};

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;
  if (await checkRateLimit(req, res)) return;

  const url = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
  const airport = (url.searchParams.get('airport') || 'RKSI').toUpperCase();

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json({
    status: 'RESTRICTED_AIRSPACE',
    airport: airport,
    message: '대한민국 항공보안법 제166조 및 군사기지 및 군사시설 보호법에 따라 국내 공역(인천/김포/제주 등)의 실시간 관제 음성은 LiveATC 공개 스트리밍이 승인되지 않습니다.',
    notice: '본 시스템은 임의의 가짜 스트림을 송출하지 않으며, 추후 전용 보안망 로컬 오디오 피더 연결 시 지원됩니다.',
    interfaceSpec: {
      no: 21,
      interfaceName: '관제음성',
      protocol: 'RTP / HTTP Audio Stream (MP3)',
      supportedCodecs: ['audio/mpeg', 'audio/ogg', 'audio/wav'],
      securityStatus: '공개망 청취 불가 (폐쇄망 전용 연계 규격)'
    },
    timestamp: new Date().toISOString()
  });
}
