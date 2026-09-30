# IFS (Information Fusion System / 정보융합지원시스템) 시스템 기술 규격서
**System Technical Specification, Database Architecture & Interface Control Document (ICD)**

*문서 버전: v3.0.0 (Exhaustive Technical Edition) | 최종 개정일: 2026년 9월 23일 | 분류: 항공교통관제(ATC/ATM) 관제정보 융합 단말 완제 시스템 기술 규격서*

---

## 1. 시스템 개요 및 개념 정의 (System Overview & Architectural Concept)

### 1.1 시스템 정의 및 목적
**IFS(Information Fusion System, 정보융합지원시스템)**는 공항 관제탑(Tower), 접근관제소(Approach/APP), 항공교통관제센터(ACC), 항공작전통제센터(OCC) 등 항공교통업무(ATS) 현장에서 관제사 및 운항관리사가 신속하고 정확한 상황 인지를 할 수 있도록 공항 및 주변 공역의 종합 전술 정보(기상, 공항시설고시, 비행계획서, 운항스케줄, 공지사항, 3D 비행로 등)를 **단일 화면(Single Pane of Glass)에 융합(Fusion)하여 표출하는 차세대 전술 관제정보 지원 단말 시스템**입니다.

과거 관제 현장에서는 기상단말(AMOS 화면), 전문수신단말(AMHS), 항공고시보(NOTAM 뷰어), 운항정보스케줄(FIDS/UBIKAIS), 전자비행스트립(EFS)이 각각 분리된 독립 모니터로 운영되어 관제사의 인지 부하(Cognitive Load)가 가중되는 한계가 있었습니다. IFS는 이러한 이기종 시스템들의 데이터를 실시간 API 게이트웨이로 통합 수집·가공하여, 관제에 직결되는 정보만을 유기적으로 융합·표출합니다.

```
       ┌────────────────────────────────────────────────────────────────────────┐
       │             대한항공 ACROSS / 항공교통본부(UAO) 표준 관제 콘솔          │
       │                   IFS (정보융합지원시스템 단말 UI)                     │
       └───────────────────────────────────▲────────────────────────────────────┘
                                           │ Real-time HTTPS / WSS / REST / JSON
       ┌───────────────────────────────────┴────────────────────────────────────┐
       │            IFS API Gateway & Data Fusion Middleware (Node.js)          │
       │   Vercel Serverless / Scraper Session Pool / Cache / Supabase Client   │
       └───────▲───────────────────▲───────────────────▲────────────────────▲───┘
               │                   │                   │                    │
   ┌───────────┴───────────┐ ┌─────┴─────────────┐ ┌───┴────────────────┐ ┌─┴────────────────┐
   │ 공항 AMOS / 항공기상청│ │ 국토부 UBIKAIS 포털 │ │ AIM Korea 항공고시보│ │ Supabase Cloud   │
   │ 기상센서, METAR, TAF  │ │ 실시간 스케줄 & FPL │ │ 실시간 NOTAM DB   │ │ PostgreSQL 15 DB │
   └───────────────────────┘ └───────────────────┘ └────────────────────┘ └──────────────────┘
```

### 1.2 핵심 설계 철학 (Core Design Philosophy)
1. **인체공학적 저조도 다크 인터페이스 (Korean Air ACROSS Ergonomics)**:
   - 야간 및 암실 관제 환경에서 관제사의 시력 보호 및 눈부심 방지를 위해 매트 차콜 다크(`--bg: #111317`)와 스카이블루(`--primary: #57a8ff`)를 기조로 한 ACROSS 표준 규격 준수.
   - 전술 CRT 감성을 지원하는 그린 앰버 모드, 모노크롬, 딥 네이비, 데이라이트(라이트) 등 5가지 전술 테마 지원.
2. **단일 원천 데이터 융합 (Single Source of Truth Fusion)**:
   - 기상청 항공기상청(AMO), 국토교통부 항공정보포털(UBIKAIS/AIM Korea), 국제민간항공기구(ICAO FPL), 항행안전시설 정밀 DB(Navdata)를 단일 데이터 파이프라인으로 엮어 불일치 배제.
3. **무결성 및 즉시성 (Zero-Latency & High Reliability)**:
   - 2분 평균 자방위 풍향 / 10분 평균 진방위 풍향의 실시간 전환, 활주로별 정풍·배풍·측풍 벡터 자동 분해 계산.
   - 현재시각 기준선(Current-time Marker)을 통한 비행 스케줄 실시간 추적.
