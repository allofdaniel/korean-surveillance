# RKJJ AIP 자동판독 리포트 (AIRAC 2026-10-28)

- 절차 29개 / Fix 58개 / 홀딩 10개 / 장애물 276개
- 지도 반영 29개 / 제외(검토 필요) 0개
- 원본: (2-11) SID_1772608055.pdf, (2-16) STAR.pdf, (2-20) INSTR APCH CHART.pdf, (2-5) AD OBSTACLE CHART TYPE A(3).pdf, (2-9) AD OBSTACLE CHART TYPE B(3).pdf, RKJJ-TEXT.pdf

## 검증 결과
- [warn] fix IMDG differs 2855 m in AD2.19
- [warn] fix IMDH differs 87 m in AD2.19
- [fixed] RNAV LILVI 1 [IGDOK] 003: dist 44.0 → 4.4 (OCR 소수점 보정)

## 절차
| 종류 | 이름 | 활주로 | 구간 | 근사 | 판정 |
|---|---|---|---|---|---|
| SID | RNAV LILVI 1 MAKSA |  | 2 |  |  |
| SID | RNAV LILVI 1 IGDOK |  | 5 |  |  |
| SID | RNAV LILVI 1 DOTOL |  | 5 |  |  |
| SID | RNAV LILVI 1 TEDAN |  | 5 |  |  |
| SID | RNAV MARYO 1 TEDAN | 22L | 4 |  |  |
| SID | RNAV MARYO 1 MAKSA | 22L | 5 |  |  |
| SID | RNAV MARYO 1 DOTOL | 22L | 3 |  |  |
| SID | RNAV MARYO 1 IGDOK | 22L | 6 |  |  |
| STAR | RNAV ARIMU 1 IGDOK | 04L | 5 |  |  |
| STAR | RNAV ARIMU 1 TEDAN | 04L | 3 |  |  |
| STAR | RNAV ARIMU 1 KAMIT | 04L | 2 |  |  |
| STAR | RNAV XEMIX 1 MANGI | 04L | 3 |  |  |
| STAR | RNAV ORUSA 1 IGDOK | 22L | 3 |  |  |
| STAR | RNAV ORUSA 1 TEDAN | 22L | 2 |  |  |
| STAR | RNAV ORUSA 1 KAMIT | 22L | 4 |  |  |
| IAP | RNP RWY 04R via XEMIX to VADRO(IF) | 04R | 2 |  |  |
| IAP | RNP RWY 04R via ARIMU to VADRO(IF) | 04R | 2 |  |  |
| IAP | RNP RWY 04R via VADRO(IF) to MAHF | 04R | 7 |  |  |
| IAP | RNP RWY 04L via XEMIX to OPASI(IF) | 04L | 2 |  |  |
| IAP | RNP RWY 04L via ARIMU to OPASI(IF) | 04L | 2 |  |  |
| IAP | RNP RWY 04L via OPASI(IF) to MAHF | 04L | 7 |  |  |
| IAP | RNP RWY 22L via MANGI to LUVOL(IAF) | 22L | 2 |  |  |
| IAP | RNP RWY 22L via LUVOL to OPIBA(IF) | 22L | 2 |  |  |
| IAP | RNP RWY 22L via ORUSA to OPIBA(IF) | 22L | 2 |  |  |
| IAP | RNP RWY 22L via OPIBA(IF) to MAHF | 22L | 9 |  |  |
| IAP | RNP RWY 22R via MANGI to LUVOL(IAF) | 22R | 2 |  |  |
| IAP | RNP RWY 22R via LUVOL to IPDUT(IF) | 22R | 2 |  |  |
| IAP | RNP RWY 22R via ORUSA to IPDUT(IF) | 22R | 2 |  |  |
| IAP | RNP RWY 22R via IPDUT(IF) to MAHF | 22R | 6 |  |  |

## 재래식 절차 (기준 코딩 구조 + AIP 좌표, 차트 대조)
기준 DB의 레그 구조만 사용하고 좌표는 AIP(항행안전시설 위치·방위/DME·활주로 시단·fix 표)로 다시 계산. 차트 대조 = 현재 AIP 차트에 fix 이름·코스가 실려 있는 비율.

| 종류 | 절차 | 결과 | fix 대조 | 코스 대조 | 기준 대비 최대 편차 | 근거 차트 | 비고 |
|---|---|---|---|---|---|---|---|
| sids | KWA5.RW04B | 반영 | 100% | 100% | 0 m | (2-11) SID_1772608055.pdf p1 | heading 구간 근사 |
| sids | KWA5.RW22B | 반영 | 100% | 100% | 0 m | (2-11) SID_1772608055.pdf p5 | heading 구간 근사 |
| iaps | D04L | 반영 | 100% | 100% | 0 m | (2-20) INSTR APCH CHART.pdf p15 | heading 구간 근사 |
| iaps | D04L.KOTTY | 반영 | 100% | 100% | 0 m | (2-20) INSTR APCH CHART.pdf p1 |  |
| iaps | D04R | 반영 | 100% | 100% | 0 m | (2-20) INSTR APCH CHART.pdf p7 | heading 구간 근사 |
| iaps | D04R.KOTTY | 반영 | 100% | 100% | 0 m | (2-20) INSTR APCH CHART.pdf p1 |  |
| iaps | D22L | 반영 | 100% | 100% | 0 m | (2-20) INSTR APCH CHART.pdf p25 | heading 구간 근사 |
| iaps | D22L.JADOO | 반영 | 100% | 100% | 1995 m | (2-20) INSTR APCH CHART.pdf p21 |  |
| iaps | D22R | 반영 | 100% | 100% | 0 m | (2-20) INSTR APCH CHART.pdf p21 | heading 구간 근사 |
| iaps | D22R.JADOO | 반영 | 100% | 100% | 3641 m | (2-20) INSTR APCH CHART.pdf p21 |  |
| iaps | I04R | 반영 | 100% | 100% | 0 m | (2-20) INSTR APCH CHART.pdf p1 | heading 구간 근사 |
| iaps | I04R.KOTTY | 반영 | 100% | 50% | 155 m | (2-20) INSTR APCH CHART.pdf p1 | heading 구간 근사 |
| iaps | L04R | 반영 | 100% | 100% | 0 m | (2-20) INSTR APCH CHART.pdf p1 | AIP 미확인 fix: MI04R; heading 구간 근사 |
| iaps | L04R.KOTTY | 반영 | 100% | 50% | 155 m | (2-20) INSTR APCH CHART.pdf p1 | heading 구간 근사 |
| iaps | L22L | 제외: AIP에서 좌표를 찾지 못한 fix가 과반 | 100% | 100% | 0 m | (2-20) INSTR APCH CHART.pdf p21 | AIP 미확인 fix: LOC14, LOC12, LOC10, 45LOC, ML22L; heading 구간 근사 |
| iaps | L22L.JADOO | 반영 | 100% | 100% | 622 m | (2-20) INSTR APCH CHART.pdf p21 |  |
