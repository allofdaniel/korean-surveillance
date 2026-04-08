const https = require('https');

const SUPABASE_HOST = 'mysfgjaggqknuhobwtrc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15c2ZnamFnZ3FrbnVob2J3dHJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg5NjAxNSwiZXhwIjoyMDg1NDcyMDE1fQ.ke-cuuQlx6kphA7gyA3crren2ARVZHWdji-5OlKiKCM';

function req(opts, body) {
  return new Promise((resolve, reject) => {
    const r = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

async function listFolder(prefix) {
  const body = JSON.stringify({ prefix, limit: 100 });
  const r = await req({
    hostname: SUPABASE_HOST,
    path: '/storage/v1/object/list/notam-data',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY
    }
  }, body);
  if (r.status === 200) return JSON.parse(r.body);
  console.log('Error listing', prefix, ':', r.status, r.body);
  return [];
}

(async () => {
  // Drill into notam_realtime/2026-01-29/
  console.log('=== notam_realtime/2026-01-29/ ===');
  const files = await listFolder('notam_realtime/2026-01-29/');
  console.log('Items:', files.length);
  files.forEach(f => {
    if (f.id) {
      console.log('  FILE:', f.name, '| size:', f.metadata?.size || 'N/A', '| mimetype:', f.metadata?.mimetype || 'N/A', '| created:', f.created_at);
    } else {
      console.log('  FOLDER:', f.name);
    }
  });

  // Check if there are also notam_realtime/latest files
  console.log('\n=== notam_realtime/latest/ ===');
  const latestFiles = await listFolder('notam_realtime/latest/');
  console.log('Items:', latestFiles.length);
  latestFiles.forEach(f => {
    if (f.id) {
      console.log('  FILE:', f.name, '| size:', f.metadata?.size || 'N/A', '| created:', f.created_at);
    } else {
      console.log('  FOLDER:', f.name);
    }
  });

  // Also check root-level "latest" (no prefix folder)
  console.log('\n=== latest/ (root level) ===');
  const rootLatest = await listFolder('latest/');
  console.log('Items:', rootLatest.length);
  rootLatest.forEach(f => {
    if (f.id) {
      console.log('  FILE:', f.name, '| size:', f.metadata?.size || 'N/A');
    } else {
      console.log('  FOLDER:', f.name);
    }
  });

  // Check root again for any files
  console.log('\n=== Root level files ===');
  const rootFiles = await listFolder('');
  console.log('Items:', rootFiles.length);
  rootFiles.forEach(f => {
    if (f.id) {
      console.log('  FILE:', f.name, '| size:', f.metadata?.size || 'N/A');
    } else {
      console.log('  FOLDER:', f.name);
    }
  });

  // Download a sample file to verify content
  if (files.length > 0 && files[0].id) {
    const fileName = 'notam_realtime/2026-01-29/' + files[0].name;
    console.log('\n=== Sample file content (first 500 chars) ===');
    console.log('Path:', fileName);
    const dlr = await req({
      hostname: SUPABASE_HOST,
      path: '/storage/v1/object/notam-data/' + encodeURIComponent(fileName),
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY
      }
    });
    console.log('Download status:', dlr.status);
    console.log('Content:', dlr.body.substring(0, 500));
  }
})();
