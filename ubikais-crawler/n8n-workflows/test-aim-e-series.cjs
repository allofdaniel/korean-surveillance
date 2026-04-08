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

  // First check E series total and locations from unfiltered query
  const paramsAll = 'sch_inorout=D&sch_from_date='+fromDate+'&sch_from_time='+time+'&sch_to_date='+fromDate+'&sch_to_time='+time+'&sch_airport=&sch_series=E&sch_select=&Page=100';
  const rAll = await post('/xNotam/searchValidNotam.do', paramsAll);
  const dAll = JSON.parse(rAll.body);
  console.log('E series total:', dAll.Total, '| fetched:', dAll.DATA.length);

  // Count locations in first 100
  const locs = {};
  dAll.DATA.forEach(n => { locs[n.LOCATION] = (locs[n.LOCATION] || 0) + 1; });
  console.log('Locations in first 100:', JSON.stringify(locs));
  console.log('Unique locations:', Object.keys(locs).length);

  // Now try per-airport for E series
  const airports = ['RKSI','RKSS','RKPK','RKPC','RKPS','RKPU','RKSM','RKTH','RKPD','RKTL','RKTU','RKNW','RKJK','RKJB','RKJY','RKJJ','RKTN','RKNY','RKRR','RKRK','RKPP','RKTE','RKSG','RKRA','RKRI','RKSO'];
  let totalE = 0;
  const eNotams = [];

  console.log('\n=== Series E by Individual Airport ===');
  for (const apt of airports) {
    const params = 'sch_inorout=D&sch_from_date='+fromDate+'&sch_from_time='+time+'&sch_to_date='+fromDate+'&sch_to_time='+time+'&sch_airport='+apt+'&sch_series=E&sch_select=&Page=100';
    const r = await post('/xNotam/searchValidNotam.do', params);
    const data = JSON.parse(r.body);
    if (data.DATA.length > 0) {
      console.log(apt+': count='+data.DATA.length+' total='+data.Total);
      totalE += data.DATA.length;
      eNotams.push(...data.DATA);
    }
  }

  // Deduplicate
  const eNos = eNotams.map(n => n.NOTAM_NO);
  const eUnique = [...new Set(eNos)];
  console.log('\nTotal E fetched per-airport:', totalE, 'unique:', eUnique.length, '(target:', dAll.Total+')');

  // Check which locations are missing
  const perAptLocs = {};
  eNotams.forEach(n => { perAptLocs[n.LOCATION] = (perAptLocs[n.LOCATION] || 0) + 1; });
  console.log('Per-airport locations:', JSON.stringify(perAptLocs));

  // Find locations from all query that we haven't covered
  const missingLocs = Object.keys(locs).filter(l => !(l in perAptLocs));
  console.log('Missing locations:', missingLocs);

  // If still missing, check for FIR-level NOTAMs (RKRR = Incheon FIR)
  if (eUnique.length < dAll.Total) {
    console.log('\nStill missing', dAll.Total - eUnique.length, 'E NOTAMs');
    // List all NOTAM_NOs from the combined query
    const allNos = new Set(dAll.DATA.map(n => n.NOTAM_NO));
    const fetchedNos = new Set(eNos);
    const missing = [...allNos].filter(n => !fetchedNos.has(n));
    console.log('Missing NOTAM_NOs (from first 100):', missing.join(', '));
    // Show details of missing
    const missingDetails = dAll.DATA.filter(n => missing.includes(n.NOTAM_NO));
    missingDetails.forEach(n => console.log('  ', n.NOTAM_NO, '|', n.LOCATION, '|', n.SERIES));
  }
})();
