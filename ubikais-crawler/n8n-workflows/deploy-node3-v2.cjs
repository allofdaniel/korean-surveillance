const https = require('https');
const fs = require('fs');
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
  // 1. Login
  console.log('=== Step 1: Login ===');
  const lb = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS });
  const lr = await req({ hostname: N8N_HOST, path: '/rest/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lb) } }, lb);
  if (lr.status !== 200) { console.log('Login failed:', lr.status, lr.body.substring(0, 200)); return; }
  const ck = lr.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
  console.log('Login OK');

  // 2. Get current workflow
  console.log('\n=== Step 2: Get current workflow ===');
  const wr = await req({ hostname: N8N_HOST, path: '/rest/workflows/' + AIM_WF_ID, method: 'GET', headers: { Cookie: ck } });
  const wf = JSON.parse(wr.body).data;
  console.log('Workflow:', wf.name, '| Nodes:', wf.nodes.length, '| Active:', wf.active, '| VersionId:', wf.versionId);

  // 3. Read updated Node 3 code
  console.log('\n=== Step 3: Read updated Node 3 code ===');
  const newCode = fs.readFileSync('C:/Users/allof/Desktop/251212 GIS/rkpu-viewer/ubikais-crawler/n8n-workflows/node3-current.js', 'utf-8');
  console.log('New code:', newCode.length, 'chars,', newCode.split('\n').length, 'lines');

  // Verify it has the Supabase upload section
  if (!newCode.includes('Supabase Storage')) {
    console.log('ERROR: New code does not contain Supabase upload section!');
    return;
  }
  console.log('Verified: Contains Supabase upload section');

  // 4. Update Node 3 in workflow
  console.log('\n=== Step 4: Update Node 3 code ===');
  const node3idx = wf.nodes.findIndex(n => n.name === '3. NOTAM 크롤링');
  if (node3idx === -1) { console.log('ERROR: Node 3 not found!'); return; }

  const oldCode = wf.nodes[node3idx].parameters.jsCode;
  console.log('Old code:', oldCode.length, 'chars');
  wf.nodes[node3idx].parameters.jsCode = newCode;
  console.log('Updated Node 3 jsCode');

  // 5. PATCH workflow
  console.log('\n=== Step 5: PATCH workflow ===');
  const patchBody = JSON.stringify({ nodes: wf.nodes, connections: wf.connections });
  const pr = await req({
    hostname: N8N_HOST,
    path: '/rest/workflows/' + AIM_WF_ID,
    method: 'PATCH',
    headers: { Cookie: ck, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(patchBody) }
  }, patchBody);
  console.log('PATCH status:', pr.status);

  if (pr.status !== 200) {
    console.log('PATCH failed:', pr.body.substring(0, 500));
    return;
  }

  const patchData = JSON.parse(pr.body).data;
  const newVersionId = patchData.versionId;
  console.log('New versionId:', newVersionId);

  // 6. Activate with new versionId
  console.log('\n=== Step 6: Activate workflow ===');
  const actBody = JSON.stringify({ versionId: newVersionId });
  const ar = await req({
    hostname: N8N_HOST,
    path: '/rest/workflows/' + AIM_WF_ID + '/activate',
    method: 'POST',
    headers: { Cookie: ck, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(actBody) }
  }, actBody);
  console.log('Activate status:', ar.status);

  if (ar.status === 200) {
    const actData = JSON.parse(ar.body).data;
    console.log('Active:', actData.active, '| VersionId:', actData.versionId);
    console.log('\n=== DEPLOYMENT SUCCESSFUL ===');
    console.log('Node 3 now includes Supabase upload internally.');
    console.log('Next execution will upload directly to Supabase Storage.');
  } else {
    console.log('Activate response:', ar.body.substring(0, 500));
  }

  // 7. Verify deployment by re-reading workflow
  console.log('\n=== Step 7: Verify deployment ===');
  const vr = await req({ hostname: N8N_HOST, path: '/rest/workflows/' + AIM_WF_ID, method: 'GET', headers: { Cookie: ck } });
  const vwf = JSON.parse(vr.body).data;
  const vNode3 = vwf.nodes.find(n => n.name === '3. NOTAM 크롤링');
  const deployedCode = vNode3.parameters.jsCode;
  console.log('Deployed code length:', deployedCode.length, 'chars');
  console.log('Has Supabase upload:', deployedCode.includes('Supabase Storage'));
  console.log('Has uploadResults:', deployedCode.includes('uploadResults'));
  console.log('Workflow active:', vwf.active);
})();
