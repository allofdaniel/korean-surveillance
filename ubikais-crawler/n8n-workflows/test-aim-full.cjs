const https = require('https');

function post(path, formData) {
  const body = formData;
  return new Promise((resolve, reject) => {
    const r = https.request({
      hostname: 'aim.koca.go.kr',
      path: path,
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'Referer': 'https://aim.koca.go.kr/xNotam/index.do?type=search2'
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.on('error', reject);
    r.write(body);
    r.end();
  });
}

(async () => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  const min = String(now.getUTCMinutes()).padStart(2, '0');
  const fromDate = y + '-' + m + '-' + d;
  const time = h + min;

  const airports = 'RKSI,RKSS,RKPK,RKPC,RKPS,RKPU,RKSM,RKTH,RKPD,RKTL,RKTU,RKNW,RKJK,RKJB,RKJY,RKJJ,RKTN,RKNY';

  // ========================================
  // TEST 1: Domestic, no series filter, no airport filter
  // ========================================
  console.log('=== TEST 1: Domestic, all series, no airport filter ===');
  const p1 = 'sch_inorout=D&sch_from_date=' + fromDate + '&sch_from_time=' + time + '&sch_to_date=' + fromDate + '&sch_to_time=' + time + '&sch_airport=&sch_series=&sch_select=&Page=1000';
  const r1 = await post('/xNotam/searchValidNotam.do', p1);
  try {
    const d1 = JSON.parse(r1.body);
    console.log('Count:', d1.DATA.length);
    const series1 = {};
    d1.DATA.forEach(n => { series1[n.SERIES] = (series1[n.SERIES] || 0) + 1; });
    console.log('By series:', JSON.stringify(series1));
  } catch(e) { console.log('Error:', r1.status, r1.body.substring(0, 200)); }

  // ========================================
  // TEST 2: Domestic, with series=A,C,D,E,G,Z,S
  // ========================================
  console.log('\n=== TEST 2: Domestic, series=A,C,D,E,G,Z,S ===');
  const p2 = 'sch_inorout=D&sch_from_date=' + fromDate + '&sch_from_time=' + time + '&sch_to_date=' + fromDate + '&sch_to_time=' + time + '&sch_airport=&sch_series=A%2CC%2CD%2CE%2CG%2CZ%2CS&sch_select=&Page=1000';
  const r2 = await post('/xNotam/searchValidNotam.do', p2);
  try {
    const d2 = JSON.parse(r2.body);
    console.log('Count:', d2.DATA.length);
    const series2 = {};
    d2.DATA.forEach(n => { series2[n.SERIES] = (series2[n.SERIES] || 0) + 1; });
    console.log('By series:', JSON.stringify(series2));
    // Check for SNOWTAM
    const snowtams = d2.DATA.filter(n => n.SERIES === 'S' || n.AIS_TYPE === 'SW');
    console.log('SNOWTAMs:', snowtams.length);
    if (snowtams.length > 0) console.log('  Sample:', JSON.stringify(snowtams[0]).substring(0, 300));
  } catch(e) { console.log('Error:', r2.status, r2.body.substring(0, 200)); }

  // ========================================
  // TEST 3: Domestic, with SNOWTAM series only
  // ========================================
  console.log('\n=== TEST 3: Domestic, series=S (SNOWTAM only) ===');
  const p3 = 'sch_inorout=D&sch_from_date=' + fromDate + '&sch_from_time=' + time + '&sch_to_date=' + fromDate + '&sch_to_time=' + time + '&sch_airport=&sch_series=S&sch_snow_series=SNOWTAM&sch_select=&Page=1000';
  const r3 = await post('/xNotam/searchValidNotam.do', p3);
  try {
    const d3 = JSON.parse(r3.body);
    console.log('Count:', d3.DATA.length);
    if (d3.DATA.length > 0) {
      console.log('  Sample:', JSON.stringify(d3.DATA[0]).substring(0, 300));
    }
  } catch(e) { console.log('Error:', r3.status, r3.body.substring(0, 200)); }

  // ========================================
  // TEST 4: International, with airport list
  // ========================================
  console.log('\n=== TEST 4: International, airports=' + airports + ' ===');
  const p4 = 'sch_inorout=I&sch_from_date=' + fromDate + '&sch_from_time=' + time + '&sch_to_date=' + fromDate + '&sch_to_time=' + time + '&sch_airport=' + encodeURIComponent(airports) + '&sch_series=&sch_select=&Page=1000';
  const r4 = await post('/xNotam/searchValidNotam.do', p4);
  try {
    const d4 = JSON.parse(r4.body);
    console.log('Count:', d4.DATA.length);
    const series4 = {};
    const locs4 = {};
    d4.DATA.forEach(n => {
      series4[n.SERIES] = (series4[n.SERIES] || 0) + 1;
      locs4[n.LOCATION] = (locs4[n.LOCATION] || 0) + 1;
    });
    console.log('By series:', JSON.stringify(series4));
    console.log('By location:', JSON.stringify(locs4));
  } catch(e) { console.log('Error:', r4.status, r4.body.substring(0, 200)); }

  // ========================================
  // TEST 5: International, single airport RKSI
  // ========================================
  console.log('\n=== TEST 5: International, airport=RKSI ===');
  const p5 = 'sch_inorout=I&sch_from_date=' + fromDate + '&sch_from_time=' + time + '&sch_to_date=' + fromDate + '&sch_to_time=' + time + '&sch_airport=RKSI&sch_series=&sch_select=&Page=1000';
  const r5 = await post('/xNotam/searchValidNotam.do', p5);
  try {
    const d5 = JSON.parse(r5.body);
    console.log('Count:', d5.DATA.length);
    const series5 = {};
    d5.DATA.forEach(n => { series5[n.SERIES] = (series5[n.SERIES] || 0) + 1; });
    console.log('By series:', JSON.stringify(series5));
    if (d5.DATA.length > 0) {
      console.log('Sample NOTAM_NOs:', d5.DATA.slice(0, 5).map(n => n.NOTAM_NO).join(', '));
    }
  } catch(e) { console.log('Error:', r5.status, r5.body.substring(0, 200)); }

  // ========================================
  // TEST 6: searchAllNotam.do (full search, date type = Issue)
  // ========================================
  console.log('\n=== TEST 6: searchAllNotam.do (all NOTAM search) ===');
  const p6 = 'sch_inorout=D&sch_date_type=I&sch_from_date=' + fromDate + '&sch_from_time=0000&sch_to_date=' + fromDate + '&sch_to_time=' + time + '&sch_airport=&sch_series=A%2CC%2CD%2CE%2CG%2CZ%2CS&sch_select=&Page=1000';
  const r6 = await post('/xNotam/searchAllNotam.do', p6);
  try {
    const d6 = JSON.parse(r6.body);
    console.log('Count:', d6.DATA.length);
    const series6 = {};
    d6.DATA.forEach(n => { series6[n.SERIES] = (series6[n.SERIES] || 0) + 1; });
    console.log('By series:', JSON.stringify(series6));
  } catch(e) { console.log('Error:', r6.status, r6.body.substring(0, 200)); }

  // ========================================
  // TEST 7: Domestic + SNOWTAM via searchValidNotam with snow_series
  // ========================================
  console.log('\n=== TEST 7: Domestic with sch_snow_series=SNOWTAM ===');
  const p7 = 'sch_inorout=D&sch_from_date=' + fromDate + '&sch_from_time=' + time + '&sch_to_date=' + fromDate + '&sch_to_time=' + time + '&sch_airport=&sch_series=A%2CC%2CD%2CE%2CG%2CZ%2CSNOWTAM&sch_snow_series=SNOWTAM&sch_select=&Page=1000';
  const r7 = await post('/xNotam/searchValidNotam.do', p7);
  try {
    const d7 = JSON.parse(r7.body);
    console.log('Count:', d7.DATA.length);
    const series7 = {};
    d7.DATA.forEach(n => { series7[n.SERIES || n.AIS_TYPE] = (series7[n.SERIES || n.AIS_TYPE] || 0) + 1; });
    console.log('By series/type:', JSON.stringify(series7));
    const snowtams7 = d7.DATA.filter(n => n.AIS_TYPE === 'SW' || n.SERIES === 'S');
    console.log('SNOWTAMs found:', snowtams7.length);
    if (snowtams7.length > 0) {
      console.log('  Sample:', JSON.stringify(snowtams7[0]).substring(0, 300));
    }
  } catch(e) { console.log('Error:', r7.status, r7.body.substring(0, 200)); }

})();
