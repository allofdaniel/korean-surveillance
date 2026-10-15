# EFS (Electronic Flight Strip / 전자비행스트립) 시스템 기술 규격서
**System Technical Specification, Database Architecture & Interface Control Document (ICD)**

*문서 버전: v3.0.0 (Exhaustive Technical Edition) | 최종 개정일: 2026년 9월 23일 | 분류: 항공교통관제(ATC/ATM) 전자비행스트립 완제 시스템 기술 규격서*

---

## 1. 시스템 개요 및 개념 정의 (System Overview & Architectural Concept)

### 1.1 시스템 정의 및 목적
**EFS (Electronic Flight Strip, 전자비행스트립)**는 공항 관제탑(Tower), 지상관제(Ground), 계류장관제(Ramp), 접근관제소(Approach) 및 지역관제센터(ACC)에서 항공기의 출발(DEP), 도착(ARR), 공역통과(TRN), 훈련장주(CCT) 등 전 비행 단계의 관제 진행 상태를 실시간으로 통제하고 관리하는 **차세대 웹 기반 디지털 전술 전자비행스트립 시스템**입니다.

과거 종이 비행스트립(Paper Strip)을 출력하여 플라스틱 홀더에 꽂고 물리적 보드(Bay)에서 손으로 옮겨가며 관제하던 아날로그 프로세스를 100% 디지털화하였으며, **ICAO Doc 4444(PANS-ATM), AMHS/AFTN 항공전문 통신망, 국토교통부 UBIKAIS 운항스케줄, A-CDM(공항협력적의사결정)**을 단일 인터페이스로 융합하여 관제사의 인지 부하를 획기적으로 낮추고 안전성을 극대화하도록 설계되었습니다.

```
       ┌────────────────────────────────────────────────────────────────────────┐
       │             대한항공 ACROSS / 항공교통본부(UAO) 표준 관제 콘솔          │
       │                   EFS (전자비행스트립 프론트엔드 단말 UI)              │
       └───────────────────────────────────▲────────────────────────────────────┘
                                           │ Real-time HTTPS / WSS / REST / JSON
       ┌───────────────────────────────────┴────────────────────────────────────┐
       │               EFS API Gateway & Message Processor Middleware           │
       │   Vercel Serverless / Node.js ES2022+ / Custom AMHS Message Parser     │
       └───────▲───────────────────▲───────────────────▲────────────────────▲───┘
               │                   │                   │                    │
   ┌───────────┴───────────┐ ┌─────┴─────────────┐ ┌───┴────────────────┐ ┌─┴────────────────┐
   │ AMHS/AFTN 항공전문망  │ │ UBIKAIS 국토부 DB │ │ Wacom Digitizer    │ │ Supabase Cloud   │
   │ FPL/CHG/CNL/DEP/ARR   │ │ 실시간 운항 스케줄│ │ EMR/AES 펜 수기필기│ │ PostgreSQL 15 DB │
   └───────────────────────┘ └───────────────────┘ └────────────────────┘ └──────────────────┘
```

### 1.2 전통 종이 스트립 대비 EFS의 6대 핵심 혁신
1. **초소형 전술 높이 규격 (`--strip-card-h: 68px`)**:
   - 기존의 과도하게 큰 디지털 스트립으로 인한 스크롤 부담을 원천 차단하고, 단일 4K/QHD 화면에 최대 4개 베이와 수십 편의 항공기 스트립을 스크롤 없이 한눈에 감시할 수 있는 밀도 최적화 설계.
2. **와콤(Wacom) 스타일러스 펜 전자 수기 필기 (Digital Inking System)**:
   - 관제사의 오랜 직관적 업무 습관인 '스트립 위 수기 펜 기입(인가 고도 체크, 헤딩 기입, 취소선)'을 브라우저 듀얼 레이어 캔버스로 100% 보존.
   - 하드웨어 레벨의 `pointerType === 'pen'` 인식 및 손바닥 닿음을 완벽 차단하는 **Palm Rejection** 내장.
3. **시각적 와이어프레임 스트립 구성기 (Visual Wireframe Builder)**:
   - 공항 및 관제 석(Delivery, Ground, Tower)마다 상이한 스트립 표기 규격을 관제사가 직접 드래그 앤 드롭으로 재배치하는 5구역 25슬롯 실시간 커스터마이징 엔진.
4. **Universal Pointer Drag & Drop Engine**:
   - 브라우저 기본 HTML5 Drag&Drop API의 터치/펜 미지원 결함을 극복하기 위해 `PointerEvent`(`pointerdown`, `pointermove`, `pointerup`) 기반 독자 엔진 구축 (마우스, 와콤 펜, 터치스크린 100% 호환).
5. **16컬럼 엑셀 비행스트립 대량 일괄 등록기 (Excel Batch Grid Drawer)**:
   - 복잡한 모달 창을 반복해서 띄울 필요 없이, 하단 서랍형 엑셀 그리드에서 전 세계 모든 공항(ICAO 4자리)과 비행 제원을 스프레드시트처럼 행 단위로 신속하게 일괄 등록.
6. **실시간 A-CDM & 활주로 롤아웃 타이머 (Rollout Timer)**:
   - 이륙 및 착륙 활주 시 활주로 점유 시간을 초 단위로 실시간 카운트다운/업하여 녹색(정상) → 황색(주의) → 적색(위험)으로 자동 경고 표출.

---

## 2. 기술 스택 세부 규격 (Exhaustive Technology Stack Architecture)

EFS는 항공관제 현장의 특수성인 **무지연성(Zero-Latency), 극한의 렌더링 신뢰성, 하드웨어 상호운용성**을 만족하기 위해 다음의 검증된 기술 스택으로 구성됩니다.

