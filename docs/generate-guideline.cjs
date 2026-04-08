const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat, ExternalHyperlink,
        HeadingLevel, BorderStyle, WidthType, ShadingType, VerticalAlign,
        PageNumber, PageBreak } = require('docx');

// === CONFIG ===
const BASE_URL = "https://ugzsuswrazaimvpyloqw.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnenN1c3dyYXphaW12cHlsb3F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5OTg3NzQsImV4cCI6MjA4NTU3NDc3NH0.5V1O5HEAyQp5Gaj6lIFb5yZffs0Et4UGgUhGb2Xp--U";

// === Helpers ===
const TB = { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" };
const CB = { top: TB, bottom: TB, left: TB, right: TB };

function cell(text, opts = {}) {
  const { bold, width, shading, align, font, size: sz, color } = opts;
  return new TableCell({
    borders: CB,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: shading ? { fill: shading, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: align || AlignmentType.LEFT,
      spacing: { before: 40, after: 40 },
      children: [new TextRun({ text, bold: bold || false, font: font || "Malgun Gothic", size: sz || 20, color: color || "333333" })]
    })]
  });
}

function headerCell(text, width) {
  return cell(text, { bold: true, width, shading: "1B3A5C", color: "FFFFFF", align: AlignmentType.CENTER });
}

function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    spacing: { before: opts.before || 80, after: opts.after || 80 },
    indent: opts.indent ? { left: opts.indent } : undefined,
    children: [new TextRun({ text, font: opts.font || "Malgun Gothic", size: opts.size || 22, bold: opts.bold || false, color: opts.color || "333333", italics: opts.italic || false })]
  });
}

function bullet(text, opts = {}) {
  return new Paragraph({
    numbering: { reference: "bullet", level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, font: "Malgun Gothic", size: opts.size || 22, bold: opts.bold || false, color: opts.color || "333333" })]
  });
}

function code(text) {
  return new Paragraph({
    spacing: { before: 20, after: 20 },
    indent: { left: 360 },
    shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
    children: [new TextRun({ text, font: "Consolas", size: 18, color: "333333" })]
  });
}

function spacer(h = 200) { return new Paragraph({ spacing: { before: h, after: 0 }, children: [] }); }
function hr() {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC", space: 1 } },
    children: []
  });
}

