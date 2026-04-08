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

  // Check execution 744 and also the latest
  const er = await req({ hostname: N8N_HOST, path: '/rest/executions?workflowId=' + AIM_WF_ID + '&limit=5', method: 'GET', headers: { Cookie: ck } });
  const execData = JSON.parse(er.body);
  const execs = execData.data?.results || execData.data || [];
  console.log('=== Recent Executions ===');
  execs.forEach(e => console.log('  #' + e.id, '|', e.status, '|', e.startedAt));

  // Get full Node 3 code and save it
  const wr = await req({ hostname: N8N_HOST, path: '/rest/workflows/' + AIM_WF_ID, method: 'GET', headers: { Cookie: ck } });
  const wf = JSON.parse(wr.body).data;
  const node3 = wf.nodes.find(n => n.name === '3. NOTAM 크롤링');
  if (node3) {
    const code = node3.parameters.jsCode || '';
    console.log('Node 3 code length:', code.length, 'chars,', code.split('\n').length, 'lines');
    // Save full code to file
    const fs = require('fs');
    fs.writeFileSync('C:/Users/allof/Desktop/251212 GIS/rkpu-viewer/ubikais-crawler/n8n-workflows/node3-current.js', code);
    console.log('Saved to node3-current.js');
  }
})();
