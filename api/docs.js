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
      "description": "대한민국 전역 15개 공항 및 한반도 공역 종합 항공감시·관제·기상·스케줄 연계 게이트웨이 API 명세서입니다.",
      "version": "2.4.0"
    },
    "servers": [{ "url": "https://www.koreasurveillance.com", "description": "Production Server" }]
  };

  if (isJson) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(openApiSpec);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>대한감시 - 23개 연계 인터페이스 API 명세서 (Swagger Explorer)</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #09090b;
      color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
    }
    header {
      height: 52px;
      background: #111114;
      border-bottom: 1px solid #27272a;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .brand-title {
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .brand-badge {
      font-size: 10px;
      background: rgba(6, 182, 212, 0.15);
      color: #38bdf8;
      border: 1px solid rgba(6, 182, 212, 0.35);
      padding: 1px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-weight: 700;
    }
    .header-links { display: flex; gap: 8px; }
    .btn-link {
      padding: 5px 12px;
      border-radius: 5px;
      background: #18181b;
      border: 1px solid #3f3f46;
      color: #e4e4e7;
      font-size: 11.5px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.15s;
    }
    .btn-link:hover { background: #27272a; color: #fff; border-color: #52525b; }
    .btn-cyan { background: rgba(6, 182, 212, 0.15); border-color: rgba(6, 182, 212, 0.4); color: #38bdf8; }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 20px;
    }
    .intro-card {
      background: #121215;
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .intro-title { font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 8px; }
    .intro-desc { font-size: 12.5px; color: #a1a1aa; line-height: 1.6; }

    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: #38bdf8;
      margin: 28px 0 12px 0;
      padding-bottom: 6px;
      border-bottom: 1px solid #27272a;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .endpoint-card {
      background: #121215;
      border: 1px solid #27272a;
      border-radius: 6px;
      margin-bottom: 10px;
      overflow: hidden;
      transition: border-color 0.15s;
    }
    .endpoint-card:hover { border-color: #3f3f46; }
    .endpoint-head {
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      user-select: none;
      background: #151519;
    }
    .endpoint-left { display: flex; align-items: center; gap: 10px; }
    .method-get {
      background: #2563eb;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      font-family: monospace;
      padding: 3px 8px;
      border-radius: 4px;
    }
    .path-text { font-family: monospace; font-size: 13px; font-weight: 700; color: #f4f4f5; }
    .title-text { font-size: 12px; color: #a1a1aa; }
    .endpoint-body {
      padding: 14px;
      border-top: 1px solid #27272a;
      background: #09090b;
      display: none;
    }

    .param-group { margin-bottom: 12px; }
    .param-label { font-size: 11.5px; font-weight: 700; color: #d4d4d8; margin-bottom: 4px; display: block; }
    .param-input {
      background: #18181b;
      border: 1px solid #3f3f46;
      color: #fff;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      width: 280px;
      outline: none;
    }
    .param-input:focus { border-color: #06b6d4; }

    .btn-exec {
      padding: 6px 14px;
      background: #0284c7;
      color: #fff;
      border: none;
      border-radius: 5px;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-exec:hover { background: #0369a1; }

    .result-box {
      margin-top: 12px;
      padding: 12px;
      background: #050507;
      border: 1px solid #27272a;
      border-radius: 5px;
      font-family: Consolas, Monaco, monospace;
      font-size: 11px;
      color: #86efac;
      line-height: 1.5;
      max-height: 280px;
      overflow: auto;
      white-space: pre-wrap;
      display: none;
    }
    .result-status { font-size: 11.5px; font-weight: 700; margin-bottom: 6px; }
  </style>
</head>
<body>
  <header>
    <div class="brand-title">
      대한감시 연계 게이트웨이
      <span class="brand-badge">API SWAGGER EXPLORER</span>
    </div>
    <div class="header-links">
      <a href="/api-dashboard" class="btn-link btn-cyan">실시간 대시보드</a>
      <a href="/" class="btn-link">관제 맵 이동</a>
    </div>
  </header>

  <div class="container">
    <div class="intro-card">
      <div class="intro-title">대한감시 23개 연계 인터페이스 API 명세서</div>
      <div class="intro-desc">
        대한민국 전역 15개 공항 및 한반도 공역의 실시간 항적(ASTERIX), 관제기상(AMOS/AMHS), 운항스케줄(FIDS), 비행계획 변동보(Doc 4444), 항공고시보(NOTAM), 실시간 음성(LiveATC), 무저장 동기화 크롤러 API를 직접 호출하고 실시간 응답을 확인할 수 있습니다.
      </div>
    </div>

    <!-- 1. Airspace Surveillance -->
    <div class="section-title">
      <span>1. 한반도 광역 항적 정보 (ASTERIX)</span>
      <span style="font-size: 11px; color: #a1a1aa; font-weight: normal;">OpenSky Network 실시간 ADS-B & Radar 변환</span>
    </div>

    <div class="endpoint-card" id="ep-ast-62">
      <div class="endpoint-head" onclick="toggleEp('ep-ast-62')">
        <div class="endpoint-left">
          <span class="method-get">GET</span>
          <span class="path-text">/api/asterix?cat=62</span>
          <span class="title-text">항적정보 (융합) - ASTERIX Cat.062 System Track</span>
        </div>
        <span style="font-size: 11px; color: #71717a;">펼치기 ▾</span>
      </div>
      <div class="endpoint-body">
        <div class="param-group">
          <label class="param-label">요청 URL:</label>
          <input type="text" class="param-input" value="/api/asterix?cat=62" id="url-ast-62" readonly style="width: 100%; max-width: 450px;" />
        </div>
        <button class="btn-exec" onclick="execApi('url-ast-62', 'res-ast-62')">직접 실행 (Try it out)</button>
        <div class="result-box" id="res-ast-62"></div>
      </div>
    </div>

    <div class="endpoint-card" id="ep-ast-21">
      <div class="endpoint-head" onclick="toggleEp('ep-ast-21')">
        <div class="endpoint-left">
          <span class="method-get">GET</span>
          <span class="path-text">/api/asterix?cat=21</span>
          <span class="title-text">항적정보 (개별) - ASTERIX Cat.021 ADS-B Target Report</span>
        </div>
        <span style="font-size: 11px; color: #71717a;">펼치기 ▾</span>
      </div>
      <div class="endpoint-body">
        <div class="param-group">
          <label class="param-label">요청 URL:</label>
          <input type="text" class="param-input" value="/api/asterix?cat=21" id="url-ast-21" readonly style="width: 100%; max-width: 450px;" />
        </div>
        <button class="btn-exec" onclick="execApi('url-ast-21', 'res-ast-21')">직접 실행 (Try it out)</button>
        <div class="result-box" id="res-ast-21"></div>
      </div>
    </div>

    <div class="endpoint-card" id="ep-ast-48">
      <div class="endpoint-head" onclick="toggleEp('ep-ast-48')">
        <div class="endpoint-left">
          <span class="method-get">GET</span>
          <span class="path-text">/api/asterix?cat=48&typ=COMBINED_PSR_SSR</span>
          <span class="title-text">Radar 합성 항적 - ASTERIX Cat.048 Monoradar Report</span>
        </div>
        <span style="font-size: 11px; color: #71717a;">펼치기 ▾</span>
      </div>
      <div class="endpoint-body">
        <div class="param-group">
          <label class="param-label">요청 URL:</label>
          <input type="text" class="param-input" value="/api/asterix?cat=48&typ=COMBINED_PSR_SSR" id="url-ast-48" readonly style="width: 100%; max-width: 450px;" />
        </div>
        <button class="btn-exec" onclick="execApi('url-ast-48', 'res-ast-48')">직접 실행 (Try it out)</button>
        <div class="result-box" id="res-ast-48"></div>
      </div>
    </div>

    <!-- 2. Realtime Weather -->
    <div class="section-title">
      <span>2. 실시간 관제기상 (AMOS & AMHS)</span>
      <span style="font-size: 11px; color: #a1a1aa; font-weight: normal;">항공기상청 42개 활주로 센서 전수</span>
    </div>

    <div class="endpoint-card" id="ep-amos">
      <div class="endpoint-head" onclick="toggleEp('ep-amos')">
        <div class="endpoint-left">
          <span class="method-get">GET</span>
          <span class="path-text">/api/weather?type=amos&icao=ALL</span>
          <span class="title-text">전국 42개 활주로 실시간 AMOS 관제기상 (55개 필드)</span>
        </div>
        <span style="font-size: 11px; color: #71717a;">펼치기 ▾</span>
      </div>
      <div class="endpoint-body">
        <div class="param-group">
          <label class="param-label">공항 ICAO 코드 (ALL / RKSI / RKSS / RKPC):</label>
          <input type="text" class="param-input" value="ALL" id="input-amos-icao" oninput="updateAmosUrl()" />
        </div>
        <div class="param-group">
          <label class="param-label">요청 URL:</label>
          <input type="text" class="param-input" value="/api/weather?type=amos&icao=ALL" id="url-amos" readonly style="width: 100%; max-width: 450px;" />
        </div>
        <button class="btn-exec" onclick="execApi('url-amos', 'res-amos')">직접 실행 (Try it out)</button>
        <div class="result-box" id="res-amos"></div>
      </div>
    </div>

    <!-- 3. Schedules -->
    <div class="section-title">
      <span>3. 전국 운항스케줄 & 비행계획 변동보</span>
      <span style="font-size: 11px; color: #a1a1aa; font-weight: normal;">UBIKAIS FIDS & ICAO Doc 4444 AMHS XML</span>
    </div>

    <div class="endpoint-card" id="ep-sched">
      <div class="endpoint-head" onclick="toggleEp('ep-sched')">
        <div class="endpoint-left">
          <span class="method-get">GET</span>
          <span class="path-text">/api/flight-schedule?airport=ALL</span>
          <span class="title-text">전국 15개 공항 실시간 출/도착 운항스케줄 (FIDS)</span>
        </div>
        <span style="font-size: 11px; color: #71717a;">펼치기 ▾</span>
      </div>
      <div class="endpoint-body">
        <div class="param-group">
          <label class="param-label">요청 URL:</label>
          <input type="text" class="param-input" value="/api/flight-schedule?airport=ALL" id="url-sched" readonly style="width: 100%; max-width: 450px;" />
        </div>
        <button class="btn-exec" onclick="execApi('url-sched', 'res-sched')">직접 실행 (Try it out)</button>
        <div class="result-box" id="res-sched"></div>
      </div>
    </div>

    <div class="endpoint-card" id="ep-amhs-fpl">
      <div class="endpoint-head" onclick="toggleEp('ep-amhs-fpl')">
        <div class="endpoint-left">
          <span class="method-get">GET</span>
          <span class="path-text">/api/amhs?type=FPL&origin=RKSI</span>
          <span class="title-text">비행계획서 (FPL) - ICAO Doc 4444 AMHS IPM XML</span>
        </div>
        <span style="font-size: 11px; color: #71717a;">펼치기 ▾</span>
      </div>
      <div class="endpoint-body">
        <div class="param-group">
          <label class="param-label">요청 URL:</label>
          <input type="text" class="param-input" value="/api/amhs?type=FPL&origin=RKSI" id="url-amhs-fpl" readonly style="width: 100%; max-width: 450px;" />
        </div>
        <button class="btn-exec" onclick="execApi('url-amhs-fpl', 'res-amhs-fpl')">직접 실행 (Try it out)</button>
        <div class="result-box" id="res-amhs-fpl"></div>
      </div>
    </div>

    <!-- 4. Background Crawler -->
    <div class="section-title">
      <span>4. Vercel Pro 무저장(Zero-Storage) 백그라운드 동기화 크롤러</span>
      <span style="font-size: 11px; color: #a1a1aa; font-weight: normal;">5분 주기 Vercel Cron 인메모리 Diff 엔진</span>
    </div>

    <div class="endpoint-card" id="ep-crawler">
      <div class="endpoint-head" onclick="toggleEp('ep-crawler')">
        <div class="endpoint-left">
          <span class="method-get">GET</span>
          <span class="path-text">/api/crawler?status=true</span>
          <span class="title-text">크롤러 하트비트 상태 및 추적 편명 통계 조회</span>
        </div>
        <span style="font-size: 11px; color: #71717a;">펼치기 ▾</span>
      </div>
      <div class="endpoint-body">
        <div class="param-group">
          <label class="param-label">요청 URL:</label>
          <input type="text" class="param-input" value="/api/crawler?status=true" id="url-crawler" readonly style="width: 100%; max-width: 450px;" />
        </div>
        <button class="btn-exec" onclick="execApi('url-crawler', 'res-crawler')">직접 실행 (Try it out)</button>
        <div class="result-box" id="res-crawler"></div>
      </div>
    </div>

    <div class="endpoint-card" id="ep-crawler-events">
      <div class="endpoint-head" onclick="toggleEp('ep-crawler-events')">
        <div class="endpoint-left">
          <span class="method-get">GET</span>
          <span class="path-text">/api/crawler?events=true</span>
          <span class="title-text">최근 실시간 변동 이벤트 큐 (결항/지연/이륙/착륙 감지)</span>
        </div>
        <span style="font-size: 11px; color: #71717a;">펼치기 ▾</span>
      </div>
      <div class="endpoint-body">
        <div class="param-group">
          <label class="param-label">요청 URL:</label>
          <input type="text" class="param-input" value="/api/crawler?events=true" id="url-crawler-events" readonly style="width: 100%; max-width: 450px;" />
        </div>
        <button class="btn-exec" onclick="execApi('url-crawler-events', 'res-crawler-events')">직접 실행 (Try it out)</button>
        <div class="result-box" id="res-crawler-events"></div>
      </div>
    </div>

  </div>

  <script>
    function toggleEp(id) {
      const card = document.getElementById(id);
      const body = card.querySelector('.endpoint-body');
      const isShown = body.style.display === 'block';
      body.style.display = isShown ? 'none' : 'block';
    }

    function updateAmosUrl() {
      const icao = (document.getElementById('input-amos-icao').value || 'ALL').trim().toUpperCase();
      document.getElementById('url-amos').value = '/api/weather?type=amos&icao=' + icao;
    }

    async function execApi(urlInputId, resultBoxId) {
      const url = document.getElementById(urlInputId).value;
      const resBox = document.getElementById(resultBoxId);
      resBox.style.display = 'block';
      resBox.textContent = '호출 중... (' + url + ')';

      const t0 = performance.now();
      try {
        const res = await fetch(url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now());
        const elapsed = Math.round(performance.now() - t0);
        const contentType = res.headers.get('content-type') || '';
        let payloadText = '';

        if (contentType.includes('json')) {
          payloadText = JSON.stringify(await res.json(), null, 2);
        } else {
          payloadText = await res.text();
        }

        resBox.textContent = '[HTTP ' + res.status + ' OK - ' + elapsed + 'ms]\\n\\n' + payloadText;
      } catch (e) {
        resBox.textContent = '[호출 실패]\\n' + e.message;
      }
    }
  </script>
</body>
</html>`;

  return res.send(html);
}
