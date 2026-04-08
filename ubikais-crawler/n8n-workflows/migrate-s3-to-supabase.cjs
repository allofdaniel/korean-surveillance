// S3 노드를 Supabase Storage HTTP Request 노드로 변환하는 스크립트
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://mysfgjaggqknuhobwtrc.supabase.co';
const SUPABASE_BUCKET = 'notam-data';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15c2ZnamFnZ3FrbnVob2J3dHJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTg5NjAxNSwiZXhwIjoyMDg1NDcyMDE1fQ.ke-cuuQlx6kphA7gyA3crren2ARVZHWdji-5OlKiKCM';

function makeSupabaseUploadNode(originalNode, filePathExpression) {
  return {
    parameters: {
      method: 'POST',
      url: `=${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${filePathExpression}`,
      sendBody: true,
      contentType: 'binaryData',
      inputDataFieldName: 'data',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'apikey', value: SERVICE_ROLE_KEY },
          { name: 'Authorization', value: 'Bearer ' + SERVICE_ROLE_KEY },
          { name: 'x-upsert', value: 'true' }
        ]
      },
      options: {}
    },
    id: originalNode.id,
    name: originalNode.name.replace('S3', 'Supabase'),
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: originalNode.position
    // credentials 제거 (Supabase는 헤더로 인증)
  };
}

function migrateWorkflow(filePath) {
  console.log('\n=== Processing:', path.basename(filePath), '===');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const wf = JSON.parse(raw);

  // 1. S3 노드를 HTTP Request 노드로 변환
  wf.nodes = wf.nodes.map(node => {
    if (node.type === 'n8n-nodes-base.awsS3') {
      const fileName = node.parameters.fileName; // "={{ $json.s3Key }}" 등
      // 표현식에서 "={{ ... }}" 형태의 값 추출
      let pathExpr;
      if (fileName && fileName.startsWith('={{')) {
        // "={{ $json.s3Key }}" → "{{ $json.s3Key }}" (= prefix 제거)
        pathExpr = fileName.substring(1); // "{{ $json.s3Key }}"
      } else {
        pathExpr = fileName || '';
      }
      console.log(`  Replacing S3 node "${node.name}" → Supabase HTTP Request`);
      console.log(`    File path expression: ${pathExpr}`);
      return makeSupabaseUploadNode(node, pathExpr);
    }
    return node;
  });

  // 2. 노드 이름에서 "S3" → "Supabase" 변경
  // 먼저 이전 이름 → 새 이름 매핑 생성
  const nameMap = {};
  wf.nodes.forEach(node => {
    const oldName = node.name.replace('Supabase', 'S3'); // 이미 변환된 것의 원래 이름
    if (oldName !== node.name) {
      nameMap[oldName] = node.name;
    }
  });
  console.log('  Name map:', JSON.stringify(nameMap));

  // 3. connections에서 노드 이름 업데이트
  if (wf.connections) {
    const newConnections = {};
    for (const [key, value] of Object.entries(wf.connections)) {
      const newKey = nameMap[key] || key;
      // value 내부의 node 참조도 변경
      const newValue = JSON.parse(
        JSON.stringify(value).replace(
          /("node"\s*:\s*")([^"]*S3[^"]*")/g,
          (match, prefix, nameWithQuote) => {
            const nodeName = nameWithQuote.slice(0, -1);
            const newName = nameMap[nodeName] || nodeName;
            return prefix + newName + '"';
          }
        )
      );
      newConnections[newKey] = newValue;
    }
    wf.connections = newConnections;
  }

  // 4. Code 노드 내 jsCode에서 "S3" 텍스트를 "Supabase" 로 변경
  wf.nodes.forEach(node => {
    if (node.type === 'n8n-nodes-base.code' && node.parameters && node.parameters.jsCode) {
      if (node.parameters.jsCode.includes('S3')) {
        node.parameters.jsCode = node.parameters.jsCode
          .replace(/S3 업로드/g, 'Supabase 업로드')
          .replace(/S3경로/g, 'Storage경로')
          .replace(/S3 경로/g, 'Storage 경로')
          .replace(/S3:/g, 'Supabase Storage:')
          .replace(/S3: /g, 'Supabase Storage: ');
        console.log(`  Updated jsCode in "${node.name}"`);
      }
    }

    // 4b. S3 업로드 준비 노드 이름 변경
    if (node.name.includes('S3')) {
      const oldName = node.name;
      node.name = node.name.replace(/S3/g, 'Supabase');
      if (oldName !== node.name) {
        nameMap[oldName] = node.name;
        console.log(`  Renamed node: "${oldName}" → "${node.name}"`);
      }
    }
  });

  // 5. connections 재처리 (코드 노드 이름 변경 반영)
  if (wf.connections) {
    const finalConnections = {};
    for (const [key, value] of Object.entries(wf.connections)) {
      const newKey = nameMap[key] || key;
      const newValue = JSON.parse(
        JSON.stringify(value, (k, v) => {
          if (k === 'node' && typeof v === 'string' && nameMap[v]) {
            return nameMap[v];
          }
          return v;
        })
      );
      finalConnections[newKey] = newValue;
    }
    wf.connections = finalConnections;
  }

  // 6. Google Sheets 컬럼 이름에서 S3 → Storage 변경
  // (이메일 HTML과 sheets row에서)
  const output = JSON.stringify(wf, null, 2);

  // 저장
  fs.writeFileSync(filePath, output, 'utf-8');
  console.log('  Saved:', filePath);

  // 검증
  const verify = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const s3Nodes = verify.nodes.filter(n => n.type === 'n8n-nodes-base.awsS3');
  const httpNodes = verify.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest');
  console.log(`  Verification: ${s3Nodes.length} S3 nodes remaining, ${httpNodes.length} HTTP Request nodes`);
}

// 두 워크플로우 파일 처리
const dir = __dirname;
migrateWorkflow(path.join(dir, 'ubikais-notam-realtime.json'));
migrateWorkflow(path.join(dir, 'ubikais-full-crawl.json'));

console.log('\n=== Migration Complete ===');
