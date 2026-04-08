const https = require('https');
const fs = require('fs');
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
  // Login
  const lb = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS });
  const lr = await req({ hostname: N8N_HOST, path: '/rest/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lb) } }, lb);
  if (lr.status !== 200) { console.log('Login failed:', lr.status); return; }
  const ck = lr.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
  console.log('Logged in');

  // Get workflow
  const wr = await req({ hostname: N8N_HOST, path: '/rest/workflows/uO4ta8EfEDbIslVY', method: 'GET', headers: { Cookie: ck } });
  const wf = JSON.parse(wr.body).data;
  console.log('Workflow:', wf.name);
  console.log('Active:', wf.active);
  console.log('Nodes:', wf.nodes.length);

  // List all nodes with their types and code length
  wf.nodes.forEach((n, i) => {
    const codeLen = n.parameters?.jsCode ? n.parameters.jsCode.length : 0;
    const contFail = n.continueOnFail ? ' [continueOnFail]' : '';
    console.log('  ' + i + ': ' + n.name + ' | ' + n.type + ' | code:' + codeLen + contFail);
  });

  // Save full workflow to file
  fs.writeFileSync('C:/Users/allof/Desktop/251212 GIS/rkpu-viewer/ubikais-crawler/n8n-workflows/current-workflow.json', JSON.stringify(wf, null, 2));
  console.log('\nSaved to current-workflow.json');

  // Show the Code node's jsCode (first 500 chars)
  const codeNode = wf.nodes.find(n => n.type === 'n8n-nodes-base.code' || n.type.includes('code'));
  if (codeNode) {
    console.log('\n=== Code Node: ' + codeNode.name + ' ===');
    console.log('Code length:', codeNode.parameters.jsCode.length);
    console.log('First 500 chars:');
    console.log(codeNode.parameters.jsCode.substring(0, 500));
    console.log('...');
    console.log('\nLast 300 chars:');
    console.log(codeNode.parameters.jsCode.substring(codeNode.parameters.jsCode.length - 300));
  }
})();
