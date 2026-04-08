const https = require('https');
const SUPABASE_HOST = 'mysfgjaggqknuhobwtrc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15c2ZnamFnZ3FrbnVob2J3dHJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg5NjAxNSwiZXhwIjoyMDg1NDcyMDE1fQ.ke-cuuQlx6kphA7gyA3crren2ARVZHWdji-5OlKiKCM';
const N8N_HOST = 'allofdaniel.app.n8n.cloud';
const EMAIL = 'allofdaniel1@gmail.com';
const PASS = 'Pr12pr34!@';

function req(opts, body) {
  return new Promise((resolve, reject) => {
    const r = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

(async () => {
  const today = new Date().toISOString().split('T')[0];

  // 1. List all files in today's folder
  console.log('=== Files in notam_realtime/' + today + '/ ===');
  const lr = await req({
    hostname: SUPABASE_HOST,
    path: '/storage/v1/object/list/notam-data',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json'
    }
  }, JSON.stringify({ prefix: 'notam_realtime/' + today + '/', limit: 100, sortBy: { column: 'created_at', order: 'desc' } }));

  const files = JSON.parse(lr.body);
  console.log('Total files:', files.length);
  // Show last 10
  files.slice(0, 10).forEach(f => {
    console.log('  ' + f.name + ' | ' + Math.round(f.metadata?.size / 1024) + 'KB | ' + f.created_at);
  });

  // 2. Download the LATEST timestamped file (not _latest.json)
  const tsFiles = files.filter(f => f.name.match(/notam_\d{8}_\d+\.json$/));
  if (tsFiles.length > 0) {
    const latestTsFile = tsFiles[0];
    console.log('\n=== Checking: ' + latestTsFile.name + ' ===');
    const dr = await req({
      hostname: SUPABASE_HOST,
      path: '/storage/v1/object/notam-data/notam_realtime/' + today + '/' + latestTsFile.name,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + SUPABASE_KEY, 'apikey': SUPABASE_KEY }
    });

    if (dr.status === 200) {
      const data = JSON.parse(dr.body);
      console.log('Keys:', Object.keys(data));
      console.log('crawled_at:', data.crawled_at);
      console.log('source:', data.source);
      console.log('Has domestic:', !!data.domestic);
      console.log('Has international:', !!data.international);
      console.log('Has fir_notam:', !!data.fir_notam);
      console.log('Has ad_notam:', !!data.ad_notam);

      if (data.domestic) {
        let total = 0;
        for (const [k, v] of Object.entries(data.domestic)) {
          const cnt = Array.isArray(v) ? v.length : 0;
          total += cnt;
          console.log('  domestic/' + k + ':', cnt);
        }
        console.log('  TOTAL domestic:', total);
      }
      if (data.international) {
        let total = 0;
        for (const [k, v] of Object.entries(data.international)) {
          const cnt = Array.isArray(v) ? v.length : 0;
          total += cnt;
          console.log('  international/' + k + ':', cnt);
        }
        console.log('  TOTAL international:', total);
      }
    }
  }

  // 3. Check ALL n8n workflows to find the UBIKAIS Daily one
  console.log('\n=== All n8n Workflows ===');
  const lb = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS });
  const loginR = await req({ hostname: N8N_HOST, path: '/rest/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lb) } }, lb);
  const ck = loginR.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');

  const wfr = await req({ hostname: N8N_HOST, path: '/rest/workflows', method: 'GET', headers: { Cookie: ck } });
  const wfBody = JSON.parse(wfr.body);
  const workflows = wfBody.data || [];
  workflows.forEach(w => {
    console.log('  ' + w.id + ' | ' + (w.active ? 'ACTIVE' : 'inactive') + ' | ' + w.name);
  });
})();
