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

  // Get current workflow
  const wr = await req({ hostname: N8N_HOST, path: '/rest/workflows/uO4ta8EfEDbIslVY', method: 'GET', headers: { Cookie: ck } });
  const wf = JSON.parse(wr.body).data;
  console.log('Workflow name:', wf.name);
  console.log('Active:', wf.active);
  console.log('Nodes:', wf.nodes.map(n => n.name).join(', '));

  // Check Node 3 current code
  const crawlNode = wf.nodes.find(n => n.name === '3. NOTAM 크롤링');
  if (crawlNode) {
    const code = crawlNode.parameters.jsCode;
    console.log('\n=== Node 3 Current Code (first 300 chars) ===');
    console.log(code.substring(0, 300));
    console.log('\n=== Code contains ===');
    console.log('  "AIM Korea":', code.includes('AIM Korea'));
    console.log('  "aim.koca.go.kr":', code.includes('aim.koca.go.kr'));
    console.log('  "UBIKAIS":', code.includes('UBIKAIS'));
    console.log('  "ubikais.fois.go.kr":', code.includes('ubikais.fois.go.kr'));
    console.log('  "domestic":', code.includes('allData.domestic'));
    console.log('  "fir_notam":', code.includes('fir_notam'));
    console.log('  Code length:', code.length);
  }

  // Check connections
  console.log('\n=== Current Connections ===');
  console.log(JSON.stringify(wf.connections, null, 2).substring(0, 500));

  // Check Node 4 current code
  const node4 = wf.nodes.find(n => n.name === '4. Supabase 업로드 준비');
  if (node4) {
    console.log('\n=== Node 4 Code ===');
    console.log(node4.parameters.jsCode);
  }

  // Check Node 6 current code
  const node6 = wf.nodes.find(n => n.name === '6. 리포트 생성');
  if (node6) {
    console.log('\n=== Node 6 Code (first 200 chars) ===');
    console.log(node6.parameters.jsCode.substring(0, 200));
    console.log('  "AIM Korea":', node6.parameters.jsCode.includes('AIM Korea'));
    console.log('  "UBIKAIS":', node6.parameters.jsCode.includes('UBIKAIS'));
  }
})();
