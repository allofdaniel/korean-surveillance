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

async function download(filePath) {
  const r = await req({
    hostname: SUPABASE_HOST,
    path: '/storage/v1/object/notam-data/' + filePath.split('/').map(encodeURIComponent).join('/'),
    method: 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY
    }
  });
  return r;
}

async function listFolder(prefix) {
  const body = JSON.stringify({ prefix, limit: 200, sortBy: { column: 'name', order: 'asc' } });
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
  return [];
}

function extractNotamIds(data) {
  const ids = new Set();
  // Check fir_notam
  if (data.fir_notam) {
    for (const [series, notams] of Object.entries(data.fir_notam)) {
      if (Array.isArray(notams)) {
        notams.forEach(n => {
          if (n.id || n.notam_id || n.number) ids.add(n.id || n.notam_id || n.number);
        });
      }
    }
  }
  // Check ad_notam
  if (data.ad_notam) {
    for (const [airport, notams] of Object.entries(data.ad_notam)) {
      if (Array.isArray(notams)) {
        notams.forEach(n => {
          if (n.id || n.notam_id || n.number) ids.add(n.id || n.notam_id || n.number);
        });
      }
    }
  }
  return ids;
}

function countNotams(data) {
  let total = 0;
  const breakdown = {};

  if (data.fir_notam) {
    for (const [series, notams] of Object.entries(data.fir_notam)) {
      const count = Array.isArray(notams) ? notams.length : 0;
      breakdown['fir_' + series] = count;
      total += count;
    }
  }
  if (data.ad_notam) {
    for (const [airport, notams] of Object.entries(data.ad_notam)) {
      const count = Array.isArray(notams) ? notams.length : 0;
      breakdown['ad_' + airport] = count;
      total += count;
    }
  }
  return { total, breakdown };
}

