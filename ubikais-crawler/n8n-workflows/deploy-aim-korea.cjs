const https = require('https');
const fs = require('fs');
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

// ===== NEW AIM Korea Crawler Code (replaces UBIKAIS) =====
const newCrawlCode = `// ===== AIM Korea NOTAM 크롤링 + 변경 감지 =====
// Source: aim.koca.go.kr/xNotam/searchValidNotam.do
const SUPABASE_URL = 'https://mysfgjaggqknuhobwtrc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15c2ZnamFnZ3FrbnVob2J3dHJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg5NjAxNSwiZXhwIjoyMDg1NDcyMDE1fQ.ke-cuuQlx6kphA7gyA3crren2ARVZHWdji-5OlKiKCM';
const helpers = this.helpers;

const now = new Date();
const y = now.getUTCFullYear();
const m = String(now.getUTCMonth() + 1).padStart(2, '0');
const d = String(now.getUTCDate()).padStart(2, '0');
const h = String(now.getUTCHours()).padStart(2, '0');
const min = String(now.getUTCMinutes()).padStart(2, '0');
const ss = String(now.getUTCSeconds()).padStart(2, '0');
const fromDate = y + '-' + m + '-' + d;
const time = h + min;
const today = fromDate;
const timestamp = y + m + d + '_' + h + min + ss;

const AIRPORTS = ['RKSI','RKSS','RKPK','RKPC','RKPS','RKPU','RKSM','RKTH','RKPD','RKTL','RKTU','RKNW','RKJK','RKJB','RKJY','RKJJ','RKTN','RKNY'];
const SERIES = ['A','C','D','E','G','Z'];

// AIM Korea API helper - POST to searchValidNotam.do
async function aimPost(params, ibpage) {
  let body = params;
  if (ibpage) body += '&ibpage=' + ibpage;
  try {
    const response = await helpers.httpRequest({
      url: 'https://aim.koca.go.kr/xNotam/searchValidNotam.do',
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://aim.koca.go.kr/xNotam/index.do?type=search2'
      },
      body: body,
      json: false
    });
    const data = JSON.parse(typeof response === 'string' ? response : JSON.stringify(response));
    return data;
  } catch (e) {
    return { DATA: [], Total: 0, error: e.message };
  }
}

// Fetch all pages for a query (handles 100-item limit)
async function fetchAllPages(params) {
  const first = await aimPost(params, null);
  const allItems = [...(first.DATA || [])];
  const total = first.Total || 0;
  if (total > 100) {
    let page = 2;
    while (allItems.length < total) {
      const next = await aimPost(params, page);
      if (!next.DATA || next.DATA.length === 0) break;
      allItems.push(...next.DATA);
      page++;
      if (page > 10) break; // safety limit
    }
  }
  return { items: allItems, total: total };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== 1단계: 이전 데이터 다운로드 =====
let prevData = null;
try {
  const latestUrl = SUPABASE_URL + '/storage/v1/object/notam-data/notam_realtime/' + today + '/notam_latest.json';
  const prev = await helpers.httpRequest({
    url: latestUrl,
    method: 'GET',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
    json: true
  });
  if (prev && prev.crawled_at) prevData = prev;
} catch (e) { /* 이전 데이터 없음 */ }

// ===== 2단계: AIM Korea 크롤링 =====
const allData = {
  crawled_at: now.toISOString(),
  source: 'AIM Korea (aim.koca.go.kr)',
  domestic: {},
  international: {},
  snowtam: [],
  changes: null
};

// --- 국내 NOTAM (시리즈별) ---
let domesticTotal = 0;
for (const s of SERIES) {
  const baseParams = 'sch_inorout=D&sch_from_date=' + fromDate + '&sch_from_time=' + time + '&sch_to_date=' + fromDate + '&sch_to_time=' + time + '&sch_airport=&sch_series=' + s + '&sch_select=&Page=100';
  const result = await fetchAllPages(baseParams);
  allData.domestic[s] = result.items;
  domesticTotal += result.items.length;
  await sleep(300);
}

// --- SNOWTAM ---
const snowParams = 'sch_inorout=D&sch_from_date=' + fromDate + '&sch_from_time=' + time + '&sch_to_date=' + fromDate + '&sch_to_time=' + time + '&sch_airport=&sch_series=S&sch_snow_series=S&sch_select=&Page=100';
const snowResult = await fetchAllPages(snowParams);
allData.snowtam = snowResult.items;
const snowCount = snowResult.items.length;
domesticTotal += snowCount;

// --- 국제 NOTAM (공항별) ---
let intlTotal = 0;
for (const apt of AIRPORTS) {
  const intlParams = 'sch_inorout=I&sch_from_date=' + fromDate + '&sch_from_time=' + time + '&sch_to_date=' + fromDate + '&sch_to_time=' + time + '&sch_airport=' + apt + '&sch_series=&sch_select=&Page=100';
  const result = await fetchAllPages(intlParams);
  if (result.items.length > 0) {
    allData.international[apt] = result.items;
    intlTotal += result.items.length;
  }
  await sleep(200);
}

const totalRecords = domesticTotal + intlTotal;

// ===== 3단계: 변경 감지 =====
if (prevData) {
  function extractNotamIds(data) {
    const map = {};
    // Domestic NOTAMs
    if (data.domestic) {
      for (const [series, items] of Object.entries(data.domestic)) {
        for (const item of (items || [])) {
          const id = item.NOTAM_NO || item.SEQ;
          if (id) map[id] = { section: 'domestic/' + series, ...item };
        }
      }
    }
    // International NOTAMs
    if (data.international) {
      for (const [apt, items] of Object.entries(data.international)) {
        for (const item of (items || [])) {
          const id = item.NOTAM_NO || item.SEQ;
          if (id) map['intl_' + apt + '_' + id] = { section: 'international/' + apt, ...item };
        }
      }
    }
    // SNOWTAM
    for (const item of (data.snowtam || [])) {
      const id = item.NOTAM_NO || item.SEQ;
      if (id) map['snow_' + id] = { section: 'snowtam', ...item };
    }
    return map;
  }

  const prevIds = extractNotamIds(prevData);
  const currIds = extractNotamIds(allData);
  const prevIdSet = new Set(Object.keys(prevIds));
  const currIdSet = new Set(Object.keys(currIds));

  const added = [...currIdSet].filter(id => !prevIdSet.has(id)).map(id => {
    const r = currIds[id];
    return { id, section: r.section, series: r.SERIES || null, notamNo: r.NOTAM_NO || null, location: r.LOCATION || null, text: (r.FULL_TEXT || '').substring(0, 200) };
  });

  const removed = [...prevIdSet].filter(id => !currIdSet.has(id)).map(id => {
    const r = prevIds[id];
    return { id, section: r.section, series: r.SERIES || null, notamNo: r.NOTAM_NO || null, location: r.LOCATION || null, text: (r.FULL_TEXT || '').substring(0, 200) };
  });

  const modified = [...currIdSet].filter(id => prevIdSet.has(id)).filter(id => {
    return (prevIds[id].FULL_TEXT || '') !== (currIds[id].FULL_TEXT || '');
  }).map(id => {
    const r = currIds[id];
    return { id, section: r.section, series: r.SERIES || null, notamNo: r.NOTAM_NO || null, location: r.LOCATION || null, text: (r.FULL_TEXT || '').substring(0, 200) };
  });

  allData.changes = {
    detected_at: now.toISOString(),
    previous_crawled_at: prevData.crawled_at,
    summary: { added: added.length, removed: removed.length, modified: modified.length, total_changes: added.length + removed.length + modified.length },
    added, removed, modified
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
    s3Key: 'notam_realtime/' + today + '/notam_' + timestamp + '.json',
    s3KeyLatest: 'notam_realtime/' + today + '/notam_latest.json',
    timestamp: timestamp,
    date: today,
    recordCounts: {
      domestic: domesticTotal,
      international: intlTotal,
      snowtam: snowCount,
      total: totalRecords
    },
    changeCount: changeCount,
    hasChanges: changeCount > 0
  }
}];`;

