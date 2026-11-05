# RKJK AIP 자동판독 리포트 (AIRAC 2026-10-28)

- 절차 23개 / Fix 34개 / 홀딩 0개 / 장애물 0개
- 지도 반영 23개 / 제외(검토 필요) 0개
- 원본: (2-2) SID.pdf, (2-5) INSTR APCH CHART.pdf, RKJK-TEXT.pdf

## 검증 결과
- [warn] fix LUKKI differs 129 m in RKJK AD CHART 2-9-1 (AIP AMDT 7/25)
- [warn] RNAV PORIX 2 [MANGI] 003: 게재 진방위 183.9°, 계산 185.0°
- [warn] RNP RWY 18 003: 게재 진방위 167.9°, 계산 169.0°
- [warn] RNP RWY 18 004: 게재 진방위 167.9°, 계산 169.0°

## 절차
| 종류 | 이름 | 활주로 | 구간 | 근사 | 판정 |
|---|---|---|---|---|---|
| SID | RNAV PORIX 2 MANGI | 18 | 3 | 예 |  |
| IAP | ILS or LOC/DME RWY 18  | 18 | 3 |  |  |
| IAP | ILS or LOC/DME RWY 18 from JULOP | 18 | 3 |  |  |
| IAP | ILS or LOC/DME RWY 18 from WWOLF | 18 | 2 |  |  |
| IAP | ILS or LOC/DME RWY 18 from WYZRD | 18 | 2 |  |  |
| IAP | ILS or LOC/DME RWY 18 from JEWEL | 18 | 2 |  |  |
| IAP | ILS or LOC/DME RWY 36  | 36 | 5 |  |  |
| IAP | ILS or LOC/DME RWY 36 from JEWEL | 36 | 3 |  |  |
| IAP | ILS or LOC/DME RWY 36 from WWOLF | 36 | 2 |  |  |
| IAP | ILS or LOC/DME RWY 36 from WYZRD | 36 | 2 |  |  |
| IAP | ILS or LOC/DME RWY 36 from JULOP | 36 | 2 |  |  |
| IAP | VOR/DME RWY 18  | 18 | 4 |  |  |
| IAP | VOR/DME RWY 18 from TRASK | 18 | 3 |  |  |
| IAP | VOR/DME RWY 18 from WWOLF | 18 | 2 |  |  |
| IAP | VOR/DME RWY 18 from WYZRD | 18 | 2 |  |  |
| IAP | VOR/DME RWY 18 from COBET | 18 | 2 |  |  |
| IAP | VOR/DME RWY 36  | 36 | 5 |  |  |
| IAP | VOR/DME RWY 36 from COBET | 36 | 3 |  |  |
| IAP | VOR/DME RWY 36 from WWOLF | 36 | 2 |  |  |
| IAP | VOR/DME RWY 36 from WYZRD | 36 | 2 |  |  |
| IAP | VOR/DME RWY 36 from TRASK | 36 | 2 |  |  |
| IAP | RNP RWY 18  | 18 | 6 |  |  |
| IAP | RNP RWY 36  | 36 | 7 |  |  |

## 재래식 절차 (기준 코딩 구조 + AIP 좌표, 차트 대조)
기준 DB의 레그 구조만 사용하고 좌표는 AIP(항행안전시설 위치·방위/DME·활주로 시단·fix 표)로 다시 계산. 차트 대조 = 현재 AIP 차트에 fix 이름·코스가 실려 있는 비율.

