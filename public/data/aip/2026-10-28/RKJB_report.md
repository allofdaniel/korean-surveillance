# RKJB AIP 자동판독 리포트 (AIRAC 2026-10-28)

- 절차 37개 / Fix 85개 / 홀딩 2개 / 장애물 55개
- 지도 반영 37개 / 제외(검토 필요) 0개
- 원본: (2-11) STAR.pdf, (2-14) INSTR APCH CHART(1).pdf, (2-5) AD OBSTACLE CHART TYPE A(2).pdf, (2-6) AD OBSTACLE CHART TYPE B(1).pdf, (2-7) SID.pdf, RKJB-TEXT.pdf

## 검증 결과
- [warn] fix THR RWY 19 differs 300 m in RKJB AD CHART 2-21-1 (AIRAC AIP AMDT 9/24)

## 절차
| 종류 | 이름 | 활주로 | 구간 | 근사 | 판정 |
|---|---|---|---|---|---|
| STAR | RNAV MANGI 2C  | 01 | 5 |  |  |
| STAR | RNAV MANGI 2H  | 01 | 6 |  |  |
| STAR | RNAV KAMIT 2C  | 01 | 4 |  |  |
| STAR | RNAV MANGI 1D  | 19 | 3 |  |  |
| STAR | RNAV SAMUL 1D  | 19 | 4 |  |  |
| STAR | RNAV KAMIT 1D  | 19 | 6 |  |  |
| IAP | ILS Y or LOC Y RWY 01  | 01 | 4 |  |  |
| IAP | ILS Y or LOC Y RWY 01 from OVGEN | 01 | 2 |  |  |
| IAP | ILS Y or LOC Y RWY 01 from OLBES | 01 | 2 |  |  |
| IAP | ILS Y or LOC Y RWY 01 from PEGRO | 01 | 3 |  |  |
| IAP | ILS Z or LOC Z RWY 01  | 01 | 4 |  |  |
| IAP | ILS Z or LOC Z RWY 01 from OVGEN | 01 | 2 |  |  |
| IAP | ILS Z or LOC Z RWY 01 from OLBES | 01 | 2 |  |  |
| IAP | ILS Z or LOC Z RWY 01 from PEGRO | 01 | 2 |  |  |
| IAP | RNP RWY 01 via OVGEN to KEVAP(IF) | 01 | 2 |  |  |
| IAP | RNP RWY 01 via OLBES to KEVAP(IF) | 01 | 2 |  |  |
| IAP | RNP RWY 01 via PEGRO to KEVAP(IF) | 01 | 2 |  |  |
| IAP | RNP RWY 01 via KEVAP(IF) to GUPLA(MAHF) | 01 | 6 |  |  |
| IAP | VOR RWY 01  | 01 | 4 |  |  |
| IAP | VOR RWY 01 from OVGEN | 01 | 2 |  |  |
| IAP | VOR RWY 01 from OLBES | 01 | 2 |  |  |
| IAP | VOR RWY 01 from PEGRO | 01 | 3 |  |  |
| IAP | ILS Y or LOC Y RWY 19  | 19 | 5 |  |  |
| IAP | ILS Y or LOC Y RWY 19 from GUPLA | 19 | 2 |  |  |
| IAP | ILS Y or LOC Y RWY 19 from DOVRA | 19 | 2 |  |  |
| IAP | ILS Z or LOC Z RWY 19  | 19 | 4 |  |  |
| IAP | ILS Z or LOC Z RWY 19 from AYEON | 19 | 2 |  |  |
| IAP | ILS Z or LOC Z RWY 19 from DOWAN | 19 | 2 |  |  |
| IAP | VOR RWY 19  | 19 | 5 |  |  |
| IAP | VOR RWY 19 from GUPLA | 19 | 2 |  |  |
| IAP | VOR RWY 19 from DOVRA | 19 | 2 |  |  |
| SID | RNAV MAKSA 1N  | 01 | 5 |  |  |
| SID | RNAV DOTOL 1N  | 01 | 8 |  |  |
| SID | RNAV MAKSA 1S  | 19 | 5 |  |  |
| SID | RNAV MAKSA 6S  | 19 | 6 |  |  |
| SID | RNAV DOTOL 1S  | 19 | 5 |  |  |
| SID | IPDAS 3S  | 19 | 0 | 예 |  |

## 재래식 절차 (기준 코딩 구조 + AIP 좌표, 차트 대조)
기준 DB의 레그 구조만 사용하고 좌표는 AIP(항행안전시설 위치·방위/DME·활주로 시단·fix 표)로 다시 계산. 차트 대조 = 현재 AIP 차트에 fix 이름·코스가 실려 있는 비율.

| 종류 | 절차 | 결과 | fix 대조 | 코스 대조 | 기준 대비 최대 편차 | 근거 차트 | 비고 |
|---|---|---|---|---|---|---|---|
| sids | IPDA3S.RW19 | 반영 | 100% | 67% | 0 m | (2-7) SID.pdf p7 | AIP 미확인 fix: KWA42; heading 구간 근사 |
| sids | KWA3N.RW01 | 반영 | 100% | 67% | 12 m | (2-7) SID.pdf p3 | heading 구간 근사 |
| sids | KWA3S.RW19 | 반영 | 100% | 100% | 12 m | (2-7) SID.pdf p7 | heading 구간 근사 |
| iaps | D01 | 반영 | 100% | 67% | 0 m | (2-14) INSTR APCH CHART(1).pdf p9 | heading 구간 근사 |
| iaps | D01.OVGEN | 반영 | 100% | 100% | 928 m | (2-14) INSTR APCH CHART(1).pdf p1 |  |
| iaps | D01.PEGRO | 반영 | 100% | 100% | 928 m | (2-14) INSTR APCH CHART(1).pdf p1 |  |
| iaps | D19.DOVRA | 반영 | 100% | 100% | 1 m | (2-14) INSTR APCH CHART(1).pdf p11 |  |
| iaps | D19.GUPLA | 반영 | 100% | 100% | 1 m | (2-14) INSTR APCH CHART(1).pdf p11 |  |
| iaps | I01-Y | 반영 | 100% | 67% | 0 m | (2-14) INSTR APCH CHART(1).pdf p1 | heading 구간 근사 |
| iaps | I01-Y.OVGEN | 반영 | 100% | 100% | 1090 m | (2-14) INSTR APCH CHART(1).pdf p1 |  |
| iaps | I01-Y.PEGRO | 반영 | 100% | 100% | 1090 m | (2-14) INSTR APCH CHART(1).pdf p1 |  |
| iaps | I19-Y | 반영 | 100% | 100% | 660 m | (2-14) INSTR APCH CHART(1).pdf p11 | heading 구간 근사 |
| iaps | I19-Y.DOVRA | 반영 | 100% | 100% | 660 m | (2-14) INSTR APCH CHART(1).pdf p11 |  |
| iaps | I19-Y.GUPLA | 반영 | 100% | 100% | 660 m | (2-14) INSTR APCH CHART(1).pdf p11 |  |