| 계층 (Layer) | 분류 (Category) | 적용 기술 (Technology) | 세부 사양 및 선정 사유 |
|:---|:---|:---|:---|
| **Frontend** | **UI Core** | **Vanilla HTML5 & ES2022+** | React/Vue 등 가상 DOM 프레임워크의 오버헤드를 배제하고, 순수 DOM 조작을 통해 수백 개의 스트립 상태 변화 시에도 60fps 렌더링 유지 |
| | **Styling** | **CSS3 Grid & CSS Custom Properties** | 전술 다크 테마, 4대 베이 시그니처 색상 변수, 고정 68px 높이 강제(`!important`), CRT 스캔라인 아날로그 주사선 효과 |
| | **Typography** | **Pretendard, JetBrains Mono, Space Grotesk** | 관제 호출부호 및 숫자에 최적화된 고시인성 모노스페이스 타이포그래피 (글꼴 간격 왜곡 및 가독성 저하 차단) |
| | **Bay DnD** | **SortableJS v1.15.2 (Embedded)** | 베이 내 스트립 순서 정렬 및 베이 간 물리적 드래그 이동 (외부 CDN 장애 시에도 동작 가능한 100% 인라인 내장) |
| | **Pointer DnD**| **Universal Pointer Event Engine** | 와이어프레임 빌더 전용 (마우스, 와콤 펜, 터치스크린 100% 호환 드래그 앤 드롭 및 4px 이동 판정 알고리즘) |
| | **Inking API** | **HTML5 Dual-Layer 2D Canvas** | 와콤 스타일러스 펜 입력 감지(`pointerType === 'pen'`), 팜 리젝션, 지우개 토글, 전자 잉크 벡터 궤적 렌더링 |
| **Backend** | **Runtime** | **Node.js (Serverless Functions)** | Vercel Serverless Architecture, 무중단 자동 스케일링, 인스턴스 콜드스타트 최소화 |
| | **Gateway API** | **`/api/efs` (RESTful Endpoint)** | 스트립 CRUD, 베이 시퀀싱, AMHS 전문 수신/파싱, 엑셀 배치 일괄 등록, 데모 데이터 리셋 |
| | **AMHS Parser**| **Custom Aeronautical Parser** | ICAO Annex 10/11 준수 FPL, CHG, CNL, DLA, DEP, ARR, IPN(NDR/DR) XML/SOAP/AFTN 정규식 파서 |
| **Database** | **Cloud DB** | **Supabase (PostgreSQL 15)** | `efs_flight_strips` (스트립 본체), `efs_amhs_messages` (전문 수신 이력), `efs_strip_logs` (관제 조작 감사 로그) |
| | **Realtime** | **Supabase Realtime (WebSocket)** | PostgreSQL WAL 변경 사항을 프론트엔드로 즉각 브로드캐스팅 (`INSERT`, `UPDATE`, `DELETE`) |
| | **Local Storage**| **HTML5 LocalStorage** | 10개 핵심 키 기반 단말별 레이아웃 분할비, 와이어프레임 슬롯 구성(v2), 테마, 줌 배율 영구 보존 |
| **Protocols**| **Security & Net**| **HTTPS (TLS 1.3), WSS, CORS Isolated** | DO-278A SRS-SEC-001/002 준수 안전 CORS 헤더, IP 기반 토큰 버킷 레이트 리미터 (120 req/min) |
| **Standards**| **Aviation Stds**| **ICAO Doc 4444, Eurocontrol EFS, A-CDM** | PANS-ATM 5대 구역 스트립 표준, 공항 A-CDM 시간 지표(EOBT, SOBT, TSAT, TTOT) 완벽 연계 |

---

## 3. 화면 구조 및 UI 컴포넌트 설계 (UI Component & Workspace Architecture)

