const fs = require('fs');
const filePath = String.raw`C:\Users\allof\Desktop\251212 GIS\rkpu-viewer\docs\generate-guideline.cjs`;
let lines = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').split('\n');
console.log('Total lines:', lines.length);

const BASE_URL = "https://ugzsuswrazaimvpyloqw.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnenN1c3dyYXphaW12cHlsb3F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5OTg3NzQsImV4cCI6MjA4NTU3NDc3NH0.5V1O5HEAyQp5Gaj6lIFb5yZffs0Et4UGgUhGb2Xp--U";

// Find section 6 (사용 예시) - search for "6.1"
const sec61Idx = lines.findIndex(l => l.includes('"6.1'));
console.log('Section 6.1 at line:', sec61Idx + 1);

if (sec61Idx > 0) {
  // Insert browser access section BEFORE 6.1 cURL 예시
  const browserContent = [
    '        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6.0 웹 브라우저에서 바로 확인")] }),',
    '        p("별도의 프로그래밍 없이 웹 브라우저 주소창에 아래 URL을 입력하면 바로 JSON 결과를 확인할 수 있습니다."),',
    '        p("apikey 파라미터를 URL에 포함하면 브라우저에서 직접 접근이 가능합니다.", { italic: true, color: "2C5F8A" }),',
    '        spacer(100),',
    '',
    '        p("(1) 최신 NOTAM 10건 조회:", { bold: true }),',
    `        code("${BASE_URL}/rest/v1/notams"),`,
    `        code("  ?select=notam_number,location,e_text,series"),`,
    `        code("  &order=crawled_at.desc&limit=10"),`,
    `        code("  &apikey=${ANON_KEY}"),`,
    '        spacer(60),',
    '        p("위 URL을 브라우저 주소창에 한 줄로 이어 붙여 입력하세요.", { italic: true, color: "666666", indent: 360 }),',
    '',
    '        spacer(100),',
    '        p("(2) 인천공항(RKSI) NOTAM만 조회:", { bold: true }),',
    `        code("${BASE_URL}/rest/v1/notams"),`,
    `        code("  ?location=eq.RKSI&order=crawled_at.desc&limit=20"),`,
    `        code("  &apikey=${ANON_KEY}"),`,
    '',
    '        spacer(100),',
    '        p("(3) 시스템 상태 확인 (총 건수, 최신 수집 시간):", { bold: true }),',
    `        code("${BASE_URL}/rest/v1/rpc/get_notam_status"),`,
    `        code("  ?apikey=${ANON_KEY}"),`,
    '        spacer(60),',
    '        p("POST가 필요한 RPC 함수는 브라우저 주소창으로는 호출이 안 됩니다. 위 get_notam_status는 GET으로도 가능하도록 설정되어 있습니다.", { italic: true, color: "666666", indent: 360 }),',
    '',
    '        spacer(100),',
    '        p("(4) 좌표가 있는 NOTAM만 조회:", { bold: true }),',
    `        code("${BASE_URL}/rest/v1/notams"),`,
    `        code("  ?q_lat=not.is.null&q_lon=not.is.null&limit=30"),`,
    `        code("  &apikey=${ANON_KEY}"),`,
    '',
    '        spacer(200),',
    `        p("팁: 브라우저에서 JSON이 보기 불편하면 Chrome 확장 프로그램 'JSON Viewer'를 설치하면 보기 좋게 표시됩니다.", { italic: true, color: "2C5F8A" }),`,
    '',
    '        spacer(300),',
  ];

  lines.splice(sec61Idx, 0, ...browserContent);
  console.log('Inserted browser access section before 6.1');
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Done! Total lines:', lines.length);
