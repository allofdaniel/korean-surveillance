# RKPU AIP 자동판독 리포트 (AIRAC 2026-10-28)

- 절차 18개 / Fix 51개 / 홀딩 5개 / 장애물 372개
- 지도 반영 18개 / 제외(검토 필요) 0개
- 원본: (2-10) STAR.pdf, (2-12) INSTR APCH CHART.pdf, (2-3) AD OBSTACLE CHART TYPE A.pdf, (2-5) AD OBSTACLE CHART TYPE B_1748417850.pdf, (2-6) SID.pdf, RKPU-TEXT.pdf

## 검증 결과
- [warn] fix IULS differs 1940 m in AD2.19
- [warn] RNP Z RWY 18 (AR) 007 GODIS→RW18: 게재 2.6 NM, 계산 3.38 NM
- [warn] RNP Z RWY 18 (AR) 007: 게재 진방위 176.1°, 계산 173.3°

## 절차
| 종류 | 이름 | 활주로 | 구간 | 근사 | 판정 |
|---|---|---|---|---|---|
| STAR | RNAV LAPAL 2D  | 18 | 3 |  |  |
| STAR | RNAV APARU 2D  | 18 | 4 |  |  |
| STAR | RNAV LAPAL 2C  | 36 | 4 |  |  |
| STAR | RNAV APARU 2C  | 36 | 3 |  |  |
| IAP | RNP Y RWY 18  | 18 | 9 |  |  |
| IAP | RNP Z RWY 18 (AR)  | 18 | 10 |  |  |
| IAP | VOR RWY 18 from MAKKY | 18 | 8 |  |  |
| IAP | ILS Y/LOC Y RWY 36 from HAEGU | 36 | 5 |  |  |
| IAP | ILS Z/LOC Z RWY 36 from HAEGU | 36 | 6 |  |  |
| IAP | RNP RWY 36  | 36 | 6 |  |  |
| IAP | VOR RWY 36 from HAEGU | 36 | 5 |  |  |
| SID | RNAV KPO 1M  | 18 | 4 |  |  |
| SID | RNAV APARU 1M  | 18 | 2 |  |  |
| SID | APARU 7S  | 18 | 0 | 예 |  |
| SID | RNAV KPO 1R  | 36 | 3 |  |  |
| SID | RNAV APARU 1R  | 36 | 4 |  |  |
| SID | APARU 1A  | 36 | 0 |  |  |
| SID | APARU 8N  | 36 | 0 |  |  |

## 재래식 절차 (기준 코딩 구조 + AIP 좌표, 차트 대조)
기준 DB의 레그 구조만 사용하고 좌표는 AIP(항행안전시설 위치·방위/DME·활주로 시단·fix 표)로 다시 계산. 차트 대조 = 현재 AIP 차트에 fix 이름·코스가 실려 있는 비율.

| 종류 | 절차 | 결과 | fix 대조 | 코스 대조 | 기준 대비 최대 편차 | 근거 차트 | 비고 |
|---|---|---|---|---|---|---|---|
| sids | APAR1A.RW36 | 반영 | 100% | 100% | 4 m | (2-6) SID.pdf p7 | heading 구간 근사 |
| sids | APAR7S.RW18 | 반영 | 100% | 75% | 4 m | (2-6) SID.pdf p3 | heading 구간 근사 |
| sids | APAR8N.RW36 | 반영 | 100% | 100% | 4 m | (2-6) SID.pdf p7 | heading 구간 근사 |
| sids | KPO1A.RW18 | 반영 | 100% | 75% | 0 m | (2-6) SID.pdf p1 | heading 구간 근사 |
| sids | KPO7S.RW18 | 반영 | 100% | 75% | 0 m | (2-6) SID.pdf p1 | heading 구간 근사 |
| sids | KPO8N.RW36 | 반영 | 100% | 75% | 162 m | (2-6) SID.pdf p7 | heading 구간 근사 |
| iaps | D18 | 반영 | 100% | 100% | 49 m | (2-12) INSTR APCH CHART.pdf p5 |  |
| iaps | D36 | 반영 | 100% | 100% | 13 m | (2-12) INSTR APCH CHART.pdf p7 |  |
| iaps | D36.HAEGU | 반영 | 100% | 100% | 183 m | (2-12) INSTR APCH CHART.pdf p7 |  |
| iaps | I36-Y | 반영 | 100% | 100% | 21 m | (2-12) INSTR APCH CHART.pdf p7 |  |
| iaps | I36-Y.HAEGU | 반영 | 100% | 50% | 273 m | (2-12) INSTR APCH CHART.pdf p7 | heading 구간 근사 |
| iaps | I36-Z | 반영 | 100% | 100% | 21 m | (2-12) INSTR APCH CHART.pdf p9 |  |