EFS의 화면은 2개 라인의 통합 헤더, 좌측 제어 레일(LNB), 4개의 멀티 베이 작업 공간, 하단 엑셀 일괄 등록 서랍장으로 구성됩니다.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [Header Line 1] 대한항공 공식 로고 | 전자비행스트립 [EFS] | AMHS 서버 하트비트 펄스 (100% ONLINE)             │
│ [Header Line 2] 공항 선택(RKSI/RKSS/RKPC...) | 4대 베이 토글 [출발][도착][통과][장주] | [균등분할] [레이아웃저장] │
│                 와콤 펜 툴바: [펜:AUTO] [●적색] [●청색] [●형광색] [지우개] [굵기:1/2/4] [전체펜지움]          │
├──────┬───────────────────────────────┬───────────────────────────────┬───────────────────────────────┤
│ LNB  │ [BAY 1] DEPARTURE (출발 베이) │ [BAY 2] ARRIVAL (도착 베이)   │ [BAY 3] TRANSIT (통과) /      │
│      │ Green (#00e475)               │ Amber (#fbcb41)               │ [BAY 4] CIRCUIT (장주)        │
│ ⛶    ├───────────────────────────────┼───────────────────────────────┼───────────────────────────────┤
│ 전체 ├─ [활성 영역] RUNWAY / TAXI ───┼─ [활성 영역] FINAL / LANDED ──┼─ [활성 영역] ENROUTE / AIR ───┤
│ 화면 │  - 스트립 카드들 (고정 68px)  │  - 스트립 카드들 (고정 68px)  │  - 스트립 카드들 (고정 68px)  │
│ 🔍+  │  - 롤아웃 타이머 작동         │  - 착륙 감시 카운트           │  - 관제 섹터 이양 관리        │
│ 🔍-  ├─ 수직 스플릿 리사이저 ────────┼─ 수직 스플릿 리사이저 ────────┼─ 수직 스플릿 리사이저 ────────┤
│ 100% ├─ [대기열 영역] QUEUE / STANDBY ┼─ [대기열 영역] QUEUE / STANDBY ┼─ [대기열 영역] STANDBY ────────┤
│ ⚙️    │  - 출발 인가/탑승 대기 스트립 │  - 접근 진입 예정 스트립      │  - 비행계획 접수 대기         │
│ 설정 │  - 비행계획(FPL) 수신 스트립  │  - 비행계획(FPL) 수신 스트립  │  - 훈련 비행 스케줄           │
├──────┴───────────────────────────────┴───────────────────────────────┴───────────────────────────────┤
│ [하단 엑셀 일괄 등록 서랍장] 16컬럼 엑셀 비행스트립 대량 등록기 (Excel Batch Grid Drawer)             │
│ [+ 행 추가] [일괄 등록] [서랍 닫기]                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 4대 멀티 베이 및 동적 리사이징 사양
1. **출발 베이 (DEPARTURE - Green `#00e475`)**:
   - 비행인가(DEL) → 지상유도(GND) → 활주로 정렬/이륙(TWR) → 공중(AIRBORNE).
2. **도착 베이 (ARRIVAL - Amber `#fbcb41`)**:
   - 레이더 접근(APP) → 최종접근(FINAL) → 착륙완료(LANDED) → 주기장 유도(TAXI IN).
3. **통과 베이 (TRANSIT - Blue `#57a8ff`)**:
   - 관제탑/접근 공역 통과(OVERFLIGHT) 항공편 전용.
4. **장주 베이 (CIRCUIT - Purple `#c084fc`)**:
   - 비행훈련원 및 훈련기 전용 장주비행(Circuit / Touch & Go / Low Approach).
- **2D 동적 리사이징 엔진**:
   - 베이 간 수평 리사이저(`.bay-col-resizer`): 드래그하여 각 베이의 너비를 픽셀 단위로 실시간 조정.
   - 영역 간 수직 리사이저(`.bay-split-resizer`): 활성 영역과 대기열 영역의 상하 높이 비율을 0.1~0.9 범위로 분할.

---

## 4. 데이터베이스 물리 스키마 규격서 (Full Database Schema & DDL Specification)

EFS는 클라우드 분산 환경에서 관제 스트립 데이터의 정합성과 실시간성을 보장하기 위해 Supabase PostgreSQL 15 데이터베이스를 사용합니다.

### 4.1 테이블 1: `efs_flight_strips` (전자비행스트립 본체)
관제사가 조작하는 모든 비행스트립의 핵심 제원 및 실시간 관제 상태를 영속화합니다.

| 컬럼명 (Column) | 데이터 타입 (Data Type) | Nullable | 기본값 (Default) | 제약조건 및 세부 설명 |
|:---|:---|:---|:---|:---|
| `id` | `TEXT` | NO | - | **기본키 (PK)**. 고유 식별자 (예: `FS-KAL1205-01`, `FPL-AMU821-RKSI`) |
| `callsign` | `VARCHAR(20)` | NO | - | 항공기 호출부호 (예: `KAL1205`, `AMU821`, `AAR8948`) |
| `operation_type` | `VARCHAR(20)` | NO | `'DEPARTURE'` | 운항 구분: `DEPARTURE`, `ARRIVAL`, `TRANSIT`, `CIRCUIT` |
| `status` | `VARCHAR(30)` | NO | `'STANDBY'` | 관제 진행 상태 (`STANDBY`, `PUSHBACK`, `TAXIOUT`, `LINEUP`, `TAKEOFF`, `AIRBORNE`, `FINAL`, `LANDED`, `TAXIIN`, `CANCELLED`, `DELAYED`) |
| `aircraft_type` | `VARCHAR(10)` | YES | `'B738'` | ICAO 4자리 기종 코드 (예: `B738`, `A321`, `B77W`, `A333`) |
| `wake_category` | `CHAR(1)` | YES | `'M'` | 후류 난기류 등급 (`L`: Light, `M`: Medium, `H`: Heavy, `J`: Super) |
| `beacon_code` | `VARCHAR(10)` | YES | `'1200'` | SSR 트랜스폰더 스쿼크 코드 (예: `7201`, `7104`, `A2622`) |
| `ssr_code` | `VARCHAR(10)` | YES | `'1200'` | `beacon_code`와의 호환성 유지 필드 |
| `departure_airport`| `VARCHAR(10)` | NO | `'RKSI'` | 출발공항 ICAO 4자리 코드 (예: `RKSI`, `RKSS`, `RKPC`) |
| `arrival_airport` | `VARCHAR(10)` | NO | `'RKPC'` | 목적공항 ICAO 4자리 코드 (예: `RKPC`, `VMMC`, `ZSHC`) |
| `dep_airport` | `VARCHAR(10)` | YES | - | `departure_airport` 단축 필드 |
| `arr_airport` | `VARCHAR(10)` | YES | - | `arrival_airport` 단축 필드 |
| `route` | `TEXT` | YES | - | 비행계획서 ICAO 경로 문자열 (예: `BOPTA Z51 BEDES Y711`) |
| `altitude` | `VARCHAR(20)` | YES | `'FL330'` | 계획 순항 고도 (예: `FL330`, `FL280`, `3000FT`) |
| `assigned_altitude`| `VARCHAR(20)`| YES | - | 관제사 배정 인가 고도 (CFL) |
| `assigned_speed` | `VARCHAR(20)` | YES | - | 관제사 배정 지시 속도 (예: `N0465`, `250KT`, `M084`) |
| `assigned_heading`| `VARCHAR(10)` | YES | - | 관제사 배정 유도 헤딩 (예: `330`, `240`, `125`) |
| `runway` | `VARCHAR(10)` | YES | `'33L'` | 배정 활주로 (예: `33L`, `33R`, `34L`, `34R`, `15R`) |
| `assigned_runway` | `VARCHAR(10)` | YES | - | `runway` 동기화 필드 |
| `gate` | `VARCHAR(20)` | YES | - | 주기장 및 게이트 번호 (예: `224`, `118`, `SPOT 42`) |
| `assigned_gate` | `VARCHAR(20)` | YES | - | `gate` 동기화 필드 |
| `assigned_sid_star`| `VARCHAR(30)`| YES | - | 배정된 표준출발절차(SID) 또는 표준도착절차(STAR) |
| `eobt` | `VARCHAR(10)` | YES | - | 예상 출발시각 (EOBT, UTC 4자리: `0515`, `0255`) |
| `eta` | `VARCHAR(10)` | YES | - | 예상 도착시각 (ETA, UTC 4자리) |
| `bay_type` | `VARCHAR(20)` | NO | `'DEPARTURE'` | 현재 위치 베이: `DEPARTURE`, `ARRIVAL`, `TRANSIT`, `CIRCUIT` |
| `bay_sequence` | `INTEGER` | NO | `0` | 해당 베이 내에서의 정렬 순서 (0부터 오름차순) |
| `flight_rules` | `VARCHAR(10)` | YES | `'IFR'` | 비행 방식 (`IFR`, `VFR`) |
| `flight_type` | `CHAR(1)` | YES | `'S'` | 운항 성격 (`S`: Scheduled, `N`: Non-scheduled, `G`: General, `M`: Military) |
| `clearance_delivery`|`BOOLEAN` | YES | `false` | 출항 인가 완료 플래그 (DEL) |
| `clearance_ground` |`BOOLEAN` | YES | `false` | 지상이동 인가 완료 플래그 (GND) |
| `clearance_tower` | `BOOLEAN` | YES | `false` | 이착륙 인가 완료 플래그 (TWR) |
| `clearance_departure`|`BOOLEAN`| YES | `false` | 출발 레이더 이양 완료 플래그 (DEP) |
| `clearance` | `TEXT` | YES | - | 통합 관제 인가 문구 텍스트 |
| `remarks` | `TEXT` | YES | - | 관제 특이사항 및 비고 (예: `TCAS EQUIPPED`, `VIP ONBOARD`) |
| `is_urgent` | `BOOLEAN` | NO | `false` | 긴급/지연 여부 (경고 강조 붉은색 테두리 발광) |
| `is_highlighted` | `BOOLEAN` | NO | `false` | 관제사 주의 강조 여부 (황색 테두리 발광) |
| `raw_message` | `TEXT` | YES | - | AMHS 수신 원문 메시지 본문 (최대 4000자) |
| `metadata` | `JSONB` | YES | `'{}'::jsonb`| 부가 정보 (`{ msgType, parsedAt, protocol }`) |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | 최초 생성 시각 |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | 최종 수정 시각 |

---

### 4.2 테이블 2: `efs_amhs_messages` (AMHS 항공전문 수신 이력)
항공고정통신망(AMHS/AFTN)으로부터 수신된 원문 전문과 파싱 결과를 저장합니다.

| 컬럼명 | 데이터 타입 | Nullable | 기본값 | 설명 |
|:---|:---|:---|:---|:---|
| `id` | `BIGSERIAL` | NO | - | **기본키 (PK)** |
| `message_type` | `VARCHAR(20)` | NO | - | 전문 유형 (`FPL`, `CHG`, `CNL`, `DLA`, `DEP`, `ARR`, `IPN`) |
| `msg_type` | `VARCHAR(20)` | YES | - | `message_type` 호환 필드 |
| `callsign` | `VARCHAR(20)` | YES | - | 대상 항공기 호출부호 |
| `filing_time` | `TIMESTAMPTZ` | YES | `NOW()` | 전문 송신/발효 시각 |
| `originator` | `VARCHAR(50)` | YES | - | 발신 기관 AFTN 주소 (예: `RKSIAFTN`, `RKSSZPZX`) |
| `recipient` | `VARCHAR(50)` | YES | - | 수신 기관 AFTN 주소 (예: `RKSIAMHS`, `RKPCAMHS`) |
| `raw_content` | `TEXT` | NO | - | 수신된 원문 XML / SOAP / AFTN 메시지 본문 |
| `raw_telegram` | `TEXT` | YES | - | 추출된 ICAO 표준 텔레그램 본문 |
| `parsed_payload` | `JSONB` | YES | - | 파서가 디코딩한 구조화 JSON 데이터 |
| `parsed_data` | `JSONB` | YES | - | `parsed_payload` 호환 필드 |
| `status` | `VARCHAR(20)` | NO | `'PROCESSED'`| 처리 상태 (`PROCESSED`, `FAILED`, `IGNORED`) |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | 전문 수신 일시 |

---

### 4.3 테이블 3: `efs_strip_logs` (관제 조작 감사 로그)
관제사의 모든 스트립 조작(베이 이동, 인가 완료, 제원 수정 등)을 실시간으로 추적하는 무결성 감사 테이블입니다.

| 컬럼명 | 데이터 타입 | Nullable | 기본값 | 설명 |
|:---|:---|:---|:---|:---|
| `id` | `BIGSERIAL` | NO | - | **기본키 (PK)** |
| `strip_id` | `TEXT` | NO | - | 대상 스트립 ID (`efs_flight_strips.id` 참조) |
| `callsign` | `VARCHAR(20)` | NO | - | 항공기 호출부호 |
| `action_type` | `VARCHAR(30)` | NO | - | 조작 유형 (`BAY_CHANGE`, `STATUS_CHANGE`, `ASSIGN_RWY`, `ASSIGN_ALT`, `CREATE_STRIP`, `DELETE_STRIP`) |
| `from_bay` | `VARCHAR(20)` | YES | - | 이전 베이 명칭 |
| `to_bay` | `VARCHAR(20)` | YES | - | 이동 대상 베이 명칭 |
| `from_status` | `VARCHAR(30)` | YES | - | 이전 관제 상태 |
| `to_status` | `VARCHAR(30)` | YES | - | 변경된 관제 상태 |
| `details` | `TEXT` | YES | - | 조작 상세 설명 |
| `metadata` | `JSONB` | YES | `'{}'::jsonb`| 조작 시점의 부가 파라미터 (A-CDM 시간, 순서 등) |
| `operated_at` | `TIMESTAMPTZ` | NO | `NOW()` | 조작 발생 일시 |

---

### 4.4 PostgreSQL DDL 전문 (Data Definition Language)

```sql
-- ============================================================
-- Supabase PostgreSQL 15 DDL for EFS (Electronic Flight Strip)
-- ============================================================

-- 1. 전자비행스트립 테이블
CREATE TABLE IF NOT EXISTS public.efs_flight_strips (
    id TEXT PRIMARY KEY,
    callsign VARCHAR(20) NOT NULL,
    operation_type VARCHAR(20) NOT NULL DEFAULT 'DEPARTURE',
    status VARCHAR(30) NOT NULL DEFAULT 'STANDBY',
    aircraft_type VARCHAR(10) DEFAULT 'B738',
    wake_category CHAR(1) DEFAULT 'M',
    beacon_code VARCHAR(10) DEFAULT '1200',
    ssr_code VARCHAR(10) DEFAULT '1200',
    departure_airport VARCHAR(10) NOT NULL DEFAULT 'RKSI',
    arrival_airport VARCHAR(10) NOT NULL DEFAULT 'RKPC',
    dep_airport VARCHAR(10),
    arr_airport VARCHAR(10),
    route TEXT,
    altitude VARCHAR(20) DEFAULT 'FL330',
    assigned_altitude VARCHAR(20),
    assigned_speed VARCHAR(20),
    assigned_heading VARCHAR(10),
    runway VARCHAR(10) DEFAULT '33L',
    assigned_runway VARCHAR(10),
    gate VARCHAR(20),
    assigned_gate VARCHAR(20),
    assigned_sid_star VARCHAR(30),
    eobt VARCHAR(10),
    eta VARCHAR(10),
    bay_type VARCHAR(20) NOT NULL DEFAULT 'DEPARTURE',
    bay_sequence INTEGER NOT NULL DEFAULT 0,
    flight_rules VARCHAR(10) DEFAULT 'IFR',
    flight_type CHAR(1) DEFAULT 'S',
    clearance_delivery BOOLEAN DEFAULT FALSE,
    clearance_ground BOOLEAN DEFAULT FALSE,
    clearance_tower BOOLEAN DEFAULT FALSE,
    clearance_departure BOOLEAN DEFAULT FALSE,
    clearance TEXT,
    remarks TEXT,
    is_urgent BOOLEAN NOT NULL DEFAULT FALSE,
    is_highlighted BOOLEAN NOT NULL DEFAULT FALSE,
    raw_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스 생성 (조회 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_efs_strips_bay ON public.efs_flight_strips (bay_type, bay_sequence ASC);
CREATE INDEX IF NOT EXISTS idx_efs_strips_airport ON public.efs_flight_strips (departure_airport, arrival_airport);
CREATE INDEX IF NOT EXISTS idx_efs_strips_callsign ON public.efs_flight_strips (callsign);

-- 2. AMHS 전문 수신 로그 테이블
CREATE TABLE IF NOT EXISTS public.efs_amhs_messages (
    id BIGSERIAL PRIMARY KEY,
    message_type VARCHAR(20) NOT NULL,
    msg_type VARCHAR(20),
    callsign VARCHAR(20),
    filing_time TIMESTAMPTZ DEFAULT NOW(),
    originator VARCHAR(50),
    recipient VARCHAR(50),
    raw_content TEXT NOT NULL,
    raw_telegram TEXT,
    parsed_payload JSONB,
    parsed_data JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'PROCESSED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_efs_amhs_created ON public.efs_amhs_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_efs_amhs_type ON public.efs_amhs_messages (message_type, callsign);

-- 3. 스트립 조작 감사 로그 테이블
CREATE TABLE IF NOT EXISTS public.efs_strip_logs (
    id BIGSERIAL PRIMARY KEY,
    strip_id TEXT NOT NULL,
    callsign VARCHAR(20) NOT NULL,
    action_type VARCHAR(30) NOT NULL,
    from_bay VARCHAR(20),
    to_bay VARCHAR(20),
    from_status VARCHAR(30),
    to_status VARCHAR(30),
    details TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    operated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_efs_logs_strip ON public.efs_strip_logs (strip_id, operated_at DESC);

-- 4. Supabase Realtime 활성화 (스트립 실시간 동기화)
ALTER PUBLICATION supabase_realtime ADD TABLE public.efs_flight_strips;
```

---

## 5. 인터페이스 제어 문서 (ICD - Complete API Input/Output Specification)

EFS 시스템은 RESTful HTTPS API 및 WSS 실시간 스트리밍 인터페이스를 제공합니다.

### 5.1 GET `/api/efs` : 실시간 스트립 전체 목록 조회
특정 공항 관제탑의 활성 스트립 전체 목록을 조회합니다.

- **Request**:
  - Method: `GET`
  - Query Parameters:
    - `airport` (string, optional, 기본값: `RKSI`): 조회 대상 공항 ICAO 코드.
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "airport": "RKSI",
  "timestamp": "2026-09-23T08:15:00.123Z",
  "total": 6,
  "strips": [
    {
      "id": "FPL-AMU821-RKSI",
      "callsign": "AMU821",
      "operation_type": "DEPARTURE",
      "status": "TAXIOUT",
      "aircraft_type": "A321",
      "wake_category": "M",
      "beacon_code": "78041B",
      "ssr_code": "78041B",
      "departure_airport": "RKSI",
      "arrival_airport": "VMMC",
      "flight_rules": "IFR",
      "flight_type": "S",
      "eobt": "0515",
      "altitude": "F320",
      "assigned_altitude": "FL320",
      "assigned_speed": "N0465",
      "assigned_heading": "330",
      "runway": "33L",
      "assigned_runway": "33L",
      "gate": "224",
      "assigned_gate": "224",
      "assigned_sid_star": "BOPTA2",
      "route": "DCT BOPTA Z51 BEDES Y711 MUGUS Y742 SALMI Q11 DRAKE A1 ELATO J101 SMT",
      "bay_type": "DEPARTURE",
      "bay_sequence": 0,
      "clearance_delivery": true,
      "clearance_ground": true,
      "clearance_tower": false,
      "clearance_departure": false,
      "is_urgent": false,
      "is_highlighted": false,
      "remarks": "REG/BMBA DOF/260716",
      "created_at": "2026-09-23T08:00:00.000Z",
      "updated_at": "2026-09-23T08:14:20.000Z"
    }
  ]
}
```

---

### 5.2 POST `/api/efs?action=ingest` : AMHS 전문 수신 및 스트립 자동 생성
AFTN/AMHS 항공전문(XML/SOAP/AFTN)을 수신하여 실시간 파싱 후 즉시 스트립으로 등록합니다.

- **Request**:
  - Method: `POST`
  - Headers: `Content-Type: application/json`
  - Query: `action=ingest`
  - Body Payload:
```json
{
  "rawMessage": "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\"><soapenv:Body><atsMessageText>(FPL-KAL1205-IS -B738/M-SDE3FGHIRWXY/LB1 -RKSI0840 -N0450F280 G597 SEL -RKPC0930 -PBN/A1B1 DOF/260923)</atsMessageText></soapenv:Body></soapenv:Envelope>",
  "protocol": "AMHS SOAP WebService"
}
```
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "AMHS FPL message successfully ingested",
  "strip": {
    "id": "FPL-KAL1205-1205",
    "callsign": "KAL1205",
    "operation_type": "DEPARTURE",
    "status": "TAXIOUT",
    "aircraft_type": "B738",
    "wake_category": "M",
    "beacon_code": "1200",
    "departure_airport": "RKSI",
    "arrival_airport": "RKPC",
    "route": "G597 SEL",
    "altitude": "F280",
    "assigned_altitude": "F280",
    "assigned_speed": "N0450",
    "assigned_runway": "33L",
    "assigned_gate": "101",
    "eobt": "0840",
    "bay_type": "DEPARTURE",
    "bay_sequence": 0,
    "flight_rules": "IFR",
    "remarks": "FPL AUTO GENERATED",
    "is_urgent": false,
    "is_highlighted": true,
    "metadata": {
      "msgType": "FPL",
      "parsedAt": "2026-09-23T08:15:30.000Z",
      "protocol": "AMHS SOAP WebService"
    }
  },
  "parsed": {
    "msgType": "FPL",
    "callsign": "KAL1205",
    "depAirport": "RKSI",
    "arrAirport": "RKPC",
    "aircraftType": "B738",
    "wakeCategory": "M",
    "flightRules": "IFR",
    "time": "0840",
    "altitude": "F280",
    "speed": "N0450",
    "route": "G597 SEL",
    "ssrCode": "1200",
    "bayType": "DEPARTURE",
    "status": "TAXIOUT",
    "isUrgent": false
  }
}
```

