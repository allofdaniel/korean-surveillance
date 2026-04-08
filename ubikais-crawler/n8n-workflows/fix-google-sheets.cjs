const https = require('https');
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
  console.log('Nodes:', wf.nodes.map(n => n.name).join(', '));

  // Find Google Sheets nodes and set continueOnFail
  let modified = false;
  for (const node of wf.nodes) {
    if (node.name.includes('Google Sheets') || node.name.includes('Sheets') || node.name.includes('7b')) {
      console.log('\nFound node:', node.name, '| type:', node.type);
      console.log('  Current continueOnFail:', node.continueOnFail);
      console.log('  Current onError:', node.onError);

      // Set continueOnFail
      node.continueOnFail = true;
      node.onError = 'continueRegularOutput';
      modified = true;
      console.log('  -> Set continueOnFail: true, onError: continueRegularOutput');
    }
    // Also check Gmail nodes
    if (node.name.includes('Gmail') || node.name.includes('7a') || node.name.includes('메일')) {
      console.log('\nFound node:', node.name, '| type:', node.type);
      console.log('  Current continueOnFail:', node.continueOnFail);
      node.continueOnFail = true;
      node.onError = 'continueRegularOutput';
      modified = true;
      console.log('  -> Set continueOnFail: true');
    }
  }

  if (!modified) {
    console.log('\nNo Google Sheets/Gmail nodes found. Listing all nodes:');
    wf.nodes.forEach(n => console.log('  -', n.name, '|', n.type, '| continueOnFail:', n.continueOnFail));
    return;
  }

  // PATCH workflow
  const patchBody = JSON.stringify({ nodes: wf.nodes });
  const pr = await req({
    hostname: N8N_HOST,
    path: '/rest/workflows/uO4ta8EfEDbIslVY',
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(patchBody),
      'Cookie': ck
    }
  }, patchBody);
  console.log('\nPATCH status:', pr.status);

  if (pr.status === 200) {
    // Get versionId and activate
    const updated = JSON.parse(pr.body).data;
    const versionId = updated.versionId;
    console.log('Updated versionId:', versionId);
    console.log('Current activeVersionId:', updated.activeVersionId);

    if (versionId !== updated.activeVersionId) {
      // Activate the new version
      const actBody = JSON.stringify({ versionId });
      const ar = await req({
        hostname: N8N_HOST,
        path: '/rest/workflows/uO4ta8EfEDbIslVY/activate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(actBody),
          'Cookie': ck
        }
      }, actBody);
      console.log('Activate status:', ar.status);

      if (ar.status === 200) {
        const activated = JSON.parse(ar.body).data;
        console.log('New activeVersionId:', activated.activeVersionId);
        console.log('versionId === activeVersionId:', activated.versionId === activated.activeVersionId);
      }
    } else {
      console.log('Already active version matches draft');
    }

    console.log('\nDone! Google Sheets/Gmail nodes now have continueOnFail enabled.');
    console.log('The workflow will no longer fail when Google Sheets returns 403.');
  } else {
    console.log('PATCH failed:', pr.body.substring(0, 500));
  }
})();
