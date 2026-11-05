# RKSM AIP 자동판독 리포트 (AIRAC 2026-10-28)

- 절차 18개 / Fix 31개 / 홀딩 0개 / 장애물 0개
- 지도 반영 18개 / 제외(검토 필요) 0개
- 원본: (2-11) INSTR APCH CHART.pdf, (2-3) SID(2).pdf, RKSM-TEXT.pdf

## 검증 결과
- 이상 없음 (모든 RNAV 구간 거리·방위가 게재값과 일치)

## 절차
| 종류 | 이름 | 활주로 | 구간 | 근사 | 판정 |
|---|---|---|---|---|---|
| IAP | RNP RWY 01 (From KAKSO) | 01 | 6 |  |  |
| IAP | RNP RWY 01 (From GUKOB) | 01 | 6 |  |  |
| IAP | RNP RWY 02 s | 02 | 2 |  |  |
| IAP | RNP RWY 02  | 02 | 6 |  |  |
| IAP | RNP RWY 19  | 19 | 8 |  |  |
| IAP | RNP RWY 19 s | 19 | 2 |  |  |
| IAP | RNP RWY 19 s | 19 | 2 |  |  |
| IAP | RNP RWY 20  | 20 | 8 |  |  |
| IAP | RNP RWY 20 s | 20 | 2 |  |  |
| IAP | RNP RWY 20 s | 20 | 2 |  |  |
| SID | RNAV MEESA 1  | 01 | 2 |  |  |
| SID | RNP RWY 01 s | 01 | 2 |  |  |
| SID | RNP RWY 01 s | 01 | 4 |  |  |
| SID | RNAV MUGAR 1  | 19 | 2 |  |  |
| SID | RNAV SONGTAN 1  | 19 | 2 |  |  |
| SID | RNP RWY 19 s | 19 | 2 |  |  |
| SID | RNAV YEOJU 1  | 19 | 3 |  |  |
| SID | RNP RWY 19 s | 19 | 4 |  |  |

## 재래식 절차 (기준 코딩 구조 + AIP 좌표, 차트 대조)
기준 DB의 레그 구조만 사용하고 좌표는 AIP(항행안전시설 위치·방위/DME·활주로 시단·fix 표)로 다시 계산. 차트 대조 = 현재 AIP 차트에 fix 이름·코스가 실려 있는 비율.

