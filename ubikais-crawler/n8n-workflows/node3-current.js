// ===== AIM Korea NOTAM 크롤링 + 변경 감지 =====
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
if (prevData && !prevData.domestic) {
  // Previous data is in old UBIKAIS format - skip change detection for transition
  prevData = null;
}

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

// ===== 4단계: Supabase Storage 업로드 (직접 수행) =====
const jsonString = JSON.stringify(allData, null, 2);
const s3Key = 'notam_realtime/' + today + '/notam_' + timestamp + '.json';
const s3KeyLatest = 'notam_realtime/' + today + '/notam_latest.json';

let uploadResults = { timestamp: null, latest: null };
try {
  // Upload timestamped file
  const tsResp = await helpers.httpRequest({
    url: SUPABASE_URL + '/storage/v1/object/notam-data/' + s3Key,
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'x-upsert': 'true'
    },
    body: jsonString,
    json: false
  });
  uploadResults.timestamp = { status: 'ok', key: s3Key, response: typeof tsResp === 'string' ? tsResp.substring(0, 200) : JSON.stringify(tsResp).substring(0, 200) };
} catch (e) {
  uploadResults.timestamp = { status: 'error', error: e.message };
}

try {
  // Upload latest file (overwrite)
  const ltResp = await helpers.httpRequest({
    url: SUPABASE_URL + '/storage/v1/object/notam-data/' + s3KeyLatest,
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'x-upsert': 'true'
    },
    body: jsonString,
    json: false
  });
  uploadResults.latest = { status: 'ok', key: s3KeyLatest, response: typeof ltResp === 'string' ? ltResp.substring(0, 200) : JSON.stringify(ltResp).substring(0, 200) };
} catch (e) {
  uploadResults.latest = { status: 'error', error: e.message };
}

return [{
  json: {
    s3Key: s3Key,
    s3KeyLatest: s3KeyLatest,
    timestamp: timestamp,
    date: today,
    recordCounts: {
      domestic: domesticTotal,
      international: intlTotal,
      snowtam: snowCount,
      total: totalRecords
    },
    changeCount: changeCount,
    hasChanges: changeCount > 0,
    uploadResults: uploadResults
  }
}];