(async () => {
  // List all files for today
  const todayFolder = new Date().toISOString().split('T')[0];
  console.log('=== Listing files for', todayFolder, '===');
  const files = await listFolder('notam_realtime/' + todayFolder + '/');
  const dataFiles = files.filter(f => f.id && f.name.startsWith('notam_') && f.name !== 'notam_latest.json');
  dataFiles.sort((a, b) => a.name.localeCompare(b.name));

  console.log('Total timestamped files:', dataFiles.length);
  dataFiles.forEach(f => console.log('  ', f.name, '| size:', f.metadata?.size || 'N/A'));

  if (dataFiles.length < 2) {
    console.log('Need at least 2 files to compare. Exiting.');
    return;
  }

  // Pick two consecutive files (last two)
  const file1Name = dataFiles[dataFiles.length - 2].name;
  const file2Name = dataFiles[dataFiles.length - 1].name;
  const path1 = 'notam_realtime/' + todayFolder + '/' + file1Name;
  const path2 = 'notam_realtime/' + todayFolder + '/' + file2Name;

  console.log('\n=== Comparing ===');
  console.log('File A:', file1Name);
  console.log('File B:', file2Name);

  // Download both
  const [dl1, dl2] = await Promise.all([download(path1), download(path2)]);

  if (dl1.status !== 200 || dl2.status !== 200) {
    console.log('Download error: A=', dl1.status, 'B=', dl2.status);
    return;
  }

  console.log('File A size:', dl1.body.length, 'chars');
  console.log('File B size:', dl2.body.length, 'chars');
  console.log('Size difference:', dl2.body.length - dl1.body.length, 'chars');
  console.log('Identical?', dl1.body === dl2.body);

  const data1 = JSON.parse(dl1.body);
  const data2 = JSON.parse(dl2.body);

  // Show top-level structure
  console.log('\n=== Data Structure ===');
  console.log('File A keys:', Object.keys(data1));
  console.log('File B keys:', Object.keys(data2));
  console.log('File A crawled_at:', data1.crawled_at);
  console.log('File B crawled_at:', data2.crawled_at);

  // Check for change/diff fields
  const changeFields = ['changes', 'diff', 'new_notams', 'removed_notams', 'modified_notams', 'delta', 'previous'];
  changeFields.forEach(f => {
    if (data1[f] !== undefined) console.log('File A has field:', f, '=', JSON.stringify(data1[f]).substring(0, 200));
    if (data2[f] !== undefined) console.log('File B has field:', f, '=', JSON.stringify(data2[f]).substring(0, 200));
  });

  // Count NOTAMs
  const count1 = countNotams(data1);
  const count2 = countNotams(data2);
  console.log('\n=== NOTAM Counts ===');
  console.log('File A total NOTAMs:', count1.total);
  console.log('File B total NOTAMs:', count2.total);

  // Compare per-section
  const allSections = new Set([...Object.keys(count1.breakdown), ...Object.keys(count2.breakdown)]);
  let diffs = [];
  for (const section of [...allSections].sort()) {
    const c1 = count1.breakdown[section] || 0;
    const c2 = count2.breakdown[section] || 0;
    if (c1 !== c2) {
      diffs.push({ section, before: c1, after: c2, change: c2 - c1 });
    }
  }

  if (diffs.length > 0) {
    console.log('\nSections with count changes:');
    diffs.forEach(d => console.log('  ', d.section, ':', d.before, '->', d.after, '(', d.change > 0 ? '+' + d.change : d.change, ')'));
  } else {
    console.log('\nNo count differences between the two files.');
  }

  // Extract and compare individual NOTAM IDs
  const ids1 = extractNotamIds(data1);
  const ids2 = extractNotamIds(data2);

  if (ids1.size > 0 || ids2.size > 0) {
    console.log('\n=== NOTAM ID Comparison ===');
    console.log('File A unique IDs:', ids1.size);
    console.log('File B unique IDs:', ids2.size);

    const added = [...ids2].filter(id => !ids1.has(id));
    const removed = [...ids1].filter(id => !ids2.has(id));

    console.log('NEW IDs (in B but not A):', added.length);
    if (added.length > 0) console.log('  ', added.slice(0, 20).join(', '));

    console.log('REMOVED IDs (in A but not B):', removed.length);
    if (removed.length > 0) console.log('  ', removed.slice(0, 20).join(', '));
  } else {
    console.log('\nCould not extract NOTAM IDs. Checking data structure...');
    // Show sample of actual data structure
    if (data1.fir_notam) {
      const firstSeries = Object.keys(data1.fir_notam)[0];
      if (firstSeries) {
        const sample = data1.fir_notam[firstSeries];
        if (Array.isArray(sample) && sample.length > 0) {
          console.log('Sample FIR NOTAM keys:', Object.keys(sample[0]));
          console.log('Sample FIR NOTAM:', JSON.stringify(sample[0]).substring(0, 500));
        }
      }
    }
    if (data1.ad_notam) {
      const firstAirport = Object.keys(data1.ad_notam)[0];
      if (firstAirport) {
        const sample = data1.ad_notam[firstAirport];
        if (Array.isArray(sample) && sample.length > 0) {
          console.log('Sample AD NOTAM keys:', Object.keys(sample[0]));
          console.log('Sample AD NOTAM:', JSON.stringify(sample[0]).substring(0, 500));
        }
      }
    }
  }

  // Also check: does the workflow store to Google Sheets for tracking?
  console.log('\n=== Summary ===');
  console.log('The crawler stores FULL SNAPSHOTS every 5 minutes.');
  console.log('Each file contains ALL current NOTAMs at that moment.');
  if (diffs.length > 0 || (ids2.size > 0 && [...ids2].filter(id => !ids1.has(id)).length > 0)) {
    console.log('CHANGES DETECTED between snapshots - the data does evolve over time.');
  } else {
    console.log('No changes between these two consecutive snapshots.');
    console.log('Changes would appear when NOTAMs are published/withdrawn by UBIKAIS.');
  }
})();
