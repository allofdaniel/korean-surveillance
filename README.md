# 대한감시 (Korean Surveillance)

저고도 항공감시 시스템 - Low-Altitude Airspace Surveillance System

## 개요

대한감시는 저고도 공역(300m 이하)의 항공기, UAM, 드론을 실시간으로 추적하고 시각화하는 시스템입니다.

### 주요 기능

- 실시간 항공기 추적 (OpenSky Network / ADS-B Exchange 연동)
- 3D 지형 및 건물 시각화 (V-World / Mapbox 연동)
- 항적(Trail) 표시 및 예측 경로
- NOTAM/기상 정보 통합
- 관제권/공역 경계 표시
- 절차(SID/STAR/APPROACH) 차트 오버레이

## 기술 스택

- **Frontend**: React 18, TypeScript, Vite
- **지도**: Mapbox GL JS, V-World API
- **3D**: Three.js
- **상태관리**: Zustand
- **배포**: Vercel

## 환경변수

`.env` 파일을 생성하고 다음 값을 설정하세요:

```env
# Mapbox
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token

# V-World API
VITE_VWORLD_API_KEY=your_vworld_key

# App Info
VITE_APP_NAME=대한감시
VITE_APP_VERSION=1.0.0
```

## 개발

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 미리보기
npm run preview
```

## 배포

이 프로젝트는 Vercel에 자동 배포됩니다.

- **Production**: https://koreansurveillance.com
- **Preview**: Vercel Preview URL

## 라이선스

Copyright 2026. All rights reserved.
