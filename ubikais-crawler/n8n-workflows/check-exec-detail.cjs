const https = require('https');
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
  const lb = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS });
  const lr = await req({ hostname: N8N_HOST, path: '/rest/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lb) } }, lb);
  const ck = lr.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');

  // Get latest executions
  const er = await req({ hostname: N8N_HOST, path: '/rest/executions?limit=3', method: 'GET', headers: { Cookie: ck } });
  const erBody = JSON.parse(er.body);
  const results = erBody.data?.results || erBody.data || [];
  const list = Array.isArray(results) ? results : [];

  console.log('=== Latest Executions ===');
  list.forEach((e, i) => {
    const started = new Date(e.startedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    console.log(i + ': ' + e.status + ' | ' + e.workflowName + ' | ' + started + ' | id:' + e.id);
  });

  // Get detail of the FIRST (latest) execution
  if (list.length === 0) { console.log('No executions'); return; }

  // Skip running executions, get last completed one
  const completed = list.filter(e => e.status !== 'running');
  if (completed.length === 0) { console.log('No completed executions'); return; }
  const latestId = completed[0].id;
  console.log('\n=== Execution Detail (id: ' + latestId + ') ===');
  const dr = await req({ hostname: N8N_HOST, path: '/rest/executions/' + latestId, method: 'GET', headers: { Cookie: ck } });
  const detail = JSON.parse(dr.body).data;

  if (!detail || !detail.data || !detail.data.resultData) {
    console.log('No result data');
    return;
  }

  const runData = detail.data.resultData.runData || {};

  for (const [nodeName, nodeRuns] of Object.entries(runData)) {
    const lastRun = nodeRuns[nodeRuns.length - 1];
    const status = lastRun.executionStatus || (lastRun.error ? 'error' : 'success');
    const outputItems = lastRun.data?.main?.[0]?.length || 0;
    const errorMsg = lastRun.error ? ' | ERROR: ' + (lastRun.error.message || '').substring(0, 200) : '';
    console.log('\n--- ' + nodeName + ': ' + status + ' | ' + outputItems + ' items' + errorMsg);

    // For Node 3 - show the notamData keys
    if (nodeName === '3. NOTAM 크롤링' && lastRun.data?.main?.[0]?.[0]) {
      const output = lastRun.data.main[0][0].json;
      console.log('  Output keys:', Object.keys(output));
      if (output.notamData) {
        console.log('  notamData keys:', Object.keys(output.notamData));
        console.log('  source:', output.notamData.source);
        console.log('  crawled_at:', output.notamData.crawled_at);

        if (output.notamData.domestic) {
          console.log('  domestic keys:', Object.keys(output.notamData.domestic));
          for (const [k, v] of Object.entries(output.notamData.domestic)) {
            console.log('    ' + k + ':', Array.isArray(v) ? v.length + ' items' : typeof v);
          }
        }
        if (output.notamData.international) {
          console.log('  international keys:', Object.keys(output.notamData.international));
          for (const [k, v] of Object.entries(output.notamData.international)) {
            console.log('    ' + k + ':', Array.isArray(v) ? v.length + ' items' : typeof v);
          }
        }
        if (output.notamData.fir_notam) {
          console.log('  WARNING: fir_notam key exists (old format!)');
        }
        if (output.notamData.snowtam) {
          console.log('  snowtam:', Array.isArray(output.notamData.snowtam) ? output.notamData.snowtam.length + ' items' : typeof output.notamData.snowtam);
        }
      }
      console.log('  recordCounts:', JSON.stringify(output.recordCounts));
      console.log('  s3Key:', output.s3Key);
      console.log('  hasChanges:', output.hasChanges);
    }

    // For Node 4 - show what's being uploaded
    if (nodeName === '4. Supabase 업로드 준비' && lastRun.data?.main?.[0]?.[0]) {
      const output = lastRun.data.main[0][0];
      console.log('  json keys:', Object.keys(output.json));
      console.log('  s3Key:', output.json.s3Key);
      console.log('  s3KeyLatest:', output.json.s3KeyLatest);
      console.log('  has binary:', !!output.binary);
      if (output.binary?.data) {
        console.log('  binary fileSize:', output.binary.data.fileSize);
        // Decode first 500 chars of base64 to see the data
        const decoded = Buffer.from(output.binary.data.data.substring(0, 700), 'base64').toString('utf-8');
        console.log('  binary data preview:', decoded.substring(0, 500));
      }
    }

    // For upload nodes - show response
    if (nodeName.includes('Supabase 업로드') && lastRun.data?.main?.[0]?.[0]) {
      const output = lastRun.data.main[0][0].json;
      console.log('  Response:', JSON.stringify(output).substring(0, 300));
    }
  }

  // Check for workflow errors
  if (detail.data.resultData.error) {
    console.log('\nWORKFLOW ERROR:', JSON.stringify(detail.data.resultData.error).substring(0, 500));
  }
})();
