# 대한감시 (Korean Surveillance) - 23개 연계 인터페이스 종합 연동 가이드

본 문서는 **대한감시(koreasurveillance.com)**에서 제공하는 한반도 전역 15개 공항 및 광역 공역의 항공 감시(ASTERIX), 실시간 관제기상(AMOS/AMHS), 운항스케줄(FIDS), 비행계획 변동보(Doc 4444 AMHS), 항공고시보(NOTAM), 관제음성(LiveATC), 백그라운드 크롤러의 데이터 획득 및 API 호출 명세서입니다.

---

## 1. 인터페이스 요약 & 카탈로그

| NO | 인터페이스 명 | 표준 규격 | 주기 | 원천 소스 | 호출 엔드포인트 |
| :---: | :--- | :--- | :---: | :--- | :--- |
| **01** | **항적정보 (융합)** | ASTERIX Cat.062 | 1~2초 | OpenSky Network (ADS-B) | `GET /api/asterix?cat=62` |
| **02** | **항적정보 (개별)** | ASTERIX Cat.021 | 1~2초 | OpenSky Network (ADS-B) | `GET /api/asterix?cat=21` |
| **03** | **Radar 합성 항적** | ASTERIX Cat.048 | 4초 | OpenSky (Radar 변환) | `GET /api/asterix?cat=48&typ=COMBINED_PSR_SSR` |
| **04** | **지상이동체 항적** | ASTERIX Cat.010 | 1초 | OpenSky (Surface) | `GET /api/asterix?cat=10` |
| **05** | **레이더 상태 정보** | ASTERIX Cat.034 | 4초 | Mode-S North Mark | `GET /api/asterix?cat=34` |
| **06** | **Primary (PSR) 단독** | ASTERIX Cat.048 | 4초 | OpenSky (PSR) | `GET /api/asterix?cat=48&typ=SINGLE_PSR` |
| **07** | **Secondary (SSR) 단독**| ASTERIX Cat.048 | 4초 | OpenSky (SSR) | `GET /api/asterix?cat=48&typ=SINGLE_SSR` |
| **08** | **실시간 관제기상 (AMOS)**| JSON (55개 필드)| 1~2초 | AMO 항공기상청 (`AmosRealTimeMqc.do`) | `GET /api/weather?type=amos&icao=ALL` |
| **09** | **정규 기상보고 (METAR)**| AMHS IPM XML | 30분 | AMO (`global.amo.go.kr`) | `GET /api/amhs?type=METAR&icao=RKSI` |
| **10** | **공항 예보 (TAF)** | AMHS IPM XML | 6시간 | AMO (`global.amo.go.kr`) | `GET /api/amhs?type=TAF&icao=RKSS` |
| **11** | **위험기상특보 (SIGMET)**| AMHS IPM XML | 발생시 | AMO 항공기상청 | `GET /api/amhs?type=SIGMET` |
| **12** | **디지털 기상 (IWXXM)**| AMHS XML (Gzip)| 30분 | AMO IWXXM Feed | `GET /api/amhs?type=IWXXM&icao=RKSI` |
| **13** | **항공고시보 (NOTAM)** | AMHS SOAP XML | 5분 | AIM Korea (`aim.koca.go.kr`) | `GET /api/amhs?type=NOTAM&location=RKSI` |
| **14** | **운항스케줄 (FIDS)** | FIDS JSON | 10초 | UBIKAIS (`fois.go.kr:8030`) | `GET /api/flight-schedule?airport=ALL` |
| **15** | **비행계획서 (FPL)** | AMHS IPM XML | 스케줄 | UBIKAIS IFR 스케줄 | `GET /api/amhs?type=FPL&origin=RKSI` |
| **16** | **비행계획 변경보 (CHG)**| AMHS IPM XML | 변경시 | UBIKAIS IFR 변경 감지 | `GET /api/amhs?type=CHG&origin=RKSI` |
| **17** | **비행계획 취소보 (CNL)**| AMHS SOAP XML | 결항시 | UBIKAIS 결항 플래그 | `GET /api/amhs?type=CNL&origin=RKSI` |
| **18** | **비행 지연보 (DLA)** | AMHS SOAP XML | 지연시 | UBIKAIS ETD 지연 플래그 | `GET /api/amhs?type=DLA&origin=RKSI` |
| **19** | **출발보 (DEP)** | AMHS SOAP XML | 이륙시 | ADS-B + UBIKAIS | `GET /api/amhs?type=DEP&origin=RKSI` |
| **20** | **도착보 (ARR)** | AMHS SOAP XML | 착륙시 | ADS-B + UBIKAIS | `GET /api/amhs?type=ARR&dest=RKSI` |
| **21** | **관제음성 (LiveATC)** | AUDIO/MPEG | 실시간 | LiveATC.net | `GET /api/voice?channel=KJFK` |
| **22** | **전자비행스트립 (EFS)**| EFS JSON | 대기 | 사용자 자체 관제 시스템 | `GET /api/flight-schedule?airport=RKSI&efs=true` |
| **23** | **무저장 동기화 크롤러**| JSON (Status/Diff)| 5분 | Vercel Cron (`*/5 * * * *`) | `GET /api/crawler?status=true` |

