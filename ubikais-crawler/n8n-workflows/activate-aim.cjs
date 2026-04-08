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

(async () => {
  const lb = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS });
  const lr = await req({ hostname: N8N_HOST, path: '/rest/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lb) } }, lb);
  const ck = lr.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');

  // Get full workflow
  const wr = await req({ hostname: N8N_HOST, path: '/rest/workflows/' + AIM_WF_ID, method: 'GET', headers: { Cookie: ck } });
  const workflow = JSON.parse(wr.body).data;
  console.log('Current:', workflow.name, '| active:', workflow.active);

  // Set active to true on full workflow
  workflow.active = true;
  const fullBody = JSON.stringify(workflow);
  console.log('Sending full workflow PATCH (size:', fullBody.length, ')');

  const pr = await req({
    hostname: N8N_HOST,
    path: '/rest/workflows/' + AIM_WF_ID,
    method: 'PATCH',
    headers: { Cookie: ck, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(fullBody) }
  }, fullBody);

  console.log('PATCH status:', pr.status);
  try {
    const d = JSON.parse(pr.body);
    console.log('Response active:', d.data ? d.data.active : 'N/A');
    if (d.data && d.data.active !== true) {
      console.log('Body (500):', pr.body.substring(0, 500));
    }
  } catch(e) {
    console.log('Body:', pr.body.substring(0, 500));
  }

  // Final check
  const check = await req({ hostname: N8N_HOST, path: '/rest/workflows/' + AIM_WF_ID, method: 'GET', headers: { Cookie: ck } });
  const wf = JSON.parse(check.body).data;
  console.log('Final active:', wf.active);

  // Show all workflows
  console.log('\nAll Workflows:');
  const wfr = await req({ hostname: N8N_HOST, path: '/rest/workflows', method: 'GET', headers: { Cookie: ck } });
  const workflows = JSON.parse(wfr.body).data || [];
  for (const w of workflows) {
    const marker = (w.id === AIM_WF_ID) ? ' <<< AIM' : (w.id === '2IMP7T4uDOX4C2Bx') ? ' <<< UBIKAIS' : '';
    console.log('  ' + (w.active ? 'ACTIVE  ' : 'INACTIVE') + ' | ' + w.name + marker);
  }
})();
