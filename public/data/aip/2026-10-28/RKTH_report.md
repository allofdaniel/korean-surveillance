# RKTH AIP 자동판독 리포트 (AIRAC 2026-10-28)

- 절차 34개 / Fix 47개 / 홀딩 6개 / 장애물 0개
- 지도 반영 34개 / 제외(검토 필요) 0개
- 원본: (2-11) INSTR APCH CHART(1).pdf, (2-3) SID(3).pdf, (2-8) STAR(1).pdf, RKTH-TEXT.pdf

## 검증 결과
- [warn] fix IKPO differs 62 m in AD2.19
- [warn] fix IGASA differs 392 m in RKTH AD CHART 2-16-2 (2 JUN 2022)
- [warn] fix TH702 differs 3699 m in RKTH AD CHART 2-17-1 (AIP AMDT 10/25)
- [warn] fix TH804 좌표 판독 실패 → DORTI에서 진방위/거리로 계산 (RNAV DORTI 1)

## 절차
| 종류 | 이름 | 활주로 | 구간 | 근사 | 판정 |
|---|---|---|---|---|---|
| IAP | RNP RWY 10 via ELAPI to IGASA(IAF) | 10 | 2 |  |  |
| IAP | RNP RWY 10 via LOSTO to IGASA(IAF) | 10 | 2 |  |  |
| IAP | RNP Y RWY 10 IGASA to RUTON | 10 | 10 |  |  |
| IAP | RNP RWY 10 via ELAPI to IGASA(IAF) | 10 | 2 |  |  |
| IAP | RNP RWY 10 via LOSTO to IGASA(IAF) | 10 | 2 |  |  |
| IAP | RNP Z RWY 10(AR) via IGASA to RUTON | 10 | 9 |  |  |
| IAP | RNP RWY 28 via LOSTO to RUTON(IAF) | 28 | 2 |  |  |
| IAP | RNP RWY 28 via BULGA to RUTON(IAF) | 28 | 2 |  |  |
| IAP | RNP Y RWY 28 via RUTON to SABUM(IF) | 28 | 3 |  |  |
| IAP | RNP Y RWY 28 via DOKPA to SABUM(IF) | 28 | 3 |  |  |
| IAP | RNP Y RWY 28 via SABUM to MAPt | 28 | 6 |  |  |
| IAP | RNP RWY 28 via LOSTO to RUTON(IAF) | 28 | 2 |  |  |
| IAP | RNP RWY 28 via BULGA to RUTON(IAF) | 28 | 1 |  |  |
| IAP | RNP Z RWY 28(AR) via RUTON to SABUM(IF) | 28 | 2 |  |  |
| IAP | RNP Z RWY 28(AR) via DOKPA to SABUM(IF) | 28 | 2 |  |  |
| IAP | RNP Z RWY 28(AR) via SABUM to IGASA | 28 | 6 |  |  |
| SID | RNAV DORTI 1 ELAPI | 10 | 5 |  |  |
| SID | RNAV DORTI 1 LOSTO | 10 | 3 |  |  |
| SID | RNAV DORTI 1 BULGA | 10 | 3 |  |  |
| SID | RNAV DORTI 1 APARU | 10 | 4 |  |  |
| SID | RNAV DORTI 1 LAPAL | 10 | 4 |  |  |
| SID | RNAV MARMI 1 LOSTO | 28 | 4 |  |  |
| SID | RNAV MARMI 1 ELAPI | 28 | 3 |  |  |
| SID | RNAV MARMI 1 LAPAL | 28 | 2 |  |  |
| SID | RNAV MARMI 1 APARU | 28 | 4 |  |  |
| SID | RNAV MARMI 1 BULGA | 28 | 5 |  |  |
| STAR | RNAV EMTIK 1  | 10 | 2 |  |  |
| STAR | RNAV EMTIK 1 BULGA | 10 | 2 |  |  |
| STAR | RNAV EMTIK 1 LAPAL | 10 | 2 |  |  |
| STAR | RNAV EMTIK 1 APARU | 10 | 3 |  |  |
| STAR | RNAV PUDEN 1 APARU | 28 | 3 |  |  |
| STAR | RNAV PUDEN 1 ELAPI | 28 | 2 |  |  |
| STAR | RNAV PUDEN 1 LAPAL | 28 | 2 |  |  |
| STAR | RNAV PUDEN 1  | 28 | 2 |  |  |

## 재래식 절차 (기준 코딩 구조 + AIP 좌표, 차트 대조)
기준 DB의 레그 구조만 사용하고 좌표는 AIP(항행안전시설 위치·방위/DME·활주로 시단·fix 표)로 다시 계산. 차트 대조 = 현재 AIP 차트에 fix 이름·코스가 실려 있는 비율.

