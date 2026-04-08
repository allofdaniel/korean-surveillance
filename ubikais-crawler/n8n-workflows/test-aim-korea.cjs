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

function supaPost(path, body) {
  const SUPABASE_HOST = 'mysfgjaggqknuhobwtrc.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15c2ZnamFnZ3FrbnVob2J3dHJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg5NjAxNSwiZXhwIjoyMDg1NDcyMDE1fQ.ke-cuuQlx6kphA7gyA3crren2ARVZHWdji-5OlKiKCM';
  const bodyStr = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const r = https.request({
      hostname: SUPABASE_HOST,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.on('error', reject);
    r.write(bodyStr);
    r.end();
  });
}

function supaGet(path) {
  const SUPABASE_HOST = 'mysfgjaggqknuhobwtrc.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15c2ZnamFnZ3FrbnVob2J3dHJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg5NjAxNSwiZXhwIjoyMDg1NDcyMDE1fQ.ke-cuuQlx6kphA7gyA3crren2ARVZHWdji-5OlKiKCM';
  return new Promise((resolve, reject) => {
    https.get({
      hostname: SUPABASE_HOST,
      path: path,
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject);
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

  // Test larger page size
  console.log('=== AIM Korea: Page 500 ===');
  const params500 = 'sch_inorout=D&sch_from_date=' + fromDate + '&sch_from_time=' + h + min + '&sch_to_date=' + fromDate + '&sch_to_time=' + h + min + '&sch_airport=&sch_series=&sch_select=&Page=500';
  const r500 = await post('/xNotam/searchValidNotam.do', params500);
  const data500 = JSON.parse(r500.body);
  console.log('Total with Page=500:', data500.DATA.length);

  // Count by series
  const bySeries = {};
  data500.DATA.forEach(n => {
    bySeries[n.SERIES] = (bySeries[n.SERIES] || 0) + 1;
  });
  console.log('By series:', JSON.stringify(bySeries));

  // Check an old UBIKAIS date that had data
  console.log('\n=== Check UBIKAIS from older dates ===');
  const dates = ['2026-01-29', '2026-01-28', '2026-01-27'];
  for (const dt of dates) {
    const listR = await supaPost('/storage/v1/object/list/notam-data', {
      prefix: 'notam_realtime/' + dt + '/',
      limit: 5,
      sortBy: { column: 'name', order: 'desc' }
    });
    const files = JSON.parse(listR.body);
    const goodFiles = files.filter(f => f.id && f.name.startsWith('notam_') && f.name !== 'notam_latest.json');
    if (goodFiles.length > 0) {
      const gf = goodFiles[0];
      console.log('\n' + dt + ': ' + gf.name + ' | size:', gf.metadata?.size);

      if (gf.metadata && gf.metadata.size > 500) {
        const path = '/storage/v1/object/notam-data/notam_realtime/' + dt + '/' + encodeURIComponent(gf.name);
        const oldR = await supaGet(path);
        if (oldR.status === 200) {
          const oldData = JSON.parse(oldR.body);
          let total = 0;
          const sections = {};
          for (const [section, sdata] of Object.entries(oldData)) {
            if (section === 'crawled_at' || section === 'changes') continue;
            if (sdata && typeof sdata === 'object') {
              const items = Array.isArray(sdata) ? sdata : (sdata.items || sdata.data || []);
              if (Array.isArray(items)) {
                total += items.length;
                sections[section] = items.length;
                if (items.length > 0 && !items[0].NOTAM_NO) {
                  console.log('  Sample keys:', Object.keys(items[0]).join(', '));
                  console.log('  Sample:', JSON.stringify(items[0]).substring(0, 300));
                }
              }
            }
          }
          console.log('  Total UBIKAIS NOTAMs:', total);
          console.log('  By section:', JSON.stringify(sections));
        }
      }
    } else {
      console.log(dt + ': no timestamped files');
    }
  }
})();