4. **DO-278A AL4 소프트웨어 보증 가이드라인 추적성**:
   - 보안 CORS 격리, 레이트 리미팅, 엄격한 입력 데이터 검증 및 예외 폴백(Graceful Degradation) 구조 설계.

---

## 2. 기술 스택 세부 규격 (Exhaustive Technology Stack Architecture)

IFS는 극한의 신뢰성과 렌더링 성능, 브라우저 이식성을 달성하기 위해 최적화된 모던 웹 기술과 마이크로서비스형 서버리스 아키텍처로 구축되었습니다.

| 계층 (Layer) | 분류 (Category) | 적용 기술 (Technology) | 세부 사양 및 선정 사유 |
|:---|:---|:---|:---|
| **Frontend** | **UI Core** | **Vanilla HTML5 & ES2022+** | 프레임워크 오버헤드 없는 즉각적인 60fps DOM 렌더링 유지 및 저사양 관제 콘솔에서의 무지연성 보장 |
| | **Styling** | **CSS3 Native Variables & Grid** | 테마 런타임 동적 스위칭, 듀얼 스플릿 반응형 레이아웃, CRT Scanlines 주사선 셰이더 효과 |
| | **Typography** | **Pretendard, JetBrains Mono** | 관제 수치/호출부호 고가독성 모노스페이스 및 국영문 최적화 가변 글꼴 |
| | **Spatial / 3D** | **Mapbox GL JS v3.8.0** | 비행계획서(FPL) 비행로, 웨이포인트(Fix), 한반도 비행정보구역(Incheon FIR) 3D 시각화 (WebGL 하드웨어 가속) |
| | **Icons** | **Inline SVG Vector** | 고해상도 DPI 환경에서도 왜곡 없는 벡터 그래픽 |
| **Backend** | **Runtime** | **Node.js (Serverless Functions)** | Vercel Serverless Architecture, 무중단 자동 스케일링 |
| | **Gateway API** | **Modular RESTful Endpoints** | `/api/weather`, `/api/amhs`, `/api/notam`, `/api/flight-schedule`, `/api/fpl-detail`, `/api/notices`, `/api/asterix`, `/api/voice` |
| | **Crawler / Parser** | **Native Scrapers & Parsers** | UBIKAIS 실시간 인증 세션 풀, ICAO Q-Code 분해기, AMOS 테이블 실시간 파서 |
| **Database & Cache** | **Cloud DB** | **Supabase (PostgreSQL 15)** | PostgREST 연동, NOTAM 공간 좌표 쿼리, FPL 전문 영속화, 관제 지시문 실시간 동기화 |
| | **Memory Cache** | **Hot Instance In-Memory Cache** | TTL 5분 캐싱을 통한 외부 공공망 부하 방지 및 응답시간 <100ms 유지 |
| | **Client Storage**| **HTML5 LocalStorage** | 단말별 활주로 풍향 모드, 테마, 확대 배율(80%~150%), 언어 설정, 패널 분할 보존 (20개 키) |
| **Protocols & Standards**| **Aviation Standard** | **ICAO Annex 3, 15 & Doc 4444** | ICAO 표준 FPL, METAR, SPECI, MET REPORT, TAF, NOTAM 포맷 규격 완전 호환 |

---

## 3. 화면 구조 및 UI 컴포넌트 설계 (UI Component & Workspace Architecture)