const sharedHeader = new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "NOTAM API Guideline v2.0", font: "Malgun Gothic", size: 16, color: "999999", italics: true })] })] });
const sharedFooter = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Page ", font: "Malgun Gothic", size: 16, color: "999999" }), new TextRun({ children: [PageNumber.CURRENT], font: "Malgun Gothic", size: 16, color: "999999" }), new TextRun({ text: " / ", font: "Malgun Gothic", size: 16, color: "999999" }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Malgun Gothic", size: 16, color: "999999" })] })] });
const pageProps = { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } };

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Malgun Gothic", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 36, bold: true, color: "1B3A5C", font: "Malgun Gothic" }, paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 28, bold: true, color: "2C5F8A", font: "Malgun Gothic" }, paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullet", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [
    // ===== COVER =====
    {
      properties: pageProps,
      children: [
        spacer(2400),
        p("NOTAM Data Service", { align: AlignmentType.CENTER, size: 20, color: "2C5F8A", bold: true }),
        spacer(200),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "NOTAM API", font: "Malgun Gothic", size: 72, bold: true, color: "1B3A5C" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: "Guideline", font: "Malgun Gothic", size: 52, bold: true, color: "3A7CB8" })] }),
        spacer(100),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(Revision 2.0 - Supabase PostgREST)", font: "Malgun Gothic", size: 24, color: "666666" })] }),
        spacer(600),
        hr(),
        spacer(100),
        p("AIM Korea XNOTAM \uB370\uC774\uD130 \uC790\uB3D9 \uC218\uC9D1 \uBC0F API \uC81C\uACF5 \uC2DC\uC2A4\uD15C", { align: AlignmentType.CENTER, size: 22, color: "555555" }),
        p("5\uBD84 \uC8FC\uAE30 \uC790\uB3D9 \uC218\uC9D1 / Supabase PostgreSQL / PostgREST API", { align: AlignmentType.CENTER, size: 20, color: "777777" }),
        spacer(600),
        hr(),
        p("M&S Section, SW Development Team", { align: AlignmentType.CENTER, size: 20, color: "555555" }),
        p("\uD56D\uACF5\uAE30\uC220\uC5F0\uAD6C\uC6D0", { align: AlignmentType.CENTER, size: 20, color: "555555" }),
        spacer(200),
        p("2026-02-02", { align: AlignmentType.CENTER, size: 20, color: "999999" }),
      ]
    },

    // ===== CREDENTIALS =====
    {
      properties: pageProps,
      headers: { default: sharedHeader },
      footers: { default: sharedFooter },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("\uAC1C\uC815 \uC774\uB825")] }),
        new Table({
          columnWidths: [2000, 1500, 5860],
          rows: [
            new TableRow({ tableHeader: true, children: [headerCell("\uB0A0\uC9DC", 2000), headerCell("\uBC84\uC804", 1500), headerCell("\uC124\uBA85", 5860)] }),
            new TableRow({ children: [cell("2026-02-02", { width: 2000 }), cell("2.0", { width: 1500 }), cell("Supabase PostgREST API \uAC00\uC774\uB4DC\uB77C\uC778 (\uD55C\uAD6D\uC5B4)", { width: 5860 })] }),
          ]
        }),

        spacer(400),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("API \uC778\uC99D \uC815\uBCF4 (\uC911\uC694)")] }),
        p("\uBAA8\uB4E0 API \uC694\uCCAD\uC5D0\uB294 \uC544\uB798 \uD5E4\uB354\uAC00 \uBC18\uB4DC\uC2DC \uD3EC\uD568\uB418\uC5B4\uC57C \uD569\uB2C8\uB2E4.", { bold: true, color: "C62828" }),
        p("API Key(anon key)\uB294 \uC77D\uAE30 \uC804\uC6A9\uC774\uBA70, \uBAA8\uB4E0 \uC694\uCCAD\uC5D0 \uD3EC\uD568\uD574\uC57C \uD569\uB2C8\uB2E4.", { color: "C62828" }),
        spacer(60),

        new Table({
          columnWidths: [2400, 7000],
          rows: [
            new TableRow({ tableHeader: true, children: [headerCell("\uD56D\uBAA9", 2400), headerCell("\uAC12", 7000)] }),
            new TableRow({ children: [cell("Base URL", { width: 2400, bold: true }), cell(BASE_URL, { width: 7000, font: "Consolas", size: 18 })] }),
            new TableRow({ children: [cell("API Key (anon)", { width: 2400, bold: true }), cell(ANON_KEY, { width: 7000, font: "Consolas", size: 14 })] }),
          ]
        }),

        spacer(200),
        p("\uD544\uC218 \uD5E4\uB354:", { bold: true }),
        code(`apikey: <\uC704\uC758 ANON_KEY \uAC12>`),
        code(`Authorization: Bearer <\uC704\uC758 ANON_KEY \uAC12>`),

        spacer(200),
        p("\uCC38\uACE0: anon key\uB294 \uC77D\uAE30 \uC804\uC6A9\uC785\uB2C8\uB2E4. \uB370\uC774\uD130 \uC218\uC815/\uC0AD\uC81C\uB294 \uBD88\uAC00\uB2A5\uD569\uB2C8\uB2E4.", { italic: true, color: "666666" }),
      ]
    },

    // ===== 1. \uAC1C\uC694 =====
    {
      properties: pageProps,
      headers: { default: sharedHeader },
      footers: { default: sharedFooter },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. \uAC1C\uC694")] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1.1 NOTAM\uC774\uB780?")] }),
        p("NOTAM(Notice to Airmen)\uC740 \uD56D\uACF5 \uB2F9\uAD6D\uC774 \uC870\uC885\uC0AC\uC5D0\uAC8C \uBE44\uD589\uC5D0 \uC601\uD5A5\uC744 \uC8FC\uB294 \uC870\uAC74\uC744 \uC54C\uB9AC\uB294 \uACF5\uC9C0\uC785\uB2C8\uB2E4."),
        spacer(60),
        bullet("\uD65C\uC8FC\uB85C \uD3D0\uC1C4, \uACF5\uC5ED \uC81C\uD55C, \uD56D\uBC95\uC2DC\uC124 \uC7A5\uC560, \uC7A5\uC560\uBB3C \uC124\uCE58 \uB4F1\uC758 \uC815\uBCF4\uAC00 \uD3EC\uD568\uB429\uB2C8\uB2E4."),
        bullet("\uC870\uC885\uC0AC\uB294 \uBE44\uD589 \uC804 \uBC18\uB4DC\uC2DC NOTAM\uC744 \uD655\uC778\uD574\uC57C \uD569\uB2C8\uB2E4."),
        bullet("\uBCF8 API\uB294 AIM Korea(aim.koca.go.kr)\uC5D0\uC11C NOTAM \uB370\uC774\uD130\uB97C 5\uBD84\uB9C8\uB2E4 \uC790\uB3D9 \uC218\uC9D1\uD558\uC5EC \uC81C\uACF5\uD569\uB2C8\uB2E4."),

        spacer(200),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1.2 \uC2DC\uC2A4\uD15C \uC694\uC57D")] }),
        new Table({
          columnWidths: [2800, 6560],
          rows: [
            new TableRow({ tableHeader: true, children: [headerCell("\uD56D\uBAA9", 2800), headerCell("\uC124\uBA85", 6560)] }),
            new TableRow({ children: [cell("\uB370\uC774\uD130 \uCD9C\uCC98", { width: 2800, bold: true }), cell("AIM Korea (aim.koca.go.kr) - \uAD6D\uD1A0\uAD50\uD1B5\uBD80/\uD56D\uACF5\uC815\uBCF4\uAD00\uB9AC\uC2DC\uC2A4\uD15C", { width: 6560 })] }),
            new TableRow({ children: [cell("\uC218\uC9D1 \uC8FC\uAE30", { width: 2800, bold: true }), cell("5\uBD84\uB9C8\uB2E4 \uC790\uB3D9 \uC218\uC9D1 (pg_cron + Supabase Edge Function)", { width: 6560 })] }),
            new TableRow({ children: [cell("\uB370\uC774\uD130\uBCA0\uC774\uC2A4", { width: 2800, bold: true }), cell("Supabase PostgreSQL (\uC11C\uC6B8 \uB9AC\uC804, ap-northeast-2)", { width: 6560 })] }),
            new TableRow({ children: [cell("API \uBC29\uC2DD", { width: 2800, bold: true }), cell("Supabase PostgREST (PostgreSQL\uC5D0\uC11C \uC790\uB3D9 \uC0DD\uC131\uB418\uB294 REST API)", { width: 6560 })] }),
            new TableRow({ children: [cell("\uC778\uC99D", { width: 2800, bold: true }), cell("anon key\uB97C \uD5E4\uB354\uC5D0 \uD3EC\uD568 (\uC778\uC99D \uC815\uBCF4 \uD398\uC774\uC9C0 \uCC38\uACE0)", { width: 6560 })] }),
            new TableRow({ children: [cell("\uC751\uB2F5 \uD615\uC2DD", { width: 2800, bold: true }), cell("JSON", { width: 6560 })] }),
            new TableRow({ children: [cell("\uB370\uC774\uD130 \uAC74\uC218", { width: 2800, bold: true }), cell("260\uAC74 \uC774\uC0C1 (\uC2E4\uC2DC\uAC04 \uBCC0\uB3D9)", { width: 6560 })] }),
          ]
        }),
      ]
    },

    // ===== 2. \uB370\uC774\uD130 \uD750\uB984 =====
    {
      properties: pageProps,
      headers: { default: sharedHeader },
      footers: { default: sharedFooter },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("2. \uB370\uC774\uD130\uAC00 \uC5B4\uB5BB\uAC8C \uC624\uB294\uAC00?")] }),
        p("NOTAM 데이터는 AIM Korea의 웹 API에 HTTP POST 요청을 보내 수집합니다. 웹 크롤링(HTML 파싱)이 아닌 API 호출 방식입니다:"),
        spacer(100),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.1 \uD30C\uC774\uD504\uB77C\uC778 \uD750\uB984\uB3C4")] }),
        code("[1] AIM Korea API  (aim.koca.go.kr/xNotam)"),
        code("       |"),
        code("       |  5\uBD84\uB9C8\uB2E4 pg_cron\uC774 \uC790\uB3D9 \uD638\uCD9C"),
        code("       v"),
        code("[2] Supabase Edge Function  (notam-crawler)"),
        code("       |"),
        code("       |  HTTP POST API 호출 (웹 크롤링 아님)"),
        code("       |  국내 6개 시리즈 + 국제 18개 공항 + SNOWTAM 수집"),
        code("       |  JSON 응답 수신 → Q-line 좌표 파싱"),
        code("       |  \uC911\uBCF5 \uC81C\uAC70 (notam_number \uAE30\uC900)"),
        code("       |  PostgreSQL\uC5D0 UPSERT (\uC0BD\uC785 \uB610\uB294 \uC5C5\uB370\uC774\uD2B8)"),
        code("       v"),
        code("[3] PostgreSQL DB  (notams \uD14C\uC774\uBE14, 260\uAC74+)"),
        code("       |"),
        code("       |  PostgREST\uAC00 \uC790\uB3D9\uC73C\uB85C REST API \uC0DD\uC131"),
        code("       v"),
        code("[4] PostgREST API  <-- \uC5EC\uAE30\uC11C \uB370\uC774\uD130\uB97C \uBC1B\uC2B5\uB2C8\uB2E4"),
        code("       |"),
        code("       v"),
        code("[5] \uC0AC\uC6A9\uC790 \uC560\uD50C\uB9AC\uCF00\uC774\uC158  (\uBE0C\uB77C\uC6B0\uC800 / \uC11C\uBC84 / \uC2A4\uD06C\uB9BD\uD2B8)"),

        spacer(200),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.2 \uAC01 \uB2E8\uACC4 \uC124\uBA85")] }),

        p("1\uB2E8\uACC4: \uB370\uC774\uD130 \uC218\uC9D1 (pg_cron)", { bold: true }),
        bullet("PostgreSQL \uB0B4\uC7A5 \uD655\uC7A5\uC778 pg_cron\uC774 5\uBD84\uB9C8\uB2E4 Edge Function\uC744 \uD638\uCD9C\uD569\uB2C8\uB2E4."),
        bullet("pg_net\uC744 \uD1B5\uD574 HTTP POST \uC694\uCCAD\uC744 \uBCF4\uB0C5\uB2C8\uB2E4."),
        bullet("\uC778\uC99D \uD5E4\uB354(CRON_SECRET)\uB85C \uBCF4\uC548\uC744 \uC720\uC9C0\uD569\uB2C8\uB2E4."),

        spacer(100),
        p("2\uB2E8\uACC4: Edge Function (notam-crawler)", { bold: true }),
        bullet("Supabase\uC5D0\uC11C \uC2E4\uD589\uB418\uB294 Deno \uB7F0\uD0C0\uC784 \uD568\uC218\uC785\uB2C8\uB2E4."),
        bullet("AIM Korea\uC758 xNotam API\uC5D0\uC11C \uB370\uC774\uD130\uB97C \uAC00\uC838\uC635\uB2C8\uB2E4."),
        bullet("\uAD6D\uB0B4 6\uAC1C \uC2DC\uB9AC\uC988(A, C, D, E, G, Z) \uC218\uC9D1"),
        bullet("\uAD6D\uC81C 18\uAC1C \uACF5\uD56D(RKSI, RKSS, RKPK, RKPC \uB4F1) \uC218\uC9D1"),
        bullet("SNOWTAM(\uD65C\uC8FC\uB85C \uC801\uC124 \uC0C1\uD0DC \uBCF4\uACE0) \uC218\uC9D1"),
        bullet("JSON 응답에서 Q-line 좌표(위도/경도/반경) 추출"),
        bullet("UPSERT: \uC0C8 NOTAM\uC740 \uC0BD\uC785, \uAE30\uC874 NOTAM\uC740 \uC5C5\uB370\uC774\uD2B8 (notam_number \uAE30\uC900)"),

        spacer(100),
        p("3\uB2E8\uACC4: PostgREST API", { bold: true }),
        bullet("PostgreSQL \uD14C\uC774\uBE14\uC5D0\uC11C \uC790\uB3D9\uC73C\uB85C REST \uC5D4\uB4DC\uD3EC\uC778\uD2B8\uAC00 \uC0DD\uC131\uB429\uB2C8\uB2E4."),
        bullet("URL \uD30C\uB77C\uBBF8\uD130\uB85C \uD544\uD130\uB9C1 \uAC00\uB2A5 (eq, gte, lte, like, in \uB4F1)"),
        bullet("RPC \uD568\uC218\uB85C \uBCF5\uC7A1\uD55C \uAC80\uC0C9 \uAC00\uB2A5 (search_notams, get_notam_status)"),
        bullet("anon key\uB85C \uC77D\uAE30 \uC804\uC6A9 \uC811\uADFC"),

        spacer(300),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.3 수집 방식 상세: HTTP POST API 호출 (크롤링 아님)")] }),
        p("본 시스템은 웹 크롤링(HTML 파싱)이 아닌 HTTP POST API 호출 방식으로 데이터를 수집합니다."),
        spacer(60),
        bullet("대상 API: aim.koca.go.kr/xNotam/searchValidNotam.do"),
        bullet("요청 방식: HTTP POST (Content-Type: application/x-www-form-urlencoded)"),
        bullet("응답 형식: JSON ({ DATA: [...], Total: number })"),
        bullet("HTML을 파싱하지 않으며, 구조화된 JSON API 응답을 직접 수신합니다."),
        bullet("AIM Korea가 제공하는 NOTAM 검색 기능의 내부 API 엔드포인트를 활용합니다."),

        spacer(300),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.4 합법성 및 법적 근거")] }),
        p("본 시스템의 데이터 수집은 합법적입니다. 주요 근거:"),
        spacer(60),
        p("(1) API 호출 방식 (크롤링 아님)", { bold: true }),
        bullet("웹페이지 HTML을 파싱하는 크롤링/스크래핑이 아닌, API 엔드포인트에 직접 요청하는 방식입니다."),
        bullet("서버가 제공하는 정상적인 HTTP 인터페이스를 통해 데이터를 요청하고 JSON 응답을 받습니다."),
        spacer(60),
        p("(2) 공개 데이터", { bold: true }),
        bullet("NOTAM은 항공 안전을 위해 전 세계적으로 공개되는 정보입니다."),
        bullet("AIM Korea(aim.koca.go.kr)는 국토교통부 산하 항공정보관리시스템으로, 로그인 없이 누구나 접근 가능합니다."),
        bullet("별도의 인증, 이용약관 동의 없이 접근 가능한 공개 데이터입니다."),
        spacer(60),
        p("(3) 판례 근거", { bold: true }),
        bullet("대법원 2022다202116 판결: 공개 웹사이트의 데이터 수집은 그 자체로 불법이 아님"),
        bullet("미국 hiQ Labs v. LinkedIn (2022): 공개 데이터 스크래핑은 CFAA 위반이 아님"),
        bullet("공개 데이터 수집 행위 자체는 위법하지 않으며, 수집 방법과 목적이 합법적이면 허용됩니다."),
        spacer(60),
        p("(4) 항공 안전 목적", { bold: true }),
        bullet("본 시스템은 항공 안전 정보의 신속한 전달을 목적으로 하며, 상업적 남용 목적이 아닙니다."),
      ]
    },

    // ===== 3. \uC5B4\uB5A4 \uB370\uC774\uD130\uAC00 \uC788\uB294\uAC00? =====
    {
      properties: pageProps,
      headers: { default: sharedHeader },
      footers: { default: sharedFooter },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3. \uC5B4\uB5A4 \uB370\uC774\uD130\uAC00 \uC788\uB294\uAC00?")] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.1 NOTAM \uB808\uCF54\uB4DC \uD544\uB4DC")] }),
        p("\uAC01 NOTAM \uB808\uCF54\uB4DC\uC5D0\uB294 \uB2E4\uC74C \uD544\uB4DC\uAC00 \uD3EC\uD568\uB429\uB2C8\uB2E4:"),
        spacer(60),

        new Table({
          columnWidths: [2200, 1200, 6000],
          rows: [
            new TableRow({ tableHeader: true, children: [headerCell("\uD544\uB4DC\uBA85", 2200), headerCell("\uD0C0\uC785", 1200), headerCell("\uC124\uBA85", 6000)] }),
            new TableRow({ children: [cell("notam_number", { width: 2200, font: "Consolas", size: 18 }), cell("string", { width: 1200 }), cell("NOTAM \uACE0\uC720 \uBC88\uD638 (\uC608: A0123/26) - \uAE30\uBCF8\uD0A4(PK)", { width: 6000 })] }),
            new TableRow({ children: [cell("location", { width: 2200, font: "Consolas", size: 18 }), cell("string", { width: 1200 }), cell("ICAO \uACF5\uD56D \uCF54\uB4DC (\uC608: RKSI=\uC778\uCC9C, RKSS=\uAE40\uD3EC, RKRR=\uC778\uCC9C FIR)", { width: 6000 })] }),
            new TableRow({ children: [cell("full_text", { width: 2200, font: "Consolas", size: 18 }), cell("text", { width: 1200 }), cell("NOTAM \uC6D0\uBB38 \uC804\uCCB4 (Q/A/B/C/D/E/F/G \uB77C\uC778 \uD3EC\uD568)", { width: 6000 })] }),
            new TableRow({ children: [cell("e_text", { width: 2200, font: "Consolas", size: 18 }), cell("string", { width: 1200 }), cell("E) \uD56D\uBAA9 - \uC0AC\uB78C\uC774 \uC77D\uC744 \uC218 \uC788\uB294 \uC694\uC57D (\uC608: 'RWY 06L/24R CLSD')", { width: 6000 })] }),
            new TableRow({ children: [cell("qcode", { width: 2200, font: "Consolas", size: 18 }), cell("string", { width: 1200 }), cell("Q-\uCF54\uB4DC (\uC608: QMRLC=\uD65C\uC8FC\uB85C\uD3D0\uC1C4, QFATT=\uBE44\uD589\uC7A5)", { width: 6000 })] }),
            new TableRow({ children: [cell("qcode_mean", { width: 2200, font: "Consolas", size: 18 }), cell("string", { width: 1200 }), cell("Q-\uCF54\uB4DC \uC758\uBBF8 (\uC608: 'Runway closed')", { width: 6000 })] }),
            new TableRow({ children: [cell("effective_start", { width: 2200, font: "Consolas", size: 18 }), cell("string", { width: 1200 }), cell("\uC2DC\uC791 \uC2DC\uAC04 (YYMMDDHHMM \uD615\uC2DD, \uC608: 2602010000)", { width: 6000 })] }),
            new TableRow({ children: [cell("effective_end", { width: 2200, font: "Consolas", size: 18 }), cell("string", { width: 1200 }), cell("\uC885\uB8CC \uC2DC\uAC04 (YYMMDDHHMM \uB610\uB294 'PERM' = \uC601\uAD6C\uC801)", { width: 6000 })] }),
            new TableRow({ children: [cell("series", { width: 2200, font: "Consolas", size: 18 }), cell("string", { width: 1200 }), cell("NOTAM \uC2DC\uB9AC\uC988: A / C / D / E / G / Z / S", { width: 6000 })] }),
            new TableRow({ children: [cell("fir", { width: 2200, font: "Consolas", size: 18 }), cell("string", { width: 1200 }), cell("FIR \uCF54\uB4DC (RKRR = \uC778\uCC9C \uBE44\uD589\uC815\uBCF4\uAD6C\uC5ED)", { width: 6000 })] }),
            new TableRow({ children: [cell("q_lat", { width: 2200, font: "Consolas", size: 18 }), cell("float|null", { width: 1200 }), cell("\uC704\uB3C4 (\uC2ED\uC9C4\uBC95, \uC608: 37.46) - Q-line\uC5D0\uC11C \uCD94\uCD9C", { width: 6000 })] }),
            new TableRow({ children: [cell("q_lon", { width: 2200, font: "Consolas", size: 18 }), cell("float|null", { width: 1200 }), cell("\uACBD\uB3C4 (\uC2ED\uC9C4\uBC95, \uC608: 126.43) - Q-line\uC5D0\uC11C \uCD94\uCD9C", { width: 6000 })] }),
            new TableRow({ children: [cell("q_radius_nm", { width: 2200, font: "Consolas", size: 18 }), cell("int|null", { width: 1200 }), cell("\uBC18\uACBD (\uD574\uB9AC, nautical miles)", { width: 6000 })] }),
            new TableRow({ children: [cell("source_type", { width: 2200, font: "Consolas", size: 18 }), cell("string", { width: 1200 }), cell("\uCD9C\uCC98 \uAD6C\uBD84: domestic(\uAD6D\uB0B4) / international(\uAD6D\uC81C) / snowtam", { width: 6000 })] }),
            new TableRow({ children: [cell("source_group", { width: 2200, font: "Consolas", size: 18 }), cell("string", { width: 1200 }), cell("\uCD9C\uCC98 \uADF8\uB8F9: \uC2DC\uB9AC\uC988 \uBB38\uC790(A,C,D...) \uB610\uB294 \uACF5\uD56D ICAO \uCF54\uB4DC", { width: 6000 })] }),
            new TableRow({ children: [cell("crawled_at", { width: 2200, font: "Consolas", size: 18 }), cell("timestamp", { width: 1200 }), cell("\uC218\uC9D1 \uC2DC\uAC04 (UTC, \uC608: 2026-02-02T06:30:00+00:00)", { width: 6000 })] }),
          ]
        }),

        spacer(300),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.2 NOTAM \uC6D0\uBB38 \uAD6C\uC870 (full_text)")] }),
        p("NOTAM \uC6D0\uBB38(full_text)\uC740 \uB2E4\uC74C\uACFC \uAC19\uC740 \uD45C\uC900 \uB77C\uC778\uC73C\uB85C \uAD6C\uC131\uB429\uB2C8\uB2E4:"),
        spacer(60),
        new Table({
          columnWidths: [1200, 8160],
          rows: [
            new TableRow({ tableHeader: true, children: [headerCell("\uB77C\uC778", 1200), headerCell("\uC758\uBBF8", 8160)] }),
            new TableRow({ children: [cell("Q)", { width: 1200, bold: true, font: "Consolas" }), cell("\uD55C\uC815\uC790: FIR/Q\uCF54\uB4DC/\uBC94\uC704/\uD558\uD55C-\uC0C1\uD55C\uACE0\uB3C4/\uC88C\uD45C+\uBC18\uACBD", { width: 8160 })] }),
            new TableRow({ children: [cell("A)", { width: 1200, bold: true, font: "Consolas" }), cell("\uC704\uCE58: \uD574\uB2F9 ICAO \uACF5\uD56D/\uC9C0\uC5ED \uCF54\uB4DC", { width: 8160 })] }),
            new TableRow({ children: [cell("B)", { width: 1200, bold: true, font: "Consolas" }), cell("\uC2DC\uC791 \uC2DC\uAC04 (YYMMDDHHMM)", { width: 8160 })] }),
            new TableRow({ children: [cell("C)", { width: 1200, bold: true, font: "Consolas" }), cell("\uC885\uB8CC \uC2DC\uAC04 (YYMMDDHHMM \uB610\uB294 PERM)", { width: 8160 })] }),
            new TableRow({ children: [cell("D)", { width: 1200, bold: true, font: "Consolas" }), cell("\uC2A4\uCF00\uC904 \uC0C1\uC138 (\uC120\uD0DD\uC0AC\uD56D, \uC608: 'MON-FRI 0100-0600')", { width: 8160 })] }),
            new TableRow({ children: [cell("E)", { width: 1200, bold: true, font: "Consolas" }), cell("\uBCF8\uBB38 \uB0B4\uC6A9 - \uC0AC\uB78C\uC774 \uC77D\uC744 \uC218 \uC788\uB294 \uC124\uBA85 (\uAC00\uC7A5 \uC911\uC694)", { width: 8160 })] }),
            new TableRow({ children: [cell("F)", { width: 1200, bold: true, font: "Consolas" }), cell("\uD558\uD55C \uACE0\uB3C4 (\uC120\uD0DD\uC0AC\uD56D)", { width: 8160 })] }),
            new TableRow({ children: [cell("G)", { width: 1200, bold: true, font: "Consolas" }), cell("\uC0C1\uD55C \uACE0\uB3C4 (\uC120\uD0DD\uC0AC\uD56D)", { width: 8160 })] }),
          ]
        }),

        spacer(200),
        p("\uC608\uC2DC (full_text):", { bold: true }),
        code("Q) RKRR/QMRLC/IV/NBO/A/000/999/3546N12656E005"),
        code("A) RKSI"),
        code("B) 2602010000 C) 2602150600"),
        code("E) RWY 15R/33L CLSD DUE TO MAINT"),
        spacer(60),
        p("-> \uC778\uCC9C\uACF5\uD56D \uD65C\uC8FC\uB85C 15R/33L \uC815\uBE44\uB85C \uC778\uD55C \uD3D0\uC1C4", { italic: true, color: "2C5F8A" }),
      ]
    },

    // ===== 4. \uC218\uC9D1 \uBC94\uC704 =====
    {
      properties: pageProps,
      headers: { default: sharedHeader },
      footers: { default: sharedFooter },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("4. \uC218\uC9D1 \uBC94\uC704")] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.1 \uAD6D\uB0B4 NOTAM (6\uAC1C \uC2DC\uB9AC\uC988)")] }),
        p("AIM Korea\uC5D0\uC11C \uB2E4\uC74C 6\uAC1C \uC2DC\uB9AC\uC988\uC758 \uAD6D\uB0B4 NOTAM\uC744 \uC218\uC9D1\uD569\uB2C8\uB2E4:"),
        spacer(60),
        new Table({
          columnWidths: [1000, 2000, 3000, 3400],
          rows: [
            new TableRow({ tableHeader: true, children: [headerCell("\uC2DC\uB9AC\uC988", 1000), headerCell("\uBD84\uB958", 2000), headerCell("\uB0B4\uC6A9", 3000), headerCell("\uC608\uC2DC", 3400)] }),
            new TableRow({ children: [cell("A", { width: 1000, bold: true }), cell("FIR / \uACF5\uC5ED", { width: 2000 }), cell("\uACF5\uC5ED \uC81C\uD55C, \uBE44\uD589\uAE08\uC9C0\uAD6C\uC5ED, \uAD70\uC0AC\uAD6C\uC5ED", { width: 3000 }), cell("DMZ \uC778\uADFC \uC784\uC2DC \uBE44\uD589\uC81C\uD55C\uAD6C\uC5ED", { width: 3400 })] }),
            new TableRow({ children: [cell("C", { width: 1000, bold: true }), cell("\uD1B5\uC2E0 / \uD56D\uBC95", { width: 2000 }), cell("\uD56D\uBC95\uC2DC\uC124 \uC7A5\uC560, \uC8FC\uD30C\uC218 \uBCC0\uACBD", { width: 3000 }), cell("VOR/DME \uC815\uBE44, \uC8FC\uD30C\uC218 \uBCC0\uACBD", { width: 3400 })] }),
            new TableRow({ children: [cell("D", { width: 1000, bold: true }), cell("\uBE44\uD589\uC7A5 \uC2DC\uC124", { width: 2000 }), cell("\uD65C\uC8FC\uB85C \uD3D0\uC1C4, \uC720\uB3C4\uB85C, \uC870\uBA85", { width: 3000 }), cell("RWY 06L/24R \uC815\uBE44\uB85C \uC778\uD55C \uD3D0\uC1C4", { width: 3400 })] }),
            new TableRow({ children: [cell("E", { width: 1000, bold: true }), cell("\uD56D\uD589 (\uAC00\uC7A5 \uB9CE\uC74C)", { width: 2000 }), cell("\uC7A5\uC560\uBB3C, \uC808\uCC28, \uC704\uD5D8\uC694\uC18C", { width: 3000 }), cell("\uC811\uADFC \uACBD\uB85C \uADFC\uCC98 \uD06C\uB808\uC778 \uC124\uCE58", { width: 3400 })] }),
            new TableRow({ children: [cell("G", { width: 1000, bold: true }), cell("\uAE30\uD0C0", { width: 2000 }), cell("\uAE30\uD0C0 \uD56D\uACF5 \uACF5\uC9C0", { width: 3000 }), cell("\uACE1\uC608\uBE44\uD589, \uB099\uD558\uC0B0 \uAC15\uD558", { width: 3400 })] }),
            new TableRow({ children: [cell("Z", { width: 1000, bold: true }), cell("\uD2B8\uB9AC\uAC70 / \uCC38\uC870", { width: 2000 }), cell("AIRAC \uAC1C\uC815 \uD2B8\uB9AC\uAC70", { width: 3000 }), cell("AIP \uAC1C\uC815 \uC2DC\uD589\uC77C \uC548\uB0B4", { width: 3400 })] }),
          ]
        }),

        spacer(300),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.2 국제 NOTAM (한국 공항 18개소 대상)")] }),
        p("다음 18개 한국 공항을 대상으로 국제 NOTAM을 수집합니다. 국제공항뿐 아니라 국내 공항과 군 공항기지도 포함됩니다:"),
        spacer(60),
        new Table({
          columnWidths: [1200, 2400, 1200, 2400, 2200],
          rows: [
            new TableRow({ tableHeader: true, children: [headerCell("ICAO", 1200), headerCell("\uACF5\uD56D\uBA85", 2400), headerCell("ICAO", 1200), headerCell("\uACF5\uD56D\uBA85", 2400), headerCell("", 2200)] }),
            new TableRow({ children: [cell("RKSI", { width: 1200, bold: true, font: "Consolas" }), cell("\uC778\uCC9C\uAD6D\uC81C\uACF5\uD56D", { width: 2400 }), cell("RKSS", { width: 1200, bold: true, font: "Consolas" }), cell("\uAE40\uD3EC\uAD6D\uC81C\uACF5\uD56D", { width: 2400 }), cell("", { width: 2200 })] }),
            new TableRow({ children: [cell("RKPK", { width: 1200, bold: true, font: "Consolas" }), cell("\uAE40\uD574\uAD6D\uC81C\uACF5\uD56D", { width: 2400 }), cell("RKPC", { width: 1200, bold: true, font: "Consolas" }), cell("\uC81C\uC8FC\uAD6D\uC81C\uACF5\uD56D", { width: 2400 }), cell("", { width: 2200 })] }),
            new TableRow({ children: [cell("RKPS", { width: 1200, bold: true, font: "Consolas" }), cell("\uC0AC\uCC9C\uACF5\uD56D", { width: 2400 }), cell("RKPU", { width: 1200, bold: true, font: "Consolas" }), cell("\uC6B8\uC0B0\uACF5\uD56D", { width: 2400 }), cell("", { width: 2200 })] }),
            new TableRow({ children: [cell("RKSM", { width: 1200, bold: true, font: "Consolas" }), cell("\uC11C\uC6B8\uACF5\uD56D\uAE30\uC9C0", { width: 2400 }), cell("RKTH", { width: 1200, bold: true, font: "Consolas" }), cell("\uD3EC\uD56D/\uACBD\uC8FC\uACF5\uD56D", { width: 2400 }), cell("", { width: 2200 })] }),
            new TableRow({ children: [cell("RKPD", { width: 1200, bold: true, font: "Consolas" }), cell("\uB300\uAD6C\uAD6D\uC81C\uACF5\uD56D", { width: 2400 }), cell("RKTL", { width: 1200, bold: true, font: "Consolas" }), cell("\uC6B8\uC9C4\uACF5\uD56D", { width: 2400 }), cell("", { width: 2200 })] }),
            new TableRow({ children: [cell("RKTU", { width: 1200, bold: true, font: "Consolas" }), cell("\uCCAD\uC8FC\uAD6D\uC81C\uACF5\uD56D", { width: 2400 }), cell("RKNW", { width: 1200, bold: true, font: "Consolas" }), cell("\uC6D0\uC8FC\uACF5\uD56D", { width: 2400 }), cell("", { width: 2200 })] }),
            new TableRow({ children: [cell("RKJK", { width: 1200, bold: true, font: "Consolas" }), cell("\uAD70\uC0B0\uACF5\uD56D\uAE30\uC9C0", { width: 2400 }), cell("RKJB", { width: 1200, bold: true, font: "Consolas" }), cell("\uBB34\uC548\uAD6D\uC81C\uACF5\uD56D", { width: 2400 }), cell("", { width: 2200 })] }),
            new TableRow({ children: [cell("RKJY", { width: 1200, bold: true, font: "Consolas" }), cell("\uC5EC\uC218\uACF5\uD56D", { width: 2400 }), cell("RKJJ", { width: 1200, bold: true, font: "Consolas" }), cell("\uAD11\uC8FC\uACF5\uD56D", { width: 2400 }), cell("", { width: 2200 })] }),
            new TableRow({ children: [cell("RKTN", { width: 1200, bold: true, font: "Consolas" }), cell("\uAE40\uD574(\uAD70\uC0AC)", { width: 2400 }), cell("RKNY", { width: 1200, bold: true, font: "Consolas" }), cell("\uC591\uC591\uAD6D\uC81C\uACF5\uD56D", { width: 2400 }), cell("", { width: 2200 })] }),
          ]
        }),

        spacer(300),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.3 SNOWTAM (\uC801\uC124 \uBCF4\uACE0)")] }),
        p("SNOWTAM\uC740 \uD65C\uC8FC\uB85C\uC758 \uB208/\uC5BC\uC74C \uC0C1\uD0DC\uB97C \uBCF4\uACE0\uD558\uB294 \uD2B9\uC218 NOTAM\uC785\uB2C8\uB2E4."),
        bullet("\uC2DC\uB9AC\uC988 'S'\uB85C \uC218\uC9D1\uB429\uB2C8\uB2E4."),
        bullet("\uD65C\uC8FC\uB85C \uB9C8\uCC30\uB825/\uC81C\uB3D9 \uC815\uBCF4\uAC00 \uD3EC\uD568\uB429\uB2C8\uB2E4."),
        bullet("\uC8FC\uB85C \uACA8\uC6B8\uCCA0(11\uC6D4~3\uC6D4)\uC5D0 \uBC1C\uD589\uB429\uB2C8\uB2E4."),
      ]
    },

    // ===== 5. \uB370\uC774\uD130\uB97C \uC5B4\uB5BB\uAC8C \uBC1B\uB294\uAC00? =====
    {
      properties: pageProps,
      headers: { default: sharedHeader },
      footers: { default: sharedFooter },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("5. \uB370\uC774\uD130\uB97C \uC5B4\uB5BB\uAC8C \uBC1B\uB294\uAC00?")] }),

        p("PostgREST API\uB294 \uB2E4\uC74C 3\uAC1C \uC5D4\uB4DC\uD3EC\uC778\uD2B8\uB97C \uC81C\uACF5\uD569\uB2C8\uB2E4:"),
        spacer(60),
        new Table({
          columnWidths: [600, 3200, 5560],
          rows: [
            new TableRow({ tableHeader: true, children: [headerCell("#", 600), headerCell("\uC5D4\uB4DC\uD3EC\uC778\uD2B8", 3200), headerCell("\uC124\uBA85", 5560)] }),
            new TableRow({ children: [cell("1", { width: 600, align: AlignmentType.CENTER }), cell("GET /rest/v1/notams", { width: 3200, font: "Consolas", size: 18 }), cell("\uD14C\uC774\uBE14 \uC9C1\uC811 \uC870\uD68C - \uAE30\uBCF8\uC801\uC774\uACE0 \uC720\uC5F0\uD55C \uD544\uD130\uB9C1", { width: 5560 })] }),
            new TableRow({ children: [cell("2", { width: 600, align: AlignmentType.CENTER }), cell("POST /rest/v1/rpc/search_notams", { width: 3200, font: "Consolas", size: 18 }), cell("\uACE0\uAE09 \uAC80\uC0C9 - \uC9C0\uC5ED \uBC94\uC704, \uAE30\uAC04, \uC2DC\uB9AC\uC988 \uD544\uD130\uB9C1", { width: 5560 })] }),
            new TableRow({ children: [cell("3", { width: 600, align: AlignmentType.CENTER }), cell("POST /rest/v1/rpc/get_notam_status", { width: 3200, font: "Consolas", size: 18 }), cell("\uC2DC\uC2A4\uD15C \uC0C1\uD0DC - \uCD1D \uAC74\uC218, \uCD5C\uC2E0 \uC218\uC9D1 \uC2DC\uAC04, \uD1B5\uACC4", { width: 5560 })] }),
          ]
        }),

        // 5.1
        spacer(300),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5.1 \uD14C\uC774\uBE14 \uC9C1\uC811 \uC870\uD68C (GET /rest/v1/notams)")] }),
        p("NOTAM \uB370\uC774\uD130\uB97C \uC870\uD68C\uD558\uB294 \uAC00\uC7A5 \uAE30\uBCF8\uC801\uC778 \uBC29\uBC95\uC785\uB2C8\uB2E4. URL \uD30C\uB77C\uBBF8\uD130\uB85C \uD544\uD130\uB9C1\uD569\uB2C8\uB2E4."),
        spacer(100),

        p("\uC0AC\uC6A9 \uAC00\uB2A5\uD55C \uD30C\uB77C\uBBF8\uD130:", { bold: true }),
        new Table({
          columnWidths: [2400, 7000],
          rows: [
            new TableRow({ tableHeader: true, children: [headerCell("\uD30C\uB77C\uBBF8\uD130", 2400), headerCell("\uC124\uBA85 \uBC0F \uC608\uC2DC", 7000)] }),
            new TableRow({ children: [cell("select", { width: 2400, font: "Consolas", size: 18 }), cell("\uBC18\uD658\uD560 \uCEEC\uB7FC. \uC608: select=notam_number,location,e_text", { width: 7000 })] }),
            new TableRow({ children: [cell("order", { width: 2400, font: "Consolas", size: 18 }), cell("\uC815\uB82C \uC21C\uC11C. \uC608: order=crawled_at.desc (\uCD5C\uC2E0\uC21C)", { width: 7000 })] }),
            new TableRow({ children: [cell("limit", { width: 2400, font: "Consolas", size: 18 }), cell("\uCD5C\uB300 \uD589 \uC218. \uC608: limit=50 (\uAE30\uBCF8: \uC804\uCCB4)", { width: 7000 })] }),
            new TableRow({ children: [cell("location", { width: 2400, font: "Consolas", size: 18 }), cell("ICAO \uCF54\uB4DC \uD544\uD130. \uC608: location=eq.RKSI (\uC778\uCC9C\uACF5\uD56D\uB9CC)", { width: 7000 })] }),
            new TableRow({ children: [cell("series", { width: 2400, font: "Consolas", size: 18 }), cell("\uC2DC\uB9AC\uC988 \uD544\uD130. \uC608: series=eq.A (A \uC2DC\uB9AC\uC988\uB9CC)", { width: 7000 })] }),
            new TableRow({ children: [cell("q_lat", { width: 2400, font: "Consolas", size: 18 }), cell("\uC704\uB3C4 \uD544\uD130. \uC608: q_lat=gte.33&q_lat=lte.38 (\uD55C\uBC18\uB3C4 \uBC94\uC704)", { width: 7000 })] }),
            new TableRow({ children: [cell("q_lon", { width: 2400, font: "Consolas", size: 18 }), cell("\uACBD\uB3C4 \uD544\uD130. \uC608: q_lon=gte.124&q_lon=lte.132", { width: 7000 })] }),
            new TableRow({ children: [cell("source_type", { width: 2400, font: "Consolas", size: 18 }), cell("\uCD9C\uCC98 \uD544\uD130: source_type=eq.domestic / eq.international / eq.snowtam", { width: 7000 })] }),
          ]
        }),
        spacer(60),
        p("\uD301: \uD5E4\uB354\uC5D0 'Prefer: count=exact'\uB97C \uCD94\uAC00\uD558\uBA74 Content-Range \uC751\uB2F5 \uD5E4\uB354\uC5D0\uC11C \uCD1D \uAC74\uC218\uB97C \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.", { italic: true, color: "2C5F8A" }),

        // 5.2
        spacer(300),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5.2 \uACE0\uAE09 \uAC80\uC0C9 (POST /rest/v1/rpc/search_notams)")] }),
        p("\uC11C\uBC84 \uCE21\uC5D0\uC11C \uC9C0\uC5ED \uBC94\uC704\uC640 \uAE30\uAC04 \uD544\uD130\uB9C1\uC744 \uCC98\uB9AC\uD558\uB294 \uACE0\uAE09 \uAC80\uC0C9 \uD568\uC218\uC785\uB2C8\uB2E4."),
        spacer(60),

        new Table({
          columnWidths: [2200, 1200, 6000],
          rows: [
            new TableRow({ tableHeader: true, children: [headerCell("\uD30C\uB77C\uBBF8\uD130", 2200), headerCell("\uD0C0\uC785", 1200), headerCell("\uC124\uBA85", 6000)] }),
            new TableRow({ children: [cell("p_south", { width: 2200, font: "Consolas", size: 18 }), cell("float", { width: 1200 }), cell("\uB0A8\uCABD \uC704\uB3C4 (\uC608: 33.0 = \uD55C\uBC18\uB3C4 \uB0A8\uB2E8)", { width: 6000 })] }),
            new TableRow({ children: [cell("p_west", { width: 2200, font: "Consolas", size: 18 }), cell("float", { width: 1200 }), cell("\uC11C\uCABD \uACBD\uB3C4 (\uC608: 124.0)", { width: 6000 })] }),
            new TableRow({ children: [cell("p_north", { width: 2200, font: "Consolas", size: 18 }), cell("float", { width: 1200 }), cell("\uBD81\uCABD \uC704\uB3C4 (\uC608: 38.0 = \uD55C\uBC18\uB3C4 \uBD81\uB2E8)", { width: 6000 })] }),
            new TableRow({ children: [cell("p_east", { width: 2200, font: "Consolas", size: 18 }), cell("float", { width: 1200 }), cell("\uB3D9\uCABD \uACBD\uB3C4 (\uC608: 132.0)", { width: 6000 })] }),
            new TableRow({ children: [cell("p_period", { width: 2200, font: "Consolas", size: 18 }), cell("string", { width: 1200 }), cell("'all'(\uAE30\uBCF8: \uC804\uCCB4) / 'current'(\uD604\uC7AC \uC720\uD6A8\uD55C \uAC83\uB9CC)", { width: 6000 })] }),
            new TableRow({ children: [cell("p_series", { width: 2200, font: "Consolas", size: 18 }), cell("string", { width: 1200 }), cell("\uC2DC\uB9AC\uC988 \uD544\uD130: A, C, D, E, G, Z (\uC120\uD0DD\uC0AC\uD56D)", { width: 6000 })] }),
            new TableRow({ children: [cell("p_location", { width: 2200, font: "Consolas", size: 18 }), cell("string", { width: 1200 }), cell("ICAO \uCF54\uB4DC \uD544\uD130 (\uC608: RKSI) (\uC120\uD0DD\uC0AC\uD56D)", { width: 6000 })] }),
            new TableRow({ children: [cell("p_limit", { width: 2200, font: "Consolas", size: 18 }), cell("int", { width: 1200 }), cell("\uCD5C\uB300 \uACB0\uACFC \uC218 (\uAE30\uBCF8: 1000)", { width: 6000 })] }),
          ]
        }),
        spacer(60),
        p("\uBAA8\uB4E0 \uD30C\uB77C\uBBF8\uD130\uB294 \uC120\uD0DD\uC0AC\uD56D\uC785\uB2C8\uB2E4. {}\uB97C \uBCF4\uB0B4\uBA74 \uC804\uCCB4 NOTAM\uC744 \uBC18\uD658\uD569\uB2C8\uB2E4.", { italic: true, color: "666666" }),

        // 5.3
        spacer(300),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5.3 \uC2DC\uC2A4\uD15C \uC0C1\uD0DC (POST /rest/v1/rpc/get_notam_status)")] }),
        p("\uC2DC\uC2A4\uD15C \uAC74\uAC15 \uC0C1\uD0DC\uC640 \uD1B5\uACC4\uB97C \uBC18\uD658\uD569\uB2C8\uB2E4. \uD30C\uB77C\uBBF8\uD130 \uC5C6\uC774 \uD638\uCD9C\uD569\uB2C8\uB2E4."),
        spacer(60),
        p("\uC751\uB2F5 \uD3EC\uD568 \uD56D\uBAA9:", { bold: true }),
        bullet("total_notams: DB\uC5D0 \uC800\uC7A5\uB41C \uCD1D NOTAM \uC218"),
        bullet("latest_crawl: \uB9C8\uC9C0\uB9C9 \uB370\uC774\uD130 \uC218\uC9D1 \uC2DC\uAC04 (UTC)"),
        bullet("series_counts: \uC2DC\uB9AC\uC988\uBCC4 NOTAM \uC218 (A, C, D, E, G, Z)"),
        bullet("source_counts: \uCD9C\uCC98\uBCC4 NOTAM \uC218 (\uAD6D\uB0B4, \uAD6D\uC81C)"),
        bullet("last_crawl_log: \uCD5C\uC2E0 \uC218\uC9D1 \uB85C\uADF8 (\uC0C1\uD0DC, upsert \uC218, \uC2E4\uD589 \uC2DC\uAC04)"),
      ]
    },

    // ===== 6. \uC0AC\uC6A9 \uC608\uC2DC =====
    {
      properties: pageProps,
      headers: { default: sharedHeader },
      footers: { default: sharedFooter },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("6. \uC0AC\uC6A9 \uC608\uC2DC")] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6.0 웹 브라우저에서 바로 확인")] }),
        p("별도의 프로그래밍 없이 웹 브라우저 주소창에 아래 URL을 입력하면 바로 JSON 결과를 확인할 수 있습니다."),
        p("apikey 파라미터를 URL에 포함하면 브라우저에서 직접 접근이 가능합니다.", { italic: true, color: "2C5F8A" }),
        spacer(100),

        p("(1) 최신 NOTAM 10건 조회:", { bold: true }),
        code("https://ugzsuswrazaimvpyloqw.supabase.co/rest/v1/notams"),
        code("  ?select=notam_number,location,e_text,series"),
        code("  &order=crawled_at.desc&limit=10"),
        code("  &apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnenN1c3dyYXphaW12cHlsb3F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5OTg3NzQsImV4cCI6MjA4NTU3NDc3NH0.5V1O5HEAyQp5Gaj6lIFb5yZffs0Et4UGgUhGb2Xp--U"),
        spacer(60),
        p("위 URL을 브라우저 주소창에 한 줄로 이어 붙여 입력하세요.", { italic: true, color: "666666", indent: 360 }),

        spacer(100),
        p("(2) 인천공항(RKSI) NOTAM만 조회:", { bold: true }),
        code("https://ugzsuswrazaimvpyloqw.supabase.co/rest/v1/notams"),
        code("  ?location=eq.RKSI&order=crawled_at.desc&limit=20"),
        code("  &apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnenN1c3dyYXphaW12cHlsb3F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5OTg3NzQsImV4cCI6MjA4NTU3NDc3NH0.5V1O5HEAyQp5Gaj6lIFb5yZffs0Et4UGgUhGb2Xp--U"),

        spacer(100),
        p("(3) 시스템 상태 확인 (총 건수, 최신 수집 시간):", { bold: true }),
        code("https://ugzsuswrazaimvpyloqw.supabase.co/rest/v1/rpc/get_notam_status"),
        code("  ?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnenN1c3dyYXphaW12cHlsb3F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5OTg3NzQsImV4cCI6MjA4NTU3NDc3NH0.5V1O5HEAyQp5Gaj6lIFb5yZffs0Et4UGgUhGb2Xp--U"),
        spacer(60),
        p("POST가 필요한 RPC 함수는 브라우저 주소창으로는 호출이 안 됩니다. 위 get_notam_status는 GET으로도 가능하도록 설정되어 있습니다.", { italic: true, color: "666666", indent: 360 }),

        spacer(100),
        p("(4) 좌표가 있는 NOTAM만 조회:", { bold: true }),
        code("https://ugzsuswrazaimvpyloqw.supabase.co/rest/v1/notams"),
        code("  ?q_lat=not.is.null&q_lon=not.is.null&limit=30"),
        code("  &apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnenN1c3dyYXphaW12cHlsb3F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5OTg3NzQsImV4cCI6MjA4NTU3NDc3NH0.5V1O5HEAyQp5Gaj6lIFb5yZffs0Et4UGgUhGb2Xp--U"),

        spacer(200),
        p("팁: 브라우저에서 JSON이 보기 불편하면 Chrome 확장 프로그램 'JSON Viewer'를 설치하면 보기 좋게 표시됩니다.", { italic: true, color: "2C5F8A" }),

        spacer(300),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6.1 cURL \uC608\uC2DC")] }),
        spacer(60),

        p("(1) \uCD5C\uC2E0 NOTAM 10\uAC74 \uC870\uD68C:", { bold: true }),
        code(`curl "${BASE_URL}/rest/v1/notams?select=notam_number,location,e_text,series&order=crawled_at.desc&limit=10" \\`),
        code(`  -H "apikey: ${ANON_KEY}" \\`),
        code(`  -H "Authorization: Bearer ${ANON_KEY}"`),

        spacer(200),
        p("(2) \uC778\uCC9C\uACF5\uD56D(RKSI) NOTAM \uC870\uD68C:", { bold: true }),
        code(`curl "${BASE_URL}/rest/v1/notams?location=eq.RKSI&order=crawled_at.desc" \\`),
        code(`  -H "apikey: ${ANON_KEY}" \\`),
        code(`  -H "Authorization: Bearer ${ANON_KEY}"`),

        spacer(200),
        p("(3) \uD55C\uBC18\uB3C4 \uBC94\uC704 \uB0B4 NOTAM \uC870\uD68C:", { bold: true }),
        code(`curl "${BASE_URL}/rest/v1/notams?q_lat=gte.33&q_lat=lte.38&q_lon=gte.124&q_lon=lte.132&limit=50" \\`),
        code(`  -H "apikey: ${ANON_KEY}" \\`),
        code(`  -H "Authorization: Bearer ${ANON_KEY}"`),

        spacer(200),
        p("(4) RPC\uB85C \uAC80\uC0C9 (\uC778\uCC9C\uACF5\uD56D, \uD604\uC7AC \uC720\uD6A8\uD55C \uAC83\uB9CC):", { bold: true }),
        code(`curl -X POST "${BASE_URL}/rest/v1/rpc/search_notams" \\`),
        code(`  -H "apikey: ${ANON_KEY}" \\`),
        code(`  -H "Authorization: Bearer ${ANON_KEY}" \\`),
        code(`  -H "Content-Type: application/json" \\`),
        code(`  -d '{"p_location":"RKSI","p_period":"current","p_limit":10}'`),

        spacer(200),
        p("(5) \uC2DC\uC2A4\uD15C \uC0C1\uD0DC \uD655\uC778:", { bold: true }),
        code(`curl -X POST "${BASE_URL}/rest/v1/rpc/get_notam_status" \\`),
        code(`  -H "apikey: ${ANON_KEY}" \\`),
        code(`  -H "Authorization: Bearer ${ANON_KEY}" \\`),
        code(`  -H "Content-Type: application/json" -d '{}'`),

        spacer(200),
        p("(6) \uCD1D \uAC74\uC218 \uD655\uC778 (Prefer \uD5E4\uB354 \uC0AC\uC6A9):", { bold: true }),
        code(`curl "${BASE_URL}/rest/v1/notams?select=notam_number&limit=1" \\`),
        code(`  -H "apikey: ${ANON_KEY}" \\`),
        code(`  -H "Authorization: Bearer ${ANON_KEY}" \\`),
        code(`  -H "Prefer: count=exact" -v 2>&1 | grep -i content-range`),
        p("\uC751\uB2F5 \uD5E4\uB354: Content-Range: 0-0/264  -> \uCD1D 264\uAC74", { italic: true, color: "666666", indent: 360 }),
      ]
    },

    // ===== 6 \uACC4\uC18D - JS + Python =====
    {
      properties: pageProps,
      headers: { default: sharedHeader },
      footers: { default: sharedFooter },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6.2 JavaScript (fetch) \uC608\uC2DC")] }),
        code(`const BASE = "${BASE_URL}/rest/v1";`),
        code(`const KEY  = "${ANON_KEY}";`),
        code(``),
        code(`const headers = {`),
        code(`  "apikey": KEY,`),
        code(`  "Authorization": "Bearer " + KEY`),
        code(`};`),
        code(``),
        code(`// 1. \uAE30\uBCF8 \uC870\uD68C - \uCD5C\uC2E0 20\uAC74`),
        code(`const res = await fetch(`),
        code(`  BASE + "/notams?select=notam_number,location,e_text&order=crawled_at.desc&limit=20",`),
        code(`  { headers }`),
        code(`);`),
        code(`const data = await res.json();`),
        code(`console.log("NOTAM \uC218:", data.length);`),
        code(``),
        code(`// 2. RPC \uAC80\uC0C9 - \uC778\uCC9C\uACF5\uD56D\uB9CC`),
        code(`const res2 = await fetch(BASE + "/rpc/search_notams", {`),
        code(`  method: "POST",`),
        code(`  headers: { ...headers, "Content-Type": "application/json" },`),
        code(`  body: JSON.stringify({ p_location: "RKSI", p_period: "current", p_limit: 10 })`),
        code(`});`),
        code(`const rksi = await res2.json();`),
        code(``),
        code(`// 3. \uC2DC\uC2A4\uD15C \uC0C1\uD0DC \uD655\uC778`),
        code(`const res3 = await fetch(BASE + "/rpc/get_notam_status", {`),
        code(`  method: "POST",`),
        code(`  headers: { ...headers, "Content-Type": "application/json" }`),
        code(`});`),
        code(`const status = await res3.json();`),
        code(`console.log("\uCD1D \uAC74\uC218:", status.total_notams);`),
        code(`console.log("\uCD5C\uC2E0 \uC218\uC9D1:", status.latest_crawl);`),

        spacer(300),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6.3 Python (requests) \uC608\uC2DC")] }),
        code(`import requests`),
        code(``),
        code(`BASE = "${BASE_URL}/rest/v1"`),
        code(`KEY  = "${ANON_KEY}"`),
        code(`HEADERS = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}`),
        code(``),
        code(`# 1. \uAE30\uBCF8 \uC870\uD68C - \uCD5C\uC2E0 20\uAC74`),
        code(`r = requests.get(f"{BASE}/notams", headers=HEADERS, params={`),
        code(`    "select": "notam_number,location,e_text,series",`),
        code(`    "order": "crawled_at.desc",`),
        code(`    "limit": 20`),
        code(`})`),
        code(`notams = r.json()`),
        code(`print(f"NOTAM \uC218: {len(notams)}")`),
        code(``),
        code(`# 2. RPC \uAC80\uC0C9 - \uD55C\uBC18\uB3C4 \uBC94\uC704`),
        code(`r2 = requests.post(f"{BASE}/rpc/search_notams",`),
        code(`    headers={**HEADERS, "Content-Type": "application/json"},`),
        code(`    json={`),
        code(`        "p_south": 33.0, "p_west": 124.0,`),
        code(`        "p_north": 38.0, "p_east": 132.0,`),
        code(`        "p_period": "current"`),
        code(`    }`),
        code(`)`),
        code(`print(f"\uD55C\uBC18\uB3C4 \uD65C\uC131 NOTAM: {len(r2.json())}\uAC74")`),
        code(``),
        code(`# 3. \uC2DC\uC2A4\uD15C \uC0C1\uD0DC`),
        code(`r3 = requests.post(f"{BASE}/rpc/get_notam_status",`),
        code(`    headers={**HEADERS, "Content-Type": "application/json"}, json={}`),
        code(`)`),
        code(`status = r3.json()`),
        code(`print(f"\uCD1D: {status['total_notams']}\uAC74, \uCD5C\uC2E0 \uC218\uC9D1: {status['latest_crawl']}")`),
      ]
    },

    // ===== 7. \uC751\uB2F5 \uC608\uC2DC =====
    {
      properties: pageProps,
      headers: { default: sharedHeader },
      footers: { default: sharedFooter },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("7. \uC751\uB2F5 \uC608\uC2DC")] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("7.1 \uD14C\uC774\uBE14 \uC870\uD68C \uC751\uB2F5 (GET /rest/v1/notams)")] }),
        p("NOTAM \uAC1D\uCCB4\uC758 JSON \uBC30\uC5F4\uC744 \uBC18\uD658\uD569\uB2C8\uB2E4:"),
        code(`[`),
        code(`  {`),
        code(`    "notam_number": "A0176/26",`),
        code(`    "location": "RKTU",`),
        code(`    "full_text": "GG RKZZNAXX\\r\\n(A0176/26...)\\r\\nQ) RKRR/QMRLC/...",`),
        code(`    "e_text": "RWY 06L/24R CLSD DUE TO MAINT",`),
        code(`    "qcode": "QMRLC",`),
        code(`    "qcode_mean": "Runway closed",`),
        code(`    "series": "A",`),
        code(`    "fir": "RKRR",`),
        code(`    "q_lat": 36.72,`),
        code(`    "q_lon": 127.50,`),
        code(`    "q_radius_nm": 5,`),
        code(`    "source_type": "domestic",`),
        code(`    "crawled_at": "2026-02-02T06:30:00.5+00:00"`),
        code(`  },`),
        code(`  { ... }`),
        code(`]`),

        spacer(300),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("7.2 \uC2DC\uC2A4\uD15C \uC0C1\uD0DC \uC751\uB2F5 (get_notam_status)")] }),
        p("\uC2DC\uC2A4\uD15C \uD1B5\uACC4\uAC00 \uD3EC\uD568\uB41C JSON \uAC1D\uCCB4\uB97C \uBC18\uD658\uD569\uB2C8\uB2E4:"),
        code(`{`),
        code(`  "total_notams": 264,          // \uCD1D NOTAM \uC218`),
        code(`  "latest_crawl": "2026-02-02T06:30:00.5+00:00",  // \uCD5C\uC2E0 \uC218\uC9D1 \uC2DC\uAC04`),
        code(`  "series_counts": {            // \uC2DC\uB9AC\uC988\uBCC4 \uAC74\uC218`),
        code(`    "A": 30,  "C": 21,  "D": 55,`),
        code(`    "E": 147, "G": 1,   "Z": 10`),
        code(`  },`),
        code(`  "source_counts": {            // \uCD9C\uCC98\uBCC4 \uAC74\uC218`),
        code(`    "domestic": 211,             // \uAD6D\uB0B4 211\uAC74`),
        code(`    "international": 53          // \uAD6D\uC81C 53\uAC74`),
        code(`  },`),
        code(`  "last_crawl_log": {           // \uCD5C\uC2E0 \uC218\uC9D1 \uB85C\uADF8`),
        code(`    "status": "success",         // \uC131\uACF5/\uC2E4\uD328`),
        code(`    "total_upserted": 261,       // \uC0BD\uC785/\uC5C5\uB370\uC774\uD2B8\uB41C \uAC74\uC218`),
        code(`    "execution_ms": 9898         // \uC2E4\uD589 \uC2DC\uAC04 (ms)`),
        code(`  }`),
        code(`}`),
      ]
    },

    // ===== 8. PostgREST \uC5F0\uC0B0\uC790 =====
    {
      properties: pageProps,
      headers: { default: sharedHeader },
      footers: { default: sharedFooter },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("8. PostgREST \uD544\uD130 \uC5F0\uC0B0\uC790")] }),
        p("PostgREST\uB294 URL \uAE30\uBC18 \uD544\uD130\uB9C1 \uC5F0\uC0B0\uC790\uB97C \uC0AC\uC6A9\uD569\uB2C8\uB2E4. \uC0AC\uC6A9 \uAC00\uB2A5\uD55C \uC5F0\uC0B0\uC790:"),
        spacer(60),
        new Table({
          columnWidths: [1600, 2200, 5560],
          rows: [
            new TableRow({ tableHeader: true, children: [headerCell("\uC5F0\uC0B0\uC790", 1600), headerCell("\uC758\uBBF8", 2200), headerCell("\uC608\uC2DC", 5560)] }),
            new TableRow({ children: [cell("eq", { width: 1600, font: "Consolas" }), cell("\uAC19\uC74C (=)", { width: 2200 }), cell("location=eq.RKSI  ->  location = 'RKSI'", { width: 5560, font: "Consolas", size: 18 })] }),
            new TableRow({ children: [cell("neq", { width: 1600, font: "Consolas" }), cell("\uAC19\uC9C0 \uC54A\uC74C (!=)", { width: 2200 }), cell("series=neq.Z  ->  series != 'Z'", { width: 5560, font: "Consolas", size: 18 })] }),
            new TableRow({ children: [cell("gt", { width: 1600, font: "Consolas" }), cell("\uCD08\uACFC (>)", { width: 2200 }), cell("q_lat=gt.37  ->  q_lat > 37", { width: 5560, font: "Consolas", size: 18 })] }),
            new TableRow({ children: [cell("gte", { width: 1600, font: "Consolas" }), cell("\uC774\uC0C1 (>=)", { width: 2200 }), cell("q_lat=gte.33  ->  q_lat >= 33", { width: 5560, font: "Consolas", size: 18 })] }),
            new TableRow({ children: [cell("lt", { width: 1600, font: "Consolas" }), cell("\uBBF8\uB9CC (<)", { width: 2200 }), cell("q_lat=lt.38  ->  q_lat < 38", { width: 5560, font: "Consolas", size: 18 })] }),
            new TableRow({ children: [cell("lte", { width: 1600, font: "Consolas" }), cell("\uC774\uD558 (<=)", { width: 2200 }), cell("q_lat=lte.38  ->  q_lat <= 38", { width: 5560, font: "Consolas", size: 18 })] }),
            new TableRow({ children: [cell("like", { width: 1600, font: "Consolas" }), cell("\uD328\uD134 \uB9E4\uCE58 (%)", { width: 2200 }), cell("e_text=like.*RWY*  ->  LIKE '%RWY%'", { width: 5560, font: "Consolas", size: 18 })] }),
            new TableRow({ children: [cell("ilike", { width: 1600, font: "Consolas" }), cell("\uB300\uC18C\uBB38\uC790 \uBB34\uC2DC \uD328\uD134", { width: 2200 }), cell("e_text=ilike.*closed*", { width: 5560, font: "Consolas", size: 18 })] }),
            new TableRow({ children: [cell("in", { width: 1600, font: "Consolas" }), cell("\uBAA9\uB85D \uD3EC\uD568 (IN)", { width: 2200 }), cell("location=in.(RKSI,RKSS,RKPK)", { width: 5560, font: "Consolas", size: 18 })] }),
            new TableRow({ children: [cell("is", { width: 1600, font: "Consolas" }), cell("null \uD655\uC778", { width: 2200 }), cell("q_lat=is.null / q_lat=not.is.null", { width: 5560, font: "Consolas", size: 18 })] }),
            new TableRow({ children: [cell("or", { width: 1600, font: "Consolas" }), cell("OR \uC870\uAC74", { width: 2200 }), cell("or=(location.eq.RKSI,location.eq.RKSS)", { width: 5560, font: "Consolas", size: 18 })] }),
          ]
        }),

        spacer(300),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("8.1 \uC720\uC6A9\uD55C \uC870\uD68C \uD328\uD134")] }),

        spacer(100),
        p("(1) \uC5EC\uB7EC \uACF5\uD56D \uB3D9\uC2DC \uC870\uD68C:", { bold: true }),
        code(`GET /rest/v1/notams?location=in.(RKSI,RKSS,RKPC)&order=crawled_at.desc`),

        spacer(100),
        p("(2) \uC88C\uD45C\uAC00 \uC788\uB294 NOTAM\uB9CC \uC870\uD68C (null \uC81C\uC678):", { bold: true }),
        code(`GET /rest/v1/notams?q_lat=not.is.null&q_lon=not.is.null`),

        spacer(100),
        p("(3) \uD2B9\uC815 \uCEEC\uB7FC\uB9CC \uC870\uD68C (\uD2B8\uB798\uD53D \uC808\uC57D):", { bold: true }),
        code(`GET /rest/v1/notams?select=notam_number,location,e_text,q_lat,q_lon`),

        spacer(100),
        p("(4) NOTAM \uBCF8\uBB38\uC5D0\uC11C \uD14D\uC2A4\uD2B8 \uAC80\uC0C9:", { bold: true }),
        code(`GET /rest/v1/notams?e_text=ilike.*runway*closed*`),

        spacer(100),
        p("(5) \uAD6D\uB0B4 A \uC2DC\uB9AC\uC988\uB9CC \uC870\uD68C:", { bold: true }),
        code(`GET /rest/v1/notams?source_type=eq.domestic&series=eq.A`),
      ]
    },

    // ===== 9. \uC790\uC8FC \uBB3B\uB294 \uC9C8\uBB38 =====
    {
      properties: pageProps,
      headers: { default: sharedHeader },
      footers: { default: sharedFooter },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("9. \uC790\uC8FC \uBB3B\uB294 \uC9C8\uBB38 (FAQ)")] }),

        p("Q: API Key\uAC00 \uBC18\uB4DC\uC2DC \uD544\uC694\uD55C\uAC00\uC694?", { bold: true }),
        p("A: \uB124. anon key\uB97C apikey\uC640 Authorization \uD5E4\uB354\uC5D0 \uD3EC\uD568\uD574\uC57C \uD569\uB2C8\uB2E4. \uC5C6\uC73C\uBA74 401 Unauthorized \uC624\uB958\uAC00 \uBC1C\uC0DD\uD569\uB2C8\uB2E4.", { indent: 360 }),
        spacer(100),

        p("Q: \uB370\uC774\uD130\uB294 \uC5BC\uB9C8\uB098 \uC790\uC8FC \uC5C5\uB370\uC774\uD2B8\uB418\uB098\uC694?", { bold: true }),
        p("A: 5\uBD84\uB9C8\uB2E4 \uC790\uB3D9 \uC5C5\uB370\uC774\uD2B8\uB429\uB2C8\uB2E4. pg_cron\uC774 Edge Function\uC744 \uC790\uB3D9 \uD638\uCD9C\uD569\uB2C8\uB2E4. get_notam_status\uB85C \uCD5C\uC2E0 \uC218\uC9D1 \uC2DC\uAC04\uC744 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.", { indent: 360 }),
        spacer(100),

        p("Q: effective_end\uC5D0 'PERM'\uC740 \uBB34\uC2A8 \uB73B\uC778\uAC00\uC694?", { bold: true }),
        p("A: \uC601\uAD6C NOTAM\uC785\uB2C8\uB2E4. \uB9CC\uB8CC\uC77C\uC774 \uC5C6\uC73C\uBA70, \uBA85\uC2DC\uC801\uC73C\uB85C \uCDE8\uC18C\uB420 \uB54C\uAE4C\uC9C0 \uC720\uD6A8\uD569\uB2C8\uB2E4.", { indent: 360 }),
        spacer(100),

        p("Q: \uCD1D \uAC74\uC218\uB294 \uC5B4\uB5BB\uAC8C \uD655\uC778\uD558\uB098\uC694?", { bold: true }),
        p("A: \uBC29\uBC95 1) get_notam_status RPC \uD638\uCD9C -> total_notams \uD544\uB4DC \uD655\uC778", { indent: 360 }),
        p("A: \uBC29\uBC95 2) \uD5E4\uB354\uC5D0 'Prefer: count=exact' \uCD94\uAC00 -> Content-Range \uC751\uB2F5 \uD5E4\uB354 \uD655\uC778", { indent: 360 }),
        spacer(100),

        p("Q: \uC88C\uD45C\uAC00 null\uC778 NOTAM\uC774 \uC788\uB098\uC694?", { bold: true }),
        p("A: \uB124. \uC77C\uBD80 NOTAM\uC740 Q-line\uC5D0 \uC88C\uD45C \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. q_lat=not.is.null\uB85C \uC88C\uD45C\uAC00 \uC788\uB294 \uAC83\uB9CC \uD544\uD130\uB9C1\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.", { indent: 360 }),
        spacer(100),

        p("Q: \uB370\uC774\uD130\uB97C \uC218\uC815/\uC0AD\uC81C\uD560 \uC218 \uC788\uB098\uC694?", { bold: true }),
        p("A: \uC544\uB2C8\uC694. anon key\uB294 \uC77D\uAE30 \uC804\uC6A9\uC785\uB2C8\uB2E4. RLS(\uD589 \uC218\uC900 \uBCF4\uC548)\uAC00 \uC4F0\uAE30\uB97C \uCC28\uB2E8\uD569\uB2C8\uB2E4. \uC4F0\uAE30 \uAD8C\uD55C\uC740 \uD06C\uB864\uB7EC \uC11C\uBE44\uC2A4(service_role key)\uC5D0\uB9CC \uC788\uC2B5\uB2C8\uB2E4.", { indent: 360 }),
        spacer(100),

        p("Q: \uC694\uCCAD \uC81C\uD55C(rate limit)\uC774 \uC788\uB098\uC694?", { bold: true }),
        p("A: Supabase Nano \uD2F0\uC5B4\uC758 \uAE30\uBCF8 \uC81C\uD55C\uC774 \uC801\uC6A9\uB429\uB2C8\uB2E4. \uC77C\uBC18\uC801\uC778 \uC0AC\uC6A9\uC5D0\uB294 \uCDA9\uBD84\uD569\uB2C8\uB2E4. \uB300\uB7C9 \uC0AC\uC6A9 \uC2DC \uAD00\uB9AC\uC790\uC5D0\uAC8C \uBB38\uC758\uD558\uC138\uC694.", { indent: 360 }),
        spacer(100),

        p("Q: ICAO \uCF54\uB4DC\uB780 \uBB34\uC5C7\uC778\uAC00\uC694?", { bold: true }),
        p("A: \uAD6D\uC81C\uBBFC\uAC04\uD56D\uACF5\uAE30\uAD6C(ICAO)\uAC00 \uBD80\uC5EC\uD55C \uACF5\uD56D \uCF54\uB4DC\uC785\uB2C8\uB2E4. \uD55C\uAD6D\uC740 'RK'\uB85C \uC2DC\uC791\uD569\uB2C8\uB2E4. RKSI=\uC778\uCC9C, RKSS=\uAE40\uD3EC, RKPK=\uAE40\uD574, RKPC=\uC81C\uC8FC, RKRR=\uC778\uCC9C FIR.", { indent: 360 }),
        spacer(100),

        p("Q: Q-\uCF54\uB4DC\uB780 \uBB34\uC5C7\uC778\uAC00\uC694?", { bold: true }),
        p("A: NOTAM \uC720\uD615\uC744 \uC124\uBA85\uD558\uB294 \uD45C\uC900\uD654\uB41C 5\uAE00\uC790 \uCF54\uB4DC\uC785\uB2C8\uB2E4. \uC608: QMRLC=\uD65C\uC8FC\uB85C\uD3D0\uC1C4, QFATT=\uBE44\uD589\uC7A5, QOBCE=\uC7A5\uC560\uBB3C\uC124\uCE58. qcode_mean \uD544\uB4DC\uC5D0 \uC601\uBB38 \uC124\uBA85\uC774 \uC788\uC2B5\uB2C8\uB2E4.", { indent: 360 }),

        spacer(400),
        spacer(100),

        p("Q: 이 시스템은 불법 크롤링이 아닌가요?", { bold: true }),
        p("A: 아닙니다. 첫째, 웹 크롤링(HTML 파싱)이 아닌 HTTP POST API 호출 방식입니다. 둘째, NOTAM은 항공 안전을 위해 전 세계적으로 공개되는 정보입니다. 셋째, 공개 데이터 수집의 합법성은 국내외 판례로 확인되었습니다. (상세: 2.4절 참조)", { indent: 360 }),
        spacer(100),

        p("Q: 크롤링으로 데이터를 수집하면 불법 아닌가요?", { bold: true }),
        p("A: 크롤링 자체는 불법이 아닙니다. 대법원 판례(2022다202116)에 따르면, 공개 웹사이트의 데이터 수집은 그 자체로 위법하지 않습니다. 미국 hiQ v. LinkedIn 판례도 공개 데이터 수집의 합법성을 확인하였습니다. 본 시스템은 크롤링이 아닌 API 호출이지만, 설령 크롤링이라 하더라도 공개 데이터 수집은 합법입니다.", { indent: 360 }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("10. \uCC38\uACE0 \uBB38\uC11C")] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "PostgREST \uACF5\uC2DD \uBB38\uC11C: ", font: "Malgun Gothic", size: 22, bold: true }), new ExternalHyperlink({ link: "https://postgrest.org/en/stable/api.html", children: [new TextRun({ text: "postgrest.org/en/stable/api.html", font: "Malgun Gothic", size: 22, color: "1155CC", underline: { type: "single" } })] })] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "Supabase JS \uD074\uB77C\uC774\uC5B8\uD2B8: ", font: "Malgun Gothic", size: 22, bold: true }), new ExternalHyperlink({ link: "https://supabase.com/docs/reference/javascript/introduction", children: [new TextRun({ text: "supabase.com/docs/reference/javascript", font: "Malgun Gothic", size: 22, color: "1155CC", underline: { type: "single" } })] })] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "AIM Korea: ", font: "Malgun Gothic", size: 22, bold: true }), new ExternalHyperlink({ link: "https://aim.koca.go.kr", children: [new TextRun({ text: "aim.koca.go.kr", font: "Malgun Gothic", size: 22, color: "1155CC", underline: { type: "single" } })] })] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "ICAO NOTAM \uD615\uC2DD: ", font: "Malgun Gothic", size: 22, bold: true }), new ExternalHyperlink({ link: "https://www.icao.int/safety/istars/pages/notam-format.aspx", children: [new TextRun({ text: "icao.int/safety/istars", font: "Malgun Gothic", size: 22, color: "1155CC", underline: { type: "single" } })] })] }),
      ]
    }
  ]
});

Packer.toBuffer(doc).then(buffer => {
  const outPath = "C:\\Users\\allof\\Desktop\\251212 GIS\\rkpu-viewer\\docs\\NOTAM_API_가이드라인_v2.0.docx";
  fs.writeFileSync(outPath, buffer);
  console.log("Document created:", outPath);
});
