const https = require('https');

function get(path) {
  return new Promise((resolve, reject) => {
    https.get({ hostname: 'aim.koca.go.kr', path, headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject);
  });
}

function post(path, formData) {
  const body = formData;
  return new Promise((resolve, reject) => {
    const r = https.request({ hostname: 'aim.koca.go.kr', path, method: 'POST', headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), 'Referer': 'https://aim.koca.go.kr/xNotam/index.do?type=search2' } }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d })); });
    r.on('error', reject); r.write(body); r.end();
  });
}

(async () => {
  // 1. Fetch the SNOWTAM tab page and extract JS
  console.log('=== Fetching SNOWTAM tab page ===');
  const page = await get('/xNotam/index.do?type=search2');

  // Find SNOWTAM-related JavaScript
  const jsMatches = page.body.match(/snow[\s\S]{0,200}/gi);
  if (jsMatches) {
    console.log('SNOWTAM JS references:');
    const unique = [...new Set(jsMatches.map(m => m.substring(0, 100)))];
    unique.forEach((m, i) => console.log('  ' + i + ':', m));
  }

  // Find form action for SNOWTAM
  const actionMatches = page.body.match(/search[\w]*Notam\.do/gi);
  console.log('\nAll .do endpoints found:', [...new Set(actionMatches || [])]);

  // 2. Get the main JS file and look for SNOWTAM search logic
  console.log('\n=== Fetching index.js for SNOWTAM logic ===');
  const jsR = await get('/xNotam/new/js/index.js?ver=202407');

  // Find SNOWTAM-related code
  const snowCode = [];
  const lines = jsR.body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes('snow')) {
      snowCode.push({ line: i+1, code: lines[i].trim().substring(0, 200) });
    }
  }
  console.log('SNOWTAM-related code lines:');
  snowCode.forEach(s => console.log('  L' + s.line + ':', s.code));

  // Find the SNOWTAM search function
  const snowFuncIdx = jsR.body.indexOf('snow');
  if (snowFuncIdx >= 0) {
    // Get surrounding context
    const start = Math.max(0, snowFuncIdx - 200);
    const end = Math.min(jsR.body.length, snowFuncIdx + 500);
    console.log('\n=== SNOWTAM context in JS ===');
    console.log(jsR.body.substring(start, end));
  }

  // 3. Try searchValidNotam with SNOWTAM in the search2 tab format
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth()+1).padStart(2,'0');
  const d = String(now.getUTCDate()).padStart(2,'0');
  const h = String(now.getUTCHours()).padStart(2,'0');
  const min = String(now.getUTCMinutes()).padStart(2,'0');
  const fromDate = y+'-'+m+'-'+d;
  const time = h+min;

  console.log('\n=== SNOWTAM API Tests ===');

  // Try various SNOWTAM queries
  const tests = [
    { name: 'searchValidSnowNotam', path: '/xNotam/searchValidSnowNotam.do', params: 'sch_from_date='+fromDate+'&sch_from_time='+time+'&sch_to_date='+fromDate+'&sch_to_time='+time+'&sch_airport=&Page=100' },
    { name: 'searchValidNotam snow_series', path: '/xNotam/searchValidNotam.do', params: 'sch_inorout=D&sch_from_date='+fromDate+'&sch_from_time='+time+'&sch_to_date='+fromDate+'&sch_to_time='+time+'&sch_airport=&sch_series=S&sch_snow_series=SNOWTAM&sch_select=&Page=100' },
    { name: 'searchValidNotam SNOWTAM in series', path: '/xNotam/searchValidNotam.do', params: 'sch_inorout=D&sch_from_date='+fromDate+'&sch_from_time='+time+'&sch_to_date='+fromDate+'&sch_to_time='+time+'&sch_airport=&sch_series=A%2CC%2CD%2CE%2CG%2CZ%2CSNOWTAM&sch_snow_series=SNOWTAM&sch_select=&Page=100' },
  ];

  for (const t of tests) {
    const r = await post(t.path, t.params);
    console.log(t.name + ':', r.status);
    try {
      const data = JSON.parse(r.body);
      console.log('  Count:', data.DATA ? data.DATA.length : 'no DATA', '| Total:', data.Total);
      if (data.DATA && data.DATA.length > 0) {
        const types = {};
        data.DATA.forEach(n => { types[n.AIS_TYPE || n.SERIES || 'unknown'] = (types[n.AIS_TYPE || n.SERIES || 'unknown'] || 0) + 1; });
        console.log('  By type:', JSON.stringify(types));
        console.log('  Sample:', JSON.stringify(data.DATA[0]).substring(0, 300));
      }
    } catch(e) {
      console.log('  Response:', r.body.substring(0, 200));
    }
  }
})();
