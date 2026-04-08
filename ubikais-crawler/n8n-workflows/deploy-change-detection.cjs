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

// New code for "3. NOTAM 크롤링" node with change detection
const NEW_CRAWL_CODE = `// ===== UBIKAIS NOTAM 크롤링 + 변경 감지 =====
const BASE_URL = 'https://ubikais.fois.go.kr:8030';
const SUPABASE_URL = 'https://mysfgjaggqknuhobwtrc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15c2ZnamFnZ3FrbnVob2J3dHJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg5NjAxNSwiZXhwIjoyMDg1NDcyMDE1fQ.ke-cuuQlx6kphA7gyA3crren2ARVZHWdji-5OlKiKCM';
const helpers = this.helpers;

const loginResponse = $input.first().json;
let cookies = '';
if (loginResponse.headers && loginResponse.headers['set-cookie']) {
  const setCookies = loginResponse.headers['set-cookie'];
  cookies = (Array.isArray(setCookies) ? setCookies : [setCookies])
    .map(c => c.split(';')[0]).join('; ');
}

const now = new Date();
const y = now.getFullYear();
const m = String(now.getMonth() + 1).padStart(2, '0');
const d = String(now.getDate()).padStart(2, '0');
const hh = String(now.getHours()).padStart(2, '0');
const mm = String(now.getMinutes()).padStart(2, '0');
const ss = String(now.getSeconds()).padStart(2, '0');
const today = \`\${y}-\${m}-\${d}\`;
const yy = String(y).slice(2);
const todayShort = \`\${yy}\${m}\${d}\`;
const timestamp = \`\${y}\${m}\${d}_\${hh}\${mm}\${ss}\`;

async function crawl(endpoint, params) {
  const qs = Object.entries(params).map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(String(v))).join("&");
  const fullUrl = BASE_URL + endpoint + "?" + qs;
  try {
    const response = await helpers.httpRequest({
      url: fullUrl,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': BASE_URL + '/sysUbikais/biz/main.ubikais',
        'Cookie': cookies
      },
      skipSslCertificateValidation: true,
      json: true
    });
    return response;
  } catch (e) { return { error: e.message }; }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== 1단계: 이전 데이터 다운로드 =====
let prevData = null;
try {
  const latestUrl = SUPABASE_URL + '/storage/v1/object/notam-data/notam_realtime/' + today + '/notam_latest.json';
  const prev = await helpers.httpRequest({
    url: latestUrl,
    method: 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY
    },
    json: true
  });
  if (prev && prev.crawled_at) {
    prevData = prev;
  }
} catch (e) {
  // 이전 데이터 없음 (첫 실행) - 무시
}

// ===== 2단계: 현재 데이터 크롤링 =====
const allData = {
  crawled_at: now.toISOString(),
  fir_notam: {}, ad_notam: {},
  snowtam: null, prohibited_area: null, sequence_list: {},
  changes: null  // 변경 감지 결과
};

// FIR NOTAM
let firTotal = 0;
for (const series of ['C', 'A', 'D']) {
  const result = await crawl('/sysUbikais/biz/nps/selectNotamRecFir.fois', {
    downloadYn: '1', srchFir: 'RKRR', srchAd: 'RKRR', srchSeries: series,
    srchValid: today, srchValidsh: todayShort + '2359',
    srchValidsh2: todayShort + '0000', srchValid2: '1',
    cmd: 'get-records', limit: '1000', offset: '0'
  });
  if (result && result.records) {
    allData.fir_notam[series] = result;
    firTotal += (result.records || []).length;
  }
  await sleep(500);
}

// AD NOTAM
let adTotal = 0;
const airports = ['RKSI', 'RKSS', 'RKPC', 'RKPK', 'RKPU', 'RKJJ', 'RKTN'];
for (const airport of airports) {
  const result = await crawl('/sysUbikais/biz/nps/selectNotamRecAd.fois', {
    downloadYn: '1', srchFir: 'RKRR', srchSeries: 'C', srchAd: airport,
    srchValid: today, srchValidsh: todayShort + '2359',
    srchValidsh2: todayShort + '0000', srchValid2: '1',
    cmd: 'get-records', limit: '1000', offset: '0'
  });
  if (result) {
    allData.ad_notam[airport] = result;
    adTotal += (result.records || []).length;
  }
  await sleep(300);
}

// SNOWTAM
allData.snowtam = await crawl('/sysUbikais/biz/nps/selectNotamRecSnow.fois', {
  downloadYn: '1', printYn: '', srchOriginator: '', srchSeq: '',
  srchAd: '', srchValidFrom: String(y),
  cmd: 'get-records', limit: '1000', offset: '0'
});
const snowCount = (allData.snowtam?.records || []).length;

// 금지구역
allData.prohibited_area = await crawl('/sysUbikais/biz/nps/selectRecOffZone.fois', {
  downloadYn: '1', srchFir: 'RKRR', srchSeries: 'D', srchQcode: 'QRP',
  srchValid: today, srchValidsh: todayShort + '2359',
  srchValidsh2: todayShort + '0000', srchValid2: '1',
  cmd: 'get-records', limit: '1000', offset: '0'
});
const prohibCount = (allData.prohibited_area?.records || []).length;

// Sequence List
let seqTotal = 0;
for (const series of ['C', 'A', 'D']) {
  const result = await crawl('/sysUbikais/biz/nps/selectNotamRecSeq.fois', {
    downloadYn: '1', printYn: '', srchFir: 'RKRR', srchSeries: series,
    srchSeq: '', srchYear: yy,
    cmd: 'get-records', limit: '1000', offset: '0'
  });
  if (result && result.records) {
    allData.sequence_list[series] = result;
    seqTotal += (result.records || []).length;
  }
  await sleep(300);
}

const totalRecords = firTotal + adTotal + snowCount + prohibCount + seqTotal;

// ===== 3단계: 변경 감지 =====
if (prevData) {
  // NOTAM records에서 ID 추출하는 함수
  function extractIds(data, section, key) {
    const map = {};
    const src = data[section];
    if (!src) return map;
    const entries = key ? { [key]: src } : src;
    for (const [k, val] of Object.entries(entries)) {
      const records = val?.records || [];
      for (const rec of records) {
        const id = rec.id || rec.ntmPk;
        if (id) {
          map[id] = { section: section + (key ? '' : '/' + k), ...rec };
        }
      }
    }
    return map;
  }

  const prevIds = {};
  const currIds = {};

  // FIR NOTAM IDs
  for (const s of ['C', 'A', 'D']) {
    Object.assign(prevIds, extractIds(prevData, 'fir_notam', null));
    Object.assign(currIds, extractIds(allData, 'fir_notam', null));
  }
  // AD NOTAM IDs
  Object.assign(prevIds, extractIds(prevData, 'ad_notam', null));
  Object.assign(currIds, extractIds(allData, 'ad_notam', null));
  // SNOWTAM IDs
  for (const rec of (prevData.snowtam?.records || [])) {
    const id = rec.stmPk || rec.id;
    if (id) prevIds['snow_' + id] = { section: 'snowtam', ...rec };
  }
  for (const rec of (allData.snowtam?.records || [])) {
    const id = rec.stmPk || rec.id;
    if (id) currIds['snow_' + id] = { section: 'snowtam', ...rec };
  }

  const prevIdSet = new Set(Object.keys(prevIds));
  const currIdSet = new Set(Object.keys(currIds));

  // 신규: 현재에만 있는 ID
  const added = [...currIdSet].filter(id => !prevIdSet.has(id)).map(id => {
    const r = currIds[id];
    return {
      id, section: r.section,
      series: r.ntSeries || null,
      seqNo: r.ntSndSeq || r.stSndSeq || null,
      status: r.ntStatus || null,
      text: (r.ntText || r.amsOriginal || '').substring(0, 200)
    };
  });

  // 삭제: 이전에만 있는 ID
  const removed = [...prevIdSet].filter(id => !currIdSet.has(id)).map(id => {
    const r = prevIds[id];
    return {
      id, section: r.section,
      series: r.ntSeries || null,
      seqNo: r.ntSndSeq || r.stSndSeq || null,
      status: r.ntStatus || null,
      text: (r.ntText || r.amsOriginal || '').substring(0, 200)
    };
  });

  // 수정: 같은 ID지만 ntText가 변경된 경우
  const modified = [...currIdSet].filter(id => prevIdSet.has(id)).filter(id => {
    const prev = prevIds[id];
    const curr = currIds[id];
    const prevText = prev.ntText || prev.amsOriginal || '';
    const currText = curr.ntText || curr.amsOriginal || '';
    return prevText !== currText;
  }).map(id => {
    const curr = currIds[id];
    return {
      id, section: curr.section,
      series: curr.ntSeries || null,
      seqNo: curr.ntSndSeq || curr.stSndSeq || null,
      status: curr.ntStatus || null,
      text: (curr.ntText || curr.amsOriginal || '').substring(0, 200)
    };
  });

  allData.changes = {
    detected_at: now.toISOString(),
    previous_crawled_at: prevData.crawled_at,
    summary: {
      added: added.length,
      removed: removed.length,
      modified: modified.length,
      total_changes: added.length + removed.length + modified.length
    },
    added,
    removed,
    modified
  };
} else {
  allData.changes = {
    detected_at: now.toISOString(),
    previous_crawled_at: null,
    summary: { added: 0, removed: 0, modified: 0, total_changes: 0 },
    note: '이전 데이터 없음 (첫 실행)',
    added: [], removed: [], modified: []
  };
}

const changeCount = allData.changes.summary.total_changes;

return [{
  json: {
    notamData: allData,
    s3Key: \`notam_realtime/\${today}/notam_\${timestamp}.json\`,
    s3KeyLatest: \`notam_realtime/\${today}/notam_latest.json\`,
    timestamp: timestamp,
    date: today,
    recordCounts: {
      fir: firTotal, ad: adTotal,
      snowtam: snowCount, prohibited: prohibCount,
      sequence: seqTotal, total: totalRecords
    },
    changeCount: changeCount,
    hasChanges: changeCount > 0
  }
}];`;

