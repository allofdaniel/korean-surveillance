const https = require('https');
const SUPABASE_HOST = 'mysfgjaggqknuhobwtrc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15c2ZnamFnZ3FrbnVob2J3dHJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg5NjAxNSwiZXhwIjoyMDg1NDcyMDE1fQ.ke-cuuQlx6kphA7gyA3crren2ARVZHWdji-5OlKiKCM';

function req(opts) {
  return new Promise((resolve, reject) => {
    const r = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.on('error', reject);
    r.end();
  });
}

(async () => {
  const today = new Date().toISOString().split('T')[0];
  console.log('Today:', today);

  // Get latest data
  const dr = await req({
    hostname: SUPABASE_HOST,
    path: '/storage/v1/object/notam-data/notam_realtime/' + today + '/notam_latest.json',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + SUPABASE_KEY, 'apikey': SUPABASE_KEY }
  });

  if (dr.status !== 200) {
    console.log('Status:', dr.status, dr.body.substring(0, 200));
    return;
  }

  const data = JSON.parse(dr.body);

  console.log('=== Top-level keys ===');
  console.log(Object.keys(data));

  console.log('\ncrawled_at:', data.crawled_at);
  console.log('source:', data.source);

  // Check if it has the NEW format (domestic/international) or OLD format (fir_notam/ad_notam)
  if (data.domestic) {
    console.log('\n=== NEW FORMAT (AIM Korea) ===');
    console.log('domestic keys:', Object.keys(data.domestic));
    let domTotal = 0;
    for (const [k, v] of Object.entries(data.domestic)) {
      const cnt = Array.isArray(v) ? v.length : 0;
      domTotal += cnt;
      console.log('  domestic/' + k + ':', cnt, 'items');
    }
    console.log('  TOTAL domestic:', domTotal);

    if (data.international) {
      console.log('\ninternational keys:', Object.keys(data.international));
      let intlTotal = 0;
      for (const [k, v] of Object.entries(data.international)) {
        const cnt = Array.isArray(v) ? v.length : 0;
        intlTotal += cnt;
        console.log('  international/' + k + ':', cnt, 'items');
      }
      console.log('  TOTAL international:', intlTotal);
    }

    if (data.snowtam) {
      console.log('\nsnowtam:', Array.isArray(data.snowtam) ? data.snowtam.length + ' items' : typeof data.snowtam);
    }

    if (data.changes) {
      console.log('\nchanges.summary:', JSON.stringify(data.changes.summary));
    }

    // Show sample data
    const domKeys = Object.keys(data.domestic);
    if (domKeys.length > 0) {
      const first = domKeys[0];
      const items = data.domestic[first];
      if (items && items[0]) {
        console.log('\nSample NOTAM (domestic/' + first + '[0]):');
        console.log(JSON.stringify(items[0]).substring(0, 500));
      }
    }
  }

  if (data.fir_notam) {
    console.log('\n=== OLD FORMAT (UBIKAIS) - PROBLEM! ===');
    console.log('fir_notam keys:', Object.keys(data.fir_notam));
    for (const [k, v] of Object.entries(data.fir_notam)) {
      if (typeof v === 'object' && v !== null) {
        console.log('  fir_notam/' + k + ':', v.records ? v.records.length + ' records' : (Array.isArray(v) ? v.length + ' items' : 'object'));
      }
    }
  }

  if (data.ad_notam) {
    console.log('ad_notam keys:', Object.keys(data.ad_notam));
    for (const [k, v] of Object.entries(data.ad_notam)) {
      if (typeof v === 'object' && v !== null) {
        console.log('  ad_notam/' + k + ':', v.records ? v.records.length + ' records' : (Array.isArray(v) ? v.length + ' items' : 'object'));
      }
    }
  }

  console.log('\nFile size:', dr.body.length, 'bytes');
})();
