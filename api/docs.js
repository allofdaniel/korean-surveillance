import { setCorsHeaders, checkRateLimit } from './_utils/cors.js';

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;
  if (await checkRateLimit(req, res)) return;

  const parsedUrl = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
  const isJson = parsedUrl.searchParams.get('json') === 'true' || req.query?.json === 'true';

  const openApiSpec = {
    "openapi": "3.0.3",
    "info": {
      "title": "대한감시 (Korean Surveillance) - 23개 연계 인터페이스 API",
      "description": "대한민국 전역 15개 공항 및 한반도 공역 종합 항공감시·관제·기상·스케줄 연계 게이트웨이 API 명세서입니다.\n\n### 주요 지원 규격\n- **항적 감시 (Surveillance)**: EUROCONTROL ASTERIX Cat.062 (융합), Cat.021 (ADS-B), Cat.048 (PSR/SSR), Cat.010 (지상), Cat.034 (센서상태)\n- **관제 기상 (Weather)**: AMO 항공기상청 42개 활주로 실시간 AMOS (55개 필드), METAR, TAF, SIGMET, IWXXM\n- **항공고시보 (NOTAM)**: AIM Korea 인천 FIR XNOTAM & AMHS AIDA-NG SOAP XML\n- **운항스케줄 (FIDS/AMHS)**: UBIKAIS 전국 15개 공항 실시간 스케줄 및 ICAO Doc 4444 FPL, CHG, CNL, DLA, DEP, ARR\n- **관제 음성 (LiveATC)**: 글로벌 관제탑 실시간 라이브 오디오 스트리밍\n- **백그라운드 동기화 (Crawler)**: Vercel Pro 무저장(Zero-Storage) 인메모리 Diff 엔진",
      "version": "2.4.0",
      "contact": {
        "name": "대한감시 시스템 운영팀",
        "url": "https://koreasurveillance.com"
      }
    },
    "servers": [
      {
        "url": "https://www.koreasurveillance.com",
        "description": "Production Live Server"
      }
    ],
    "tags": [
      { "name": "1. Airspace Surveillance (ASTERIX)", "description": "한반도 광역 항적 정보 (유로컨트롤 ASTERIX 표준 규격)" },
      { "name": "2. Real-time Weather (AMOS & AMHS)", "description": "전국 15개 공항 42개 활주로 실시간 관제기상 및 예보" },
      { "name": "3. Flight Schedules & FIDS", "description": "전국 15개 공항 실시간 출도착 운항스케줄 및 전자비행스트립" },
      { "name": "4. Flight Plan & AMHS Messages", "description": "ICAO Doc 4444 비행계획 변동(FPL, CHG, CNL, DLA, DEP, ARR) AMHS 전문" },
      { "name": "5. NOTAM Aeronautical Information", "description": "인천 FIR 비행제한구역 및 시설 고시보" },
      { "name": "6. Live ATC Audio Stream", "description": "실시간 관제탑 오디오 라이브 스트림" },
      { "name": "7. Background Sync Crawler", "description": "24시간 Vercel Pro 무저장 상태 변동 감지 크롤러" }
    ],
    "paths": {
      "/api/asterix": {
        "get": {
          "tags": ["1. Airspace Surveillance (ASTERIX)"],
          "summary": "ASTERIX 항적 데이터 조회 (Cat.062, Cat.021, Cat.048, Cat.010, Cat.034)",
          "description": "한반도 상공의 실시간 ADS-B 및 레이더 탐지 표적을 유로컨트롤 ASTERIX 표준 형식으로 변환하여 반환합니다.",
          "parameters": [
            {
              "name": "cat",
              "in": "query",
              "required": true,
              "description": "ASTERIX 카테고리 (62: 융합, 21: 개별ADS-B, 48: 레이더, 10: 지상이동체, 34: 센서상태)",
              "schema": { "type": "string", "enum": ["62", "21", "48", "10", "34"], "default": "62" }
            },
            {
              "name": "typ",
              "in": "query",
              "required": false,
              "description": "Cat.048 레이더 유형 (COMBINED_PSR_SSR, SINGLE_PSR, SINGLE_SSR)",
              "schema": { "type": "string", "enum": ["COMBINED_PSR_SSR", "SINGLE_PSR", "SINGLE_SSR"] }
            }
          ],
          "responses": {
            "200": { "description": "ASTERIX 규격 JSON 리포트 배열" }
          }
        }
      },
      "/api/weather": {
        "get": {
          "tags": ["2. Real-time Weather (AMOS & AMHS)"],
          "summary": "실시간 관제기상 (AMOS) 및 공항 기상 조회",
          "description": "항공기상청(AMO)으로부터 전국 15개 공항 42개 활주로의 1~2초 초단위 순간풍/RVR/QNH/기온 등 55개 필드 실측치를 실시간 수집하여 반환합니다.",
          "parameters": [
            {
              "name": "type",
              "in": "query",
              "required": false,
              "description": "기상 타입 (amos: 실시간 관제기상 센서)",
              "schema": { "type": "string", "default": "amos" }
            },
            {
              "name": "icao",
              "in": "query",
              "required": false,
              "description": "공항 ICAO 코드 (ALL: 전국 42개 활주로 일괄, RKSI, RKSS, RKPC 등)",
              "schema": { "type": "string", "default": "ALL" }
            }
          ],
          "responses": {
            "200": { "description": "활주로별 AMOS 실시간 관측치 배열 (55개 세부 필드)" }
          }
        }
      },
      "/api/amhs": {
        "get": {
          "tags": ["4. Flight Plan & AMHS Messages", "2. Real-time Weather (AMOS & AMHS)"],
          "summary": "AMHS X.400 IPM / SOAP XML 항공통신 전문 조회",
          "description": "METAR, TAF, SIGMET, IWXXM, NOTAM 및 ICAO Doc 4444 FPL, CHG, CNL, DLA, DEP, ARR 전문을 AMHS X.400 IPM 및 SOAP XML 표준 규격으로 패키징하여 반환합니다.",
          "parameters": [
            {
              "name": "type",
              "in": "query",
              "required": true,
              "description": "전문 유형 (METAR, TAF, SIGMET, IWXXM, NOTAM, FPL, CHG, CNL, DLA, DEP, ARR)",
              "schema": { "type": "string", "enum": ["METAR", "TAF", "SIGMET", "IWXXM", "NOTAM", "FPL", "CHG", "CNL", "DLA", "DEP", "ARR"], "default": "METAR" }
            },
            {
              "name": "icao",
              "in": "query",
              "required": false,
              "description": "대상 공항 ICAO 코드 (RKSI, RKSS 등)",
              "schema": { "type": "string", "default": "RKSI" }
            },
            {
              "name": "origin",
              "in": "query",
              "required": false,
              "description": "출발 공항 ICAO 코드",
              "schema": { "type": "string", "default": "RKSI" }
            }
          ],
          "responses": {
            "200": { "description": "AMHS X.400 IPM / SOAP XML 전문" }
          }
        }
      },
      "/api/flight-schedule": {
        "get": {
          "tags": ["3. Flight Schedules & FIDS"],
          "summary": "전국 공항 운항스케줄 (FIDS) 및 전자비행스트립 (EFS) 조회",
          "description": "UBIKAIS(항공교통업무망)로부터 전국 15개 공항의 실시간 출도착 전광판 스케줄을 수집하거나 사용자 EFS 연계 대기 규격을 반환합니다.",
          "parameters": [
            {
              "name": "airport",
              "in": "query",
              "required": false,
              "description": "공항 코드 (ALL: 전국 15개 공항 일괄 종합, RKSI, RKSS 등)",
              "schema": { "type": "string", "default": "ALL" }
            },
            {
              "name": "efs",
              "in": "query",
              "required": false,
              "description": "true 설정 시 전자비행스트립(EFS) 사용자 연계 대기 규격 반환",
              "schema": { "type": "boolean", "default": false }
            }
          ],
          "responses": {
            "200": { "description": "실시간 FIDS 운항스케줄" }
          }
        }
      },
      "/api/notam": {
        "get": {
          "tags": ["5. NOTAM Aeronautical Information"],
          "summary": "인천 FIR 항공고시보 (NOTAM) 조회",
          "description": "AIM Korea로부터 인천 비행정보구역(RKRR FIR) 및 전국 공항의 유효 항공고시보를 수집하여 반환합니다.",
          "parameters": [
            {
              "name": "location",
              "in": "query",
              "required": false,
              "description": "위치 ICAO 코드 (RKRR, RKSI 등)",
              "schema": { "type": "string", "default": "RKRR" }
            }
          ],
          "responses": {
            "200": { "description": "유효 NOTAM 목록" }
          }
        }
      },
      "/api/voice": {
        "get": {
          "tags": ["6. Live ATC Audio Stream"],
          "summary": "LiveATC 실시간 관제탑 오디오 스트림",
          "description": "실시간 관제탑 음성 스트림(MP3)을 중계합니다.",
          "parameters": [
            {
              "name": "channel",
              "in": "query",
              "required": false,
              "description": "관제탑 채널 (KJFK, RJTT, KLAX)",
              "schema": { "type": "string", "enum": ["KJFK", "RJTT", "KLAX"], "default": "KJFK" }
            }
          ],
          "responses": {
            "200": { "description": "실시간 오디오 스트림 (audio/mpeg)" }
          }
        }
      },
      "/api/crawler": {
        "get": {
          "tags": ["7. Background Sync Crawler"],
          "summary": "Vercel Pro 무저장 백그라운드 크롤러 실행 및 상태 점검",
          "description": "5분 주기로 전국 15개 공항 스케줄과 42개 기상 센서를 메모리 상에서 대조(Zero-Storage Diff)하여 결항(CNL), 지연(DLA), 출발(DEP), 도착(ARR)을 감지합니다.",
          "parameters": [
            {
              "name": "status",
              "in": "query",
              "required": false,
              "description": "true 설정 시 크롤러 하트비트 및 메모리 상태만 반환",
              "schema": { "type": "boolean", "default": false }
            },
            {
              "name": "events",
              "in": "query",
              "required": false,
              "description": "true 설정 시 최근 감지된 실시간 비행 상태 변동 이벤트 큐 반환",
              "schema": { "type": "boolean", "default": false }
            }
          ],
          "responses": {
            "200": { "description": "크롤러 동기화 결과 및 이벤트 요약" }
          }
        }
      }
    }
  };

  if (isJson) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(openApiSpec);
  }

  res.setHeader('Content-Type', 'text/html');
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>대한감시 - 23개 연계 인터페이스 API Swagger 명세서</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; background: #09090b; color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .custom-topbar { height: 48px; background: #121215; border-bottom: 1px solid #27272a; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; }
    .brand-title { font-size: 13.5px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px; }
    .brand-badge { font-size: 10px; background: rgba(6, 182, 212, 0.15); color: #38bdf8; border: 1px solid rgba(6, 182, 212, 0.35); padding: 1px 6px; border-radius: 4px; font-family: monospace; font-weight: 700; }
    .top-links { display: flex; gap: 8px; }
    .top-link { padding: 4px 10px; border-radius: 5px; background: #18181b; border: 1px solid #3f3f46; color: #e4e4e7; font-size: 11px; font-weight: 600; text-decoration: none; transition: all 0.15s; }
    .top-link:hover { background: #27272a; color: #fff; border-color: #52525b; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui { background: #09090b; color: #e4e4e7; padding-bottom: 40px; }
    .swagger-ui .info .title { color: #ffffff; }
    .swagger-ui .info p, .swagger-ui .info li, .swagger-ui .info td { color: #d4d4d8; }
    .swagger-ui .scheme-container { background: #121215; border-bottom: 1px solid #27272a; box-shadow: none; }
    .swagger-ui select { background: #18181b; color: #38bdf8; border: 1px solid #3f3f46; }
    .swagger-ui .opblock .opblock-summary-operation-id, .swagger-ui .opblock .opblock-summary-path, .swagger-ui .opblock .opblock-summary-path__deprecated { color: #fafafa; }
    .swagger-ui .opblock .opblock-summary-description { color: #a1a1aa; }
    .swagger-ui .opblock.opblock-get { background: rgba(59, 130, 246, 0.08); border-color: #3b82f6; }
    .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #2563eb; }
    .swagger-ui .opblock-body { background: #0c0c0f; }
    .swagger-ui table thead tr td, .swagger-ui table thead tr th { color: #a1a1aa; border-bottom: 1px solid #27272a; }
    .swagger-ui .tabli button { color: #a1a1aa; }
    .swagger-ui .tabli.active button { color: #38bdf8; }
    .swagger-ui .response-col_status { color: #34d399; }
    .swagger-ui .highlight-code { background: #050507; }
    .swagger-ui .btn { border-color: #3f3f46; color: #e4e4e7; background: #18181b; }
    .swagger-ui .btn.execute { background: #0284c7; color: #fff; border-color: #0284c7; }
    .swagger-ui input[type=text], .swagger-ui textarea { background: #18181b; color: #fafafa; border: 1px solid #3f3f46; }
  </style>
</head>
<body>
  <div class="custom-topbar">
    <div class="brand-title">
      대한감시 연계 게이트웨이
      <span class="brand-badge">OPENAPI 3.0 SWAGGER</span>
    </div>
    <div class="top-links">
      <a href="/api-dashboard" class="top-link">실시간 대시보드</a>
      <a href="/" class="top-link">관제 맵 이동</a>
    </div>
  </div>

  <div id="swagger-ui"></div>

  <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      const spec = ${JSON.stringify(openApiSpec)};
      SwaggerUIBundle({
        spec: spec,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`;

  return res.send(html);
}