---

### 5.3 POST `/api/efs` : 엑셀 그리드 대량 일괄 등록 (Batch Submit)
하단 엑셀 서랍장에서 입력된 다수의 비행스트립 데이터를 단일 트랜잭션으로 일괄 등록합니다.

- **Request**:
  - Method: `POST`
  - Headers: `Content-Type: application/json`
  - Body Payload (Array of Strips):
```json
[
  {
    "callsign": "AAR8911",
    "aircraft_type": "A321",
    "wake_category": "M",
    "flight_rules": "IFR",
    "beacon_code": "5201",
    "departure_airport": "RKSS",
    "arrival_airport": "RKPC",
    "eobt": "0910",
    "altitude": "FL240",
    "assigned_speed": "N0420",
    "runway": "14L",
    "gate": "Gate 12",
    "status": "DEP_STANDBY",
    "bay_type": "DEPARTURE",
    "route": "DOTOP Y782 BULTI",
    "remarks": "EXCEL BATCH INGEST"
  },
  {
    "callsign": "JNA1023",
    "aircraft_type": "B772",
    "wake_category": "H",
    "flight_rules": "IFR",
    "beacon_code": "6312",
    "departure_airport": "RKPC",
    "arrival_airport": "RKSI",
    "eobt": "0930",
    "altitude": "FL280",
    "assigned_speed": "N0460",
    "runway": "07",
    "gate": "Spot 3",
    "status": "ARR_STANDBY",
    "bay_type": "ARRIVAL",
    "route": "TAMNA Y711 MASTA",
    "remarks": "EXCEL BATCH INGEST"
  }
]
```
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "2 strips successfully created via batch ingest",
  "count": 2
}
```

---

### 5.4 PATCH `/api/efs` : 단일 스트립 관제 상태 및 제원 갱신
관제사의 상태 클릭, 베이 이동, 활주로/고도 변경 시 호출됩니다.

- **Request**:
  - Method: `PATCH`
  - Headers: `Content-Type: application/json`
  - Body Payload:
```json
{
  "id": "FPL-AMU821-RKSI",
  "status": "LINEUP",
  "bay_type": "DEPARTURE",
  "bay_sequence": 1,
  "assigned_runway": "33L",
  "assigned_altitude": "FL320",
  "assigned_speed": "N0465",
  "clearance_tower": true
}
```
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "FPL-AMU821-RKSI",
      "status": "LINEUP",
      "bay_type": "DEPARTURE",
      "bay_sequence": 1,
      "assigned_runway": "33L",
      "assigned_altitude": "FL320",
      "clearance_tower": true,
      "updated_at": "2026-09-23T08:16:10.000Z"
    }
  ]
}
```

