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
  // 1. Check latest n8n executions
  console.log('=== Latest n8n Executions ===');
  const lb = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS });
  const lr = await req({ hostname: N8N_HOST, path: '/rest/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lb) } }, lb);
  if (lr.status !== 200) { console.log('Login failed'); return; }
  const cookies = lr.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');

  // Get executions for Realtime workflow
  const er = await req({ hostname: N8N_HOST, path: '/rest/executions?workflowId=uO4ta8EfEDbIslVY&limit=5', method: 'GET', headers: { Cookie: cookies } });
  const execs = JSON.parse(er.body);
  // Debug: check structure
  console.log('Exec response keys:', Object.keys(execs));
  const execList = execs.data?.results || execs.data || execs.results || [];
  const execArr = Array.isArray(execList) ? execList : [];
  console.log('Realtime workflow executions (last 5):');
  if (execArr.length === 0) {
    console.log('  Raw:', JSON.stringify(execs).substring(0, 500));
  }
  execArr.forEach(e => {
    console.log('  #' + e.id, '| status:', e.status, '| started:', e.startedAt, '| finished:', e.stoppedAt);
  });

  // Check latest execution details
  if (execArr.length > 0) {
    const latest = execArr[0];
    console.log('\n=== Latest Execution #' + latest.id + ' Details ===');
    const dr = await req({ hostname: N8N_HOST, path: '/rest/executions/' + latest.id, method: 'GET', headers: { Cookie: cookies } });
    const detail = JSON.parse(dr.body);
    const d = detail.data;

    if (d.data) {
      // Check for errors
      const resultData = d.data.resultData || d.data;
      if (resultData.error) {
        console.log('ERROR:', JSON.stringify(resultData.error).substring(0, 500));
      }
      if (resultData.lastNodeExecuted) {
        console.log('Last node:', resultData.lastNodeExecuted);
      }

      // Check node run data
      const runData = resultData.runData;
      if (runData) {
        for (const [nodeName, nodeRuns] of Object.entries(runData)) {
          const run = nodeRuns[0];
          const status = run?.executionStatus || run?.error ? 'error' : 'success';
          console.log('  Node:', nodeName, '| status:', status);
          if (run?.error) {
            console.log('    Error:', JSON.stringify(run.error).substring(0, 200));
          }
        }
      }
    }
  }

  // 2. Check Supabase latest files
  console.log('\n=== Supabase Storage - Latest Files ===');
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const todayFolder = new Date().toISOString().split('T')[0];

  const listBody = JSON.stringify({ prefix: 'notam_realtime/' + todayFolder + '/', limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
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

  if (listR.status === 200) {
    const files = JSON.parse(listR.body);
    console.log('Files in notam_realtime/' + todayFolder + '/:', files.length);
    files.forEach(f => {
      if (f.id) {
        console.log('  ' + f.name, '| size:', f.metadata?.size || 'N/A', '| created:', f.created_at);
      }
    });

    // Download the latest file to check content
    if (files.length > 0) {
      // Sort by name desc to get most recent timestamp file
      const dataFiles = files.filter(f => f.id && f.name.startsWith('notam_'));
      dataFiles.sort((a, b) => b.name.localeCompare(a.name));

      if (dataFiles.length > 0) {
        const latestFile = dataFiles[0];
        const filePath = 'notam_realtime/' + todayFolder + '/' + latestFile.name;
        console.log('\n=== Downloading latest file:', filePath, '===');

        const dlr = await req({
          hostname: SUPABASE_HOST,
          path: '/storage/v1/object/notam-data/' + filePath.split('/').map(encodeURIComponent).join('/'),
          method: 'GET',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY
          }
        });

        console.log('Download status:', dlr.status);
        if (dlr.status === 200) {
          const content = dlr.body;
          console.log('Content size:', content.length, 'chars');

          // Check if it contains real data or "fetch is not defined" errors
          if (content.includes('fetch is not defined')) {
            console.log('STILL HAS fetch ERROR! Fix did not work yet.');
          } else if (content.includes('"error"')) {
            console.log('Contains error field. Checking...');
            try {
              const data = JSON.parse(content);
              // Check first airport
              const firstKey = Object.keys(data)[0];
              if (firstKey) {
                const firstVal = data[firstKey];
                console.log('First airport (' + firstKey + '):', JSON.stringify(firstVal).substring(0, 300));
                if (firstVal.error) {
                  console.log('ERROR in data:', firstVal.error);
                } else {
                  console.log('SUCCESS! Real NOTAM data present!');
                }
              }
            } catch(e) {
              console.log('Parse error:', e.message);
              console.log('Raw (first 500):', content.substring(0, 500));
            }
          } else {
            console.log('Content (first 1000):', content.substring(0, 1000));
            console.log('Looks like real data!');
          }
        } else {
          console.log('Download error:', dlr.body.substring(0, 200));
        }
      }
    }

    // Also download notam_latest.json
    console.log('\n=== Downloading notam_latest.json ===');
    const latestPath = 'notam_realtime/' + todayFolder + '/notam_latest.json';
    const lr2 = await req({
      hostname: SUPABASE_HOST,
      path: '/storage/v1/object/notam-data/' + latestPath.split('/').map(encodeURIComponent).join('/'),
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY
      }
    });
    console.log('Status:', lr2.status);
    if (lr2.status === 200) {
      console.log('Size:', lr2.body.length, 'chars');
      if (lr2.body.includes('fetch is not defined')) {
        console.log('STILL HAS fetch ERROR!');
      } else {
        console.log('Content (first 1000):', lr2.body.substring(0, 1000));
      }
    }
  } else {
    console.log('List error:', listR.body.substring(0, 200));
  }
})();
