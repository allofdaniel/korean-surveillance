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
  if (lr.status !== 200) { console.log('Login failed'); return; }
  const ck = lr.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');

  // List ALL workflows
  const wlr = await req({ hostname: N8N_HOST, path: '/rest/workflows', method: 'GET', headers: { Cookie: ck } });
  const workflows = JSON.parse(wlr.body).data || [];

  console.log('=== All Workflows ===');
  console.log('Total:', workflows.length);
  workflows.forEach(w => {
    console.log('  ID:', w.id, '| name:', w.name, '| active:', w.active, '| updated:', w.updatedAt);
  });

  // Get details of each workflow
  for (const w of workflows) {
    console.log('\n\n========================================');
    console.log('WORKFLOW:', w.name, '(ID:', w.id, ')');
    console.log('Active:', w.active);
    console.log('========================================');

    const wr = await req({ hostname: N8N_HOST, path: '/rest/workflows/' + w.id, method: 'GET', headers: { Cookie: ck } });
    const wf = JSON.parse(wr.body).data;

    console.log('Nodes:', wf.nodes.length);
    wf.nodes.forEach(n => {
      console.log('\n  --- Node:', n.name, '| type:', n.type, '---');

      if (n.type === 'n8n-nodes-base.code' || n.type === 'n8n-nodes-base.function' || n.type === 'n8n-nodes-base.functionItem') {
        const code = n.parameters?.jsCode || n.parameters?.functionCode || n.parameters?.code || '';
        if (code) {
          // Check for change detection patterns
          const patterns = ['change', 'diff', 'previous', 'compare', 'delta', 'added', 'removed', 'modified', 'new_notam', 'old_notam', '이전', '변경', '신규', '삭제'];
          const found = patterns.filter(p => code.toLowerCase().includes(p.toLowerCase()));

          console.log('  Code length:', code.length, 'chars');
          console.log('  Change detection keywords found:', found.length > 0 ? found.join(', ') : 'NONE');

          // Show key parts of the code
          console.log('  CODE SUMMARY:');
          // Show first 500 chars
          console.log(code.substring(0, 500));
          console.log('  ...(truncated)...');

          // Check what URLs/endpoints are being crawled
          const urlMatches = code.match(/https?:\/\/[^\s'"]+/g) || [];
          if (urlMatches.length > 0) {
            console.log('  URLs found in code:', urlMatches.join('\n    '));
          }

          // Check what data structure is being built
          const allDataMatch = code.match(/allData\s*=\s*\{[^}]+\}/);
          if (allDataMatch) {
            console.log('  Data structure:', allDataMatch[0].substring(0, 200));
          }
        }
      }

      if (n.parameters?.url) {
        console.log('  URL:', typeof n.parameters.url === 'string' ? n.parameters.url.substring(0, 150) : JSON.stringify(n.parameters.url).substring(0, 150));
      }

      if (n.type === 'n8n-nodes-base.scheduleTrigger') {
        console.log('  Schedule:', JSON.stringify(n.parameters?.rule || n.parameters).substring(0, 200));
      }
    });
  }
})();