---

### 5.5 DELETE `/api/efs?id={stripId}` : 스트립 관제 종료 및 삭제
비행이 완료되었거나 취소된 스트립을 베이에서 제거합니다.

- **Request**: `DELETE /api/efs?id=FPL-AMU821-RKSI`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Strip FPL-AMU821-RKSI deleted successfully"
}
```

---

### 5.6 POST `/api/efs?action=reset-demo` : ICAO 표준 데모 데이터 리셋
시스템 시연 및 훈련을 위해 표준 6개 ICAO 스트립(FPL, CHG, DEP, ARR, DLA, TRANSIT)으로 초기화합니다.

- **Request**: `POST /api/efs?action=reset-demo`
- **Success Response (200 OK)**: `{ "success": true, "count": 6, "data": [...] }`

---

### 5.7 GET `/api/efs?action=samples` : AMHS 샘플 전문 7종 조회
- **Request**: `GET /api/efs?action=samples`
- **Success Response (200 OK)**:
  - 1. FPL 제출 비행계획서 (AMHS IPM XML, AMU821)
  - 2. CHG 비행계획 변경 (AMHS IPM XML, CES5072)
  - 3. CNL 비행계획 취소 (SOAP, KAL1847)
  - 4. DLA 비행 지연 (SOAP, AAR8948)
  - 5. DEP 출발 통보 (SOAP, KAL2086)
  - 6. ARR 도착 통보 (SOAP, CES5072)
  - 7. IPN 전송결과 보고 NDR/DR (SOAP)

---

### 5.8 Supabase Realtime WebSocket 이벤트 규격
프론트엔드는 `@supabase/supabase-js` 클라이언트를 통해 `efs_flight_strips` 테이블을 실시간 구독합니다.

```javascript
// 클라이언트 구독 코드 규격
const channel = supabase
  .channel('efs-realtime-strips')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'efs_flight_strips' }, (payload) => {
    if (payload.eventType === 'INSERT') {
      handleRemoteStripInsert(payload.new);
    } else if (payload.eventType === 'UPDATE') {
      handleRemoteStripUpdate(payload.new);
    } else if (payload.eventType === 'DELETE') {
      handleRemoteStripDelete(payload.old.id);
    }
  })
  .subscribe();