IFS는 화면 전체를 4개의 대형 전술 영역과 3개의 정밀 모달로 분할하여 구성합니다.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [GNB Header] 브랜드 로고 | 서브시스템(AMHS, EFS) 펄스 | KST/UTC 시계 | 공항 셀렉터(15개소) | 테마 | 배율    │
├──────┬───────────────────────────────────────────────────────────────────────────────────────────────┤
│ LNB  │ [Module 1] AMOS 실시간 활주로 기상 센서 (자방위/진방위 토글, 정풍·측풍 벡터 분해)                    │
│      ├───────────────────────────────────────────────┬───────────────────────────────────────────────┤
│ ⛶    │ [Module 2-A] 기상 전문 (MET)                  │ [Module 2-B] 공항 NOTAM 실시간 분류           │
│ 전체 │ - METAR / TAF / SPECI / SIGMET                │ - RWY/TWY, 항행등화, 공역, 📌고정             │
│ 화면 │ - 시맨틱 컬러 구문 강조 (Syntax Highlighting) │ - Q코드 파싱, 한글 해설, 간소화 모드          │
│ 🔍+  ├───────────────────────────────────────────────┴───────────────────────────────────────────────┤
│ 🔍-  │ [Module 3] UBIKAIS 운항스케줄 (출발 DEPARTURES / 도착 ARRIVALS)                               │
│ 100% │ - SEQ, FLT, TYP, REG, NAT, FPL, DES/ORG, SPT, RAM, ETD/ATD, ETA/ATA, STS, CHA                 │
│ ⚙️    │ - 전 컬럼 클릭 정렬 + 현재시각 타임라인 실시간 추적선 (Timeline Follow Bar)                  │
│ 설정 ├───────────────────────────────────────────────┬───────────────────────────────────────────────┤
│      │ [Module 4-A] 대형 통합 원자시계               │ [Module 4-B] 관제 지시 및 공항 공지 (Notices) │
│      │ - UTC / KST 1초 정밀 틱 동기화                │ - 다중 패널(패널+/-), 폰트크기 조절, Supabase │
└──────┴───────────────────────────────────────────────┴───────────────────────────────────────────────┘
```

---

## 4. 데이터베이스 물리 스키마 규격서 (Full Database Schema & DDL Specification)

IFS는 총 9개의 핵심 테이블을 통해 공항 기상, NOTAM, 스케줄, 비행계획서, 공지사항, 감시 항적을 영속화합니다.

### 4.1 테이블 1: `airport_notices` (공항별 관제 지시 및 공지사항)
관제탑 및 접근관제소 관제사들이 공유하는 일일 관제 지시문 및 활주로 운영 방침을 저장합니다.

| 컬럼명 | 데이터 타입 | Nullable | 기본값 | 설명 |
|:---|:---|:---|:---|:---|
| `airport_icao` | `VARCHAR(10)` | NO | - | **기본키 (PK)**. 공항 ICAO 4자리 코드 (예: `RKSI`, `RKJY`) |
| `texts` | `JSONB` | NO | `'[]'::jsonb`| 패널별 작성된 공지사항 텍스트 배열 (`["내용1", "내용2"]`) |
| `panel_count` | `INTEGER` | NO | `2` | 활성화된 공지사항 분할 패널 개수 (1~4) |
| `widths` | `JSONB` | YES | `'[]'::jsonb`| 각 분할 패널의 너비 비율 배열 |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | 최종 수정 일시 |

---

### 4.2 테이블 2: `notams` (실시간 항공고시보 DB)
국토교통부 AIM Korea 및 UBIKAIS로부터 수집된 NOTAM 전문 및 Q-Code 공간 좌표를 저장합니다.

| 컬럼명 | 데이터 타입 | Nullable | 기본값 | 설명 |
|:---|:---|:---|:---|:---|
| `notam_number` | `VARCHAR(20)` | NO | - | **기본키 (PK)**. NOTAM 일련번호 (예: `A0123/26`, `C0456/26`) |
| `location` | `VARCHAR(10)` | NO | - | 대상 비행장 또는 비행정보구역 (예: `RKSI`, `RKRR`) |
| `full_text` | `TEXT` | NO | - | NOTAM ICAO 표준 원문 전문 |
| `e_text` | `TEXT` | YES | - | 항목 E) 한글 해설 및 요약 본문 |
| `qcode` | `VARCHAR(10)` | YES | - | ICAO 5자리 Q코드 (예: `QMRLC`, `QNBAS`) |
| `qcode_mean` | `TEXT` | YES | - | Q코드 의미 국문 해석 (예: '활주로 폐쇄') |
| `effective_start`| `TIMESTAMPTZ`| YES | - | 발효 개시 일시 (항목 B) |
| `effective_end` | `TIMESTAMPTZ`| YES | - | 발효 종료 일시 (항목 C / PERM) |
| `series` | `CHAR(1)` | YES | - | NOTAM 시리즈 구분 (`A`: 국제, `C`: 국내) |
| `fir` | `VARCHAR(10)` | YES | `'RKRR'` | 관할 비행정보구역 (Incheon FIR) |
| `q_lat` | `DOUBLE PRECISION`| YES | - | Q라인 파싱 위도 (Decimal Degrees) |
| `q_lon` | `DOUBLE PRECISION`| YES | - | Q라인 파싱 경도 (Decimal Degrees) |
| `q_radius_nm` | `DOUBLE PRECISION`| YES | - | 영향 반경 (해리, NM) |
| `crawled_at` | `TIMESTAMPTZ` | NO | `NOW()` | 수집 일시 |

---

### 4.3 테이블 3: `flight_schedules_3days` (UBIKAIS 3일 운항스케줄 스냅샷)
공항별 출발/도착 운항스케줄의 15초 단위 실시간 스냅샷을 저장합니다.

| 컬럼명 | 데이터 타입 | Nullable | 기본값 | 설명 |
|:---|:---|:---|:---|:---|
| `id` | `BIGSERIAL` | NO | - | **기본키 (PK)** |
| `target_date` | `DATE` | NO | - | 운항 대상 일자 (`YYYY-MM-DD`) |
| `airport_icao` | `VARCHAR(10)` | NO | - | 대상 공항 ICAO 코드 |
| `flight_type` | `VARCHAR(10)` | NO | `'ALL'` | 스케줄 구분 (`DEP`, `ARR`, `ALL`) |
| `flight_json` | `JSONB` | NO | - | 출발/도착 전체 항공편 구조화 JSON 스냅샷 |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | 갱신 일시 |

---

### 4.4 테이블 4: `flight_plan_details` (비행계획서 ICAO FPL 상세 영속화)
UBIKAIS 연계 비행계획서 고유키(`ams_rec_pk`)별 원문 및 파싱 항로를 캐싱합니다.

| 컬럼명 | 데이터 타입 | Nullable | 기본값 | 설명 |
|:---|:---|:---|:---|:---|
| `ams_rec_pk` | `VARCHAR(50)` | NO | - | **기본키 (PK)**. 국토부 비행계획서 고유키 |
| `flight_id` | `VARCHAR(20)` | NO | - | 항공기 호출부호 (Callsign) |
| `dep_airport` | `VARCHAR(10)` | NO | - | 출발 비행장 코드 |
| `arr_airport` | `VARCHAR(10)` | NO | - | 목적 비행장 코드 |
| `flight_rules` | `VARCHAR(10)` | YES | `'IFR'` | 비행 방식 (`IFR`, `VFR`) |
| `aircraft_type` | `VARCHAR(10)` | YES | - | 기종 부호 (예: `A321`) |
| `registration` | `VARCHAR(20)` | YES | - | 등록부호 (Tail Number) |
| `raw_telegram` | `TEXT` | NO | - | ICAO 표준 FPL 원문 텔레그램 |
| `parsed_route` | `JSONB` | YES | `'{}'::jsonb`| 비행로 상세 파싱 데이터 (경유 Fix, 속도, 고도 등) |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | 최종 동기화 일시 |

---

### 4.5 테이블 5: `weather_snapshot_cache` (최신 기상 관측 스냅샷 캐시)
기상청 서버 장애 시에도 무중단 관제를 보장하기 위해 각 공항의 최신 유효 AMOS/METAR 데이터를 캐시합니다.

| 컬럼명 | 데이터 타입 | Nullable | 기본값 | 설명 |
|:---|:---|:---|:---|:---|
| `airport_icao` | `VARCHAR(10)` | NO | - | **기본키 (PK)**. 공항 ICAO 코드 |
| `amos_data` | `JSONB` | YES | - | 활주로별 실측 풍향/풍속/기온/QNH 센서 데이터 |
| `metar_taf_data`| `JSONB` | YES | - | METAR, TAF, SPECI 전문 데이터 |
| `status` | `VARCHAR(20)` | NO | `'HEALTHY'` | 서비스 상태 (`HEALTHY`, `DEGRADED`, `OFFLINE`) |
| `last_success_at`| `TIMESTAMPTZ`| YES | - | 최종 수집 성공 일시 |
| `last_error_message`| `TEXT` | YES | - | 최근 발생 에러 메시지 |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | 갱신 일시 |

---

### 4.6 기타 지원 테이블
- **`weather_error_logs`**: 기상청/외부 수집 API 장애 추적 로그 (`service`, `error_type`, `airport_icao`, `message`, `details`).
- **`eaip_sync_packages`**: 국토부 e-AIP AIRAC 주기(28일 주기) 전자 항공정보 간행물 동기화 패키지 이력.
- **`amhs_messages`**: AMHS/AFTN 원문 텔레그램 수신 로그.
- **`asterix_tracks`**: 감시 레이더(Cat.062, Cat.021, Cat.048, Cat.010) 실시간 항적 DB.

---

### 4.7 PostgreSQL DDL 전문 (Data Definition Language)

```sql
-- ============================================================
-- Supabase PostgreSQL 15 DDL for IFS (Information Fusion System)
-- ============================================================