---

## 2. 대화형 인터랙티브 도구 & Swagger UI

* **실시간 관제 대시보드**: [https://koreasurveillance.com/api-dashboard](https://koreasurveillance.com/api-dashboard)
* **대화형 Swagger UI**: [https://koreasurveillance.com/swagger](https://koreasurveillance.com/swagger) (또는 `/docs`)
* **OpenAPI 3.0 Raw JSON**: [https://koreasurveillance.com/openapi.json](https://koreasurveillance.com/openapi.json)

---

## 3. 언어별 API 호출 예제 코드

### 1) Python 예제
```python
import requests

BASE_URL = "https://www.koreasurveillance.com"

# 1. 전국 15개 공항 42개 활주로 AMOS 실시간 관측치 조회
amos_res = requests.get(f"{BASE_URL}/api/weather?type=amos&icao=ALL")
runways = amos_res.json()
print(f"수신된 활주로 센서 수: {len(runways)}")
print(f"인천 15R 순간풍: {runways[0].get('ws')} kts, 시정: {runways[0].get('mor1min')} m")

# 2. ASTERIX Cat.062 광역 융합 항적 조회
asterix_res = requests.get(f"{BASE_URL}/api/asterix?cat=62")
tracks = asterix_res.json()
print(f"실시간 추적 항공기 수: {len(tracks)}")

# 3. UBIKAIS 전국 운항스케줄 일괄 조회
sched_res = requests.get(f"{BASE_URL}/api/flight-schedule?airport=ALL")
sched_data = sched_res.json()
print(f"전국 총 운항 편수: {sched_data.get('totalNationwideFlights')}편")
```

### 2) JavaScript (Node.js / Browser) 예제
```javascript
const BASE_URL = 'https://www.koreasurveillance.com';

async function fetchAviationData() {
  // 1. AMHS METAR XML 기상전문 수신
  const metarRes = await fetch(`${BASE_URL}/api/amhs?type=METAR&icao=RKSI`);
  const metarXml = await metarRes.text();
  console.log('인천공항 METAR AMHS 전문:\n', metarXml);

  // 2. Vercel Pro 무저장 크롤러 상태 및 최근 변동 이벤트 확인
  const crawlerRes = await fetch(`${BASE_URL}/api/crawler?events=true`);
  const crawlerEvents = await crawlerRes.json();
  console.log('최근 감지된 변동 이벤트:', crawlerEvents.recentEvents);
}

fetchAviationData();
```

### 3) cURL 명령어
```bash
# 1. ASTERIX Cat.021 ADS-B 개별 타겟 조회
curl -s "https://www.koreasurveillance.com/api/asterix?cat=21"

# 2. 인천공항 실시간 ICAO Doc 4444 FPL 전문 조회
curl -s "https://www.koreasurveillance.com/api/amhs?type=FPL&origin=RKSI"

# 3. 크롤러 하트비트 점검
curl -s "https://www.koreasurveillance.com/api/crawler?status=true"
```

---

## 4. 아키텍처 및 무저장(Zero-Storage) 크롤러 작동 원리

1. **실시간 온더플라이(On-the-fly) 변환 (항적 1~7번)**:
   - 사용자가 `/api/asterix` 요청 시, OpenSky/ADS-B 실시간 피드를 0.05초 만에 ASTERIX 표준 바이너리/JSON 구조체로 파싱하여 응답합니다.
2. **무저장 인메모리 Diff 감지 (크롤러 23번)**:
   - Vercel Cron(`*/5 * * * *`)이 5분 주기로 `/api/crawler`를 실행합니다.
   - 직전 주기의 스케줄 해시 맵과 현재 스케줄을 메모리에서 비교하여 **결항(CNL), 이륙(DEP), 착륙(ARR), 지연(DLA)**만 즉시 감지합니다.
   - DB에 수만 건의 과거 데이터를 무한 적재하지 않으므로 저장소 용량 낭비가 전혀 없습니다.
