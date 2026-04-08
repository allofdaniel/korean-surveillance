const https = require('https');
const N8N_HOST = 'allofdaniel.app.n8n.cloud';
const EMAIL = 'allofdaniel1@gmail.com';
const PASS = 'Pr12pr34!@';
const SUPABASE_HOST = 'mysfgjaggqknuhobwtrc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15c2ZnamFnZ3FrbnVob2J3dHJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg5NjAxNSwiZXhwIjoyMDg1NDcyMDE1fQ.ke-cuuQlx6kphA7gyA3crren2ARVZHWdji-5OlKiKCM';

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
  // 1. Login to n8n
  const lb = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS });
  const lr = await req({ hostname: N8N_HOST, path: '/rest/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lb) } }, lb);
  if (lr.status !== 200) { console.log('Login failed:', lr.status); return; }
  const ck = lr.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');

  // 2. Get latest executions
  console.log('=== Latest n8n Executions ===');
  const er = await req({ hostname: N8N_HOST, path: '/rest/executions?workflowId=uO4ta8EfEDbIslVY&limit=5', method: 'GET', headers: { Cookie: ck } });
  const erBody = JSON.parse(er.body);
  const execs = erBody.data || erBody.results || erBody;
  console.log('Response keys:', Object.keys(erBody));
  if (!Array.isArray(execs)) { console.log('Raw response:', JSON.stringify(erBody).substring(0, 500)); }
  (Array.isArray(execs) ? execs : []).forEach((e, i) => {
    const started = new Date(e.startedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const finished = e.stoppedAt ? new Date(e.stoppedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : 'running';
    console.log(`  ${i}: ${e.status} | ${started} -> ${finished} | mode: ${e.mode}`);
  });

  // 3. Get the latest execution detail
  if (execs.length > 0) {
    const latestId = execs[0].id;
    console.log('\n=== Latest Execution Detail (ID: ' + latestId + ') ===');
    const dr = await req({ hostname: N8N_HOST, path: '/rest/executions/' + latestId, method: 'GET', headers: { Cookie: ck } });
    const detail = JSON.parse(dr.body).data;

    if (detail.data && detail.data.resultData) {
      const runData = detail.data.resultData.runData;
      for (const [nodeName, nodeRuns] of Object.entries(runData)) {
        const lastRun = nodeRuns[nodeRuns.length - 1];
        const status = lastRun.executionStatus || (lastRun.error ? 'error' : 'success');
        const outputItems = lastRun.data?.main?.[0]?.length || 0;
        const errorMsg = lastRun.error ? ` | ERROR: ${lastRun.error.message?.substring(0, 100)}` : '';
        console.log(`  ${nodeName}: ${status} | ${outputItems} items${errorMsg}`);

        // Show crawl node output details
        if (nodeName === '3. NOTAM 크롤링' && lastRun.data?.main?.[0]?.[0]) {
          const output = lastRun.data.main[0][0].json;
          console.log('    source:', output.source);
          console.log('    timestamp:', output.timestamp);
          console.log('    recordCounts:', JSON.stringify(output.recordCounts));
          console.log('    hasChanges:', output.hasChanges);
          console.log('    changeCount:', output.changeCount);
        }
      }
    }

    // Check for errors
    if (detail.data?.resultData?.error) {
      console.log('\nEXECUTION ERROR:', JSON.stringify(detail.data.resultData.error).substring(0, 500));
    }
  }

  // 4. Check Supabase for latest data
  console.log('\n=== Supabase Latest Data ===');
  const sr = await req({
    hostname: SUPABASE_HOST,
    path: '/storage/v1/object/notam_realtime/notam_latest.json',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + SUPABASE_KEY, 'apikey': SUPABASE_KEY }
  });
  if (sr.status === 200) {
    const data = JSON.parse(sr.body);
    console.log('  source:', data.source);
    console.log('  timestamp:', data.timestamp);
    console.log('  domestic count:', data.domestic?.length || 'N/A');
    console.log('  international count:', data.international?.length || 'N/A');
    console.log('  snowtam count:', data.snowtam?.length || 'N/A');

    // Check data format
    if (data.domestic && data.domestic.length > 0) {
      console.log('  domestic sample:', JSON.stringify(data.domestic[0]).substring(0, 200));
    }
    if (data.international && data.international.length > 0) {
      console.log('  international sample:', JSON.stringify(data.international[0]).substring(0, 200));
    }

    // Check if it's the old UBIKAIS format or new AIM Korea format
    if (data.fir_notam) {
      console.log('  WARNING: Still using old UBIKAIS format (fir_notam key exists)');
    }
    if (data.ad_notam) {
      console.log('  WARNING: Still using old UBIKAIS format (ad_notam key exists)');
    }
  } else {
    console.log('  Supabase fetch status:', sr.status);
    console.log('  Body:', sr.body.substring(0, 200));
  }
})();
