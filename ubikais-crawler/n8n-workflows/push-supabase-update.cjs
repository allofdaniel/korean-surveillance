// n8n Cloud에 Supabase 마이그레이션된 워크플로우를 업데이트하는 스크립트
// 서버의 versionId와 credential 정보를 보존하면서 노드/연결 업데이트
const https = require('https');
const fs = require('fs');
const path = require('path');

const N8N_HOST = 'allofdaniel.app.n8n.cloud';
const EMAIL = 'allofdaniel1@gmail.com';
const PASSWORD = 'Pr12pr34!@';

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
  // Login
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
    { id: 'uO4ta8EfEDbIslVY', name: 'Realtime', file: 'ubikais-notam-realtime.json' },
    { id: '2IMP7T4uDOX4C2Bx', name: 'Full Crawl', file: 'ubikais-full-crawl.json' }
  ];

  for (const wf of workflows) {
    console.log('\n=== Updating', wf.name, '(', wf.id, ') ===');

    // 1. GET current workflow from server
    const getRes = await httpsRequest({
      hostname: N8N_HOST, path: '/rest/workflows/' + wf.id, method: 'GET',
      headers: { 'Cookie': cookieStr }
    });
    if (getRes.status !== 200) { console.log('GET failed:', getRes.body.substring(0, 200)); continue; }

    const serverData = JSON.parse(getRes.body);
    const serverWf = serverData.data;
    console.log('Server versionId:', serverWf.versionId);
    console.log('Server nodes:', serverWf.nodes.length);

    // Collect credentials from server nodes (by node ID)
    const serverCredentials = {};
    serverWf.nodes.forEach(n => {
      if (n.credentials) {
        serverCredentials[n.id] = n.credentials;
      }
    });
    console.log('Server credentials found:', Object.keys(serverCredentials).length);

    // 2. Load local JSON
    const localPath = path.join(__dirname, wf.file);
    const localWf = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
    console.log('Local nodes:', localWf.nodes.length);

    // 3. Apply server credentials to local nodes (matching by ID)
    localWf.nodes.forEach(node => {
      if (serverCredentials[node.id]) {
        node.credentials = serverCredentials[node.id];
        console.log('  Restored credentials for:', node.name, '| creds:', JSON.stringify(node.credentials));
      }
    });

    // 4. Build update payload
    const updatePayload = {
      name: serverWf.name,
      nodes: localWf.nodes,
      connections: localWf.connections,
      settings: localWf.settings || serverWf.settings,
      staticData: serverWf.staticData,
      versionId: serverWf.versionId
    };

    // Log node summary
    console.log('Update payload nodes:');
    updatePayload.nodes.forEach(n => {
      const hasCreds = n.credentials ? ' [creds]' : '';
      console.log('  ', n.name, '|', n.type, hasCreds);
    });

    // 5. PATCH
    const patchBody = JSON.stringify(updatePayload);
    const patchRes = await httpsRequest({
      hostname: N8N_HOST, path: '/rest/workflows/' + wf.id, method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(patchBody),
        'Cookie': cookieStr
      }
    }, patchBody);

    console.log('PATCH status:', patchRes.status);
    if (patchRes.status === 200) {
      const result = JSON.parse(patchRes.body);
      console.log('Updated! New versionId:', result.data?.versionId);

      // Verify no S3 nodes remain
      const s3Nodes = (result.data?.nodes || []).filter(n => n.type === 'n8n-nodes-base.awsS3');
      console.log('Remaining S3 nodes:', s3Nodes.length, s3Nodes.length === 0 ? '(clean)' : '(WARNING!)');
    } else {
      console.log('PATCH error:', patchRes.body.substring(0, 500));
    }
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
