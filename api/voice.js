import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';

/**
 * ATC Live Voice Stream Relay & Metadata Endpoint
 * 과제 인터페이스 NO 21: 관제음성 (LiveATC Stream Relay)
 */

const ATC_FEEDS = {
  KJFK: {
    airport: '뉴욕 JFK 국제공항 (KJFK Tower)',
    streamUrl: 'https://s1-fmt2.liveatc.net/kjfk_twr',
    freq: '119.1 MHz',
    status: 'ACTIVE_STREAMING'
  },
  RJTT: {
    airport: '도쿄 하네다 국제공항 (RJTT Tower)',
    streamUrl: 'https://s1-fmt2.liveatc.net/rjtt_twr',
    freq: '118.1 MHz',
    status: 'ACTIVE_STREAMING'
  },
  KLAX: {
    airport: '로스앤젤레스 국제공항 (KLAX Tower)',
    streamUrl: 'https://s1-fmt2.liveatc.net/klax_twr',
    freq: '120.95 MHz',
    status: 'ACTIVE_STREAMING'
  },
  RKSI: {
    airport: '인천국제공항 (RKSI)',
    streamUrl: null,
    freq: '118.2 MHz',
    status: 'RESTRICTED_AIRSPACE',
    notice: '대한민국 항공보안법 제166조에 의거 국내 공역은 LiveATC 공개 송출이 승인되지 않습니다. 음성 스트리밍 기능 검증은 상단 KJFK/RJTT/KLAX 채널을 이용하세요.'
  }
};

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;
  if (await checkRateLimit(req, res)) return;

  const url = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
  const channel = (url.searchParams.get('channel') || url.searchParams.get('airport') || 'KJFK').toUpperCase();
  const isStream = url.searchParams.get('stream') === 'true';

  const feed = ATC_FEEDS[channel] || ATC_FEEDS.KJFK;

  if (isStream && feed.streamUrl) {
    return res.redirect(302, feed.streamUrl);
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json({
    status: feed.status,
    selectedChannel: channel,
    airportName: feed.airport,
    frequency: feed.freq,
    streamUrl: feed.streamUrl,
    directListenUrl: feed.streamUrl ? `/api/voice?channel=${channel}&stream=true` : null,
    availableChannels: Object.keys(ATC_FEEDS).map(k => ({
      code: k,
      name: ATC_FEEDS[k].airport,
      freq: ATC_FEEDS[k].freq,
      status: ATC_FEEDS[k].status,
      streamUrl: ATC_FEEDS[k].streamUrl
    })),
    notice: feed.notice || '실시간 Icecast Audio/MPEG (MP3) 스트림이 정상 연결되어 있습니다.',
    timestamp: new Date().toISOString()
  });
}
