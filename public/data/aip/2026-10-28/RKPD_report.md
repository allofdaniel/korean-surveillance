# RKPD AIP 자동판독 리포트 (AIRAC 2026-10-28)

- 절차 22개 / Fix 48개 / 홀딩 1개 / 장애물 3개
- 지도 반영 22개 / 제외(검토 필요) 0개
- 원본: (2-12) STAR(2).pdf, (2-15) INSTR APCH CHART(1).pdf, (2-3) AERODROME OBST CHART.pdf, (2-4) SID.pdf, RKPD-TEXT.pdf

## 검증 결과
- 이상 없음 (모든 RNAV 구간 거리·방위가 게재값과 일치)

## 절차
| 종류 | 이름 | 활주로 | 구간 | 근사 | 판정 |
|---|---|---|---|---|---|
| STAR | RNAV CJU 1T  | 01 | 4 |  |  |
| STAR | RNAV UPGOS 1S  | 01 | 6 |  |  |
| IAP | ILS RWY 01  | 01 | 3 |  |  |
| IAP | ILS RWY 01 from TENUL | 01 | 2 |  |  |
| IAP | ILS RWY 01 from EGOMI | 01 | 2 |  |  |
| IAP | LOC RWY 01  | 01 | 4 |  |  |
| IAP | LOC RWY 01 from TENUL | 01 | 2 |  |  |
| IAP | LOC RWY 01 from EGOMI | 01 | 2 |  |  |
| IAP | RNP RWY 01 via TENUL to PD501(IF) | 01 | 2 |  |  |
| IAP | RNP RWY 01 via MUPAS to PD501(IF) | 01 | 2 |  |  |
| IAP | RNP RWY 01 via PD501 (IF) to MAHF | 01 | 7 |  |  |
| IAP | VOR RWY 01 from TENUL | 01 | 6 |  |  |
| SID | RNAV CJU 1N  | 01 | 5 |  |  |
| SID | RNAV AKPON 1M  | 01 | 5 |  |  |
| SID | TENUL 1N  | 01 | 0 |  |  |
| SID | EGOMI 1N  | 01 | 0 | 예 |  |
| SID | GONEE 1A  | 01 | 0 |  |  |
| SID | RNAV CJU 1S  | 19 | 5 |  |  |
| SID | RNAV AKPON 1S  | 19 | 5 |  |  |
| SID | TENUL 1S  | 19 | 0 |  |  |
| SID | SUPUL 1A  | 19 | 0 | 예 |  |
| SID | EGOMI 1S  | 19 | 0 |  |  |

## 재래식 절차 (기준 코딩 구조 + AIP 좌표, 차트 대조)
기준 DB의 레그 구조만 사용하고 좌표는 AIP(항행안전시설 위치·방위/DME·활주로 시단·fix 표)로 다시 계산. 차트 대조 = 현재 AIP 차트에 fix 이름·코스가 실려 있는 비율.

| 종류 | 절차 | 결과 | fix 대조 | 코스 대조 | 기준 대비 최대 편차 | 근거 차트 | 비고 |
|---|---|---|---|---|---|---|---|
| sids | CJU6A.RW01 | 반영 | 100% | 50% | 184 m | (2-4) SID.pdf p2 | heading 구간 근사 |
| sids | CJU6B.RW19 | 반영 | 100% | 67% | 79 m | (2-4) SID.pdf p13 | heading 구간 근사 |
| sids | EGOM1S.RW19 | 반영 | 100% | 100% | 22 m | (2-4) SID.pdf p15 | heading 구간 근사 |
| sids | GONE1A.RW01 | 반영 | 100% | 100% | 16 m | (2-4) SID.pdf p7 | heading 구간 근사 |
| sids | SUPU1A.RW19 | 반영 | 100% | 100% | 123 m | (2-4) SID.pdf p15 | heading 구간 근사 |
| sids | TENU1N.RW01 | 반영 | 100% | 50% | 929 m | (2-4) SID.pdf p5 | heading 구간 근사 |
| sids | TENU1S.RW19 | 반영 | 100% | 100% | 0 m | (2-4) SID.pdf p13 | heading 구간 근사 |
| stars | GEB1A.RW01 | 반영 | 100% | 100% | 0 m | (2-12) STAR(2).pdf p5 |  |
| stars | TDL1A.RW01 | 반영 | 100% | 100% | 0 m | (2-12) STAR(2).pdf p5 |  |
| iaps | D01 | 반영 | 100% | 100% | 927 m | (2-15) INSTR APCH CHART(1).pdf p7 | heading 구간 근사 |
| iaps | D01.EGOMI | 반영 | 100% | 100% | 0 m | (2-15) INSTR APCH CHART(1).pdf p7 |  |
| iaps | D01.TENUL | 반영 | 100% | 100% | 0 m | (2-15) INSTR APCH CHART(1).pdf p7 |  |
| iaps | I01 | 반영 | 100% | 100% | 56 m | (2-15) INSTR APCH CHART(1).pdf p1 | heading 구간 근사 |
| iaps | I01.EGOMI | 반영 | 100% | 50% | 172 m | (2-15) INSTR APCH CHART(1).pdf p1 | heading 구간 근사 |
| iaps | I01.TENUL | 반영 | 100% | 50% | 172 m | (2-15) INSTR APCH CHART(1).pdf p1 | heading 구간 근사 |
| iaps | L01 | 반영 | 100% | 100% | 56 m | (2-15) INSTR APCH CHART(1).pdf p1 | heading 구간 근사 |
| iaps | L01.EGOMI | 반영 | 100% | 50% | 172 m | (2-15) INSTR APCH CHART(1).pdf p1 | heading 구간 근사 |
| iaps | L01.TENUL | 반영 | 100% | 50% | 172 m | (2-15) INSTR APCH CHART(1).pdf p1 | heading 구간 근사 |
