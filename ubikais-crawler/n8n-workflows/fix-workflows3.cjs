const https = require('https');
const N8N_HOST = 'allofdaniel.app.n8n.cloud';
const EMAIL = 'allofdaniel1@gmail.com';
const PASS = 'Pr12pr34!@';
const AIM_WF_ID = 'uO4ta8EfEDbIslVY';
const UBIKAIS_WF_ID = '2IMP7T4uDOX4C2Bx';

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
  // Login
  const lb = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS });
  const lr = await req({ hostname: N8N_HOST, path: '/rest/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lb) } }, lb);
  const ck = lr.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
  console.log('Login: OK');

  // Try multiple API approaches to deactivate UBIKAIS
  console.log('\n=== Trying to deactivate UBIKAIS (' + UBIKAIS_WF_ID + ') ===');

  // Approach 1: PATCH with active: false (simple)
  console.log('\n--- Approach 1: PATCH {active: false} ---');
  const body1 = JSON.stringify({ active: false });
  const r1 = await req({
    hostname: N8N_HOST,
    path: '/rest/workflows/' + UBIKAIS_WF_ID,
    method: 'PATCH',
    headers: { Cookie: ck, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body1) }
  }, body1);
  console.log('Status:', r1.status);
  // Print raw response to see structure
  const r1json = JSON.parse(r1.body);
  console.log('Response keys:', Object.keys(r1json));
  if (r1json.data) {
    console.log('data.active:', r1json.data.active);
    console.log('data.name:', r1json.data.name);
  } else {
    console.log('Raw (first 500):', r1.body.substring(0, 500));
  }

  // Approach 2: POST to /activate or /deactivate
  console.log('\n--- Approach 2: POST /deactivate ---');
  const r2 = await req({
    hostname: N8N_HOST,
    path: '/rest/workflows/' + UBIKAIS_WF_ID + '/deactivate',
    method: 'POST',
    headers: { Cookie: ck }
  });
  console.log('Status:', r2.status, r2.body.substring(0, 300));

  // Approach 3: PATCH /activate endpoint
  console.log('\n--- Approach 3: PATCH /activate ---');
  const r3 = await req({
    hostname: N8N_HOST,
    path: '/rest/workflows/' + UBIKAIS_WF_ID + '/activate',
    method: 'PATCH',
    headers: { Cookie: ck }
  });
  console.log('Status:', r3.status, r3.body.substring(0, 300));

  // Check what actually happened
  console.log('\n=== Checking current state ===');
  const check = await req({ hostname: N8N_HOST, path: '/rest/workflows/' + UBIKAIS_WF_ID, method: 'GET', headers: { Cookie: ck } });
  const wf = JSON.parse(check.body).data;
  console.log('UBIKAIS active now:', wf.active);

  // If still active, try the n8n API v1 approach (without /rest prefix)
  if (wf.active) {
    console.log('\n--- Approach 4: /api/v1/workflows PATCH ---');
    const r4 = await req({
      hostname: N8N_HOST,
      path: '/api/v1/workflows/' + UBIKAIS_WF_ID,
      method: 'PATCH',
      headers: { Cookie: ck, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body1) }
    }, body1);
    console.log('Status:', r4.status, r4.body.substring(0, 300));
  }

  // Also try AIM Korea deactivate/reactivate with the approach that worked
  console.log('\n=== AIM Korea deactivate/reactivate ===');
  const aimOff = JSON.stringify({ active: false });
  const ar1 = await req({
    hostname: N8N_HOST,
    path: '/rest/workflows/' + AIM_WF_ID,
    method: 'PATCH',
    headers: { Cookie: ck, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(aimOff) }
  }, aimOff);
  const ar1json = JSON.parse(ar1.body);
  console.log('AIM deactivate:', ar1.status, 'active:', ar1json.data?.active);

  await new Promise(r => setTimeout(r, 2000));

  const aimOn = JSON.stringify({ active: true });
  const ar2 = await req({
    hostname: N8N_HOST,
    path: '/rest/workflows/' + AIM_WF_ID,
    method: 'PATCH',
    headers: { Cookie: ck, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(aimOn) }
  }, aimOn);
  const ar2json = JSON.parse(ar2.body);
  console.log('AIM reactivate:', ar2.status, 'active:', ar2json.data?.active);

  // Final check on all workflows
  console.log('\n=== Final workflow status ===');
  const wfr = await req({ hostname: N8N_HOST, path: '/rest/workflows', method: 'GET', headers: { Cookie: ck } });
  const workflows = JSON.parse(wfr.body).data || [];
  for (const w of workflows) {
    const marker = (w.id === AIM_WF_ID) ? ' <<< AIM' : (w.id === UBIKAIS_WF_ID) ? ' <<< UBIKAIS' : '';
    console.log('  ' + (w.active ? 'ACTIVE  ' : 'INACTIVE') + ' | ' + w.name + marker);
  }
})();