```


### 5.9 IDD 기준 내부 인터페이스 (MRTO-DATCS-EFS-IDD v1.1 3.2.6)
아래 경로는 `vercel.json` rewrite로 `/api/efs?route=...`에 연결됩니다. 상태값은 SDD D-EFS-FS-SFR-0004 비행 단계 코드(`STANDBY, PUSHBACK, TAXIOUT, LINEUP, AIRBORNE, APPROACH, LANDED, TAXIIN, ONBLOCK, ENTRY, PASSING, EXIT, BASE, DOWNWIND, CROSSWIND, UPWIND`)이며, 화면의 베이 상태(`DEP_ACTIVE` 등)는 `metadata.uiStatus`에 함께 저장합니다.

| IDD 식별자 | 경로 | 요청 | 응답 |
|---|---|---|---|
| I-EFS-INT-0020 | `PATCH /api/strips/{id}/status` | `fromStatus, toStatus, operatorId, operatedAt` | 200 `{id, status, updatedAt, alert}` / 400 상태 코드 오류 / 404 스트립 없음 / 409 `fromStatus` 불일치 |
| I-EFS-INT-0030 | `PATCH /api/strips/{id}/bay` | `fromBay, toBay, baySequence, operatorId, operatedAt` | 200 `{id, bayType, baySequence}` / 409 베이 배정 불가·`fromBay` 불일치 |
| I-EFS-INT-0060 | `POST /api/runway-config` (`GET`으로 최신 설정 조회) | `airport, activeRunways[], mode(MANUAL/AUTO), operatorId, appliedAt` | 200 `{result:"OK", appliedAt}` / 400 활주로 지정자 오류 |
| I-EFS-INT-0090 | `GET /api/efs/heartbeat` (화면에서 5초 주기 호출) | - | `{type:"LINK_HEARTBEAT", sentAt, links[{name, interfaceIds, state, lastReceivedAt, latencyMs}], ntpOffsetMs}` |

상태·베이 변경은 서버가 `efs_strip_logs`에 `STATUS_CHANGE`/`BAY_CHANGE`로 기록하고, 사용 활주로 설정은 `ASSIGN_RWY`(strip_id `RWY-CONFIG-{ICAO}`)로 기록합니다.

### 5.10 Realtime Broadcast 이벤트 (채널 `efs`)
서버는 Supabase Realtime Broadcast(`/realtime/v1/api/broadcast`, topic `efs`)로 아래 이벤트를 발행하고, 화면은 같은 채널을 구독합니다.

| IDD 식별자 | event | payload |
|---|---|---|
| I-EFS-INT-0040 | `STRIP_UPDATED` | `{type, action, sentAt, strip{...camelCase 컬럼}, originId}` |
| I-EFS-INT-0050 | `RWY_OCCUPANCY_ALERT` | `{type, alertId, state, severity, runway, stripIds[], callsigns[], occupiedSec, message, raisedAt}` — 같은 활주로에 최근 3분 내 `LINEUP`/`LANDED` 스트립이 있을 때 발행 |

---

## 6. 클라이언트 로컬 스토리지 데이터 사전 (Client LocalStorage Dictionary & Schemas)

EFS는 관제사 개인별 작업 편의성을 극대화하기 위해 브라우저의 `HTML5 LocalStorage`에 다음 10개 핵심 키를 저장·관리합니다.

| 스토리지 키 (Storage Key) | 데이터 타입 | 기본값 (Default) | 상세 설명 및 데이터 구조 |
|:---|:---|:---|:---|
| `efs_strip_slot_layout_v2`| `JSON String`| 기본 표준 매핑 | **와이어프레임 5구역 25슬롯 커스텀 필드 매핑**. 4대 베이별 독립 슬롯 필드 ID 저장. |
| `efs_saved_layout` | `JSON String`| 균등 4분할 | **관제 워크스페이스 레이아웃 상태**. 베이별 너비(`px`), 상하 높이 비율(`0.1~0.9`), 베이 가시성(`true/false`). |
| `efs_bay_col_widths` | `JSON String`| `{"DEPARTURE":"320px"...}`| 각 베이 컬럼의 픽셀 너비 맵 (수평 리사이징 결과). |
| `efs_theme` | `String` | `"theme-across"` | 관제 콘솔 테마 (`"theme-across"`, `"theme-crt"`, `"theme-navy"`, `"theme-mono"`, `"theme-light"`). |
| `efs_font` | `String` | `"pretendard"` | 폰트 종류 (`"pretendard"`, `"jetbrains"`, `"noto"`, `"system"`). |
| `efs_language` | `String` | `"bilingual"` | 관제 언어 (`"bilingual"` 국영문 혼용, `"ko"` 한글, `"en"` 영문). |
| `efs_scanlines` | `String` | `"false"` | CRT 아날로그 브라운관 주사선 오버레이 효과 (`"true"` / `"false"`). |
| `efs_zoom_level` | `String` | `"1"` | 전체 UI 줌 배율 (`"0.8"` ~ `"1.5"`, 10% 단위). |
| `efs_strips_data` | `JSON String`| `[]` | 오프라인 복원용 최신 스트립 배열 캐시. |
| `efs_scratchpad_notes` | `String` | `""` | 관제사 자유 수기 메모 텍스트패드 내용. |

### 6.1 `efs_strip_slot_layout_v2` JSON 구조 예시
```json
{
  "DEPARTURE": {
    "slot_1_1": "acid",
    "slot_1_2": "type_wake",
    "slot_1_3": "route_id",
    "slot_1_4": "cid",
    "slot_2_1": "ssr",
    "slot_2_2": "eobt",
    "slot_2_3": "clr",
    "slot_3_1": "dep",
    "slot_3_2": "sid",
    "slot_3_3": "gate",
    "slot_4_tl": "act",
    "slot_4_tr": "type",
    "slot_4_ctr": "route",
    "slot_4_bl": "rules",
    "slot_4_br": "remarks",
    "slot_5_11": "",
    "slot_5_12": "",
    "slot_5_13": ""
  },
  "ARRIVAL": {
    "slot_1_1": "acid",
    "slot_1_2": "type_wake",
    "slot_3_1": "arr",
    "slot_3_2": "star",
    "slot_3_3": "gate"
  },
  "TRANSIT": {
    "slot_1_1": "acid",
    "slot_4_ctr": "route"
  },
  "CIRCUIT": {
    "slot_1_1": "acid",
    "slot_4_br": "remarks"
  }
}
```

---

## 7. 운용 환경 및 하드웨어 연동 규격 (Operating Environment & Hardware Specifications)

EFS는 24시간 365일 무중단 운용되는 공항 관제탑 및 접근관제소 환경에 적합하도록 설계되었습니다.

### 7.1 권장 관제 콘솔 하드웨어 사양
- **관제 모니터 (Display)**:
  - 해상도: 3840×2160 (4K UHD) 또는 2560×1440 (QHD) 권장 (최소 1920×1080 Full HD).
  - 화면 크기: 27인치 ~ 32인치 관제 전용 터치/펜 모니터 (예: Wacom Cintiq Pro 27/32, EIZO DuraVision FDF2711W).
  - 터치 디지타이저: 정전용량식 10포인트 멀티터치 및 EMR/AES 펜 동시 지원.
- **관제 단말 워크스테이션 (PC Specs)**:
  - CPU: Intel Core i5/i7 8세대 이상 또는 AMD Ryzen 5 이상 (4코어 8스레드 이상).
  - RAM: 8GB 이상 (16GB 권장 - 듀얼 레이어 캔버스 및 60fps 인터랙션 보장).
  - 그래픽: Intel Iris Xe / UHD Graphics 630 이상 또는 NVIDIA GeForce GTX 1050 이상.
- **네트워크 (Network)**:
  - 100/1000 Mbps 유선 이더넷 (ATC 이중화 LAN 망 권장).
  - 지연 시간: Supabase / API Gateway 간 RTT < 50ms.

### 7.2 운영체제 및 웹 브라우저 호환성 매트릭스
- **지원 운영체제 (OS)**:
  - Microsoft Windows 10 / 11 (64-bit) - **주력 권장 환경**
  - Apple macOS 12 Monterey 이상
  - Linux (Ubuntu 20.04 LTS 이상, Debian 11 이상 - X11 / Wayland 환경)
  - Android 10+ (Capacitor/WebView 래핑을 통한 모바일 태블릿 지원)
- **지원 웹 브라우저**:
  - Google Chrome 100+ (Chromium 기반) - **완벽 호환**
  - Microsoft Edge 100+ (Chromium 기반) - **완벽 호환**
  - Mozilla Firefox 100+ (Canvas & Sortable 완벽 호환)
  - Apple Safari 15+

### 7.3 와콤(Wacom) 스타일러스 펜 디지타이저 연동 및 Palm Rejection
- **하드웨어 입력 감지 알고리즘**:
  - W3C Pointer Events Level 3 규격의 `e.pointerType` 프로퍼티를 감지.
  - `e.pointerType === 'pen'`: 수기 필기 캔버스 드로잉 모드로 자동 전환.
  - `e.pointerType === 'touch' || e.pointerType === 'mouse'`: 스트립 선택, 베이 이동, UI 조작으로 분기.
- **Palm Rejection (손바닥 닿음 방지)**:
  - 스타일러스 펜 팁이 화면에 근접(Hover)하거나 터치된 동안에는 동일 좌표 부근의 터치 이벤트를 브라우저 레벨에서 즉각 무시(`e.preventDefault()`).
- **와콤 사이드 배럴 버튼(Barrel Switch)**:
  - 스타일러스 측면 버튼을 누른 상태에서의 터치는 자동으로 **전자 지우개 모드**로 전환되어 필기된 선을 직관적으로 삭제.

### 7.4 서버 환경 변수 (Environment Variables)
Vercel 대시보드 또는 `.env`에 다음 키가 설정되어 있어야 합니다:

| 변수명 (Key) | 필수 여부 | 설명 | 예시 값 |
|:---|:---|:---|:---|
| `SUPABASE_URL` | **필수** | Supabase 프로젝트 엔드포인트 URL | `https://xwwygmiwjlhnlfultear.supabase.co` |
| `SUPABASE_ANON_KEY`| **필수** | 클라이언트/엣지용 공개 Anon JWT 키 | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_SERVICE_ROLE_KEY`| 권장 | 관리자 권한 서비스 역할 키 (DB 직접 쓰기용) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `KMA_API_KEY` | 선택 | 기상청 API 허브 인증키 (항공기상 연계용) | `abcd1234efgh5678...` |
| `AVIATIONSTACK_API_KEY`| 선택 | 국제선 운항 스케줄 조회 폴백 키 | `key_live_...` |

### 7.5 네트워크 방화벽 및 보안 포트 규격
- **Outbound Port 443 (HTTPS / WSS)**:
  - `*.supabase.co` (REST PostgREST 쿼리 및 WebSocket Realtime 수신)
  - `cdn.jsdelivr.net`, `fonts.googleapis.com` (웹 폰트 및 리소스 로드)
- **보안 CORS 헤더 (`api/_utils/cors.js`)**:
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type, Authorization, apikey, Prefer`
- **Rate Limiting**:
  - IP별 분당 최대 120회 요청 제한 (초과 시 `429 Too Many Requests` 반환).