(async () => {
  // Login
  const lb = JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS });
  const lr = await req({ hostname: N8N_HOST, path: '/rest/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lb) } }, lb);
  if (lr.status !== 200) { console.log('Login failed'); return; }
  const ck = lr.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
  console.log('Logged in');

  // Get current workflow
  const wr = await req({ hostname: N8N_HOST, path: '/rest/workflows/uO4ta8EfEDbIslVY', method: 'GET', headers: { Cookie: ck } });
  const wf = JSON.parse(wr.body).data;
  console.log('Got workflow:', wf.name);
  console.log('Current node count:', wf.nodes.length);

  // Find and update the crawling code node
  const crawlNode = wf.nodes.find(n => n.name === '3. NOTAM 크롤링');
  if (!crawlNode) {
    console.log('ERROR: Could not find crawl node');
    return;
  }

  console.log('Old code length:', crawlNode.parameters.jsCode.length);
  crawlNode.parameters.jsCode = NEW_CRAWL_CODE;
  console.log('New code length:', NEW_CRAWL_CODE.length);

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
  console.log('PATCH status:', pr.status);

  if (pr.status === 200) {
    console.log('Workflow updated successfully!');

    // Deactivate then reactivate
    const deact = JSON.stringify({ active: false });
    const dr = await req({
      hostname: N8N_HOST, path: '/rest/workflows/uO4ta8EfEDbIslVY',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(deact), 'Cookie': ck }
    }, deact);
    console.log('Deactivate:', dr.status);

    await new Promise(r => setTimeout(r, 1000));

    const react = JSON.stringify({ active: true });
    const rr = await req({
      hostname: N8N_HOST, path: '/rest/workflows/uO4ta8EfEDbIslVY',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(react), 'Cookie': ck }
    }, react);
    console.log('Reactivate:', rr.status);

    console.log('\nDone! Change detection is now active.');
    console.log('Next execution will include a "changes" field in the data.');
  } else {
    console.log('PATCH failed:', pr.body.substring(0, 500));
  }
})();
