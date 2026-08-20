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

  const url = new URL(req.url, `http://${req.headers.host}`);
  const airport = (url.searchParams.get('airport') || 'RKSI').toUpperCase();
  const stream = url.searchParams.get('stream');

  // If stream URL requested directly, proxy audio or redirect
  if (stream) {
    const feed = ATC_FEEDS[airport];
    const channel = feed?.channels.find(c => c.name.toLowerCase().includes(stream.toLowerCase())) || feed?.channels[0];
    if (channel) {
      return res.redirect(302, channel.url);
    }
  }

  const result = ATC_FEEDS[airport] || ATC_FEEDS.RKSI;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json({
    status: 'ACTIVE',
    airport: result.airport,
    channels: result.channels,
    protocol: 'ICECAST_HTTP_STREAM / MP3',
    format: 'AUDIO/MPEG',
    timestamp: new Date().toISOString()
  });
}