---

## 8. 핵심 기능 동작 알고리즘 및 상태 머신 (Core Functional Algorithms)

### 8.1 Universal Pointer Drag & Drop Engine
와이어프레임 빌더에서 마우스, 와콤 펜, 터치스크린 등 모든 입력 장치를 통합 처리하는 독자 엔진입니다.

```javascript
// 4px 임계치 판정 및 가상 고스트 배지 추적 알고리즘
let dragActive = false;
let startX = 0, startY = 0;
let ghostElem = null;

function onPointerDown(e) {
  startX = e.clientX;
  startY = e.clientY;
  currentFieldId = e.currentTarget.dataset.field;
  
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}

function onPointerMove(e) {
  const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
  if (!dragActive && dist > 4) {
    dragActive = true;
    createGhostBadge(e.clientX, e.clientY, currentFieldId);
  }
  if (dragActive && ghostElem) {
    ghostElem.style.left = `${e.clientX + 14}px`;
    ghostElem.style.top = `${e.clientY + 14}px`;
    
    // 포인터 아래 위치한 슬롯 실시간 감지
    const elemBelow = document.elementFromPoint(e.clientX, e.clientY);
    highlightTargetSlot(elemBelow?.closest('.wf-slot'));
  }
}

function onPointerUp(e) {
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  
  if (dragActive) {
    const dropTarget = document.elementFromPoint(e.clientX, e.clientY)?.closest('.wf-slot');
    if (dropTarget) {
      assignFieldToSlot(dropTarget.dataset.slotId, currentFieldId);
    }
    removeGhostBadge();
    dragActive = false;
  } else {
    // 4px 미만 클릭 시: 탭-투-배치 (Tap to Assign) 동작 유지
    handleTapToAssign(currentFieldId);
  }
}
```

