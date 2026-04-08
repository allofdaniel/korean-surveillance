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
  // 1. Login
  const lb = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS });
  const lr = await req({ hostname: N8N_HOST, path: '/rest/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lb) } }, lb);
  const ck = lr.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');

  // 2. Get ALL recent executions
  const er = await req({ hostname: N8N_HOST, path: '/rest/executions?limit=10', method: 'GET', headers: { Cookie: ck } });
  const body = JSON.parse(er.body);
  const results = body.data?.results || body.data || [];

  console.log('=== All Recent Executions ===');
  const list = Array.isArray(results) ? results : [];
  list.forEach((e, i) => {
    const started = new Date(e.startedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const isOurs = e.workflowId === 'uO4ta8EfEDbIslVY';
    console.log((isOurs ? '>>>' : '   ') + ' ' + i + ': ' + e.status + ' | ' + e.workflowName + ' | ' + started + ' | id:' + e.id);
  });

  // 3. Get detail of the latest execution for our workflow
  const ours = list.filter(e => e.workflowId === 'uO4ta8EfEDbIslVY');
  if (ours.length > 0) {
    console.log('\n=== Our Workflow Latest Execution (id: ' + ours[0].id + ') ===');
    const dr = await req({ hostname: N8N_HOST, path: '/rest/executions/' + ours[0].id, method: 'GET', headers: { Cookie: ck } });
    const detail = JSON.parse(dr.body).data;

    if (detail && detail.data && detail.data.resultData) {
      const runData = detail.data.resultData.runData || {};
      for (const [nodeName, nodeRuns] of Object.entries(runData)) {
        const lastRun = nodeRuns[nodeRuns.length - 1];
        const status = lastRun.executionStatus || (lastRun.error ? 'error' : 'success');
        const outputItems = lastRun.data && lastRun.data.main && lastRun.data.main[0] ? lastRun.data.main[0].length : 0;
        const errorMsg = lastRun.error ? ' | ERROR: ' + (lastRun.error.message || '').substring(0, 200) : '';
        console.log('  ' + nodeName + ': ' + status + ' | ' + outputItems + ' items' + errorMsg);

        if (nodeName.includes('ld�') && lastRun.data && lastRun.data.main && lastRun.data.main[0] && lastRun.data.main[0][0]) {
          const output = lastRun.data.main[0][0].json;
          console.log('    source:', output.source);
          console.log('    timestamp:', output.timestamp);
          console.log('    recordCounts:', JSON.stringify(output.recordCounts));
          console.log('    hasChanges:', output.hasChanges);
          console.log('    changeCount:', output.changeCount);
        }
      }
      if (detail.data.resultData.error) {
        console.log('\nWORKFLOW ERROR:', JSON.stringify(detail.data.resultData.error).substring(0, 500));
      }
    }
  } else {
    console.log('\nNo executions for our workflow yet. It may need a few more minutes.');
  }

  // 4. Check latest data from Supabase - with detail
  console.log('\n=== Supabase Latest Data ===');
  const dr2 = await req({
    hostname: SUPABASE_HOST,
    path: '/storage/v1/object/notam-data/notam_realtime/2026-01-31/notam_latest.json',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + SUPABASE_KEY, 'apikey': SUPABASE_KEY }
  });
  if (dr2.status === 200) {
    const data = JSON.parse(dr2.body);
    console.log('crawled_at:', data.crawled_at);
    console.log('source:', data.source);

    // Check domestic/fir_notam
    const dom = data.domestic || data.fir_notam;
    const domKey = data.domestic ? 'domestic' : 'fir_notam';
    if (dom && typeof dom === 'object') {
      console.log('\n' + domKey + ' (series):');
      let domTotal = 0;
      for (const [k, v] of Object.entries(dom)) {
        const cnt = Array.isArray(v) ? v.length : 0;
        domTotal += cnt;
        console.log('  ' + k + ': ' + cnt + ' items');
      }
      console.log('  TOTAL domestic: ' + domTotal);
    }

    // Check international/ad_notam
    const intl = data.international || data.ad_notam;
    const intlKey = data.international ? 'international' : 'ad_notam';
    if (intl && typeof intl === 'object') {
      console.log('\n' + intlKey + ' (airports):');
      let intlTotal = 0;
      for (const [k, v] of Object.entries(intl)) {
        const cnt = Array.isArray(v) ? v.length : 0;
        intlTotal += cnt;
        console.log('  ' + k + ': ' + cnt + ' items');
      }
      console.log('  TOTAL international: ' + intlTotal);
    }

    // Snowtam
    if (data.snowtam) {
      if (Array.isArray(data.snowtam)) {
        console.log('\nsnowtam: ' + data.snowtam.length + ' items');
      } else {
        console.log('\nsnowtam:', Object.keys(data.snowtam));
      }
    }

    // Changes
    if (data.changes) {
      const ch = data.changes;
      console.log('\nchanges:');
      console.log('  detected_at:', ch.detected_at);
      console.log('  summary:', JSON.stringify(ch.summary));
      if (ch.added) console.log('  added:', Array.isArray(ch.added) ? ch.added.length : ch.added);
      if (ch.removed) console.log('  removed:', Array.isArray(ch.removed) ? ch.removed.length : ch.removed);
      if (ch.modified) console.log('  modified:', Array.isArray(ch.modified) ? ch.modified.length : ch.modified);
    }

    // Check a sample NOTAM record
    if (dom) {
      const firstSeries = Object.keys(dom)[0];
      const firstItems = dom[firstSeries];
      if (firstItems && firstItems[0]) {
        console.log('\nSample NOTAM record (' + firstSeries + '[0]):');
        console.log(JSON.stringify(firstItems[0]).substring(0, 400));
      }
    }
  } else {
    console.log('  Status:', dr2.status, dr2.body.substring(0, 200));
  }
})();
