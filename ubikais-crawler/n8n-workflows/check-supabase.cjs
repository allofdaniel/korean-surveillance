const https = require('https');
const SUPABASE_URL = 'mysfgjaggqknuhobwtrc.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15c2ZnamFnZ3FrbnVob2J3dHJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg5NjAxNSwiZXhwIjoyMDg1NDcyMDE1fQ.ke-cuuQlx6kphA7gyA3crren2ARVZHWdji-5OlKiKCM';

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const headers = { 'Authorization': 'Bearer ' + SERVICE_KEY, 'apikey': SERVICE_KEY };
    if (body) headers['Content-Type'] = 'application/json';
    const r = https.request({
      hostname: SUPABASE_URL,
      path: path,
      method: method,
      headers: headers
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

(async () => {
  const now = new Date();
  const utcDate = now.toISOString().split('T')[0];
  console.log('Current UTC time:', now.toISOString());
  console.log('Checking date folder:', utcDate);

  // Supabase Storage list requires POST with body
  const listBody = JSON.stringify({
    prefix: 'notam_realtime/' + utcDate + '/',
    limit: 20,
    sortBy: { column: 'name', order: 'desc' }
  });
  const r = await req('POST', '/storage/v1/object/list/notam-data', listBody);
  console.log('List status:', r.status);
  if (r.status !== 200) {
    console.log('List response:', r.body.substring(0, 500));
  }
  const files = JSON.parse(r.body);
  console.log('Files found:', Array.isArray(files) ? files.length : 'not array');

  if (Array.isArray(files) && files.length > 0) {
    files.slice(0, 5).forEach(f => {
      console.log('  ', f.name, '| size:', (f.metadata && f.metadata.size) || 'N/A', '| created:', f.created_at || 'N/A');
    });

    const latest = files[0];
    const filePath = 'notam_realtime/' + utcDate + '/' + latest.name;
    console.log('\nDownloading latest file:', filePath);
    const dr = await req('GET', '/storage/v1/object/notam-data/' + filePath);
    console.log('Download status:', dr.status);

    if (dr.status === 200) {
      const data = JSON.parse(dr.body);
      console.log('\nData keys:', Object.keys(data));

      if (data.domestic !== undefined) {
        console.log('FORMAT: AIM Korea (domestic/international)');
        console.log('domestic count:', Array.isArray(data.domestic) ? data.domestic.length : 'not array');
        console.log('international count:', Array.isArray(data.international) ? data.international.length : 'not array');
        if (Array.isArray(data.domestic) && data.domestic.length > 0) {
          console.log('\nSample domestic NOTAM:', JSON.stringify(data.domestic[0]).substring(0, 300));
        }
        if (Array.isArray(data.international) && data.international.length > 0) {
          console.log('\nSample international NOTAM:', JSON.stringify(data.international[0]).substring(0, 300));
        }
      } else if (data.fir_notam !== undefined) {
        console.log('FORMAT: UBIKAIS (fir_notam/ad_notam)');
        console.log('fir_notam count:', Array.isArray(data.fir_notam) ? data.fir_notam.length : 'not array');
        console.log('ad_notam count:', Array.isArray(data.ad_notam) ? data.ad_notam.length : 'not array');
      } else {
        console.log('UNKNOWN FORMAT');
        console.log('Sample:', JSON.stringify(data).substring(0, 500));
      }

      console.log('\nTimestamp:', data.timestamp || data.crawled_at || 'N/A');
      console.log('Source:', data.source || 'N/A');
    }
  } else {
    console.log('No files found for today. Checking yesterday...');
    const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
    const listBody2 = JSON.stringify({
      prefix: 'notam_realtime/' + yesterday + '/',
      limit: 5,
      sortBy: { column: 'name', order: 'desc' }
    });
    const r2 = await req('POST', '/storage/v1/object/list/notam-data', listBody2);
    const files2 = JSON.parse(r2.body);
    console.log('Yesterday (' + yesterday + ') files:', Array.isArray(files2) ? files2.length : 'error');
    if (Array.isArray(files2) && files2.length > 0) {
      files2.slice(0, 3).forEach(f => console.log('  ', f.name, '| created:', f.created_at || 'N/A'));
    }
  }
})();
