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
  // 1. Login
  console.log('=== Step 1: Login ===');
  const lb = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS });
  const lr = await req({ hostname: N8N_HOST, path: '/rest/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lb) } }, lb);
  const ck = lr.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
  console.log('Login:', lr.status === 200 ? 'OK' : 'FAILED');

  // 2. Get UBIKAIS workflow
  console.log('\n=== Step 2: Get UBIKAIS workflow ===');
  const ugr = await req({ hostname: N8N_HOST, path: '/rest/workflows/' + UBIKAIS_WF_ID, method: 'GET', headers: { Cookie: ck } });
  const ubikaisWf = JSON.parse(ugr.body).data;
  console.log('UBIKAIS name:', ubikaisWf.name);
  console.log('UBIKAIS active:', ubikaisWf.active);
  console.log('UBIKAIS versionId:', ubikaisWf.versionId);

  // 3. Deactivate UBIKAIS using full workflow body with active=false
  console.log('\n=== Step 3: Deactivate UBIKAIS ===');
  // n8n requires versionId for updates
  const ubikaisUpdate = {
    ...ubikaisWf,
    active: false
  };
  const ub = JSON.stringify(ubikaisUpdate);
  const udr = await req({
    hostname: N8N_HOST,
    path: '/rest/workflows/' + UBIKAIS_WF_ID,
    method: 'PUT',
    headers: { Cookie: ck, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(ub) }
  }, ub);
  console.log('PUT status:', udr.status);
  const udrData = JSON.parse(udr.body);
  console.log('Response active:', udrData.data?.active);
  if (udr.status !== 200) {
    console.log('Response body:', udr.body.substring(0, 500));
  }

  // Also try the activation endpoint
  if (udrData.data?.active !== false) {
    console.log('\nTrying /rest/workflows/{id}/deactivate ...');
    const dar = await req({
      hostname: N8N_HOST,
      path: '/rest/workflows/' + UBIKAIS_WF_ID + '/deactivate',
      method: 'POST',
      headers: { Cookie: ck, 'Content-Type': 'application/json' }
    });
    console.log('Deactivate endpoint status:', dar.status, dar.body.substring(0, 200));
  }

  // 4. Now handle AIM Korea - deactivate then reactivate
  console.log('\n=== Step 4: Refresh AIM Korea ===');
  const agr = await req({ hostname: N8N_HOST, path: '/rest/workflows/' + AIM_WF_ID, method: 'GET', headers: { Cookie: ck } });
  const aimWf = JSON.parse(agr.body).data;
  console.log('AIM Korea name:', aimWf.name);
  console.log('AIM Korea active:', aimWf.active);

  // Deactivate
  const aimOff = JSON.stringify({ ...aimWf, active: false });
  const adr = await req({
    hostname: N8N_HOST,
    path: '/rest/workflows/' + AIM_WF_ID,
    method: 'PUT',
    headers: { Cookie: ck, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(aimOff) }
  }, aimOff);
  console.log('AIM deactivate:', adr.status, JSON.parse(adr.body).data?.active);

  await new Promise(r => setTimeout(r, 3000));

  // Get fresh version for reactivation
  const agr2 = await req({ hostname: N8N_HOST, path: '/rest/workflows/' + AIM_WF_ID, method: 'GET', headers: { Cookie: ck } });
  const aimWf2 = JSON.parse(agr2.body).data;
  const aimOn = JSON.stringify({ ...aimWf2, active: true });
  const aar = await req({
    hostname: N8N_HOST,
    path: '/rest/workflows/' + AIM_WF_ID,
    method: 'PUT',
    headers: { Cookie: ck, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(aimOn) }
  }, aimOn);
  console.log('AIM reactivate:', aar.status, JSON.parse(aar.body).data?.active);

  // 5. Final verification
  console.log('\n=== Step 5: Final Verification ===');
  const wfr = await req({ hostname: N8N_HOST, path: '/rest/workflows', method: 'GET', headers: { Cookie: ck } });
  const workflows = JSON.parse(wfr.body).data || [];
  workflows.forEach(w => {
    const marker = (w.id === AIM_WF_ID) ? ' <<< AIM Korea' : (w.id === UBIKAIS_WF_ID) ? ' <<< UBIKAIS' : '';
    console.log('  ' + (w.active ? 'ACTIVE  ' : 'inactive') + ' | ' + w.name + marker);
  });
})();
