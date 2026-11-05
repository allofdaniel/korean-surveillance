# RKTN AIP 자동판독 리포트 (AIRAC 2026-10-28)

- 절차 42개 / Fix 50개 / 홀딩 2개 / 장애물 235개
- 지도 반영 42개 / 제외(검토 필요) 0개
- 원본: (2-10) SID.pdf, (2-15) STAR.pdf, (2-18) INSTR APCH CHART.pdf, (2-9) AD OBSTACLE CHART TYPE B(2).pdf, RKTN-TEXT.pdf

## 검증 결과
- [warn] fix ITAG differs 2754 m in AD2.19
- [warn] fix IDAG differs 80 m in AD2.19
- [warn] fix ITGL differs 2782 m in AD2.19
- [warn] fix MASTA differs 110959 m in RKTN AD CHART 2-15-2 (AIRAC AIP AMDT 8/26)
- [warn] fix MASTA differs 110959 m in RKTN AD CHART 2-16-2 (AIP AMDT 11/26)

## 절차
| 종류 | 이름 | 활주로 | 구간 | 근사 | 판정 |
|---|---|---|---|---|---|
| SID | RADAR 1E  |  | 0 |  |  |
| SID | RADAR 1W  |  | 0 |  |  |
| SID | BITUX 1B  | 13L | 0 | 예 |  |
| SID | OPEDA 1B  | 13L | 0 | 예 |  |
| SID | IGDOK 1B  | 13L | 0 | 예 |  |
| SID | MASTA 1B  | 13L | 0 | 예 |  |
| SID | KALOD 1B  | 13L | 0 | 예 |  |
| SID | LAPAL 1B  | 13L | 0 | 예 |  |
| SID | BITUX 1A  | 31L | 0 | 예 |  |
| SID | OPEDA 1A  | 31L | 0 | 예 |  |
| SID | IGDOK 1A  | 31L | 0 | 예 |  |
| SID | MASTA 1A  | 31L | 0 | 예 |  |
| SID | KALOD 1A  | 31L | 0 | 예 |  |
| SID | LAPAL 1A  | 31L | 0 | 예 |  |
| SID | RNAV BITUX 1D  | 13L | 5 |  |  |
| SID | RNAV OPEDA 1D  | 13L | 4 |  |  |
| SID | RNAV IGDOK 1D  | 13L | 4 |  |  |
| SID | RNAV MASTA 1D  | 13L | 3 |  |  |
| SID | RNAV KALOD 1D  | 13L | 2 |  |  |
| SID | RNAV LAPAL 1D  | 13L | 2 |  |  |
| SID | RNAV BITUX 1K  | 31L | 3 |  |  |
| SID | RNAV OPEDA 1K  | 31L | 2 |  |  |
| SID | RNAV IGDOK 1K  | 31L | 4 |  |  |
| SID | RNAV MASTA 1K  | 31L | 3 |  |  |
| SID | RNAV KALOD 1K  | 31L | 4 |  |  |
| SID | RNAV LAPAL 1K  | 31L | 4 |  |  |
| STAR | RNAV BITUX 1Y  | 13L | 4 |  |  |
| STAR | RNAV OPEDA 1Y  | 13L | 3 |  |  |
| STAR | RNAV IGDOK 1Y  | 13L | 3 |  |  |
| STAR | RNAV MASTA 1Y  | 13L | 2 |  |  |
| STAR | RNAV KALOD 1Y  | 13L | 3 |  |  |
| STAR | RNAV LAPAL 1Y  | 13L | 3 |  |  |
| STAR | RNAV BITUX 1U  | 31L | 5 |  |  |
| STAR | RNAV OPEDA 1U  | 31L | 4 |  |  |
| STAR | RNAV IGDOK 1U  | 31L | 5 |  |  |
| STAR | RNAV MASTA 1U  | 31L | 5 |  |  |
| STAR | RNAV KALOD 1U  | 31L | 5 |  |  |
| STAR | RNAV LAPAL 1U  | 31L | 2 |  |  |
| IAP | ILS/LOC RWY 13R from YAWAN | 13R | 4 |  |  |
| IAP | ILS/LOC RWY 31L from UKBAT | 31L | 4 |  |  |
| IAP | LOC Y RWY 31R from UKBAT | 31R | 4 |  |  |
| IAP | RNP Y RWY 31R  | 31R | 11 |  |  |

