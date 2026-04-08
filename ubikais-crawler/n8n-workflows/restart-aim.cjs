const https = require('https');
const N8N_HOST = 'allofdaniel.app.n8n.cloud';
const EMAIL = 'allofdaniel1@gmail.com';
const PASS = 'Pr12pr34!@';
const AIM_WF_ID = 'uO4ta8EfEDbIslVY';

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

  // Step 1: Deactivate AIM Korea using POST /deactivate
  console.log('Deactivating AIM Korea...');
  const dr = await req({
    hostname: N8N_HOST,
    path: '/rest/workflows/' + AIM_WF_ID + '/deactivate',
    method: 'POST',
    headers: { Cookie: ck }
  });
  const drData = JSON.parse(dr.body);
  console.log('Deactivate result:', dr.status, 'active:', drData.data?.active);

  // Step 2: Wait 3 seconds
  console.log('Waiting 3 seconds...');
  await new Promise(r => setTimeout(r, 3000));

  // Step 3: Reactivate using PATCH {active: true}
  console.log('Reactivating AIM Korea...');
  const activateBody = JSON.stringify({ active: true });
  const ar = await req({
    hostname: N8N_HOST,
    path: '/rest/workflows/' + AIM_WF_ID,
    method: 'PATCH',
    headers: { Cookie: ck, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(activateBody) }
  }, activateBody);
  const arData = JSON.parse(ar.body);
  console.log('Reactivate result:', ar.status, 'active:', arData.data?.active);

  // Step 4: Verify
  const check = await req({ hostname: N8N_HOST, path: '/rest/workflows/' + AIM_WF_ID, method: 'GET', headers: { Cookie: ck } });
  const wf = JSON.parse(check.body).data;
  console.log('\nFinal status:');
  console.log('  Name:', wf.name);
  console.log('  Active:', wf.active);
  console.log('  Updated:', wf.updatedAt);

  console.log('\nAIM Korea has been properly restarted (deactivate → wait → reactivate).');
  console.log('Next execution should happen within 5 minutes.');
  console.log('Run check-data-now.cjs after ~5 min to verify new format.');
})();
