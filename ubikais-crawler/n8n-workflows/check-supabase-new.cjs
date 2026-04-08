const https = require('https');
const SUPABASE_URL = 'mysfgjaggqknuhobwtrc.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15c2ZnamFnZ3FrbnVob2J3dHJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg5NjAxNSwiZXhwIjoyMDg1NDcyMDE1fQ.ke-cuuQlx6kphA7gyA3crren2ARVZHWdji-5OlKiKCM';

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const headers = { 'Authorization': 'Bearer ' + SERVICE_KEY, 'apikey': SERVICE_KEY };
    if (body) headers['Content-Type'] = 'application/json';
    const r = https.request({
      hostname: SUPABASE_URL,
      path: path,
      method: method,
      headers: headers
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

(async () => {
  const now = new Date();
  const utcDate = now.toISOString().split('T')[0];

  // List ALL files for today, sorted by created_at desc
  const listBody = JSON.stringify({
    prefix: 'notam_realtime/' + utcDate + '/',
    limit: 50,
    sortBy: { column: 'created_at', order: 'desc' }
  });
  const r = await req('POST', '/storage/v1/object/list/notam-data', listBody);
  const files = JSON.parse(r.body);

  console.log('=== All files today (sorted by created_at desc) ===');
  console.log('Total:', files.length);
  files.slice(0, 15).forEach(f => {
    console.log('  ', f.name, '| size:', (f.metadata && f.metadata.size) || 'N/A', '| created:', f.created_at || 'N/A', '| updated:', f.updated_at || 'N/A');
  });

  // Download the most recently created file (not notam_latest.json)
  const recentFile = files.find(f => f.name !== 'notam_latest.json' && f.name.startsWith('notam_'));
  if (recentFile) {
    console.log('\n=== Downloading most recent timestamped file:', recentFile.name, '===');
    const filePath = 'notam_realtime/' + utcDate + '/' + recentFile.name;
    const dr = await req('GET', '/storage/v1/object/notam-data/' + filePath);
    if (dr.status === 200) {
      const data = JSON.parse(dr.body);
      console.log('Data keys:', Object.keys(data));
      if (data.domestic !== undefined) {
        console.log('FORMAT: AIM Korea (domestic/international)');
        console.log('domestic keys:', typeof data.domestic === 'object' ? Object.keys(data.domestic) : 'not object');
        console.log('international keys:', typeof data.international === 'object' ? Object.keys(data.international) : 'not object');
        let domesticCount = 0;
        if (typeof data.domestic === 'object') {
          for (const [k, v] of Object.entries(data.domestic)) {
            domesticCount += Array.isArray(v) ? v.length : 0;
          }
        }
        let intlCount = 0;
        if (typeof data.international === 'object') {
          for (const [k, v] of Object.entries(data.international)) {
            intlCount += Array.isArray(v) ? v.length : 0;
          }
        }
        console.log('Total domestic NOTAMs:', domesticCount);
        console.log('Total international NOTAMs:', intlCount);
        console.log('Snowtam count:', Array.isArray(data.snowtam) ? data.snowtam.length : 'not array');
        console.log('Source:', data.source);
        console.log('Timestamp:', data.crawled_at || data.timestamp);
      } else if (data.fir_notam !== undefined) {
        console.log('FORMAT: UBIKAIS (fir_notam/ad_notam) - OLD FORMAT');
        console.log('Timestamp:', data.crawled_at || data.timestamp);
      }
    }
  }

  // Also check notam_latest.json updated time
  console.log('\n=== notam_latest.json ===');
  const latestFile = files.find(f => f.name === 'notam_latest.json');
  if (latestFile) {
    console.log('Updated:', latestFile.updated_at);
    console.log('Created:', latestFile.created_at);
  }
  const latestPath = 'notam_realtime/' + utcDate + '/notam_latest.json';
  const lr = await req('GET', '/storage/v1/object/notam-data/' + latestPath);
  if (lr.status === 200) {
    const data = JSON.parse(lr.body);
    console.log('Keys:', Object.keys(data));
    console.log('Has domestic:', data.domestic !== undefined);
    console.log('Has fir_notam:', data.fir_notam !== undefined);
    console.log('Timestamp:', data.crawled_at || data.timestamp);
  }
})();
