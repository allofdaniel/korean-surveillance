# RKPK AIP 자동판독 리포트 (AIRAC 2026-10-28)

- 절차 36개 / Fix 48개 / 홀딩 7개 / 장애물 238개
- 지도 반영 35개 / 제외(검토 필요) 1개
- 원본: (2-11) AD OBSTACLE CHART TYPE B_1760589223.pdf, (2-14) SID(1).pdf, (2-17) STAR.pdf, (2-21) INSTR APCH CHART(1).pdf, (2-7) AD OBSTACLE CHART TYPE A(2).pdf, RKPK-TEXT.pdf

## 검증 결과
- [warn] fix RW18R differs 600 m in AD2.12
- [warn] fix PSN differs 20 m in AD2.19
- [warn] RNP RWY 18R(AR) 008 PK182→RW18R: 게재 1.3 NM, 계산 2.88 NM
- [warn] RNP RWY 18R(AR) 008: 게재 진방위 173.9°, 계산 132.4°

## 절차
| 종류 | 이름 | 활주로 | 구간 | 근사 | 판정 |
|---|---|---|---|---|---|
| SID | KALOD 1S  | 36L | 0 | 예 |  |
| SID | BUSAN 1S  | 36L | 0 | 예 |  |
| SID | MASTA 1S  | 36L | 0 | 예 |  |
| SID | TOPAX 1S  | 36L | 0 | 예 |  |
| SID | BESNA 1S  | 36L | 0 | 예 |  |
| SID | ENGOT 1S  | 36L | 0 | 예 |  |
| SID | KALEK 1B  | 18L | 0 | 예 |  |
| SID | INVOK 1B  | 18L | 0 | 예 |  |
| SID | APELA 1B  | 18L | 0 | 예 |  |
| SID | BUSAN 1B  | 18L | 0 | 예 |  |
| SID | TOPAX 1B  | 18L | 0 | 예 |  |
| SID | ENGOT 1B  | 18L | 0 | 예 |  |
| SID | BESNA 1B  | 18L | 0 | 예 |  |
| SID | RADAR 1S  |  | 0 |  |  |
| SID | RADAR 1N  |  | 0 |  |  |
| STAR | RNAV APARU 1P  | 36L | 3 |  |  |
| STAR | RNAV KALEK 1P  | 36L | 3 |  |  |
| STAR | RNAV INVOK 1P  | 36L | 2 |  |  |
| STAR | RNAV APELA 1P  | 36L | 2 |  |  |
| STAR | RNAV PSN 1P  | 36L | 2 |  |  |
| STAR | RNAV MASTA 1K  | 36L | 3 |  |  |
| STAR | RNAV KALOD 1K  | 36L | 3 |  |  |
| STAR | RNAV SARAM 1K  | 36L | 2 |  |  |
| STAR | RNAV ANROD 1K  | 36L | 3 |  |  |
| STAR | RNAV MASTA 1G  | 18L | 2 |  |  |
| STAR | RNAV KALOD 1G  | 18L | 2 |  |  |
| STAR | RNAV APARU 1G  | 18L | 3 |  |  |
| STAR | RNAV PSN 1G  | 18L | 3 |  |  |
| STAR | RNAV ANROD 1G  | 18L | 3 |  |  |
| IAP | ILS/LOC RWY 36L from PEDLO | 36L | 2 |  |  |
| IAP | ILS/LOC RWY 36L from KEVOX | 36L | 3 |  |  |
| IAP | ILS/LOC RWY 36L from GUBGI | 36L | 3 |  |  |
| IAP | RNP RWY 36R via PEDLO to KEVOX(MAHF) | 36R | 9 |  |  |
| IAP | RNP RWY 36R via KEVOX to KEVOX(MAHF) | 36R | 10 |  |  |
| IAP | VOR RWY 18L  | 18L | 4 |  |  |
| IAP | RNP RWY 18R(AR)  | 18R | 11 |  | 제외: PK182→RW18R 거리 불일치, PK182→RW18R 방위 불일치 |