### 8.2 활주로 롤아웃 타이머 (Runway Rollout Timer)
항공기가 활주로에 진입하거나 이착륙 허가를 받았을 때 활주로 점유 시간을 자동 감시합니다.
- **카운트 공식**: `T_occupancy = Date.now() - T_lineup_or_touchdown`
- **시각화 경고 로직**:
  - `0초 ~ 59초`: **정상 (Normal Green)** - 활주로 점유 정상 진행 (`#00e475`).
  - `60초 ~ 89초`: **주의 (Caution Amber)** - 활주로 점유 지연 경고 (`#fbcb41`).
  - `90초 이상`: **위험 (Warning Red & Pulse)** - 활주로 침범/점유 초과 위험 비상 알림 (`#ff3b56`).

---

## 9. 결론 및 소프트웨어 보증 요약 (Conclusion & Verification)

본 **EFS(전자비행스트립)** 시스템은 대한민국 항공교통관제(ATC) 현장의 무지연성 요구조건과 관제사의 인체공학적 조작 습관을 100% 반영하여 설계된 최첨단 디지털 스트립 솔루션입니다. 

- **완벽한 데이터 영속성**: Supabase Cloud PostgreSQL 15 및 브라우저 LocalStorage 10대 키 기반 이중 영속화 보장.
- **무지연 실시간 동기화**: Supabase Realtime WebSocket을 통한 다중 관제 석 간 0.1초 이내 스트립 상태 동기화.
- **하드웨어 융합**: 와콤 스타일러스 펜 전자 수기 필기 및 팜 리젝션 완비.
- **표준 적합성**: ICAO Doc 4444 PANS-ATM, AMHS XML/SOAP/AFTN 전문 파서 완비.