| 종류 | 절차 | 결과 | fix 대조 | 코스 대조 | 기준 대비 최대 편차 | 근거 차트 | 비고 |
|---|---|---|---|---|---|---|---|
| sids | ENTEL3.RW18 | 반영 | 100% | 67% | 0 m | (2-2) SID.pdf p3 | AIP 미확인 fix: KUZ30; heading 구간 근사 |
| sids | ENTEL3.RW36 | 반영 | 100% | 67% | 0 m | (2-2) SID.pdf p3 (OCR) | AIP 미확인 fix: KUZ30; heading 구간 근사 |
| sids | LINTA3.RW18 | 반영 | 100% | 50% | 0 m | (2-2) SID.pdf p1 (OCR) | heading 구간 근사 |
| sids | LINTA3.RW36 | 반영 | 100% | 50% | 0 m | (2-2) SID.pdf p1 (OCR) | heading 구간 근사 |
| iaps | I18.EKIVA | 제외: 현재 AIP 차트에서 확인 안 됨 | 50% | 100% |  | (2-5) INSTR APCH CHART.pdf p1 (OCR) |  |
| iaps | I18.JULOP | 제외: 현재 AIP 차트에서 확인 안 됨 | 67% | 100% |  | (2-5) INSTR APCH CHART.pdf p1 (OCR) |  |
| iaps | I18.WWOLF | 제외: 현재 AIP 차트에서 확인 안 됨 | 50% | 100% |  | (2-5) INSTR APCH CHART.pdf p1 (OCR) |  |
| iaps | I18.WYZRD | 제외: 현재 AIP 차트에서 확인 안 됨 | 50% | 50% |  | (2-5) INSTR APCH CHART.pdf p1 (OCR) |  |
| iaps | I36.EKIVA | 제외: 현재 AIP 차트에서 확인 안 됨 | 60% | 100% |  | (2-5) INSTR APCH CHART.pdf p3 (OCR) |  |
| iaps | I36.WWOLF | 반영 | 75% | 100% | 3703 m | (2-5) INSTR APCH CHART.pdf p3 (OCR) |  |
| iaps | I36.WYZRD | 반영 | 75% | 100% | 3703 m | (2-5) INSTR APCH CHART.pdf p3 (OCR) |  |
| iaps | S18 | 반영 | 100% | 100% | 3705 m | (2-5) INSTR APCH CHART.pdf p5 |  |
| iaps | S18.COBET | 반영 | 100% | 100% | 3705 m | (2-5) INSTR APCH CHART.pdf p5 |  |
| iaps | S18.TRASK | 반영 | 75% | 100% | 3705 m | (2-5) INSTR APCH CHART.pdf p5 |  |
| iaps | S18.WWOLF | 제외: 현재 AIP 차트에서 확인 안 됨 | 67% | 100% |  | (2-5) INSTR APCH CHART.pdf p5 (OCR) |  |
| iaps | S18.WYZRD | 제외: 현재 AIP 차트에서 확인 안 됨 | 67% | 100% |  | (2-5) INSTR APCH CHART.pdf p5 (OCR) |  |
| iaps | S36 | 반영 | 80% | 100% | 3703 m | (2-5) INSTR APCH CHART.pdf p7 |  |
| iaps | S36.COBET | 반영 | 75% | 100% | 3705 m | (2-5) INSTR APCH CHART.pdf p7 |  |
| iaps | S36.TRASK | 반영 | 100% | 100% | 3703 m | (2-5) INSTR APCH CHART.pdf p7 |  |
| iaps | S36.WWOLF | 제외: 현재 AIP 차트에서 확인 안 됨 | 67% | 100% |  | (2-5) INSTR APCH CHART.pdf p7 (OCR) |  |
| iaps | S36.WYZRD | 제외: 현재 AIP 차트에서 확인 안 됨 | 67% | 100% |  | (2-5) INSTR APCH CHART.pdf p7 (OCR) |  |
| iaps | T18 | 반영 | 100% | 100% | 3705 m | (2-5) INSTR APCH CHART.pdf p5 (OCR) |  |
| iaps | T18.COBET | 반영 | 100% | 100% | 3705 m | (2-5) INSTR APCH CHART.pdf p5 (OCR) |  |
| iaps | T18.TRASK | 반영 | 75% | 100% | 3705 m | (2-5) INSTR APCH CHART.pdf p5 (OCR) |  |
| iaps | T18.WWOLF | 제외: 현재 AIP 차트에서 확인 안 됨 | 67% | 100% |  | (2-5) INSTR APCH CHART.pdf p5 (OCR) |  |
| iaps | T18.WYZRD | 제외: 현재 AIP 차트에서 확인 안 됨 | 67% | 100% |  | (2-5) INSTR APCH CHART.pdf p5 (OCR) |  |
| iaps | T36 | 반영 | 80% | 100% | 3703 m | (2-5) INSTR APCH CHART.pdf p7 (OCR) |  |
| iaps | T36.COBET | 반영 | 75% | 100% | 3705 m | (2-5) INSTR APCH CHART.pdf p7 (OCR) |  |
| iaps | T36.TRASK | 반영 | 100% | 100% | 3703 m | (2-5) INSTR APCH CHART.pdf p7 (OCR) |  |
| iaps | T36.WWOLF | 제외: 현재 AIP 차트에서 확인 안 됨 | 67% | 100% |  | (2-5) INSTR APCH CHART.pdf p7 (OCR) |  |
| iaps | T36.WYZRD | 제외: 현재 AIP 차트에서 확인 안 됨 | 67% | 100% |  | (2-5) INSTR APCH CHART.pdf p7 (OCR) |  |
