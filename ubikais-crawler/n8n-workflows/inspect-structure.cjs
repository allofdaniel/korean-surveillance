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
  // Part 1: Inspect NOTAM data structure
  console.log('=== Part 1: NOTAM Data Structure ===\n');

  const todayFolder = new Date().toISOString().split('T')[0];
  // Download latest file
  const listBody = JSON.stringify({ prefix: 'notam_realtime/' + todayFolder + '/', limit: 200, sortBy: { column: 'name', order: 'desc' } });
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
  const dataFiles = files.filter(f => f.id && f.name.startsWith('notam_') && f.name !== 'notam_latest.json');

  // Download last two files
  const file1 = dataFiles[1]; // second to last
  const file2 = dataFiles[0]; // last

  console.log('Comparing:', file1.name, 'vs', file2.name);

  const paths = [file1, file2].map(f => 'notam_realtime/' + todayFolder + '/' + f.name);
  const downloads = await Promise.all(paths.map(p => req({
    hostname: SUPABASE_HOST,
    path: '/storage/v1/object/notam-data/' + p.split('/').map(encodeURIComponent).join('/'),
    method: 'GET',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
  })));

  const data1 = JSON.parse(downloads[0].body);
  const data2 = JSON.parse(downloads[1].body);

  // Inspect fir_notam structure
  console.log('\n--- fir_notam structure ---');
  if (data1.fir_notam) {
    const firKeys = Object.keys(data1.fir_notam);
    console.log('fir_notam keys:', firKeys);
    for (const key of firKeys.slice(0, 3)) {
      const val = data1.fir_notam[key];
      console.log('  [' + key + '] type:', typeof val, Array.isArray(val) ? '(array, length=' + val.length + ')' : '');
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        console.log('    sub-keys:', Object.keys(val).slice(0, 10));
        const firstSubKey = Object.keys(val)[0];
        if (firstSubKey) {
          const subVal = val[firstSubKey];
          console.log('    [' + firstSubKey + '] type:', typeof subVal, Array.isArray(subVal) ? '(array, length=' + subVal.length + ')' : '');
          if (Array.isArray(subVal) && subVal.length > 0) {
            console.log('    sample item keys:', Object.keys(subVal[0]));
            console.log('    sample item:', JSON.stringify(subVal[0]).substring(0, 300));
          }
        }
      }
      if (Array.isArray(val) && val.length > 0) {
        console.log('    sample item keys:', Object.keys(val[0]));
        console.log('    sample item:', JSON.stringify(val[0]).substring(0, 300));
      }
    }
  }

  // Inspect ad_notam structure
  console.log('\n--- ad_notam structure ---');
  if (data1.ad_notam) {
    const adKeys = Object.keys(data1.ad_notam);
    console.log('ad_notam keys (first 10):', adKeys.slice(0, 10));
    console.log('ad_notam total airports:', adKeys.length);
    for (const key of adKeys.slice(0, 2)) {
      const val = data1.ad_notam[key];
      console.log('  [' + key + '] type:', typeof val, Array.isArray(val) ? '(array, length=' + val.length + ')' : '');
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        console.log('    sub-keys:', Object.keys(val).slice(0, 10));
        const firstSubKey = Object.keys(val)[0];
        if (firstSubKey) {
          const subVal = val[firstSubKey];
          if (Array.isArray(subVal) && subVal.length > 0) {
            console.log('    [' + firstSubKey + '] sample item keys:', Object.keys(subVal[0]));
            console.log('    sample:', JSON.stringify(subVal[0]).substring(0, 300));
          }
        }
      }
    }
  }

  // Inspect other fields
  console.log('\n--- snowtam ---');
  if (data1.snowtam) {
    console.log('type:', typeof data1.snowtam, Array.isArray(data1.snowtam) ? 'array(' + data1.snowtam.length + ')' : '');
    console.log('keys:', typeof data1.snowtam === 'object' ? Object.keys(data1.snowtam).slice(0, 5) : 'N/A');
  }

  console.log('\n--- prohibited_area ---');
  if (data1.prohibited_area) {
    console.log('type:', typeof data1.prohibited_area, Array.isArray(data1.prohibited_area) ? 'array(' + data1.prohibited_area.length + ')' : '');
  }

  console.log('\n--- sequence_list ---');
  if (data1.sequence_list) {
    console.log('type:', typeof data1.sequence_list, Array.isArray(data1.sequence_list) ? 'array(' + data1.sequence_list.length + ')' : '');
    if (typeof data1.sequence_list === 'object' && !Array.isArray(data1.sequence_list)) {
      console.log('keys:', Object.keys(data1.sequence_list).slice(0, 5));
    }
  }

  // Deep comparison: find actual differences between data1 and data2
  console.log('\n\n=== Deep Comparison ===');
  const str1 = JSON.stringify(data1);
  const str2 = JSON.stringify(data2);
  console.log('File A size:', str1.length);
  console.log('File B size:', str2.length);

  // Replace crawled_at to compare the rest
  const norm1 = str1.replace(/"crawled_at":"[^"]*"/, '"crawled_at":"NORMALIZED"');
  const norm2 = str2.replace(/"crawled_at":"[^"]*"/, '"crawled_at":"NORMALIZED"');
  console.log('After normalizing crawled_at, identical?', norm1 === norm2);

  if (norm1 !== norm2) {
    // Find first difference
    for (let i = 0; i < Math.min(norm1.length, norm2.length); i++) {
      if (norm1[i] !== norm2[i]) {
        console.log('First difference at position', i);
        console.log('  A:', norm1.substring(Math.max(0, i-50), i+50));
        console.log('  B:', norm2.substring(Math.max(0, i-50), i+50));
        break;
      }
    }
  }

  // Part 2: Get n8n workflow code to check for change detection logic
  console.log('\n\n=== Part 2: n8n Workflow Code Analysis ===\n');

  const lb = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS });
  const lr = await req({ hostname: N8N_HOST, path: '/rest/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lb) } }, lb);
  if (lr.status !== 200) { console.log('Login failed'); return; }
  const ck = lr.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');

  const wr = await req({ hostname: N8N_HOST, path: '/rest/workflows/uO4ta8EfEDbIslVY', method: 'GET', headers: { Cookie: ck } });
  const wf = JSON.parse(wr.body).data;

  console.log('Workflow name:', wf.name);
  console.log('Nodes:', wf.nodes.length);

  wf.nodes.forEach(n => {
    console.log('\n--- Node:', n.name, '| type:', n.type, '---');
    if (n.type === 'n8n-nodes-base.code' || n.type === 'n8n-nodes-base.function' || n.type === 'n8n-nodes-base.functionItem') {
      // Show the JavaScript code
      const code = n.parameters?.jsCode || n.parameters?.functionCode || n.parameters?.code || '';
      if (code) {
        console.log('CODE (first 2000 chars):');
        console.log(code.substring(0, 2000));

        // Check for change detection patterns
        const hasChangeDetection = code.includes('change') || code.includes('diff') ||
          code.includes('previous') || code.includes('compare') || code.includes('delta') ||
          code.includes('added') || code.includes('removed') || code.includes('modified') ||
          code.includes('new_notam');
        console.log('Has change detection keywords?', hasChangeDetection);
      }
    }
    if (n.parameters?.url) {
      console.log('URL:', n.parameters.url);
    }
    if (n.credentials) {
      console.log('Credentials:', JSON.stringify(n.credentials));
    }
  });
})();
