# TBAS NOTAM API Guide

> **TBAS (Tower-Based ATC Surveillance)** NOTAM 데이터 API
> AIM Korea (aim.koca.go.kr) XNOTAM 데이터를 5분 간격으로 자동 수집하여 제공합니다.

---

## 목차

- [1. 시스템 개요](#1-시스템-개요)
- [2. 아키텍처](#2-아키텍처)
- [3. API 엔드포인트](#3-api-엔드포인트)
- [4. 파라미터](#4-파라미터)
- [5. 응답 구조](#5-응답-구조)
- [6. NOTAM 데이터 필드](#6-notam-데이터-필드)
- [7. 사용 예시](#7-사용-예시)
- [8. Swagger UI](#8-swagger-ui)
- [9. 데이터 수집 범위](#9-데이터-수집-범위)
- [10. 시스템 운영 정보](#10-시스템-운영-정보)
- [11. 에러 처리](#11-에러-처리)
- [12. FAQ](#12-faq)

---

## 1. 시스템 개요

TBAS NOTAM API는 대한민국 항공고시보(NOTAM) 데이터를 실시간으로 수집하고 제공하는 REST API입니다.

| 항목 | 내용 |
|------|------|
| **API 주소** | `https://tbas.vercel.app/api/notam` |
| **Swagger 문서** | [https://tbas.vercel.app/api/docs](https://tbas.vercel.app/api/docs) |
| **데이터 소스** | AIM Korea (`aim.koca.go.kr/xNotam`) |
| **수집 주기** | 5분 간격 자동 수집 |
| **인증** | 불필요 (Public API) |
| **응답 형식** | JSON |

---

## 2. 아키텍처

### 시스템 구성도

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Data Source                                   │
│  ┌───────────────────────────────────────────┐                      │
│  │  AIM Korea (aim.koca.go.kr)               │                      │
│  │  XNOTAM API - 국내/국제/SNOWTAM           │                      │
│  └──────────────────┬────────────────────────┘                      │
└─────────────────────┼───────────────────────────────────────────────┘
                      │ POST (Form Data)
                      │ 응답: { DATA: [...], Total: N }
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Supabase Cloud (Seoul Region)                      │
│                                                                      │
│  ┌──────────┐    HTTP POST     ┌──────────────────┐                 │
│  │ pg_cron  │ ──────────────► │  Edge Function    │                 │
│  │ (5min)   │  Bearer Token    │ (notam-crawler)  │                 │
│  └──────────┘                  └────────┬─────────┘                 │
│       ▲                                 │                            │
│       │                                 │ UPSERT (50건 배치)         │
│  ┌────┴─────┐                          ▼                            │
│  │ pg_net   │              ┌──────────────────────┐                 │
│  │ (HTTP)   │              │    PostgreSQL DB      │                 │
│  └──────────┘              │  ┌────────────────┐  │                 │
│                            │  │ notams         │  │                 │
│                            │  │ (NOTAM 데이터) │  │                 │
│                            │  ├────────────────┤  │                 │
│                            │  │ notam_crawl    │  │                 │
│                            │  │ _logs (수집로그)│  │                 │
│                            │  └────────────────┘  │                 │
│                            └──────────┬───────────┘                 │
│                                       │ PostgREST                    │
│                                       ▼                              │
│                            ┌──────────────────────┐                 │
│                            │  PostgREST            │                 │
│                            │  (Auto REST API)      │                 │
│                            └──────────┬───────────┘                 │
│                                       │                              │
│  ┌────────────────────────┐          │                              │
│  │ Supabase Storage       │          │                              │
│  │ (JSON Fallback)        │ ─ ─ ─ ─ ┤                              │
│  └────────────────────────┘          │                              │
└──────────────────────────────────────┼──────────────────────────────┘
                                       │ JSON Response
                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Vercel (Production)                             │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────┐  ┌───────────────────┐     │
│  │ /api/notam       │  │ /api/docs    │  │ TBAS Frontend     │     │
│  │ (API Handler)    │  │ (Swagger UI) │  │ (React + Mapbox)  │     │
│  └────────┬─────────┘  └──────────────┘  └───────────────────┘     │
│           │                                                          │
└───────────┼──────────────────────────────────────────────────────────┘
            │ JSON
            ▼
     ┌──────────────┐
     │  API Client   │
     │  (브라우저,    │
     │   외부 시스템) │
     └──────────────┘
```

### 데이터 흐름

1. **pg_cron** (5분 주기) → **pg_net** → Edge Function 호출
2. **Edge Function** → AIM Korea API에 POST 요청 (국내 6개 시리즈 + 국제 18개 공항 + SNOWTAM)
3. AIM Korea → JSON 응답 `{ DATA: [...], Total: N }`
4. Edge Function → **중복 제거** (notam_number 기준) → **배치 UPSERT** (50건씩)
5. **PostgREST** → API Handler가 DB 조회 → JSON 응답

---

## 3. API 엔드포인트

### Base URL

```
https://tbas.vercel.app
```

### 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/api/notam` | NOTAM 데이터 조회 |
| `GET` | `/api/docs` | Swagger UI (API 문서) |

---

## 4. 파라미터

### GET `/api/notam`

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `period` | string | X | `all` | 유효 기간 필터 |
| `bounds` | string | X | - | 지리적 범위 필터 (south,west,north,east) |
| `limit` | integer | X | `0` | 최대 반환 수 (0 = 제한 없음, 내부 기본 2000) |

### `period` 값

| 값 | 설명 |
|----|------|
| `all` | 모든 NOTAM 반환 |
| `current` | 현재 시점에 유효한 NOTAM만 (B <= now <= C) |
| `1month` | 현재 기준 전후 1개월 이내 |
| `1year` | 현재 기준 전후 1년 이내 |

### `bounds` 형식

```
south,west,north,east
```

예시: `33.0,124.0,38.0,132.0` (한반도 영역)

> **참고**: bounds 필터 적용 시, Q-line 좌표가 없는 NOTAM도 함께 반환됩니다 (좌표 없는 NOTAM을 누락하지 않기 위함).

---

## 5. 응답 구조

### 성공 응답 (200)

```json
{
  "data": [
    {
      "notam_number": "A0123/26",
      "location": "RKSI",
      "full_text": "GG RKZZNAXX\r\n...",
      "e_text": "RWY 15L/33R CLSD DUE TO MAINT",
      "qcode": "QMRLC",
      "qcode_mean": "",
      "effective_start": "2602010800",
      "effective_end": "2602051200",
      "series": "A",
      "fir": "RKRR",
      "q_lat": 37.383333,
      "q_lon": 126.783333,
      "q_radius": 5
    }
  ],
  "count": 232,
  "afterPeriodFilter": 180,
  "source": "database",
  "filtered": 120,
  "returned": 50,
  "period": "current",
  "bounds": {
    "south": 33,
    "west": 124,
    "north": 38,
    "east": 132
  }
}
```

### 메타데이터 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `count` | integer | DB 전체 NOTAM 수 |
| `afterPeriodFilter` | integer | 기간 필터 적용 후 수 |
| `filtered` | integer | 모든 필터(기간+영역) 적용 후 수 |
| `returned` | integer | 실제 반환된 수 (limit 적용) |
| `source` | string | 데이터 소스 (`database` 또는 `storage`) |
| `period` | string | 적용된 기간 필터 |
| `bounds` | object/null | 적용된 지리적 범위 |

### 에러 응답 (500)

```json
{
  "error": "NOTAM service temporarily unavailable",
  "code": "NOTAM_ERROR"
}
```

---

## 6. NOTAM 데이터 필드

| 필드 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `notam_number` | string | NOTAM 번호 | `A0123/26` |
| `location` | string | ICAO 공항/위치 코드 | `RKSI` |
| `full_text` | string | NOTAM 전체 텍스트 (Q/A/B/C/E 라인) | - |
| `e_text` | string | E항목 (내용 요약) | `RWY 15L/33R CLSD` |
| `qcode` | string | Q-코드 (NOTAM 유형 분류) | `QMRLC` |
| `qcode_mean` | string | Q-코드 의미 (번역) | - |
| `effective_start` | string | 유효 시작일 (YYMMDDHHMM) | `2602010800` |
| `effective_end` | string | 유효 종료일 (YYMMDDHHMM 또는 PERM) | `2602051200` |
| `series` | string | 시리즈 | `A`, `C`, `D`, `E`, `G`, `Z`, `S` |
| `fir` | string | FIR 코드 | `RKRR` |
| `q_lat` | number/null | Q-line 위도 (decimal degrees) | `37.383333` |
| `q_lon` | number/null | Q-line 경도 (decimal degrees) | `126.783333` |
| `q_radius` | integer/null | Q-line 영향 반경 (NM) | `5` |

### Q-코드 주요 유형

| Q-코드 패턴 | 의미 |
|-------------|------|
| `QMRLC` | 활주로 폐쇄 (Runway Closed) |
| `QMRXX` | 활주로 관련 (Runway) |
| `QFAXX` | 비행장 관련 (Aerodrome) |
| `QFATT` | 트리거 NOTAM |
| `QOBCE` | 장애물 설치 (Obstacle Erected) |
| `QWMLW` | 기상 경보 (Met Warning) |
| `QRTCA` | 공역 제한 (Airspace Restriction) |

### 시리즈 구분

| 시리즈 | 설명 |
|--------|------|
| `A` | FIR/공역 관련 |
| `C` | 통신/항행시설 |
| `D` | 비행장 시설 |
| `E` | 항행 관련 (가장 많음) |
| `G` | 기타 |
| `Z` | 트리거/참고 |
| `S` | SNOWTAM (적설 정보) |

---

## 7. 사용 예시

### 기본 조회 (전체 NOTAM)

```bash
curl "https://tbas.vercel.app/api/notam"
```

### 현재 유효한 NOTAM만

```bash
curl "https://tbas.vercel.app/api/notam?period=current"
```

### 한반도 영역 + 현재 유효 + 50건 제한

```bash
curl "https://tbas.vercel.app/api/notam?period=current&bounds=33,124,38,132&limit=50"
```

### 최근 1개월 NOTAM

```bash
curl "https://tbas.vercel.app/api/notam?period=1month&limit=100"
```

### JavaScript (fetch)

```javascript
const response = await fetch(
  'https://tbas.vercel.app/api/notam?period=current&limit=50'
);
const { data, count, source } = await response.json();

console.log(`총 ${count}건 중 ${data.length}건 반환 (source: ${source})`);

data.forEach(notam => {
  console.log(`${notam.notam_number} | ${notam.location} | ${notam.e_text}`);
});
```

### Python (requests)

```python
import requests

url = "https://tbas.vercel.app/api/notam"
params = {
    "period": "current",
    "bounds": "33,124,38,132",
    "limit": 100
}

response = requests.get(url, params=params)
data = response.json()

print(f"총 {data['count']}건, 반환 {data['returned']}건")
for notam in data['data']:
    print(f"{notam['notam_number']} | {notam['location']} | {notam['e_text']}")
```

---

## 8. Swagger UI

### 접속 주소

[https://tbas.vercel.app/api/docs](https://tbas.vercel.app/api/docs)

### 기능

- **API 파라미터 설명**: 각 파라미터의 타입, 기본값, 설명 확인
- **Try it out**: Swagger UI에서 바로 API 호출 테스트 가능
- **응답 예시**: 실제 응답 포맷과 필드 설명 확인
- **스키마 모델**: Notam, NotamResponse, ErrorResponse 모델 정의 확인
- **NOTAM 예시 섹션**: 자주 사용되는 파라미터 조합 바로 실행

---

## 9. 데이터 수집 범위

### 국내 NOTAM (6개 시리즈)

| 시리즈 | 파라미터 |
|--------|----------|
| A | `sch_inorout=D&sch_series=A` |
| C | `sch_inorout=D&sch_series=C` |
| D | `sch_inorout=D&sch_series=D` |
| E | `sch_inorout=D&sch_series=E` |
| G | `sch_inorout=D&sch_series=G` |
| Z | `sch_inorout=D&sch_series=Z` |

### SNOWTAM

| 시리즈 | 파라미터 |
|--------|----------|
| S | `sch_inorout=D&sch_series=S&sch_snow_series=S` |

### 국제 NOTAM (18개 공항)

| ICAO | 공항명 | ICAO | 공항명 |
|------|--------|------|--------|
| RKSI | 인천국제공항 | RKSS | 김포국제공항 |
| RKPK | 김해국제공항 | RKPC | 제주국제공항 |
| RKPS | 사천공항 | RKPU | 울산공항 |
| RKSM | 서울공항 | RKTH | 포항공항 |
| RKPD | 대구국제공항 | RKTL | - |
| RKTU | 청주국제공항 | RKNW | 원주공항 |
| RKJK | 군산공항 | RKJB | 무안국제공항 |
| RKJY | 여수공항 | RKJJ | 광주공항 |
| RKTN | 대구(군) | RKNY | 양양국제공항 |

---

## 10. 시스템 운영 정보

### 인프라 구성

| 구성요소 | 기술 | 설명 |
|----------|------|------|
| 크롤러 | Supabase Edge Function (Deno) | AIM Korea API 호출 및 DB 저장 |
| 스케줄러 | pg_cron + pg_net | 5분 주기 자동 실행 |
| 데이터베이스 | Supabase PostgreSQL | notams, notam_crawl_logs 테이블 |
| API 서버 | Vercel Serverless Functions | `/api/notam` 핸들러 |
| API 문서 | Vercel Serverless Functions | `/api/docs` Swagger UI |
| 프론트엔드 | Vercel (React + Vite) | TBAS 웹 애플리케이션 |

### 크롤링 프로세스

1. pg_cron이 5분마다 Edge Function을 HTTP POST로 호출
2. Edge Function이 AIM Korea API에 순차적으로 요청:
   - 국내 NOTAM: 6개 시리즈 (A/C/D/E/G/Z)
   - SNOWTAM: S 시리즈
   - 국제 NOTAM: 18개 공항별
3. 각 요청에서 페이지네이션 처리 (100건/페이지, 최대 10페이지)
4. 전체 수집 데이터에서 `notam_number` 기준 중복 제거
5. 50건씩 배치로 DB에 UPSERT (`ON CONFLICT notam_number`)
6. 크롤 로그를 `notam_crawl_logs` 테이블에 기록

### 크롤 로그 조회

Supabase Dashboard 또는 PostgREST로 크롤 로그를 확인할 수 있습니다:

```bash
# 최근 크롤 로그 조회 (RPC)
curl "https://ugzsuswrazaimvpyloqw.supabase.co/rest/v1/rpc/get_notam_status" \
  -H "apikey: YOUR_API_KEY" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 장애 대응 (Fallback)

- **1차**: Supabase DB (PostgREST) 조회
- **2차**: DB 조회 실패 또는 데이터 없음 → Supabase Storage JSON 파일 조회
- API Handler가 자동으로 Fallback 처리

---

## 11. 에러 처리

| HTTP 상태 | 코드 | 설명 |
|-----------|------|------|
| 200 | - | 정상 응답 |
| 500 | `NOTAM_ERROR` | 서버 오류 (DB/Storage 모두 실패) |

> 500 에러 발생 시 잠시 후 재시도하면 대부분 해결됩니다.
> 지속적인 오류 발생 시 시스템 관리자에게 문의하세요.

---

## 12. FAQ

### Q: API 호출에 인증이 필요한가요?
**A**: 아니요. TBAS NOTAM API는 Public API로, 별도의 인증 없이 사용 가능합니다.

### Q: 데이터는 얼마나 자주 업데이트되나요?
**A**: 5분 간격으로 AIM Korea에서 자동 수집됩니다.

### Q: 좌표가 없는 NOTAM은 어떻게 처리되나요?
**A**: Q-line에 좌표가 파싱되지 않는 NOTAM은 `q_lat`, `q_lon`, `q_radius` 값이 `null`로 반환됩니다. bounds 필터 적용 시에도 좌표 없는 NOTAM은 함께 반환됩니다.

### Q: PERM은 무엇인가요?
**A**: `effective_end` 값이 `PERM`인 경우 해당 NOTAM은 영구 유효함을 의미합니다.

### Q: 최대 몇 건까지 조회 가능한가요?
**A**: limit 파라미터를 지정하지 않으면 내부적으로 최대 2000건이 반환됩니다. 필요시 limit 값을 조정하세요.

### Q: source가 "storage"인 경우는 무엇인가요?
**A**: DB 조회에 실패하거나 데이터가 없을 때 Supabase Storage에 저장된 JSON 파일에서 데이터를 가져온 경우입니다. 정상 상황에서는 `"database"`가 표시됩니다.

---

## 관련 링크

| 리소스 | URL |
|--------|-----|
| TBAS 프론트엔드 | [https://tbas.vercel.app](https://tbas.vercel.app) |
| NOTAM API | [https://tbas.vercel.app/api/notam](https://tbas.vercel.app/api/notam) |
| Swagger UI | [https://tbas.vercel.app/api/docs](https://tbas.vercel.app/api/docs) |
| 아키텍처 다이어그램 | [Whimsical](https://whimsical.com/generated-board-JhurhKpRt17UgWUVeK1sVv) |
| AIM Korea (데이터 소스) | [https://aim.koca.go.kr](https://aim.koca.go.kr) |

---

*최종 업데이트: 2026-02-02*
*문서 버전: 2.0.0*