## 재래식 절차 (기준 코딩 구조 + AIP 좌표, 차트 대조)
기준 DB의 레그 구조만 사용하고 좌표는 AIP(항행안전시설 위치·방위/DME·활주로 시단·fix 표)로 다시 계산. 차트 대조 = 현재 AIP 차트에 fix 이름·코스가 실려 있는 비율.

| 종류 | 절차 | 결과 | fix 대조 | 코스 대조 | 기준 대비 최대 편차 | 근거 차트 | 비고 |
|---|---|---|---|---|---|---|---|
| sids | DAEG1D.RW13B | 반영 | 100% | 100% | 0 m | (2-10) SID.pdf p1 | heading 구간 근사 |
| sids | DAEG1D.RW31B | 반영 | 100% | 100% | 0 m | (2-10) SID.pdf p1 | heading 구간 근사 |
| sids | DOC13.BITUX | 반영 | 100% | 100% | 297 m | (2-10) SID.pdf p3 |  |
| sids | DOC13.IGDOK | 반영 | 100% | 100% | 179 m | (2-10) SID.pdf p3 |  |
| sids | DOC13.KALOD | 반영 | 100% | 100% | 179 m | (2-10) SID.pdf p1 |  |
| sids | DOC13.LAPAL | 반영 | 100% | 100% | 249 m | (2-10) SID.pdf p1 |  |
| sids | DOC13.MASTA | 반영 | 100% | 100% | 230 m | (2-10) SID.pdf p1 |  |
| sids | DOC13.OPEDA | 반영 | 100% | 100% | 179 m | (2-10) SID.pdf p3 |  |
| sids | DOC13.RW13B | 반영 | 100% | 100% | 179 m | (2-10) SID.pdf p1 | heading 구간 근사 |
| sids | DOC31.IGDOK | 반영 | 100% | 100% | 178 m | (2-10) SID.pdf p3 |  |
| sids | DOC31.KALOD | 반영 | 100% | 100% | 178 m | (2-10) SID.pdf p1 |  |
| sids | DOC31.LAPAL | 반영 | 100% | 100% | 249 m | (2-10) SID.pdf p1 |  |
| sids | DOC31.MASTA | 반영 | 100% | 100% | 230 m | (2-10) SID.pdf p1 |  |
| sids | DOC31.OPEDA | 반영 | 100% | 100% | 178 m | (2-10) SID.pdf p3 |  |
| sids | DOC31.RW31B | 반영 | 100% | 100% | 178 m | (2-10) SID.pdf p1 | heading 구간 근사 |
| sids | TGU3A.RW13B | 제외: 현재 AIP 차트에서 확인 안 됨 | 100% | 0% |  | (2-10) SID.pdf p1 (OCR) |  |
| sids | TGU3A.RW31B | 반영 | 100% | 50% | 594 m | (2-10) SID.pdf p1 (OCR) | heading 구간 근사 |
| iaps | D31L | 반영 | 100% | 100% | 0 m | (2-18) INSTR APCH CHART.pdf p3 | AIP 미확인 fix: CD31, VOR11 |
| iaps | D31L.UKBAT | 반영 | 100% | 100% | 0 m | (2-18) INSTR APCH CHART.pdf p1 | AIP 미확인 fix: CD31 |
| iaps | D31R | 반영 | 100% | 100% | 0 m | (2-18) INSTR APCH CHART.pdf p3 | AIP 미확인 fix: CD31, VOR11 |
| iaps | D31R.UKBAT | 반영 | 100% | 100% | 0 m | (2-18) INSTR APCH CHART.pdf p1 | AIP 미확인 fix: CD31 |
| iaps | I13R | 반영 | 100% | 100% | 0 m | (2-18) INSTR APCH CHART.pdf p1 | heading 구간 근사 |
| iaps | I13R.YAWAN | 반영 | 100% | 100% | 1012 m | (2-18) INSTR APCH CHART.pdf p1 |  |
| iaps | I31L | 반영 | 100% | 100% | 0 m | (2-18) INSTR APCH CHART.pdf p3 | heading 구간 근사 |
| iaps | I31L.UKBAT | 반영 | 100% | 100% | 950 m | (2-18) INSTR APCH CHART.pdf p1 |  |
| iaps | L13R | 반영 | 100% | 100% | 0 m | (2-18) INSTR APCH CHART.pdf p1 | AIP 미확인 fix: 94LOC; heading 구간 근사 |
| iaps | L13R.YAWAN | 반영 | 100% | 50% | 227 m | (2-18) INSTR APCH CHART.pdf p1 | heading 구간 근사 |
| iaps | L31L | 반영 | 100% | 100% | 0 m | (2-18) INSTR APCH CHART.pdf p3 | AIP 미확인 fix: LOC10, 33LOC; heading 구간 근사 |
| iaps | L31L.UKBAT | 반영 | 100% | 100% | 0 m | (2-18) INSTR APCH CHART.pdf p1 |  |
| iaps | L31R | 반영 | 100% | 100% | 0 m | (2-18) INSTR APCH CHART.pdf p3 | AIP 미확인 fix: LOC12, 48LOC |
| iaps | L31R.UKBAT | 반영 (AIP 표 절차 L31R-Y.UKBAT 형상 교체) | 100% | 100% | 262 m | (2-18) INSTR APCH CHART.pdf p3 | heading 구간 근사 |
| sids | BITU1B.RW13L | AIP 명칭 적용 (DOC13.RW13B + DOC13.BITUX → BITUX 1B) | 100% | 100% |  |  |  |
| sids | OPED1B.RW13L | AIP 명칭 적용 (DOC13.RW13B + DOC13.OPEDA → OPEDA 1B) | 100% | 100% |  |  |  |
| sids | IGDO1B.RW13L | AIP 명칭 적용 (DOC13.RW13B + DOC13.IGDOK → IGDOK 1B) | 100% | 100% |  |  |  |
| sids | MAST1B.RW13L | AIP 명칭 적용 (DOC13.RW13B + DOC13.MASTA → MASTA 1B) | 100% | 100% |  |  |  |
| sids | KALO1B.RW13L | AIP 명칭 적용 (DOC13.RW13B + DOC13.KALOD → KALOD 1B) | 100% | 100% |  |  |  |
| sids | LAPA1B.RW13L | AIP 명칭 적용 (DOC13.RW13B + DOC13.LAPAL → LAPAL 1B) | 100% | 100% |  |  |  |
| sids | OPED1A.RW31L | AIP 명칭 적용 (DOC31.RW31B + DOC31.OPEDA → OPEDA 1A) | 100% | 100% |  |  |  |
| sids | IGDO1A.RW31L | AIP 명칭 적용 (DOC31.RW31B + DOC31.IGDOK → IGDOK 1A) | 100% | 100% |  |  |  |
| sids | MAST1A.RW31L | AIP 명칭 적용 (DOC31.RW31B + DOC31.MASTA → MASTA 1A) | 100% | 100% |  |  |  |
| sids | KALO1A.RW31L | AIP 명칭 적용 (DOC31.RW31B + DOC31.KALOD → KALOD 1A) | 100% | 100% |  |  |  |
| sids | LAPA1A.RW31L | AIP 명칭 적용 (DOC31.RW31B + DOC31.LAPAL → LAPAL 1A) | 100% | 100% |  |  |  |
