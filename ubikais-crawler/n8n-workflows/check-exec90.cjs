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
  const lb = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS });
  const lr = await req({ hostname: HOST, path: '/rest/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lb) } }, lb);
  const cookies = lr.headers['set-cookie'];
  const ck = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';

  // Get execution #90 detail
  const dr = await req({ hostname: HOST, path: '/rest/executions/90', method: 'GET', headers: { Cookie: ck } });
  const detail = JSON.parse(dr.body);
  const d = detail.data;

  console.log('Status:', d.status);
  console.log('Finished:', d.finished);

  // Parse the flattened execution data
  if (typeof d.data === 'string') {
    const arr = JSON.parse(d.data);
    const root = arr[0];
    console.log('Root keys:', Object.keys(root));

    const resultData = arr[parseInt(root.resultData)];
    console.log('resultData keys:', Object.keys(resultData));

    // Error
    if (resultData.error) {
      const errorObj = arr[parseInt(resultData.error)];
      console.log('\nError object keys:', Object.keys(errorObj));
      for (const [key, val] of Object.entries(errorObj)) {
        const idx = parseInt(val);
        if (!isNaN(idx) && arr[idx] !== undefined) {
          const resolved = arr[idx];
          if (typeof resolved === 'string' || typeof resolved === 'number') {
            console.log('  ' + key + ':', String(resolved).substring(0, 500));
          } else {
            console.log('  ' + key + ':', JSON.stringify(resolved).substring(0, 500));
          }
        } else {
          console.log('  ' + key + ':', val);
        }
      }
    } else {
      console.log('No error in resultData');
    }

    // lastNodeExecuted
    if (resultData.lastNodeExecuted) {
      console.log('\nlastNodeExecuted:', arr[parseInt(resultData.lastNodeExecuted)]);
    }

    // runData - which nodes ran
    if (resultData.runData) {
      const runData = arr[parseInt(resultData.runData)];
      console.log('\nNodes that ran:', Object.keys(runData));
    }
  }
})();