| 종류 | 절차 | 결과 | fix 대조 | 코스 대조 | 기준 대비 최대 편차 | 근거 차트 | 비고 |
|---|---|---|---|---|---|---|---|
| sids | POHAN3.APARU | 반영 | 100% | 100% | 32 m | (2-3) SID(3).pdf p1 | heading 구간 근사 |
| sids | POHAN3.BULGA | 반영 | 100% | 100% | 32 m | (2-3) SID(3).pdf p1 | heading 구간 근사 |
| sids | POHAN3.ELAPI | 반영 | 100% | 100% | 32 m | (2-3) SID(3).pdf p1 | heading 구간 근사 |
| sids | POHAN3.LAPAL | 반영 | 100% | 100% | 32 m | (2-3) SID(3).pdf p1 | heading 구간 근사 |
| sids | POHAN3.LOSTO | 반영 | 100% | 100% | 32 m | (2-3) SID(3).pdf p1 | heading 구간 근사 |
| sids | POHAN3.RW10 | 반영 | 100% | 100% | 32 m | (2-3) SID(3).pdf p1 | heading 구간 근사 |
| sids | POHAN4.APARU | 반영 | 100% | 100% | 129 m | (2-3) SID(3).pdf p7 | heading 구간 근사 |
| sids | POHAN4.BULGA | 반영 | 100% | 100% | 129 m | (2-3) SID(3).pdf p7 | heading 구간 근사 |
| sids | POHAN4.ELAPI | 반영 | 100% | 100% | 129 m | (2-3) SID(3).pdf p7 | heading 구간 근사 |
| sids | POHAN4.LAPAL | 반영 | 100% | 100% | 129 m | (2-3) SID(3).pdf p1 | heading 구간 근사 |
| sids | POHAN4.LOSTO | 반영 | 100% | 100% | 129 m | (2-3) SID(3).pdf p7 | heading 구간 근사 |
| sids | POHAN4.RW28 | 반영 | 100% | 100% | 129 m | (2-3) SID(3).pdf p7 | heading 구간 근사 |
| sids | POHAN5.APARU | 반영 | 100% | 100% | 130 m | (2-3) SID(3).pdf p1 | heading 구간 근사 |
| sids | POHAN5.BULGA | 반영 | 100% | 100% | 130 m | (2-3) SID(3).pdf p1 | heading 구간 근사 |
| sids | POHAN5.ELAPI | 반영 | 100% | 100% | 130 m | (2-3) SID(3).pdf p1 | heading 구간 근사 |
| sids | POHAN5.LAPAL | 반영 | 100% | 100% | 130 m | (2-3) SID(3).pdf p1 | heading 구간 근사 |
| sids | POHAN5.LOSTO | 반영 | 100% | 100% | 130 m | (2-3) SID(3).pdf p1 | heading 구간 근사 |
| sids | POHAN5.RW10 | 반영 | 100% | 100% | 130 m | (2-3) SID(3).pdf p1 |  |
| iaps | D10 | 반영 | 100% | 100% | 0 m | (2-11) INSTR APCH CHART(1).pdf p1 | AIP 미확인 fix: CD10, 80VOR; heading 구간 근사 |
| iaps | D10.POSCO | 반영 | 100% | 100% | 0 m | (2-11) INSTR APCH CHART(1).pdf p1 | AIP 미확인 fix: CD10 |
| iaps | D28 | 반영 | 100% | 100% | 0 m | (2-11) INSTR APCH CHART(1).pdf p9 | AIP 미확인 fix: CD28; heading 구간 근사 |
| iaps | D28.DAEBO | 반영 | 100% | 100% | 0 m | (2-11) INSTR APCH CHART(1).pdf p9 | AIP 미확인 fix: CD28 |
| iaps | L10 | 반영 | 100% | 100% | 121 m | (2-11) INSTR APCH CHART(1).pdf p1 | AIP 미확인 fix: 90LOC, 48LOC, ML10; heading 구간 근사 |
| iaps | L10.POSCO | 반영 | 100% | 50% | 355 m | (2-11) INSTR APCH CHART(1).pdf p1 | heading 구간 근사 |
| iaps | T10 | 반영 | 100% | 100% | 0 m | (2-11) INSTR APCH CHART(1).pdf p1 | AIP 미확인 fix: CD10, 80VOR; heading 구간 근사 |
| iaps | T10.POSCO | 반영 | 100% | 100% | 0 m | (2-11) INSTR APCH CHART(1).pdf p1 | AIP 미확인 fix: CD10 |
| iaps | T28 | 반영 | 100% | 100% | 0 m | (2-11) INSTR APCH CHART(1).pdf p9 | AIP 미확인 fix: CD28; heading 구간 근사 |
| iaps | T28.DAEBO | 반영 | 100% | 100% | 0 m | (2-11) INSTR APCH CHART(1).pdf p9 | AIP 미확인 fix: CD28 |
