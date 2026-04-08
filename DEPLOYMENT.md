# 대한감시 배포 가이드

## 환경변수

Vercel 또는 로컬 `.env` 파일에 다음 값을 설정하세요:

```env
# Mapbox 토큰 (https://account.mapbox.com/access-tokens/ 에서 발급)
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token_here

# V-World API 키 (http://www.vworld.kr/dev/v4api.do 에서 발급)
VITE_VWORLD_API_KEY=your_vworld_api_key_here

# 앱 정보
VITE_APP_NAME=대한감시
VITE_APP_VERSION=1.0.0
```

## Vercel 배포

### 1. GitHub에서 가져오기
1. https://vercel.com/new 접속
2. GitHub 연동 후 `korean-surveillance` 레포 선택
3. 환경변수 설정 (위 참조)
4. Deploy 클릭

### 2. 커스텀 도메인 연결
1. Vercel 프로젝트 > Settings > Domains
2. `koreansurveillance.com` 추가

### 3. Cafe24 DNS 설정

#### CNAME 방식 (권장)
| 타입 | 호스트 | 값 |
|------|--------|-----|
| CNAME | @ | cname.vercel-dns.com |
| CNAME | www | cname.vercel-dns.com |

#### A 레코드 방식
| 타입 | 호스트 | 값 |
|------|--------|-----|
| A | @ | 76.76.21.21 |
| CNAME | www | cname.vercel-dns.com |

## API 키 정보

### Mapbox
- 발급처: https://account.mapbox.com/access-tokens/
- 용도: 지도 렌더링, 3D 지형

### V-World
- 발급처: http://www.vworld.kr/dev/v4api.do
- 용도: 대한민국 지형 데이터, 건물 정보

## 문제 해결

### 지도가 표시되지 않는 경우
- Mapbox 토큰이 올바르게 설정되었는지 확인
- 토큰의 URL 제한 설정 확인

### 빌드 오류
```bash
npm install
npm run build
```

### 로컬 개발
```bash
npm run dev
```
