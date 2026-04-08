// n8n Cloud에 워크플로우를 임포트하는 스크립트
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
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // Step 1: Login to get session cookie
  console.log('=== Step 1: n8n Cloud 로그인 ===');
  const loginBody = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASSWORD });
  const loginRes = await httpsRequest({
    hostname: N8N_HOST,
    path: '/rest/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginBody)
    }
  }, loginBody);

  console.log('Login status:', loginRes.status);

  if (loginRes.status !== 200) {
    console.log('Login failed:', loginRes.body.substring(0, 300));
    return;
  }

  // Extract session cookie
  const cookies = loginRes.headers['set-cookie'];
  const cookieStr = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';
  console.log('Cookie obtained:', cookieStr ? 'YES' : 'NO');

  // Also extract auth token from response body
  let authToken = '';
  try {
    const loginData = JSON.parse(loginRes.body);
    console.log('Login response keys:', Object.keys(loginData.data || loginData));
  } catch (e) {}

  // Helper: clean workflow for import (remove tags, credentials, and server-generated fields)
  function cleanWorkflow(wf) {
    delete wf.tags;
    delete wf.id;
    delete wf.createdAt;
    delete wf.updatedAt;
    delete wf.versionId;
    // Remove credential references from nodes (will configure in UI after import)
    if (wf.nodes) {
      wf.nodes.forEach(node => {
        delete node.credentials;
      });
    }
    return wf;
  }

  // Step 2: Create Realtime workflow
  console.log('\n=== Step 2: NOTAM Realtime 워크플로우 생성 ===');
  const realtimeJson = fs.readFileSync(path.join(__dirname, 'ubikais-notam-realtime.json'), 'utf-8');
  const realtimeWf = cleanWorkflow(JSON.parse(realtimeJson));
  const realtimeBody = JSON.stringify(realtimeWf);

  const createRes1 = await httpsRequest({
    hostname: N8N_HOST,
    path: '/rest/workflows',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(realtimeBody),
      'Cookie': cookieStr
    }
  }, realtimeBody);

  console.log('Realtime workflow create status:', createRes1.status);
  if (createRes1.status === 200 || createRes1.status === 201) {
    const data = JSON.parse(createRes1.body);
    console.log('Created workflow ID:', data.data?.id, 'Name:', data.data?.name);
  } else {
    console.log('Error:', createRes1.body.substring(0, 500));
  }

  // Step 3: Create Full Crawl workflow
  console.log('\n=== Step 3: Full Crawl 워크플로우 생성 ===');
  const fullJson = fs.readFileSync(path.join(__dirname, 'ubikais-full-crawl.json'), 'utf-8');
  const fullWf = cleanWorkflow(JSON.parse(fullJson));
  const fullBody = JSON.stringify(fullWf);

  const createRes2 = await httpsRequest({
    hostname: N8N_HOST,
    path: '/rest/workflows',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(fullBody),
      'Cookie': cookieStr
    }
  }, fullBody);

  console.log('Full crawl workflow create status:', createRes2.status);
  if (createRes2.status === 200 || createRes2.status === 201) {
    const data = JSON.parse(createRes2.body);
    console.log('Created workflow ID:', data.data?.id, 'Name:', data.data?.name);
  } else {
    console.log('Error:', createRes2.body.substring(0, 500));
  }

  console.log('\n=== 완료 ===');
}

main().catch(console.error);
