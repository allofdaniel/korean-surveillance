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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  // Login
  const lb = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS });
  const lr = await req({ hostname: N8N_HOST, path: '/rest/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lb) } }, lb);
  const ck = lr.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');

  // Check error from latest execution
  console.log('=== Error from execution #743 ===');
  const exr = await req({ hostname: N8N_HOST, path: '/rest/executions/743', method: 'GET', headers: { Cookie: ck } });
  try {
    const ex = JSON.parse(exr.body).data;
    if (ex && ex.data && ex.data.resultData) {
      const runData = ex.data.resultData.runData;
      for (const [nodeName, nodeRuns] of Object.entries(runData || {})) {
        for (const run of (nodeRuns || [])) {
          if (run.error) {
            console.log('Node:', nodeName);
            console.log('Error:', run.error.message);
          }
        }
      }
    }
  } catch(e) { console.log('Could not parse execution:', e.message); }

  // Step 1: Deactivate
  console.log('\n=== Step 1: Deactivate ===');
  const dr = await req({
    hostname: N8N_HOST,
    path: '/rest/workflows/' + AIM_WF_ID + '/deactivate',
    method: 'POST',
    headers: { Cookie: ck }
  });
  console.log('Deactivate status:', dr.status);
  try {
    const drData = JSON.parse(dr.body);
    console.log('Active after deactivate:', drData.data ? drData.data.active : 'N/A');
  } catch(e) { console.log('Deactivate response:', dr.body.substring(0, 300)); }

  // Wait 3 seconds
  console.log('\nWaiting 3 seconds...');
  await sleep(3000);

  // Step 2: Try POST /activate endpoint
  console.log('\n=== Step 2: Activate ===');
  const ar = await req({
    hostname: N8N_HOST,
    path: '/rest/workflows/' + AIM_WF_ID + '/activate',
    method: 'POST',
    headers: { Cookie: ck }
  });
  console.log('Activate status:', ar.status);
  try {
    const arData = JSON.parse(ar.body);
    console.log('Active after activate:', arData.data ? arData.data.active : 'N/A');

    if (ar.status !== 200) {
      console.log('Activate response:', ar.body.substring(0, 300));

      // Fallback: PATCH with full workflow + active:true
      console.log('\n=== Fallback: PATCH with full workflow ===');
      const wr = await req({ hostname: N8N_HOST, path: '/rest/workflows/' + AIM_WF_ID, method: 'GET', headers: { Cookie: ck } });
      const workflow = JSON.parse(wr.body).data;
      workflow.active = true;
      const fullBody = JSON.stringify(workflow);
      console.log('Sending PATCH (size:', fullBody.length, ')');

      const pr = await req({
        hostname: N8N_HOST,
        path: '/rest/workflows/' + AIM_WF_ID,
        method: 'PATCH',
        headers: { Cookie: ck, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(fullBody) }
      }, fullBody);
      console.log('PATCH status:', pr.status);
      const prData = JSON.parse(pr.body);
      console.log('Active after PATCH:', prData.data ? prData.data.active : 'N/A');
    }
  } catch(e) { console.log('Activate response:', ar.body.substring(0, 300)); }

  // Verify
  const check = await req({ hostname: N8N_HOST, path: '/rest/workflows/' + AIM_WF_ID, method: 'GET', headers: { Cookie: ck } });
  const wf = JSON.parse(check.body).data;
  console.log('\nFinal status:', wf.name, '| active:', wf.active, '| updated:', wf.updatedAt);

  // Check if Node 3 has the fix
  const node3 = wf.nodes.find(n => n.name === '3. NOTAM 크롤링');
  if (node3) {
    const code = node3.parameters.jsCode || '';
    console.log('Node 3 has fix (!prevData.domestic):', code.includes('!prevData.domestic'));
  }
})();
