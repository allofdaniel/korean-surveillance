const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xwwygmiwjlhnlfultear.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3d3lnbWl3amxobmxmdWx0ZWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTE3MDEsImV4cCI6MjEwMzA4NzcwMX0.2dwsq8yeZNwo9rEapB1IHYS4lvQsHZWPSlOvbDX196A';

const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
  'Prefer': 'return=representation,resolution=merge-duplicates'
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { icao } = req.query;
  const airportIcao = (icao || 'RKJY').toUpperCase();

  if (req.method === 'GET') {
    try {
      const response = await fetch(SUPABASE_URL + '/rest/v1/airport_notices?airport_icao=eq.' + airportIcao + '&select=*', { headers: HEADERS, signal: AbortSignal.timeout(3500) });
      if (response.ok) {
        const rows = await response.json();
        if (rows && rows.length > 0) return res.status(200).json(rows[0]);
      }
      return res.status(200).json({ airport_icao: airportIcao, texts: [], panel_count: 2, widths: [] });
    } catch (e) {
      return res.status(200).json({ airport_icao: airportIcao, texts: [], panel_count: 2, widths: [] });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const payload = {
        airport_icao: airportIcao,
        texts: body.texts || [],
        panel_count: body.panel_count || 2,
        widths: body.widths || [],
        updated_at: new Date().toISOString()
      };
      const response = await fetch(SUPABASE_URL + '/rest/v1/airport_notices?on_conflict=airport_icao', { method: 'POST', headers: HEADERS, body: JSON.stringify(payload) });
      if (response.ok) {
        const saved = await response.json();
        return res.status(200).json({ success: true, data: saved });
      } else {
        const txt = await response.text();
        return res.status(500).json({ success: false, error: txt });
      }
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}