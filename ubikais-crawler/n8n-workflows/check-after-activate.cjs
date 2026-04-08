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
  console.log('Checking at:', new Date().toISOString());

  // Check latest execution
  const lb = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS });
  const lr = await req({ hostname: N8N_HOST, path: '/rest/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lb) } }, lb);
  const ck = lr.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');

  const er = await req({ hostname: N8N_HOST, path: '/rest/executions?workflowId=uO4ta8EfEDbIslVY&limit=3', method: 'GET', headers: { Cookie: ck } });
  const execs = JSON.parse(er.body);
  const execList = execs.data?.results || execs.data || [];
  const execArr = Array.isArray(execList) ? execList : [];

  console.log('\n=== Latest Executions ===');
  execArr.forEach(e => {
    console.log('  #' + e.id, '| status:', e.status, '| started:', e.startedAt, '| finished:', e.stoppedAt);
  });

  // Check latest timestamped file
  console.log('\n=== Check Latest Data Files ===');
  const todayFolder = '2026-01-29';
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
  files.filter(f => f.id).forEach(f => console.log('  ', f.name, '| size:', f.metadata?.size, '| created:', f.created_at));

  // Download latest timestamped file (not notam_latest.json)
  const latestTimestamped = files.filter(f => f.id && f.name.startsWith('notam_') && f.name !== 'notam_latest.json')[0];
  if (latestTimestamped) {
    console.log('\nChecking file:', latestTimestamped.name);
    const path = 'notam_realtime/' + todayFolder + '/' + latestTimestamped.name;
    const dlr = await req({
      hostname: SUPABASE_HOST,
      path: '/storage/v1/object/notam-data/' + path.split('/').map(encodeURIComponent).join('/'),
      method: 'GET',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });

    if (dlr.status === 200) {
      console.log('File size:', dlr.body.length);
      const hasChangesStr = dlr.body.indexOf('"changes"') >= 0;
      console.log('Raw has "changes":', hasChangesStr);

      const data = JSON.parse(dlr.body);
      console.log('crawled_at:', data.crawled_at);
      console.log('Top keys:', Object.keys(data));
      console.log('Has changes field:', data.changes !== undefined);

      if (data.changes) {
        console.log('\n=== CHANGES DETECTED ===');
        console.log('previous_crawled_at:', data.changes.previous_crawled_at);
        console.log('summary:', JSON.stringify(data.changes.summary));
        if (data.changes.note) console.log('note:', data.changes.note);
        if (data.changes.added?.length > 0) {
          console.log('\nAdded NOTAMs:');
          data.changes.added.forEach(a => console.log('  +', a.id, '|', a.section, '|', (a.series || '') + (a.seqNo || '')));
        }
        if (data.changes.removed?.length > 0) {
          console.log('\nRemoved NOTAMs:');
          data.changes.removed.forEach(r => console.log('  -', r.id, '|', r.section, '|', (r.series || '') + (r.seqNo || '')));
        }
        if (data.changes.modified?.length > 0) {
          console.log('\nModified NOTAMs:');
          data.changes.modified.forEach(m => console.log('  ~', m.id, '|', m.section, '|', (m.series || '') + (m.seqNo || '')));
        }
      } else if (data.changes === null) {
        console.log('changes is null');
      } else {
        console.log('changes is undefined (old code still running)');
      }
    } else {
      console.log('Download failed:', dlr.status);
    }
  }
})();
