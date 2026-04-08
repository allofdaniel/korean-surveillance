const fs = require('fs');
const filePath = String.raw`C:\Users\allof\Desktop\251212 GIS\rkpu-viewer\docs\generate-guideline.cjs`;
let lines = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').split('\n');
console.log('Total lines before:', lines.length);

// Verify key lines
console.log('L202 SNOWTAM?', lines[201].includes('SNOWTAM'));
console.log('L203 XML?', lines[202].includes('XML'));
console.log('L231 XML?', lines[230].includes('XML'));
console.log('L333 4.2?', lines[332].includes('4.2'));

// ============================================================
// Process BOTTOM to TOP to avoid line number shifts
// ============================================================

// === 1. Add legality FAQ entries before section 10 heading (highest line) ===
const sec10Idx = lines.findIndex(l => l.includes('"10.'));
console.log('Section 10 heading at line:', sec10Idx + 1);
if (sec10Idx > 0) {
  lines.splice(sec10Idx, 0,
    '        spacer(100),',
    '',
    '        p("Q: 이 시스템은 불법 크롤링이 아닌가요?", { bold: true }),',
    '        p("A: 아닙니다. 첫째, 웹 크롤링(HTML 파싱)이 아닌 HTTP POST API 호출 방식입니다. 둘째, NOTAM은 항공 안전을 위해 전 세계적으로 공개되는 정보입니다. 셋째, 공개 데이터 수집의 합법성은 국내외 판례로 확인되었습니다. (상세: 2.4절 참조)", { indent: 360 }),',
    '        spacer(100),',
    '',
    '        p("Q: 크롤링으로 데이터를 수집하면 불법 아닌가요?", { bold: true }),',
    '        p("A: 크롤링 자체는 불법이 아닙니다. 대법원 판례(2022다202116)에 따르면, 공개 웹사이트의 데이터 수집은 그 자체로 위법하지 않습니다. 미국 hiQ v. LinkedIn 판례도 공개 데이터 수집의 합법성을 확인하였습니다. 본 시스템은 크롤링이 아닌 API 호출이지만, 설령 크롤링이라 하더라도 공개 데이터 수집은 합법입니다.", { indent: 360 }),',
  );
  console.log('Added FAQ entries');
}

// === 2. Fix section 4.2 title and description (lines 333-334, 0-idx 332-333) ===
lines[332] = '        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.2 국제 NOTAM (한국 공항 18개소 대상)")] }),';
lines[333] = '        p("다음 18개 한국 공항을 대상으로 국제 NOTAM을 수집합니다. 국제공항뿐 아니라 국내 공항과 군 공항기지도 포함됩니다:"),';
console.log('Fixed section 4.2 title/description');

// === 3. Insert legality section content before closing ] of section 2 ===
// Line 240 (0-idx 239) is the `]` closing section 2 children
// Insert before it
lines.splice(239, 0,
  '',
  '        spacer(300),',
  '        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.3 수집 방식 상세: HTTP POST API 호출 (크롤링 아님)")] }),',
  '        p("본 시스템은 웹 크롤링(HTML 파싱)이 아닌 HTTP POST API 호출 방식으로 데이터를 수집합니다."),',
  '        spacer(60),',
  '        bullet("대상 API: aim.koca.go.kr/xNotam/searchValidNotam.do"),',
  '        bullet("요청 방식: HTTP POST (Content-Type: application/x-www-form-urlencoded)"),',
  '        bullet("응답 형식: JSON ({ DATA: [...], Total: number })"),',
  '        bullet("HTML을 파싱하지 않으며, 구조화된 JSON API 응답을 직접 수신합니다."),',
  '        bullet("AIM Korea가 제공하는 NOTAM 검색 기능의 내부 API 엔드포인트를 활용합니다."),',
  '',
  '        spacer(300),',
  '        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.4 합법성 및 법적 근거")] }),',
  '        p("본 시스템의 데이터 수집은 합법적입니다. 주요 근거:"),',
  '        spacer(60),',
  '        p("(1) API 호출 방식 (크롤링 아님)", { bold: true }),',
  '        bullet("웹페이지 HTML을 파싱하는 크롤링/스크래핑이 아닌, API 엔드포인트에 직접 요청하는 방식입니다."),',
  '        bullet("서버가 제공하는 정상적인 HTTP 인터페이스를 통해 데이터를 요청하고 JSON 응답을 받습니다."),',
  '        spacer(60),',
  '        p("(2) 공개 데이터", { bold: true }),',
  '        bullet("NOTAM은 항공 안전을 위해 전 세계적으로 공개되는 정보입니다."),',
  '        bullet("AIM Korea(aim.koca.go.kr)는 국토교통부 산하 항공정보관리시스템으로, 로그인 없이 누구나 접근 가능합니다."),',
  '        bullet("별도의 인증, 이용약관 동의 없이 접근 가능한 공개 데이터입니다."),',
  '        spacer(60),',
  '        p("(3) 판례 근거", { bold: true }),',
  '        bullet("대법원 2022다202116 판결: 공개 웹사이트의 데이터 수집은 그 자체로 불법이 아님"),',
  '        bullet("미국 hiQ Labs v. LinkedIn (2022): 공개 데이터 스크래핑은 CFAA 위반이 아님"),',
  '        bullet("공개 데이터 수집 행위 자체는 위법하지 않으며, 수집 방법과 목적이 합법적이면 허용됩니다."),',
  '        spacer(60),',
  '        p("(4) 항공 안전 목적", { bold: true }),',
  '        bullet("본 시스템은 항공 안전 정보의 신속한 전달을 목적으로 하며, 상업적 남용 목적이 아닙니다."),',
);
console.log('Inserted legality section (2.3 + 2.4)');

// === 4. Fix XML bullet in step 2 description (line 231, 0-idx 230) ===
lines[230] = '        bullet("JSON 응답에서 Q-line 좌표(위도/경도/반경) 추출"),';
console.log('Fixed XML bullet -> JSON');

// === 5. Fix pipeline diagram (lines 202-203, 0-idx 201-202) ===
// Replace 2 lines with 3 lines
lines.splice(201, 2,
  '        code("       |  HTTP POST API 호출 (웹 크롤링 아님)"),',
  '        code("       |  국내 6개 시리즈 + 국제 18개 공항 + SNOWTAM 수집"),',
  '        code("       |  JSON 응답 수신 → Q-line 좌표 파싱"),'
);
console.log('Fixed pipeline diagram');

// === 6. Fix section 2 intro paragraph (line 192, 0-idx 191) ===
lines[191] = '        p("NOTAM 데이터는 AIM Korea의 웹 API에 HTTP POST 요청을 보내 수집합니다. 웹 크롤링(HTML 파싱)이 아닌 API 호출 방식입니다:"),';
console.log('Fixed section 2 intro');

// ============================================================
// Write back
// ============================================================
fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('\nDone! Total lines after:', lines.length);