## 재래식 절차 (기준 코딩 구조 + AIP 좌표, 차트 대조)
기준 DB의 레그 구조만 사용하고 좌표는 AIP(항행안전시설 위치·방위/DME·활주로 시단·fix 표)로 다시 계산. 차트 대조 = 현재 AIP 차트에 fix 이름·코스가 실려 있는 비율.

| 종류 | 절차 | 결과 | fix 대조 | 코스 대조 | 기준 대비 최대 편차 | 근거 차트 | 비고 |
|---|---|---|---|---|---|---|---|
| sids | ATLAX2.RW36B | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 67% |  | (2-7) AD OBSTACLE CHART TYPE A(2).pdf p1 (OCR) |  |
| sids | BAHDA2.APELA | 반영 | 100% | 100% | 259 m | (2-14) SID(1).pdf p3 |  |
| sids | BAHDA2.BESNA | 반영 | 100% | 100% | 13 m | (2-14) SID(1).pdf p3 | heading 구간 근사 |
| sids | BAHDA2.ENGOT | 반영 | 100% | 100% | 13 m | (2-14) SID(1).pdf p3 | heading 구간 근사 |
| sids | BAHDA2.INVOK | 반영 | 100% | 100% | 220 m | (2-14) SID(1).pdf p3 |  |
| sids | BAHDA2.KALEK | 반영 | 100% | 100% | 132 m | (2-14) SID(1).pdf p3 |  |
| sids | BAHDA2.PSN | 반영 | 100% | 100% | 259 m | (2-14) SID(1).pdf p3 |  |
| sids | BAHDA2.RW18B | 반영 | 100% | 50% | 13 m | (2-14) SID(1).pdf p3 | heading 구간 근사 |
| sids | BAHDA2.TOPAX | 반영 | 100% | 100% | 207 m | (2-14) SID(1).pdf p3 |  |
| sids | BEVSI3.KALOD | 제외: 현재 AIP 차트에서 확인 안 됨 | 50% | 100% |  | (2-14) SID(1).pdf p5 (OCR) |  |
| sids | BEVSI3.MASTA | 제외: 현재 AIP 차트에서 확인 안 됨 | 50% | 100% |  | (2-14) SID(1).pdf p1 (OCR) |  |
| sids | BEVSI3.PSN | 제외: 현재 AIP 차트에서 확인 안 됨 | 50% | 100% |  | (2-14) SID(1).pdf p5 (OCR) |  |
| sids | BEVSI3.RW36B | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 50% |  | (2-14) SID(1).pdf p5 (OCR) |  |
| sids | BEVSI3.TOPAX | 제외: 현재 AIP 차트에서 확인 안 됨 | 67% | 100% |  | (2-14) SID(1).pdf p5 (OCR) |  |
| sids | BURIM3.BESNA | 제외: 현재 AIP 차트에서 확인 안 됨 | 67% | 100% |  | (2-14) SID(1).pdf p3 (OCR) |  |
| sids | BURIM3.ENGOT | 제외: 현재 AIP 차트에서 확인 안 됨 | 67% | 100% |  | (2-14) SID(1).pdf p3 (OCR) |  |
| sids | BURIM3.INVOK | 제외: 현재 AIP 차트에서 확인 안 됨 | 67% | 100% |  | (2-14) SID(1).pdf p3 (OCR) |  |
| sids | BURIM3.PSN | 제외: 현재 AIP 차트에서 확인 안 됨 | 50% | 100% |  | (2-14) SID(1).pdf p1 (OCR) |  |
| sids | BURIM3.RW18L | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 50% |  | (2-14) SID(1).pdf p3 (OCR) |  |
| sids | BURIM3.RW18R | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 50% |  | (2-14) SID(1).pdf p3 (OCR) |  |
| sids | GIMHA2.RW18B | 반영 | 100% | 100% | 0 m | (2-7) AD OBSTACLE CHART TYPE A(2).pdf p1 (OCR) | heading 구간 근사 |
| sids | GIMHA2.RW36B | 반영 | 100% | 50% | 0 m | (2-14) SID(1).pdf p5 (OCR) | heading 구간 근사 |
| sids | OPONO3.BESNA | 제외: 현재 AIP 차트에서 확인 안 됨 | 50% | 100% |  | (2-14) SID(1).pdf p1 (OCR) |  |
| sids | SOORO2.BESNA | 반영 | 100% | 100% | 329 m | (2-14) SID(1).pdf p1 (OCR) |  |
| sids | SOORO2.ENGOT | 반영 | 100% | 100% | 85 m | (2-14) SID(1).pdf p1 (OCR) | heading 구간 근사 |
| sids | SOORO2.KALOD | 반영 | 100% | 100% | 329 m | (2-14) SID(1).pdf p1 (OCR) |  |
| sids | SOORO2.MASTA | 반영 | 100% | 100% | 0 m | (2-14) SID(1).pdf p1 (OCR) | heading 구간 근사 |
| sids | SOORO2.PSN | 반영 | 100% | 100% | 329 m | (2-14) SID(1).pdf p1 (OCR) |  |
| sids | SOORO2.RW36B | 반영 | 100% | 50% | 0 m | (2-14) SID(1).pdf p1 (OCR) | heading 구간 근사 |
| sids | SOORO2.TOPAX | 반영 | 100% | 100% | 85 m | (2-14) SID(1).pdf p1 (OCR) | heading 구간 근사 |
| sids | ULSUK3.KALOD | 제외: 현재 AIP 차트에서 확인 안 됨 | 50% | 0% |  | (2-14) SID(1).pdf p1 (OCR) |  |
| sids | ULSUK3.MASTA | 제외: 현재 AIP 차트에서 확인 안 됨 | 50% | 0% |  | (2-14) SID(1).pdf p1 (OCR) |  |
| sids | ULSUK3.PSN | 제외: 현재 AIP 차트에서 확인 안 됨 | 50% | 50% |  | (2-14) SID(1).pdf p1 (OCR) |  |
| sids | ULSUK3.RW18B | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 33% |  | (2-7) AD OBSTACLE CHART TYPE A(2).pdf p1 (OCR) |  |
| sids | ULSUK3.SAPDI | 제외: 현재 AIP 차트에서 확인 안 됨 | 50% | 0% |  | (2-14) SID(1).pdf p5 (OCR) |  |
| sids | ULSUK3.TOPAX | 제외: 현재 AIP 차트에서 확인 안 됨 | 50% | 100% |  | (2-14) SID(1).pdf p1 (OCR) |  |
| iaps | D36L | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 0% |  | (2-21) INSTR APCH CHART(1).pdf p5 (OCR) |  |
| iaps | D36L.GEOJE | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 0% |  | (2-21) INSTR APCH CHART(1).pdf p5 (OCR) |  |
| iaps | D36L.NARAE | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 0% |  | (2-21) INSTR APCH CHART(1).pdf p5 (OCR) |  |
| iaps | D36R | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 0% |  | (2-21) INSTR APCH CHART(1).pdf p5 (OCR) |  |
| iaps | D36R.GEOJE | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 0% |  | (2-21) INSTR APCH CHART(1).pdf p5 (OCR) |  |
| iaps | D36R.NARAE | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 0% |  | (2-21) INSTR APCH CHART(1).pdf p5 (OCR) |  |
| iaps | I36LY | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 100% |  | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) |  |
| iaps | I36LY.GEOJE | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 100% |  | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) |  |
| iaps | I36LY.NARAE | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 100% |  | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) |  |
| iaps | I36LZ | 반영 | 80% | 100% | 16 m | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) | AIP 미확인 fix: OLMOG; heading 구간 근사 |
| iaps | I36RY | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 100% |  | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) |  |
| iaps | I36RY.GEOJE | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 100% |  | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) |  |
| iaps | I36RY.NARAE | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 100% |  | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) |  |
| iaps | I36RZ | 제외: 현재 AIP 차트에서 확인 안 됨 | 60% | 100% |  | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) |  |
| iaps | I36RZ.KEVOX | 제외: 현재 AIP 차트에서 확인 안 됨 | 50% | 100% |  | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) |  |
| iaps | I36RZ.PEDLO | 제외: 현재 AIP 차트에서 확인 안 됨 | 50% | 100% |  | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) |  |
| iaps | L36LY | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 100% |  | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) |  |
| iaps | L36LY.GEOJE | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 100% |  | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) |  |
| iaps | L36LY.NARAE | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 100% |  | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) |  |
| iaps | L36LZ | 반영 | 80% | 100% | 16 m | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) | AIP 미확인 fix: OLMOG, 38LOC; heading 구간 근사 |
| iaps | L36LZ.KEVOX | 반영 | 100% | 100% | 0 m | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) |  |
| iaps | L36LZ.PEDLO | 반영 | 100% | 100% | 0 m | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) |  |
| iaps | L36RY | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 100% |  | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) |  |
| iaps | L36RY.GEOJE | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 100% |  | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) |  |
| iaps | L36RY.NARAE | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 100% |  | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) |  |
| iaps | L36RZ | 제외: 현재 AIP 차트에서 확인 안 됨 | 60% | 100% |  | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) |  |
| iaps | L36RZ.KEVOX | 제외: 현재 AIP 차트에서 확인 안 됨 | 50% | 100% |  | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) |  |
| iaps | L36RZ.PEDLO | 제외: 현재 AIP 차트에서 확인 안 됨 | 50% | 100% |  | (2-21) INSTR APCH CHART(1).pdf p1 (OCR) |  |
| iaps | VORA | 반영 | 100% | 100% | 137 m | (2-21) INSTR APCH CHART(1).pdf p5 (OCR) |  |
| iaps | VORA.GAYHA | 반영 | 100% | 100% | 219 m | (2-21) INSTR APCH CHART(1).pdf p5 (OCR) |  |
| sids | KALO1S.RW36L | AIP 명칭 적용 (SOORO2.RW36B + SOORO2.KALOD → KALOD 1S) | 100% | 100% |  |  |  |
| sids | BUSA1S.RW36L | AIP 명칭 적용 (SOORO2.RW36B + SOORO2.PSN → BUSAN 1S) | 100% | 100% |  |  |  |
| sids | MAST1S.RW36L | AIP 명칭 적용 (SOORO2.RW36B + SOORO2.MASTA → MASTA 1S) | 100% | 100% |  |  |  |
| sids | TOPA1S.RW36L | AIP 명칭 적용 (SOORO2.RW36B + SOORO2.TOPAX → TOPAX 1S) | 100% | 100% |  |  |  |
| sids | BESN1S.RW36L | AIP 명칭 적용 (SOORO2.RW36B + SOORO2.BESNA → BESNA 1S) | 100% | 100% |  |  |  |
| sids | ENGO1S.RW36L | AIP 명칭 적용 (SOORO2.RW36B + SOORO2.ENGOT → ENGOT 1S) | 100% | 100% |  |  |  |
| sids | KALE1B.RW18L | AIP 명칭 적용 (BAHDA2.RW18B + BAHDA2.KALEK → KALEK 1B) | 100% | 100% |  |  |  |
| sids | INVO1B.RW18L | AIP 명칭 적용 (BAHDA2.RW18B + BAHDA2.INVOK → INVOK 1B) | 100% | 100% |  |  |  |
| sids | APEL1B.RW18L | AIP 명칭 적용 (BAHDA2.RW18B + BAHDA2.APELA → APELA 1B) | 100% | 100% |  |  |  |
| sids | BUSA1B.RW18L | AIP 명칭 적용 (BAHDA2.RW18B + BAHDA2.PSN → BUSAN 1B) | 100% | 100% |  |  |  |
| sids | TOPA1B.RW18L | AIP 명칭 적용 (BAHDA2.RW18B + BAHDA2.TOPAX → TOPAX 1B) | 100% | 100% |  |  |  |
| sids | ENGO1B.RW18L | AIP 명칭 적용 (BAHDA2.RW18B + BAHDA2.ENGOT → ENGOT 1B) | 100% | 100% |  |  |  |
| sids | BESN1B.RW18L | AIP 명칭 적용 (BAHDA2.RW18B + BAHDA2.BESNA → BESNA 1B) | 100% | 100% |  |  |  |
