const https = require('https');
function post(path, formData) {
  const body = formData;
  return new Promise((resolve, reject) => {
    const r = https.request({ hostname: 'aim.koca.go.kr', path, method: 'POST', headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), 'Referer': 'https://aim.koca.go.kr/xNotam/index.do?type=search2' } }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d })); });
    r.on('error', reject); r.write(body); r.end();
  });
}
(async () => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth()+1).padStart(2,'0');
  const d = String(now.getUTCDate()).padStart(2,'0');
  const h = String(now.getUTCHours()).padStart(2,'0');
  const min = String(now.getUTCMinutes()).padStart(2,'0');
  const fromDate = y+'-'+m+'-'+d;
  const time = h+min;

  // 1. Test correct SNOWTAM parameter (sch_snow_series=S, not SNOWTAM)
  console.log('=== SNOWTAM with sch_snow_series=S ===');
  const snow1 = 'sch_inorout=D&sch_from_date='+fromDate+'&sch_from_time='+time+'&sch_to_date='+fromDate+'&sch_to_time='+time+'&sch_airport=&sch_series=S&sch_snow_series=S&sch_select=&Page=100';
  const rs1 = await post('/xNotam/searchValidNotam.do', snow1);
  const ds1 = JSON.parse(rs1.body);
  console.log('series=S, snow_series=S:', ds1.DATA.length, '| Total:', ds1.Total);
  if (ds1.DATA.length > 0) {
    console.log('  Sample:', JSON.stringify(ds1.DATA[0]).substring(0, 300));
  }

  // 2. SNOWTAM with just sch_snow_series=S, no sch_series
  const snow2 = 'sch_inorout=D&sch_from_date='+fromDate+'&sch_from_time='+time+'&sch_to_date='+fromDate+'&sch_to_time='+time+'&sch_airport=&sch_series=&sch_snow_series=S&sch_select=&Page=100';
  const rs2 = await post('/xNotam/searchValidNotam.do', snow2);
  const ds2 = JSON.parse(rs2.body);
  console.log('series=empty, snow_series=S:', ds2.DATA.length, '| Total:', ds2.Total);

  // 3. SNOWTAM with all series + S
  const snow3 = 'sch_inorout=D&sch_from_date='+fromDate+'&sch_from_time='+time+'&sch_to_date='+fromDate+'&sch_to_time='+time+'&sch_airport=&sch_series=A%2CC%2CD%2CE%2CG%2CZ%2CS&sch_snow_series=S&sch_select=&Page=100';
  const rs3 = await post('/xNotam/searchValidNotam.do', snow3);
  const ds3 = JSON.parse(rs3.body);
  console.log('series=A,C,D,E,G,Z,S, snow_series=S:', ds3.DATA.length, '| Total:', ds3.Total);
  // Check for any SW type in the results
  const swItems = ds3.DATA.filter(n => n.AIS_TYPE === 'SW' || n.SERIES === 'S');
  console.log('SW/S items in results:', swItems.length);

  // 4. Try IBSheet paging for E series
  console.log('\n=== IBSheet Paging Attempts for E Series ===');
  const ibsheetTests = [
    // IBSheet typically uses these params for server paging
    'sch_inorout=D&sch_from_date='+fromDate+'&sch_from_time='+time+'&sch_to_date='+fromDate+'&sch_to_time='+time+'&sch_airport=&sch_series=E&sch_select=&Page=100&ibpage=2',
    'sch_inorout=D&sch_from_date='+fromDate+'&sch_from_time='+time+'&sch_to_date='+fromDate+'&sch_to_time='+time+'&sch_airport=&sch_series=E&sch_select=&Page=100&ibpage=1',
    'sch_inorout=D&sch_from_date='+fromDate+'&sch_from_time='+time+'&sch_to_date='+fromDate+'&sch_to_time='+time+'&sch_airport=&sch_series=E&sch_select=&Page=100&CurPage=2',
    'sch_inorout=D&sch_from_date='+fromDate+'&sch_from_time='+time+'&sch_to_date='+fromDate+'&sch_to_time='+time+'&sch_airport=&sch_series=E&sch_select=&Page=100&ibspage=2',
    // Try completely different approach - larger page
    'sch_inorout=D&sch_from_date='+fromDate+'&sch_from_time='+time+'&sch_to_date='+fromDate+'&sch_to_time='+time+'&sch_airport=&sch_series=E&sch_select=&Page=200',
    // Try with ibsheet format
    'sch_inorout=D&sch_from_date='+fromDate+'&sch_from_time='+time+'&sch_to_date='+fromDate+'&sch_to_time='+time+'&sch_airport=&sch_series=E&sch_select=&Page=130',
  ];

  for (const params of ibsheetTests) {
    const r = await post('/xNotam/searchValidNotam.do', params);
    const data = JSON.parse(r.body);
    const paramShort = params.split('&').filter(p => p.startsWith('Page') || p.startsWith('ib') || p.startsWith('Cur')).join('&');
    console.log(paramShort, '-> count:', data.DATA.length, '| total:', data.Total, '| last:', data.DATA[data.DATA.length-1]?.NOTAM_NO);
  }

  // 5. Try XML-style IBSheet request body
  console.log('\n=== Content-Type: text/xml IBSheet ===');
  const xmlBody = '<?xml version="1.0" encoding="utf-8"?><Param><sch_inorout>D</sch_inorout><sch_from_date>'+fromDate+'</sch_from_date><sch_from_time>'+time+'</sch_from_time><sch_to_date>'+fromDate+'</sch_to_date><sch_to_time>'+time+'</sch_to_time><sch_airport></sch_airport><sch_series>E</sch_series><Page>200</Page></Param>';
  const rxmlBody = await new Promise((resolve, reject) => {
    const r = https.request({ hostname: 'aim.koca.go.kr', path: '/xNotam/searchValidNotam.do', method: 'POST', headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'text/xml', 'Content-Length': Buffer.byteLength(xmlBody), 'Referer': 'https://aim.koca.go.kr/xNotam/index.do?type=search2' } }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d })); });
    r.on('error', reject); r.write(xmlBody); r.end();
  });
  console.log('XML request:', rxmlBody.status, rxmlBody.body.substring(0, 200));

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log('Domestic Total: 225');
  console.log('  A: 25 (fetchable)');
  console.log('  C: 19 (fetchable)');
  console.log('  D: 31 (fetchable)');
  console.log('  E: 130 (only 100 fetchable due to API limit)');
  console.log('  G: 9 (fetchable)');
  console.log('  Z: 11 (fetchable)');
  console.log('  SNOWTAM: ' + ds1.DATA.length);
  console.log('International: 54 (all fetchable, per-airport)');
})();