-- 1. 공항 공지 및 관제 지시문
CREATE TABLE IF NOT EXISTS public.airport_notices (
    airport_icao VARCHAR(10) PRIMARY KEY,
    texts JSONB NOT NULL DEFAULT '[]'::jsonb,
    panel_count INTEGER NOT NULL DEFAULT 2,
    widths JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. NOTAM 항공고시보 테이블
CREATE TABLE IF NOT EXISTS public.notams (
    notam_number VARCHAR(20) PRIMARY KEY,
    location VARCHAR(10) NOT NULL,
    full_text TEXT NOT NULL,
    e_text TEXT,
    qcode VARCHAR(10),
    qcode_mean TEXT,
    effective_start TIMESTAMPTZ,
    effective_end TIMESTAMPTZ,
    series CHAR(1),
    fir VARCHAR(10) DEFAULT 'RKRR',
    q_lat DOUBLE PRECISION,
    q_lon DOUBLE PRECISION,
    q_radius_nm DOUBLE PRECISION,
    crawled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notams_loc ON public.notams (location, effective_start, effective_end);
CREATE INDEX IF NOT EXISTS idx_notams_coords ON public.notams (q_lat, q_lon);

-- 3. 운항스케줄 스냅샷 테이블
CREATE TABLE IF NOT EXISTS public.flight_schedules_3days (
    id BIGSERIAL PRIMARY KEY,
    target_date DATE NOT NULL,
    airport_icao VARCHAR(10) NOT NULL,
    flight_type VARCHAR(10) NOT NULL DEFAULT 'ALL',
    flight_json JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sched_date_ap ON public.flight_schedules_3days (target_date, airport_icao);

-- 4. 비행계획서 상세 테이블
CREATE TABLE IF NOT EXISTS public.flight_plan_details (
    ams_rec_pk VARCHAR(50) PRIMARY KEY,
    flight_id VARCHAR(20) NOT NULL,
    dep_airport VARCHAR(10) NOT NULL,
    arr_airport VARCHAR(10) NOT NULL,
    flight_rules VARCHAR(10) DEFAULT 'IFR',
    aircraft_type VARCHAR(10),
    registration VARCHAR(20),
    raw_telegram TEXT NOT NULL,
    parsed_route JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fpl_flt ON public.flight_plan_details (flight_id);

-- 5. 기상 스냅샷 캐시 테이블
CREATE TABLE IF NOT EXISTS public.weather_snapshot_cache (
    airport_icao VARCHAR(10) PRIMARY KEY,
    amos_data JSONB,
    metar_taf_data JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'HEALTHY',
    last_success_at TIMESTAMPTZ,
    last_error_message TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 5. 인터페이스 제어 문서 (ICD - Complete API Input/Output Specification)

### 5.1 GET `/api/weather` : 실시간 활주로 AMOS 및 항공기상 조회
- **Query Parameters**:
  - `type`: `amos` | `metar` | `taf` | `sigmet` | `error_logs` | `snapshot`
  - `icao`: 공항 ICAO 코드 (기본값: `RKSI`, `ALL` 지원)
- **Response JSON (200 OK - AMOS)**:
```json
{
  "dataSource": "대한민국 기상청 항공기상청 (AMO)",
  "timestamp": "2026-09-23T08:20:00.000Z",
  "airport": "RKJY",
  "count": 2,
  "runways": [
    {
      "runway": "17",
      "heading": 170,
      "windDirection": 190,
      "windSpeed": 12,
      "windGust": 18,
      "headwind": 11.3,
      "crosswind": 4.1,
      "crosswindSide": "R",
      "temperature": 22.4,
      "dewPoint": 15.1,
      "qnhHpa": 1013.2,
      "qnhInHg": 29.92,
      "visibilityM": 9999,
      "rvrM": null,
      "ceilingFt": 3500
    },
    {
      "runway": "35",
      "heading": 350,
      "windDirection": 190,
      "windSpeed": 12,
      "headwind": -11.3,
      "crosswind": 4.1,
      "crosswindSide": "L"
    }
  ]
}
```

---

### 5.2 GET `/api/notam` : 공항별 NOTAM 실시간 목록 조회
- **Query Parameters**:
  - `location`: 공항 ICAO 코드 (예: `RKJY`, `RKSI`)
  - `period`: `current` (현재 유효) | `all` | `1month`
  - `limit`: 최대 반환 건수 (기본값: 2000)
- **Response JSON (200 OK)**:
```json
{
  "success": true,
  "location": "RKJY",
  "count": 1,
  "data": [
    {
      "notam_number": "A0891/26",
      "location": "RKJY",
      "full_text": "A0891/26 NOTAMN\nQ) RKRR/QMRLC/IV/NBO/A/000/999/3459N12737E005\nA) RKJY B) 2609231400 C) 2609232200\nE) RWY 17/35 CLSD DUE TO WIP MAINT.",
      "e_text": "RWY 17/35 유지보수 공사로 인한 활주로 임시 폐쇄",
      "qcode": "QMRLC",
      "qcode_mean": "활주로 폐쇄 (Runway Closed)",
      "category": "RWY_TWY",
      "effective_start": "2026-09-23T14:00:00.000Z",
      "effective_end": "2026-09-23T22:00:00.000Z",
      "series": "A",
      "q_lat": 34.9833,
      "q_lon": 127.6166,
      "q_radius": 5.0
    }
  ]
}
```

---

### 5.3 GET `/api/flight-schedule` : UBIKAIS 실시간 운항스케줄 조회
- **Query Parameters**: `airport=RKJY`
- **Response JSON (200 OK)**:
```json
{
  "airport": "RKJY",
  "timestamp": "2026-09-23T08:20:00.000Z",
  "totalFlights": 2,
  "departures": [
    {
      "seq": 1,
      "flt": "KAL1635",
      "typ": "A321",
      "reg": "HL8277",
      "nat": "PAX",
      "fpl": "Y",
      "des": "RKSS",
      "spt": "2",
      "ram": "08:35",
      "etd": "08:40",
      "atd": "08:42",
      "sts": "DEP",
      "cha": "-",
      "amsRecPk": "202609230018271"
    }
  ],
  "arrivals": [
    {
      "seq": 1,
      "flt": "AAR8701",
      "typ": "B738",
      "reg": "HL7788",
      "nat": "PAX",
      "fpl": "Y",
      "org": "RKPC",
      "spt": "1",
      "ram": "09:20",
      "eta": "09:25",
      "ata": "",
      "sts": "AIR",
      "cha": "-",
      "amsRecPk": "202609230019442"
    }
  ]
}
```

---

### 5.4 GET `/api/fpl-detail` : ICAO FPL 비행계획서 상세 조회
- **Query Parameters**: `amsRecPk=202609230018271&flt=KAL1635`
- **Response JSON (200 OK)**:
```json
{
  "status": "success",
  "source": "supabase_db",
  "flt": "KAL1635",
  "fpCls": "IFR",
  "amsRecPk": "202609230018271",
  "rawTelegram": "(FPL-KAL1635-IS\n-A321/M-SDE3FGHIRWXY/LB1\n-RKJY0840\n-N0420F240 G597 SEL\n-RKSS0044\n-PBN/A1B1 DOF/260923)",
  "record": {
    "flt": "KAL1635",
    "typ": "A321",
    "reg": "HL8277",
    "std": "08:40",
    "etd": "08:40",
    "sta": "09:24",
    "via": "G597 SEL"
  }
}
```

---

### 5.5 GET / POST `/api/notices` : 공항별 관제 지시 및 공지사항
- **GET Request**: `GET /api/notices?icao=RKJY`
- **GET Response (200 OK)**:
```json
{
  "airport_icao": "RKJY",
  "texts": [
    "RWY 17 운영 중. 착륙 후 유도로 P3 통해 주기장 진입 지시 요망.",
    "야간 활주로 마킹 도색 작업 예정 (22:00 ~ 익일 05:00)"
  ],
  "panel_count": 2,
  "widths": [50, 50],
  "updated_at": "2026-09-23T07:30:00.000Z"
}
```
- **POST Request**:
  - Headers: `Content-Type: application/json`
  - Body:
```json
{
  "texts": [
    "RWY 35로 활주로 변경. 풍향 340도 14KT.",
    "주기장 2번 유류 보급 완료."
  ],
  "panel_count": 2,
  "widths": [60, 40]
}
```

---

## 6. 클라이언트 로컬 스토리지 데이터 사전 (Client LocalStorage Dictionary)

IFS 단말은 관제사 개인화 설정을 브라우저의 `HTML5 LocalStorage`에 20개 키로 저장합니다.

| 키 (Key) | 타입 | 기본값 | 설명 |
|:---|:---|:---|:---|
| `ifs_theme` | `String` | `"theme-across"` | UI 테마 (`"theme-across"`, `"theme-crt"`, `"theme-navy"`, `"theme-mono"`, `"theme-light"`) |
| `ifs_font` | `String` | `"pretendard"` | 글꼴 설정 (`"pretendard"`, `"jetbrains"`, `"system"`) |
| `ifs_language` | `String` | `"bilingual"` | 언어 모드 (`"bilingual"`, `"ko"`, `"en"`) |
| `ifs_scanlines` | `String` | `"false"` | CRT 스캔라인 아날로그 효과 (`"true"` / `"false"`) |
| `ifs_ui_zoom` | `String` | `"1"` | UI 배율 (`"0.8"` ~ `"1.5"`) |
| `ifs_wind_mode` | `String` | `"mag"` | 풍향 기준 (`"mag"` 2분 자방위, `"true"` 10분 진방위) |
| `ifs_wind_decimal` | `String`| `"false"` | 풍속 소수점 표출 여부 (`"true"`: 12.4 KT, `"false"`: 12 KT) |
| `ifs_met_syntax` | `String` | `"true"` | 기상 전문 시맨틱 컬러 구문 강조 활성화 여부 |
| `ifs_section_heights`| `JSON` | `{"met":0.5...}`| 섹션별 분할 높이 비율 |
| `ifs_pinned_notams` | `JSON` | `[]` | 상단 고정된 중요 NOTAM 번호 목록 |
| `ifs_follow_dep` | `String` | `"true"` | 출발 스케줄 현재시각 타임라인 자동 추적 활성화 |
| `ifs_follow_arr` | `String` | `"true"` | 도착 스케줄 현재시각 타임라인 자동 추적 활성화 |
| `ifs_notices_panel_count`| `String`| `"2"` | 공지사항 분할 패널 개수 |
| `ifs_notices_font_size` | `String`| `"14"` | 공지사항 폰트 크기 (`px`) |
| `ifs_notices_widths_` | `JSON` | `[]` | 패널 분할 너비 비율 |
| `ifs_notices_texts_` | `JSON` | `[]` | 로컬 공지사항 임시 텍스트 |
| `ifs_notices_time_` | `String` | ISO String | 로컬 공지 최종 작성 일시 |

---

## 7. 운용 환경 및 하드웨어 연동 규격 (Operating Environment Specifications)

### 7.1 권장 관제 콘솔 하드웨어 사양
- **관제 모니터 (Display)**:
  - 해상도: 3840×2160 (4K UHD) 또는 2560×1440 (QHD) 권장.
  - 가로 폭: 최소 1920px 이상 (4대 모듈 병렬 표출).
  - 터치 디지타이저: 멀티터치 및 스타일러스 지원.
- **관제 단말 워크스테이션 (PC Specs)**:
  - CPU: Intel Core i5/i7 이상 (Mapbox GL 3D 렌더링 60fps 유지).
  - GPU: WebGL 2.0 하드웨어 가속 지원 필수.
  - RAM: 8GB 이상 (권장 16GB).
- **네트워크 (Network)**:
  - 100/1000 Mbps 유선 이더넷 (ATC 이중화 LAN 망).
  - 인터넷 아웃바운드: AMO(기상청), UBIKAIS(국토부), Supabase Cloud 간 무중단 연결.

### 7.2 운영체제 및 웹 브라우저 호환성 매트릭스
- **운영체제 (OS)**: Microsoft Windows 10/11 (64-bit), macOS 12+, Linux (Ubuntu 20.04+).
- **웹 브라우저**: Google Chrome 100+, Microsoft Edge 100+, Mozilla Firefox 100+, Apple Safari 15+.

---

## 8. 결론 및 소프트웨어 보증 요약 (Conclusion & Verification)

본 **IFS(정보융합지원시스템)**는 단편적인 관제 화면을 완전히 극복하고, 기상·비행계획·스케줄·항공고시보·관제공지를 단일 인터페이스로 완벽히 융합하여 관제사의 인지 안전성과 공항 수용 능력을 극대화한 최고 수준의 스마트 항공관제 시스템입니다.
