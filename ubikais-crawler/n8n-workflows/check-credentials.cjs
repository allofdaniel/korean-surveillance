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

(async () => {
  // Login
  const lb = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS });
  const lr = await req({ hostname: HOST, path: '/rest/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lb) } }, lb);
  if (lr.status !== 200) { console.log('Login failed'); return; }
  const ck = lr.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
  console.log('Logged in');

  // List all credentials
  console.log('\n=== All Credentials ===');
  const cr = await req({ hostname: HOST, path: '/rest/credentials', method: 'GET', headers: { Cookie: ck } });
  const creds = JSON.parse(cr.body);
  const credList = creds.data || [];
  credList.forEach(c => {
    console.log('  ID:', c.id, '| name:', c.name, '| type:', c.type, '| updatedAt:', c.updatedAt);
  });

  // Check Google Sheets credential specifically
  const gsCred = credList.find(c => c.type === 'googleSheetsOAuth2Api');
  if (gsCred) {
    console.log('\n=== Google Sheets Credential Detail ===');
    const dr = await req({ hostname: HOST, path: '/rest/credentials/' + gsCred.id, method: 'GET', headers: { Cookie: ck } });
    console.log('Status:', dr.status);
    const detail = JSON.parse(dr.body);
    console.log('Detail:', JSON.stringify(detail.data || detail).substring(0, 1000));
  }

  // Check Gmail credential
  const gmailCred = credList.find(c => c.type === 'gmailOAuth2');
  if (gmailCred) {
    console.log('\n=== Gmail Credential Detail ===');
    const dr = await req({ hostname: HOST, path: '/rest/credentials/' + gmailCred.id, method: 'GET', headers: { Cookie: ck } });
    console.log('Status:', dr.status);
    const detail = JSON.parse(dr.body);
    console.log('Detail:', JSON.stringify(detail.data || detail).substring(0, 1000));
  }

  // Check workflow node credential assignments
  console.log('\n=== Realtime Workflow - Node Credentials ===');
  const wr = await req({ hostname: HOST, path: '/rest/workflows/uO4ta8EfEDbIslVY', method: 'GET', headers: { Cookie: ck } });
  const wf = JSON.parse(wr.body).data;
  wf.nodes.forEach(n => {
    if (n.credentials) {
      console.log('  Node:', n.name, '| credentials:', JSON.stringify(n.credentials));
    }
  });
})();
