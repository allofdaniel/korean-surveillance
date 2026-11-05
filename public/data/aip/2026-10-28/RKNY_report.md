# RKNY AIP 자동판독 리포트 (AIRAC 2026-10-28)

- 절차 12개 / Fix 32개 / 홀딩 3개 / 장애물 105개
- 지도 반영 12개 / 제외(검토 필요) 0개
- 원본: (2-12) STAR.pdf, (2-14) INSTR APCH CHART.pdf, (2-6) AD OBSTACLE CHART TYPE B.pdf, (2-8) SID.pdf, RKNY-TEXT.pdf

## 검증 결과
- [warn] fix IYAN differs 2515 m in AD2.19
- [warn] fix D2 YAG differs 375 m in RKNY AD CHART 2-17-1 (AIP AMDT 5/24)

## 절차
| 종류 | 이름 | 활주로 | 구간 | 근사 | 판정 |
|---|---|---|---|---|---|
| STAR | RNAV KAE 2H  | 33 | 6 |  |  |
| STAR | RNAV BIKSI 2H  | 33 | 6 |  |  |
| IAP | ILS/LOC Z RWY 33 from DUBUN | 33 | 7 |  |  |
| IAP | ILS/LOC Y RWY 33 from DUBUN | 33 | 7 |  |  |
| IAP | RNP RWY 33 via DUBUN(IAF) | 33 | 8 |  |  |
| IAP | VOR RWY 33 from DUBUN | 33 | 4 |  |  |
| SID | RNAV KAE 2E  | 15 | 4 |  |  |
| SID | RNAV BIKSI 2E  | 15 | 5 |  |  |
| SID | RNAV PILIT 2E  | 15 | 5 |  |  |
| SID | RNAV KAE 2N  | 33 | 6 |  |  |
| SID | RNAV BIKSI 2N  | 33 | 7 |  |  |
| SID | RNAV PILIT 2N  | 33 | 7 |  |  |

## 재래식 절차 (기준 코딩 구조 + AIP 좌표, 차트 대조)
기준 DB의 레그 구조만 사용하고 좌표는 AIP(항행안전시설 위치·방위/DME·활주로 시단·fix 표)로 다시 계산. 차트 대조 = 현재 AIP 차트에 fix 이름·코스가 실려 있는 비율.

| 종류 | 절차 | 결과 | fix 대조 | 코스 대조 | 기준 대비 최대 편차 | 근거 차트 | 비고 |
|---|---|---|---|---|---|---|---|
| sids | YAG2A.RW33 | 반영 | 100% | 100% | 64 m | (2-8) SID.pdf p5 | heading 구간 근사 |
| sids | YAG2S.RW15 | 반영 | 100% | 50% | 52 m | (2-8) SID.pdf p3 | heading 구간 근사 |
| sids | YAG2T.RW15 | 반영 | 100% | 50% | 233 m | (2-8) SID.pdf p3 | heading 구간 근사 |
| iaps | D33 | 반영 | 100% | 100% | 11 m | (2-14) INSTR APCH CHART.pdf p1 | heading 구간 근사 |
| iaps | D33.DUBUN | 반영 | 100% | 100% | 11 m | (2-14) INSTR APCH CHART.pdf p1 |  |
| iaps | I33-Y | 반영 | 100% | 100% | 403 m | (2-14) INSTR APCH CHART.pdf p1 |  |
| iaps | I33-Y.DUBUN | 반영 | 100% | 100% | 284 m | (2-14) INSTR APCH CHART.pdf p1 |  |
| iaps | I33-Z | 반영 | 100% | 100% | 403 m | (2-14) INSTR APCH CHART.pdf p1 |  |
