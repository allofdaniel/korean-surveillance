// n8n Cloud 워크플로우 노드 파라미터 업데이트 스크립트
const https = require('https');

const N8N_HOST = 'allofdaniel.app.n8n.cloud';
const EMAIL = 'allofdaniel1@gmail.com';
const PASSWORD = 'Pr12pr34!@';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1zXsSUt6X6EZSRGT_PYjpSg2glOOMFSNxd1nXF1Gx3TI/edit';

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // Step 1: Login
  console.log('=== Login ===');
  const loginBody = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASSWORD });
  const loginRes = await httpsRequest({
    hostname: N8N_HOST, path: '/rest/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) }
  }, loginBody);
  console.log('Login status:', loginRes.status);
  if (loginRes.status !== 200) { console.log('Login failed'); return; }
  const cookies = loginRes.headers['set-cookie'];
  const cookieStr = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';

  const workflows = [
    { id: 'uO4ta8EfEDbIslVY', name: 'Realtime' },
    { id: '2IMP7T4uDOX4C2Bx', name: 'Full Crawl' }
  ];

  for (const wf of workflows) {
    console.log('\n=== Updating', wf.name, '(', wf.id, ') ===');

    // GET current workflow
    const getRes = await httpsRequest({
      hostname: N8N_HOST, path: '/rest/workflows/' + wf.id, method: 'GET',
      headers: { 'Cookie': cookieStr }
    });
    console.log('GET status:', getRes.status);
    if (getRes.status !== 200) { console.log('GET failed:', getRes.body.substring(0, 200)); continue; }

    const data = JSON.parse(getRes.body);
    const workflow = data.data;
    console.log('Workflow name:', workflow.name, '| Nodes:', workflow.nodes.length, '| versionId:', workflow.versionId);

    // Log all node names for debugging
    workflow.nodes.forEach(n => console.log('  Node:', n.name, '| Type:', n.type));

    // Update node parameters
    let updated = false;
    workflow.nodes.forEach(node => {
      // Update UBIKAIS login nodes - check bodyParameters
      if (node.parameters && node.parameters.bodyParameters && node.parameters.bodyParameters.parameters) {
        node.parameters.bodyParameters.parameters.forEach(p => {
          if (p.name === 'memberId') {
            const oldVal = p.value;
            p.value = 'allofdanie';
            if (oldVal !== p.value) { console.log('  Updated memberId in', node.name); updated = true; }
          }
          if (p.name === 'memberPw') {
            const oldVal = p.value;
            p.value = 'pr12pr34!!';
            if (oldVal !== p.value) { console.log('  Updated memberPw in', node.name); updated = true; }
          }
        });
      }

      // Update Gmail notify email
      if (node.type === 'n8n-nodes-base.gmail' && node.parameters && node.parameters.sendTo) {
        const oldVal = node.parameters.sendTo;
        node.parameters.sendTo = 'allofdaniel@gmail.com';
        if (oldVal !== node.parameters.sendTo) { console.log('  Updated sendTo in', node.name); updated = true; }
      }

      // Update Google Sheets document URL
      if (node.type === 'n8n-nodes-base.googleSheets' && node.parameters && node.parameters.documentId) {
        const oldVal = node.parameters.documentId.value;
        node.parameters.documentId.value = SHEET_URL;
        if (oldVal !== SHEET_URL) { console.log('  Updated documentId in', node.name, '| old:', oldVal); updated = true; }
      }
    });

    console.log('Changes made:', updated);

    // PATCH updated workflow
    const patchBody = JSON.stringify(workflow);
    const patchRes = await httpsRequest({
      hostname: N8N_HOST, path: '/rest/workflows/' + wf.id, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(patchBody), 'Cookie': cookieStr }
    }, patchBody);
    console.log('PATCH status:', patchRes.status);
    if (patchRes.status === 200) {
      const patchData = JSON.parse(patchRes.body);
      console.log('Updated successfully! versionId:', patchData.data?.versionId);
    } else {
      console.log('PATCH error:', patchRes.body.substring(0, 500));
    }
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
