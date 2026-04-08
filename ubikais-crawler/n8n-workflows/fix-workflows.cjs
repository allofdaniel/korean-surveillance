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
  console.log('=== Logging in to n8n ===');
  const lb = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS });
  const lr = await req({ hostname: N8N_HOST, path: '/rest/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lb) } }, lb);
  const ck = lr.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
  console.log('Login:', lr.status === 200 ? 'OK' : 'FAILED');

  // 2. Deactivate UBIKAIS Daily workflow
  console.log('\n=== Deactivating UBIKAIS Daily Crawler ===');
  const deactivateBody = JSON.stringify({ active: false });
  const dr = await req({
    hostname: N8N_HOST,
    path: '/rest/workflows/' + UBIKAIS_WF_ID,
    method: 'PATCH',
    headers: { Cookie: ck, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(deactivateBody) }
  }, deactivateBody);
  const drData = JSON.parse(dr.body);
  console.log('UBIKAIS deactivated:', drData.data?.active === false ? 'YES' : 'NO (status: ' + dr.status + ')');

  // 3. Force deactivate AIM Korea workflow
  console.log('\n=== Deactivating AIM Korea workflow ===');
  const dr2 = await req({
    hostname: N8N_HOST,
    path: '/rest/workflows/' + AIM_WF_ID,
    method: 'PATCH',
    headers: { Cookie: ck, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(deactivateBody) }
  }, deactivateBody);
  const dr2Data = JSON.parse(dr2.body);
  console.log('AIM Korea deactivated:', dr2Data.data?.active === false ? 'YES' : 'NO');

  // 4. Wait 2 seconds
  await new Promise(r => setTimeout(r, 2000));

  // 5. Reactivate AIM Korea workflow
  console.log('\n=== Reactivating AIM Korea workflow ===');
  const activateBody = JSON.stringify({ active: true });
  const ar = await req({
    hostname: N8N_HOST,
    path: '/rest/workflows/' + AIM_WF_ID,
    method: 'PATCH',
    headers: { Cookie: ck, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(activateBody) }
  }, activateBody);
  const arData = JSON.parse(ar.body);
  console.log('AIM Korea reactivated:', arData.data?.active === true ? 'YES' : 'NO (status: ' + ar.status + ')');

  // 6. Verify both workflows
  console.log('\n=== Verifying all workflows ===');
  const wfr = await req({ hostname: N8N_HOST, path: '/rest/workflows', method: 'GET', headers: { Cookie: ck } });
  const wfBody = JSON.parse(wfr.body);
  const workflows = wfBody.data || [];
  workflows.forEach(w => {
    const marker = (w.id === AIM_WF_ID) ? ' <<<< AIM Korea' : (w.id === UBIKAIS_WF_ID) ? ' <<<< UBIKAIS (should be INACTIVE)' : '';
    console.log('  ' + w.id + ' | ' + (w.active ? 'ACTIVE' : 'inactive') + ' | ' + w.name + marker);
  });

  // 7. Quick verify Node 3 code still has AIM Korea
  console.log('\n=== Quick verify Node 3 code ===');
  const wr = await req({ hostname: N8N_HOST, path: '/rest/workflows/' + AIM_WF_ID, method: 'GET', headers: { Cookie: ck } });
  const wf = JSON.parse(wr.body).data;
  const node3 = wf.nodes.find(n => n.name.includes('크롤링') || n.name.includes('NOTAM'));
  if (node3) {
    const code = node3.parameters?.jsCode || '';
    console.log('Node 3 name:', node3.name);
    console.log('Code length:', code.length);
    console.log('Has "AIM Korea":', code.includes('AIM Korea'));
    console.log('Has "aim.koca.go.kr":', code.includes('aim.koca.go.kr'));
    console.log('Has "domestic":', code.includes('domestic'));
    console.log('Has "UBIKAIS":', code.includes('UBIKAIS'));
    console.log('Has "fir_notam":', code.includes('fir_notam'));
  }

  console.log('\n=== DONE ===');
  console.log('UBIKAIS Daily: DEACTIVATED');
  console.log('AIM Korea: REACTIVATED (code cache flushed)');
  console.log('Wait ~5 minutes then run check-data-now.cjs to verify new format');
})();
