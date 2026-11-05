# RKJY AIP 자동판독 리포트 (AIRAC 2026-10-28)

- 절차 26개 / Fix 67개 / 홀딩 9개 / 장애물 183개
- 지도 반영 26개 / 제외(검토 필요) 0개
- 원본: (2-12) STAR(1).pdf, (2-15) INSTR APCH CHART.pdf, (2-5) AD OBSTACLE CHART TYPE A(4).pdf, (2-7) AD OBSTACLE CHART TYPE B.pdf, (2-8) SID(1).pdf, RKJY-TEXT.pdf

## 검증 결과
- [fixed] RNAV POVOR 1R 002: dist 77.0 → 7.7 (OCR 소수점 보정)

## 절차
| 종류 | 이름 | 활주로 | 구간 | 근사 | 판정 |
|---|---|---|---|---|---|
| STAR | RNAV TEDAN 1D  | 17 | 2 |  |  |
| STAR | RNAV NISAV 1D  | 17 | 6 |  |  |
| STAR | RNAV TEDAN 1E  | 17 | 2 |  |  |
| STAR | RNAV TEDAN 3C  | 35 | 5 |  |  |
| STAR | RNAV NISAV 1C  | 35 | 3 |  |  |
| IAP | ILS Y/LOC Y RWY 17 from YEONA | 17 | 6 |  |  |
| IAP | ILS Z/LOC Z RWY 17 from SKOTA | 17 | 6 |  |  |
| IAP | RNP RWY 17 via SKOTA to AGUTI(IF) | 17 | 2 |  |  |
| IAP | RNP RWY 17 via YEONA to AGUTI(IF) | 17 | 3 |  |  |
| IAP | RNP RWY 17 via AGUTI(IF) to SOONA(MAHF) | 17 | 6 |  |  |
| IAP | VOR RWY 17 from YEONA | 17 | 6 |  |  |
| IAP | ILS Y/LOC Y RWY 35 from SOONA | 35 | 6 |  |  |
| IAP | ILS Z/LOC Z RWY 35 from SOONA | 35 | 6 |  |  |
| IAP | RNP RWY 35  | 35 | 7 |  |  |
| IAP | VOR RWY 35 from SOONA | 35 | 6 |  |  |
| SID | RNAV ANUBA 1M  | 17 | 5 |  |  |
| SID | RNAV POVOR 1M  | 17 | 3 |  |  |
| SID | RNAV TEDAN 1M  | 17 | 4 | 예 |  |
| SID | ANUBA 5S  | 17 | 0 | 예 |  |
| SID | GOSBO 4S  | 17 | 0 | 예 |  |
| SID | RNAV POVOR 1R  | 35 | 6 |  |  |
| SID | RNAV ANUBA 1R  | 35 | 2 |  |  |
| SID | RNAV TEDAN 1R  | 35 | 2 | 예 |  |
| SID | RNAV POVOR 6R  | 35 | 4 | 예 |  |
| SID | ANUBA 5N  | 35 | 0 | 예 |  |
| SID | GOSBO 5N  | 35 | 0 | 예 |  |

## 재래식 절차 (기준 코딩 구조 + AIP 좌표, 차트 대조)
기준 DB의 레그 구조만 사용하고 좌표는 AIP(항행안전시설 위치·방위/DME·활주로 시단·fix 표)로 다시 계산. 차트 대조 = 현재 AIP 차트에 fix 이름·코스가 실려 있는 비율.

| 종류 | 절차 | 결과 | fix 대조 | 코스 대조 | 기준 대비 최대 편차 | 근거 차트 | 비고 |
|---|---|---|---|---|---|---|---|
| sids | ANUB5N.RW35 | 반영 | 100% | 67% | 6 m | (2-8) SID(1).pdf p7 (OCR) | heading 구간 근사 |
| sids | ANUB5S.RW17 | 반영 | 100% | 67% | 6 m | (2-8) SID(1).pdf p3 (OCR) | heading 구간 근사 |
| sids | GOSB4S.RW17 | 반영 | 100% | 100% | 0 m | (2-8) SID(1).pdf p3 (OCR) | heading 구간 근사 |
| sids | GOSB5N.RW35 | 반영 | 100% | 67% | 26 m | (2-8) SID(1).pdf p7 (OCR) | heading 구간 근사 |
| iaps | D17 | 반영 | 100% | 100% | 4 m | (2-15) INSTR APCH CHART.pdf p7 |  |
| iaps | D17.YEONA | 반영 | 100% | 100% | 4 m | (2-15) INSTR APCH CHART.pdf p1 |  |
| iaps | D35 | 반영 | 100% | 100% | 13 m | (2-15) INSTR APCH CHART.pdf p9 | heading 구간 근사 |
| iaps | I17-Y | 반영 | 100% | 100% | 0 m | (2-15) INSTR APCH CHART.pdf p1 |  |
| iaps | I17-Y.YEONA | 반영 | 100% | 100% | 213 m | (2-15) INSTR APCH CHART.pdf p1 |  |
| iaps | I17-Z | 반영 | 100% | 100% | 0 m | (2-15) INSTR APCH CHART.pdf p1 |  |
| iaps | I35-Y | 반영 | 100% | 100% | 188 m | (2-15) INSTR APCH CHART.pdf p9 | heading 구간 근사 |
| iaps | I35-Z | 반영 | 100% | 100% | 0 m | (2-15) INSTR APCH CHART.pdf p11 |  |
