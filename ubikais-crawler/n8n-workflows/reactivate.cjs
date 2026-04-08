const https = require('https');
const HOST = 'allofdaniel.app.n8n.cloud';
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  // Login
  const lb = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS });
  const lr = await req({ hostname: HOST, path: '/rest/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lb) } }, lb);
  if (lr.status !== 200) { console.log('Login failed:', lr.status); return; }
  const cookies = lr.headers['set-cookie'];
  const ck = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';
  console.log('Logged in');

  const workflows = [
    { id: 'uO4ta8EfEDbIslVY', name: 'Realtime' },
    { id: '2IMP7T4uDOX4C2Bx', name: 'Full Crawl' }
  ];

  for (const wf of workflows) {
    console.log('\n=== ' + wf.name + ' (' + wf.id + ') ===');

    // 1. Get current versionId
    const gr = await req({ hostname: HOST, path: '/rest/workflows/' + wf.id, method: 'GET', headers: { Cookie: ck } });
    const serverWf = JSON.parse(gr.body).data;
    console.log('Current active:', serverWf.active, '| versionId:', serverWf.versionId);

    // 2. Deactivate
    console.log('Deactivating...');
    const deactBody = JSON.stringify({ versionId: serverWf.versionId });
    const dr = await req({ hostname: HOST, path: '/rest/workflows/' + wf.id + '/deactivate', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(deactBody), Cookie: ck } }, deactBody);
    console.log('Deactivate status:', dr.status);
    const afterDeact = JSON.parse(dr.body);
    console.log('After deactivate - active:', afterDeact.data?.active);

    // Wait a moment
    await sleep(2000);

    // 3. Get updated versionId
    const gr2 = await req({ hostname: HOST, path: '/rest/workflows/' + wf.id, method: 'GET', headers: { Cookie: ck } });
    const serverWf2 = JSON.parse(gr2.body).data;
    console.log('After deact versionId:', serverWf2.versionId);

    // 4. Reactivate
    console.log('Reactivating...');
    const actBody = JSON.stringify({ versionId: serverWf2.versionId });
    const ar = await req({ hostname: HOST, path: '/rest/workflows/' + wf.id + '/activate', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(actBody), Cookie: ck } }, actBody);
    console.log('Activate status:', ar.status);
    const afterAct = JSON.parse(ar.body);
    console.log('After activate - active:', afterAct.data?.active);
  }

  console.log('\n=== Done. Both workflows reactivated. ===');
})();
