# RKPS AIP 자동판독 리포트 (AIRAC 2026-10-28)

- 절차 35개 / Fix 65개 / 홀딩 8개 / 장애물 15개
- 지도 반영 35개 / 제외(검토 필요) 0개
- 원본: (2-13) INSTR APCH CHART.pdf, (2-3) SID(1).pdf, (2-8) STAR.pdf, RKPS-TEXT.pdf

## 검증 결과
- [warn] fix ISAM differs 72 m in AD2.19
- [warn] fix PS684 좌표 판독 실패 → GUTVA에서 진방위/거리로 계산 (RNP RWY 06L)

## 절차
| 종류 | 이름 | 활주로 | 구간 | 근사 | 판정 |
|---|---|---|---|---|---|
| IAP | RNP RWY 06L via SOLYI to GUTVA(IF) | 06L | 3 |  |  |
| IAP | RNP RWY 06L via VIBOR to GUTVA(IF) | 06L | 3 |  |  |
| IAP | RNP RWY 06L via GUTVA(IF) to MAHF | 06L | 8 |  |  |
| IAP | RNP RWY 06R via SOLYI to PABKO(IF) | 06R | 3 |  |  |
| IAP | RNP RWY 06R via VIBOR to PABKO(IF) | 06R | 3 |  |  |
| IAP | RNP RWY 06R via PABKO(IF) to MAHF | 06R | 7 |  |  |
| IAP | RNP RWY 24R via KABVO to AGTEG(IF) | 24R | 3 |  |  |
| IAP | RNP RWY 24R via NOBOP to AGTEG(IF) | 24R | 3 |  |  |
| IAP | RNP RWY 24R via AGTEG(IF) to MAHF | 24R | 7 |  |  |
| IAP | RNP RWY 24L via KABVO to BUVPU(IF) | 24L | 3 |  |  |
| IAP | RNP RWY 24L via NOBOP to BUVPU(IF) | 24L | 3 |  |  |
| IAP | RNP RWY 24L via BUVPU(IF) to MAHF | 24L | 7 |  |  |
| SID | RNAV VONDU 1 ANUBA | 06R | 4 |  |  |
| SID | RNAV VONDU 1 MASTA |  | 2 |  |  |
| SID | RNAV VONDU 1 SARAM |  | 2 |  |  |
| SID | RNAV VONDU 1 GOSBO | 06R | 5 |  |  |
| SID | RNAV VONDU 1 POVOR |  | 5 |  |  |
| SID | RNAV AKLOG 1 ANUBA |  | 3 |  |  |
| SID | RNAV AKLOG 1  |  | 4 |  |  |
| SID | RNAV AKLOG 1  |  | 5 |  |  |
| SID | RNAV AKLOG 1 SARAM |  | 4 |  |  |
| SID | RNAV AKLOG 1 GOSBO |  | 5 |  |  |
| SID | RNAV AKLOG 1 POVOR | 24R | 5 |  |  |
| STAR | RNAV SOLYI 1 MASTA | 06L | 3 |  |  |
| STAR | RNAV SOLYI 1 ANUBA | 06L | 2 |  |  |
| STAR | RNAV VIBOR 1 SARAM | 06L | 3 |  |  |
| STAR | RNAV VIBOR 1 GOSBO | 06L | 3 |  |  |
| STAR | RNAV VIBOR 1 NISAV | 06L | 3 |  |  |
| STAR | RNAV KABVO 1 ANUBA | 24L | 5 |  |  |
| STAR | RNAV KABVO 1 GOSBO | 24L | 5 |  |  |
| STAR | RNAV KABVO 1 NISAV | 24L | 5 |  |  |
| STAR | RNAV KABVO 1 SARAM | 24L | 2 |  |  |
| STAR | RNAV KABVO 1 MASTA | 24L | 3 |  |  |
| STAR | RNAV NOBOP 1 ANUBA | 24L | 3 |  |  |
| STAR | RNAV NOBOP 1 MASTA | 24L | 2 |  |  |

## 재래식 절차 (기준 코딩 구조 + AIP 좌표, 차트 대조)
기준 DB의 레그 구조만 사용하고 좌표는 AIP(항행안전시설 위치·방위/DME·활주로 시단·fix 표)로 다시 계산. 차트 대조 = 현재 AIP 차트에 fix 이름·코스가 실려 있는 비율.

| 종류 | 절차 | 결과 | fix 대조 | 코스 대조 | 기준 대비 최대 편차 | 근거 차트 | 비고 |
|---|---|---|---|---|---|---|---|
| sids | SAC5.RW06B | 반영 | 100% | 100% | 0 m | (2-13) INSTR APCH CHART.pdf p7 | heading 구간 근사 |
| sids | SAC5.RW24B | 반영 | 100% | 100% | 0 m | (2-13) INSTR APCH CHART.pdf p19 | heading 구간 근사 |
| iaps | D06L | 반영 | 100% | 100% | 0 m | (2-13) INSTR APCH CHART.pdf p5 | heading 구간 근사 |
| iaps | D06L.SOLYI | 반영 | 100% | 100% | 4 m | (2-13) INSTR APCH CHART.pdf p5 |  |
| iaps | D06R | 반영 | 100% | 100% | 0 m | (2-13) INSTR APCH CHART.pdf p11 | heading 구간 근사 |
| iaps | D06R.SOLYI | 반영 | 100% | 100% | 17 m | (2-13) INSTR APCH CHART.pdf p11 |  |
| iaps | D24L | 반영 | 100% | 100% | 0 m | (2-13) INSTR APCH CHART.pdf p29 |  |
| iaps | D24L.KABVO | 반영 | 100% | 100% | 2288 m | (2-13) INSTR APCH CHART.pdf p29 |  |
| iaps | D24R | 반영 | 100% | 100% | 0 m | (2-13) INSTR APCH CHART.pdf p23 |  |
| iaps | D24R.KABVO | 반영 | 100% | 100% | 75 m | (2-13) INSTR APCH CHART.pdf p23 |  |
| iaps | I24R | 반영 | 100% | 100% | 0 m | (2-13) INSTR APCH CHART.pdf p17 | heading 구간 근사 |
| iaps | I24R.KABVO | 반영 | 100% | 100% | 0 m | (2-13) INSTR APCH CHART.pdf p17 |  |
| iaps | L06L | 반영 | 100% | 100% | 0 m | (2-13) INSTR APCH CHART.pdf p1 | heading 구간 근사 |
| iaps | L06L.SOLYI | 반영 | 100% | 100% | 0 m | (2-13) INSTR APCH CHART.pdf p1 |  |
| iaps | L24R | 반영 | 100% | 100% | 0 m | (2-13) INSTR APCH CHART.pdf p19 | heading 구간 근사 |
| iaps | L24R.KABVO | 반영 | 100% | 100% | 0 m | (2-13) INSTR APCH CHART.pdf p19 |  |
