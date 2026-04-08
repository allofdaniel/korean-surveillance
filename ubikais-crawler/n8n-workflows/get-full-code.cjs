const https = require('https');
const fs = require('fs');

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
  // Part 1: Get full workflow code
  console.log('=== Part 1: Full Workflow Code ===\n');
  const lb = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS });
  const lr = await req({ hostname: N8N_HOST, path: '/rest/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lb) } }, lb);
  const ck = lr.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');

  const wr = await req({ hostname: N8N_HOST, path: '/rest/workflows/uO4ta8EfEDbIslVY', method: 'GET', headers: { Cookie: ck } });
  const wf = JSON.parse(wr.body).data;

  // Save full workflow JSON
  fs.writeFileSync('C:/Users/allof/Desktop/251212 GIS/rkpu-viewer/ubikais-crawler/n8n-workflows/realtime-workflow.json', JSON.stringify(wf, null, 2));

  // Print full code of node "3. NOTAM 크롤링"
  const crawlNode = wf.nodes.find(n => n.name === '3. NOTAM 크롤링');
  if (crawlNode) {
    const code = crawlNode.parameters?.jsCode || '';
    console.log('=== FULL CODE: 3. NOTAM 크롤링 ===');
    console.log('Code length:', code.length);
    console.log(code);
  }

  // Part 2: Inspect records structure from actual NOTAM data
  console.log('\n\n=== Part 2: NOTAM Records Structure ===\n');
  const todayFolder = new Date().toISOString().split('T')[0];
  const listBody = JSON.stringify({ prefix: 'notam_realtime/' + todayFolder + '/', limit: 5, sortBy: { column: 'name', order: 'desc' } });
  const listR = await req({
    hostname: SUPABASE_HOST,
    path: '/storage/v1/object/list/notam-data',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(listBody),
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY
    }
  }, listBody);

  const files = JSON.parse(listR.body);
  const dataFile = files.find(f => f.id && f.name.startsWith('notam_') && f.name !== 'notam_latest.json');
  if (dataFile) {
    const path = 'notam_realtime/' + todayFolder + '/' + dataFile.name;
    const dlr = await req({
      hostname: SUPABASE_HOST,
      path: '/storage/v1/object/notam-data/' + path.split('/').map(encodeURIComponent).join('/'),
      method: 'GET',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });

    const data = JSON.parse(dlr.body);

    // Check FIR NOTAM records
    console.log('--- FIR NOTAM records ---');
    for (const series of Object.keys(data.fir_notam || {})) {
      const section = data.fir_notam[series];
      const records = section.records || [];
      console.log(`fir_notam[${series}]: ${records.length} records`);
      if (records.length > 0) {
        console.log('  Record keys:', Object.keys(records[0]));
        console.log('  Sample record:', JSON.stringify(records[0]).substring(0, 500));
        // Check which fields could be a unique ID
        const r0 = records[0];
        console.log('  Potential IDs: notamNo=' + r0.notamNo + ', notamId=' + r0.notamId + ', notamPk=' + r0.notamPk + ', id=' + r0.id + ', seqNo=' + r0.seqNo);
      }
    }

    // Check AD NOTAM records
    console.log('\n--- AD NOTAM records ---');
    for (const airport of Object.keys(data.ad_notam || {}).slice(0, 2)) {
      const section = data.ad_notam[airport];
      const records = section.records || [];
      console.log(`ad_notam[${airport}]: ${records.length} records`);
      if (records.length > 0) {
        console.log('  Record keys:', Object.keys(records[0]));
        console.log('  Sample record:', JSON.stringify(records[0]).substring(0, 500));
        const r0 = records[0];
        console.log('  Potential IDs: notamNo=' + r0.notamNo + ', notamId=' + r0.notamId + ', notamPk=' + r0.notamPk + ', id=' + r0.id + ', seqNo=' + r0.seqNo);
      }
    }

    // Check SNOWTAM records
    console.log('\n--- SNOWTAM records ---');
    const snowRecords = data.snowtam?.records || [];
    console.log('snowtam records:', snowRecords.length);
    if (snowRecords.length > 0) {
      console.log('  Record keys:', Object.keys(snowRecords[0]));
      console.log('  Sample:', JSON.stringify(snowRecords[0]).substring(0, 300));
    }
  }
})();