| 종류 | 절차 | 결과 | fix 대조 | 코스 대조 | 기준 대비 최대 편차 | 근거 차트 | 비고 |
|---|---|---|---|---|---|---|---|
| sids | EGOBA5.RW01 | 반영 | 100% | 100% | 0 m | (2-3) SID(2).pdf p5 (OCR) | heading 구간 근사 |
| sids | EGOBA5.RW02 | 반영 | 100% | 75% | 0 m | (2-3) SID(2).pdf p5 (OCR) | heading 구간 근사 |
| sids | EGOBA5.RW19 | 반영 | 100% | 100% | 0 m | (2-3) SID(2).pdf p5 (OCR) | heading 구간 근사 |
| sids | EGOBA5.RW20 | 반영 | 100% | 75% | 0 m | (2-3) SID(2).pdf p5 (OCR) | heading 구간 근사 |
| sids | KSM2.KARBU | 반영 | 100% | 100% | 1343 m | (2-3) SID(2).pdf p9 |  |
| sids | KSM2.RW01 | 반영 | 100% | 100% | 0 m | (2-11) INSTR APCH CHART.pdf p5 | heading 구간 근사 |
| sids | KSM2.RW02 | 반영 | 100% | 75% | 0 m | (2-3) SID(2).pdf p5 (OCR) | heading 구간 근사 |
| sids | KSM2.RW19 | 반영 | 100% | 100% | 0 m | (2-11) INSTR APCH CHART.pdf p5 | heading 구간 근사 |
| sids | KSM2.RW20 | 반영 | 100% | 75% | 0 m | (2-11) INSTR APCH CHART.pdf p15 | heading 구간 근사 |
| sids | KSM2.SEL | 반영 | 100% | 100% | 1343 m | (2-3) SID(2).pdf p15 |  |
| sids | MUGAR1.RW20 | 반영 | 100% | 67% | 21 m | (2-11) INSTR APCH CHART.pdf p23 | heading 구간 근사 |
| sids | PINEV5.RW01 | 반영 | 100% | 100% | 21 m | (2-3) SID(2).pdf p7 (OCR) | heading 구간 근사 |
| sids | PINEV5.RW02 | 반영 | 100% | 75% | 21 m | (2-3) SID(2).pdf p7 (OCR) | heading 구간 근사 |
| sids | PINEV5.RW19 | 반영 | 100% | 100% | 21 m | (2-3) SID(2).pdf p7 (OCR) | heading 구간 근사 |
| sids | PINEV5.RW20 | 반영 | 100% | 75% | 21 m | (2-3) SID(2).pdf p7 (OCR) | heading 구간 근사 |
| sids | YEOJU1.RW20 | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 33% |  | (2-11) INSTR APCH CHART.pdf p15 (OCR) |  |
| iaps | D19 | 반영 | 100% | 100% | 0 m | (2-11) INSTR APCH CHART.pdf p5 | AIP 미확인 fix: CF203, DME11; heading 구간 근사 |
| iaps | D19.BAVIX | 반영 | 100% | 100% | 2714 m | (2-11) INSTR APCH CHART.pdf p3 |  |
| iaps | D20 | 반영 | 100% | 100% | 0 m | (2-11) INSTR APCH CHART.pdf p15 (OCR) | AIP 미확인 fix: CF203, DME11; heading 구간 근사 |
| iaps | D20.BAVIX | 반영 | 100% | 100% | 2714 m | (2-11) INSTR APCH CHART.pdf p9 |  |
| iaps | I20-Y | 반영 | 100% | 100% | 0 m | (2-11) INSTR APCH CHART.pdf p9 | heading 구간 근사 |
| iaps | I20-Y.BAVIX | 반영 | 100% | 100% | 251 m | (2-11) INSTR APCH CHART.pdf p9 |  |
| iaps | I20-Z | 반영 | 100% | 100% | 1745 m | (2-11) INSTR APCH CHART.pdf p7 | heading 구간 근사 |
| iaps | I20-Z.NITEX | 반영 | 100% | 100% | 1745 m | (2-11) INSTR APCH CHART.pdf p7 |  |
| iaps | L19-Y | 반영 | 100% | 100% | 1893 m | (2-11) INSTR APCH CHART.pdf p3 | AIP 미확인 fix: 65LOC, ML19; heading 구간 근사 |
| iaps | L19-Y.BAVIX | 반영 | 100% | 100% | 653 m | (2-11) INSTR APCH CHART.pdf p3 |  |
| iaps | L19-Z | 반영 | 100% | 100% | 1893 m | (2-11) INSTR APCH CHART.pdf p1 | AIP 미확인 fix: 65LOC, ML19; heading 구간 근사 |
| iaps | L19-Z.NITEX | 반영 | 100% | 100% | 1745 m | (2-11) INSTR APCH CHART.pdf p1 |  |
| iaps | L20-Y | 반영 | 100% | 100% | 33 m | (2-11) INSTR APCH CHART.pdf p9 | heading 구간 근사 |
| iaps | L20-Y.BAVIX | 반영 | 100% | 100% | 251 m | (2-11) INSTR APCH CHART.pdf p9 |  |
| iaps | L20-Z | 반영 | 100% | 100% | 1745 m | (2-11) INSTR APCH CHART.pdf p7 | heading 구간 근사 |
| iaps | L20-Z.NITEX | 반영 | 100% | 100% | 1745 m | (2-11) INSTR APCH CHART.pdf p7 |  |
| iaps | T19 | 반영 | 100% | 100% | 1745 m | (2-11) INSTR APCH CHART.pdf p37 | AIP 미확인 fix: CF203, DME11; heading 구간 근사 |
| iaps | T19.NITEX | 반영 | 100% | 100% | 2714 m | (2-11) INSTR APCH CHART.pdf p1 |  |
| iaps | T20 | 반영 | 100% | 100% | 1745 m | (2-11) INSTR APCH CHART.pdf p41 (OCR) | AIP 미확인 fix: CF203, DME11; heading 구간 근사 |
| iaps | T20.NITEX | 반영 | 100% | 100% | 2714 m | (2-11) INSTR APCH CHART.pdf p7 |  |