// ===== NEW Report Code =====
const newReportCode = `// Gmail + Google Sheets 용 리포트 데이터 생성 (AIM Korea)
const item = $input.first().json;
const rc = item.recordCounts;
const ts = item.timestamp;
const dt = item.date;
const kstDate = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

const emailHtml = \`
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #0d47a1; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0;">AIM Korea NOTAM 크롤링 완료</h2>
    <p style="margin: 4px 0 0; opacity: 0.8;">\${kstDate} (KST)</p>
  </div>
  <div style="background: #f5f5f5; padding: 20px 24px; border-radius: 0 0 8px 8px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: white;">
        <td style="padding: 10px 14px; border: 1px solid #e0e0e0; font-weight: bold;">국내 NOTAM (A/C/D/E/G/Z)</td>
        <td style="padding: 10px 14px; border: 1px solid #e0e0e0; text-align: right;">\${rc.domestic}건</td>
      </tr>
      <tr style="background: #fafafa;">
        <td style="padding: 10px 14px; border: 1px solid #e0e0e0; font-weight: bold;">국제 NOTAM (18개 공항)</td>
        <td style="padding: 10px 14px; border: 1px solid #e0e0e0; text-align: right;">\${rc.international}건</td>
      </tr>
      <tr style="background: white;">
        <td style="padding: 10px 14px; border: 1px solid #e0e0e0; font-weight: bold;">SNOWTAM</td>
        <td style="padding: 10px 14px; border: 1px solid #e0e0e0; text-align: right;">\${rc.snowtam}건</td>
      </tr>
      <tr style="background: #e3f2fd;">
        <td style="padding: 10px 14px; border: 1px solid #e0e0e0; font-weight: bold; font-size: 16px;">총 수집</td>
        <td style="padding: 10px 14px; border: 1px solid #e0e0e0; text-align: right; font-size: 16px; font-weight: bold; color: #0d47a1;">\${rc.total}건</td>
      </tr>
    </table>
    <p style="margin-top: 16px; color: #666; font-size: 13px;">Source: AIM Korea (aim.koca.go.kr)</p>
    <p style="margin-top: 4px; color: #666; font-size: 13px;">Supabase: <code>\${item.s3Key}</code></p>
  </div>
</div>\`;

const emailSubject = '[NOTAM] ' + dt + ' ' + ts.split('_')[1].replace(/(\\\\d{2})(\\\\d{2})(\\\\d{2})/, '$1:$2') + ' - ' + rc.total + '건 (AIM Korea)';

return [{
  json: {
    emailSubject,
    emailHtml,
    sheetRow: {
      timestamp: kstDate,
      workflow: 'AIM Korea NOTAM',
      fir_notam: rc.domestic,
      ad_notam: rc.international,
      snowtam: rc.snowtam,
      prohibited: 0,
      sequence: 0,
      total: rc.total,
      s3_path: item.s3Key,
      status: rc.total > 0 ? 'SUCCESS' : 'EMPTY'
    }
  }
}];`;


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
  console.log('Current workflow:', wf.name);
  console.log('Nodes:', wf.nodes.map(n => n.name).join(', '));

  // 1. Update workflow name
  const newName = 'AIM Korea NOTAM Realtime Crawler';

  // 2. Update node 3 code (crawl)
  const crawlNode = wf.nodes.find(n => n.name === '3. NOTAM 크롤링');
  if (crawlNode) {
    crawlNode.parameters.jsCode = newCrawlCode;
    console.log('Updated crawl code:', newCrawlCode.length, 'chars');
  } else {
    console.log('ERROR: Crawl node not found');
    return;
  }

  // 3. Update node 6 code (report)
  const reportNode = wf.nodes.find(n => n.name === '6. 리포트 생성');
  if (reportNode) {
    reportNode.parameters.jsCode = newReportCode;
    console.log('Updated report code:', newReportCode.length, 'chars');
  }

  // 4. Update connections: skip login nodes, trigger -> crawl directly
  const newConnections = {
    "5분마다 실행": {
      "main": [[{ "node": "3. NOTAM 크롤링", "type": "main", "index": 0 }]]
    },
    "3. NOTAM 크롤링": {
      "main": [[
        { "node": "4. Supabase 업로드 준비", "type": "main", "index": 0 },
        { "node": "6. 리포트 생성", "type": "main", "index": 0 }
      ]]
    },
    "4. Supabase 업로드 준비": {
      "main": [[
        { "node": "5a. Supabase 업로드 (타임스탬프)", "type": "main", "index": 0 },
        { "node": "5b. Supabase 업로드 (최신)", "type": "main", "index": 0 }
      ]]
    },
    "6. 리포트 생성": {
      "main": [[
        { "node": "7a. Gmail 알림", "type": "main", "index": 0 },
        { "node": "7b. Google Sheets 기록", "type": "main", "index": 0 }
      ]]
    }
  };

  // PATCH workflow
  const patchBody = JSON.stringify({
    name: newName,
    nodes: wf.nodes,
    connections: newConnections
  });
  const pr = await req({
    hostname: N8N_HOST,
    path: '/rest/workflows/uO4ta8EfEDbIslVY',
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(patchBody), 'Cookie': ck }
  }, patchBody);
  console.log('\nPATCH status:', pr.status);

  if (pr.status === 200) {
    const updated = JSON.parse(pr.body).data;
    console.log('Updated name:', updated.name);
    console.log('Updated versionId:', updated.versionId);

    // Deactivate and reactivate to apply changes
    // First deactivate
    const deactBody = JSON.stringify({ active: false });
    const dr = await req({
      hostname: N8N_HOST,
      path: '/rest/workflows/uO4ta8EfEDbIslVY',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(deactBody), 'Cookie': ck }
    }, deactBody);
    console.log('Deactivate status:', dr.status);

    // Then reactivate
    const actBody = JSON.stringify({ active: true });
    const ar = await req({
      hostname: N8N_HOST,
      path: '/rest/workflows/uO4ta8EfEDbIslVY',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(actBody), 'Cookie': ck }
    }, actBody);
    console.log('Reactivate status:', ar.status);

    if (ar.status === 200) {
      const final = JSON.parse(ar.body).data;
      console.log('Final active:', final.active);
      console.log('Final name:', final.name);
      console.log('\nDONE! AIM Korea crawler deployed and activated.');
      console.log('Login nodes (1, 2) are now disconnected (kept but unused).');
      console.log('Trigger -> Crawl -> Upload + Report');
    }
  } else {
    console.log('PATCH failed:', pr.body.substring(0, 500));
  }
})();
