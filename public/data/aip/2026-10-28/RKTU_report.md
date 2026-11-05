# RKTU AIP 자동판독 리포트 (AIRAC 2026-10-28)

- 절차 46개 / Fix 63개 / 홀딩 4개 / 장애물 85개
- 지도 반영 46개 / 제외(검토 필요) 0개
- 원본: (2-11) SID.pdf, (2-14) STAR.pdf, (2-17) INSTR APCH CHART.pdf, (2-5) AD OBSTACLE CHART TYPE A.pdf, (2-9) AD OBSTACLE CHART TYPE B(1).pdf, RKTU-TEXT.pdf

## 검증 결과
- [warn] fix ICHG differs 8679 m in AD2.19
- [warn] fix ICHG differs 5927 m in AD2.19
- [warn] fix ICHG differs 4821 m in RKTU AD CHART 2-21-1 (AIP AMDT 11/26)
- [warn] fix ICHL differs 2755 m in AD2.19
- [warn] fix ICHJ differs 3857 m in AD2.19
- [warn] fix ICHJ differs 1108 m in AD2.19
- [warn] fix ICHR differs 3861 m in AD2.19
- [warn] fix ICHR differs 1110 m in AD2.19
- [warn] fix MAKDU differs 89644 m in RKTU AD CHART 2-11-2 (AIP AMDT 11/26)

## 절차
| 종류 | 이름 | 활주로 | 구간 | 근사 | 판정 |
|---|---|---|---|---|---|
| SID | RNP GUKDO 1D  | 06L | 2 |  |  |
| SID | RNP OLMEN 1D  | 06L | 5 |  |  |
| SID | RNP BULTI 1D  | 06L | 5 |  |  |
| SID | RNP MAKDU 1D  | 06L | 5 |  |  |
| SID | RNP OSPOT 1D  | 06L | 3 |  |  |
| SID | GUKDO 1C  | 24L | 0 |  |  |
| SID | OLMEN 1C  | 24L | 0 |  |  |
| SID | BULTI 1C  | 24L | 0 |  |  |
| SID | MAKDU 1C  | 24L | 0 |  |  |
| SID | OSPOT 1C  | 24L | 0 |  |  |
| SID | RNP GUKDO 1C  | 24L | 5 |  |  |
| SID | RNP OLMEN 1C  | 24L | 2 |  |  |
| SID | RNP BULTI 1C  | 24L | 2 |  |  |
| SID | RNP MAKDU 1C  | 24L | 4 |  |  |
| SID | RNP OSPOT 1C  | 24L | 3 |  |  |
| SID | RADAR 1D  |  | 0 |  |  |
| SID | RADAR 1C  |  | 0 |  |  |
| STAR | RNP OSPOT 1P  | 06L | 9 |  |  |
| STAR | RNP OSPOT 1B  | 06L | 5 |  |  |
| STAR | RNP BIGOB 1B  | 06L | 4 |  |  |
| STAR | RNP MAKDU 1B  | 06L | 3 |  |  |
| STAR | RNP OSPOT 1A  | 24L | 3 |  |  |
| STAR | RNP OSPOT 1T  | 24L | 4 |  |  |
| STAR | RNP BIGOB 1A  | 24L | 2 |  |  |
| STAR | RNP MAKDU 1A  | 24L | 3 |  |  |
| IAP | ILS/LOC RWY 06L from ENSED | 06L | 2 |  |  |
| IAP | ILS/LOC RWY 06L from VENVI | 06L | 2 |  |  |
| IAP | ILS/LOC RWY 06L from BAKJO | 06L | 8 |  |  |
| IAP | RNP RWY 06L via ENSED(IAF) to BAKJO(IF) | 06L | 2 |  |  |
| IAP | RNP RWY 06L via VENVI(IAF) to BAKJO(IF) | 06L | 2 |  |  |
| IAP | RNP RWY 06L via BAKJO(IF) to JIKJI(MAHF) | 06L | 11 |  |  |
| IAP | ILS/LOC RWY 06R from ENSED | 06R | 2 |  |  |
| IAP | ILS/LOC RWY 06R from VENVI | 06R | 2 |  |  |
| IAP | ILS/LOC RWY 06R from ATKEP | 06R | 8 |  |  |
| IAP | RNP RWY 24L via IKAPO(IAF) to BUNPI(IF) | 24L | 3 |  |  |
| IAP | RNP RWY 24L via HYEIN(IAF) to BUNPI(IF) | 24L | 2 |  |  |
| IAP | RNP RWY 24L via OSALO(IAF) to BUNPI(IF) | 24L | 2 |  |  |
| IAP | RNP RWY 24L via BUNPI(IF) to COWON(MAHF) | 24L | 8 |  |  |
| IAP | ILS/LOC RWY 24R from IKAPO | 24R | 3 |  |  |
| IAP | ILS/LOC RWY 24R from OSALO | 24R | 2 |  |  |
| IAP | ILS/LOC RWY 24R from HYEIN | 24R | 2 |  |  |
| IAP | ILS/LOC RWY 24R from TURTU | 24R | 6 |  |  |
| IAP | RNP RWY 24R via IKAPO to TURTU(IF) | 24R | 3 |  |  |
| IAP | RNP RWY 24R via HYEIN to TURTU(IF) | 24R | 2 |  |  |
| IAP | RNP RWY 24R via OSALO to TURTU(IF) | 24R | 2 |  |  |
| IAP | RNP RWY 24R via TURTU(IF) to COWON(MAHF) | 24R | 1 |  |  |

## 재래식 절차 (기준 코딩 구조 + AIP 좌표, 차트 대조)
기준 DB의 레그 구조만 사용하고 좌표는 AIP(항행안전시설 위치·방위/DME·활주로 시단·fix 표)로 다시 계산. 차트 대조 = 현재 AIP 차트에 fix 이름·코스가 실려 있는 비율.

| 종류 | 절차 | 결과 | fix 대조 | 코스 대조 | 기준 대비 최대 편차 | 근거 차트 | 비고 |
|---|---|---|---|---|---|---|---|
| sids | CHO1D.RW06B | 반영 | 100% | 100% | 0 m | (2-11) SID.pdf p1 | heading 구간 근사 |
| sids | CHO1D.RW24B | 반영 | 100% | 100% | 0 m | (2-11) SID.pdf p5 | heading 구간 근사 |
| sids | CHO4.BULTI | 반영 | 100% | 100% | 12 m | (2-11) SID.pdf p1 | heading 구간 근사 |
| sids | CHO4.GUKDO | 반영 | 100% | 50% | 4 m | (2-11) SID.pdf p5 | heading 구간 근사 |
| sids | CHO4.MAKDU | 반영 | 100% | 50% | 9 m | (2-11) SID.pdf p9 | heading 구간 근사 |
| sids | CHO4.OLMEN | 반영 | 100% | 100% | 16 m | (2-11) SID.pdf p1 | heading 구간 근사 |
| sids | CHO4.OSPOT | 반영 | 100% | 100% | 4 m | (2-11) SID.pdf p1 | heading 구간 근사 |
| sids | CHO4.RW06B | 반영 | 100% | 100% | 0 m | (2-11) SID.pdf p1 |  |
| sids | CHO5.BULTI | 반영 | 100% | 50% | 12 m | (2-11) SID.pdf p1 | heading 구간 근사 |
| sids | CHO5.GUKDO | 반영 | 100% | 100% | 4 m | (2-11) SID.pdf p5 | heading 구간 근사 |
| sids | CHO5.MAKDU | 반영 | 100% | 100% | 9 m | (2-11) SID.pdf p9 | heading 구간 근사 |
| sids | CHO5.OLMEN | 반영 | 100% | 50% | 16 m | (2-11) SID.pdf p1 | heading 구간 근사 |
| sids | CHO5.OSPOT | 반영 | 100% | 100% | 4 m | (2-11) SID.pdf p5 | heading 구간 근사 |
| sids | CHO5.RW24B | 반영 | 100% | 100% | 0 m | (2-11) SID.pdf p5 |  |
| iaps | D06L | 반영 | 100% | 50% | 1 m | (2-17) INSTR APCH CHART.pdf p1 | AIP 미확인 fix: CD06L, VOR13; heading 구간 근사 |
| iaps | D06L.CHO | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 0% |  | (2-17) INSTR APCH CHART.pdf p1 (OCR) |  |
| iaps | D24R | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 0% |  | (2-17) INSTR APCH CHART.pdf p7 (OCR) |  |
| iaps | D24R.IKAPO | 반영 | 100% | 100% | 0 m | (2-17) INSTR APCH CHART.pdf p7 (OCR) | AIP 미확인 fix: CD24R |
| iaps | I06LY | 반영 | 100% | 100% | 12 m | (2-17) INSTR APCH CHART.pdf p1 (OCR) | AIP 미확인 fix: CI06I; heading 구간 근사 |
| iaps | I06LY.IKAPO | 제외: 현재 AIP 차트에서 확인 안 됨 | 50% | 50% |  | (2-17) INSTR APCH CHART.pdf p1 (OCR) |  |
| iaps | I06LZ | 제외: 현재 AIP 차트에서 확인 안 됨 | 60% | 100% |  | (2-17) INSTR APCH CHART.pdf p1 (OCR) |  |
| iaps | I06LZ.JIKJI | 제외: 현재 AIP 차트에서 확인 안 됨 | 40% | 100% |  | (2-17) INSTR APCH CHART.pdf p1 (OCR) |  |
| iaps | I06RY | 반영 | 100% | 100% | 0 m | (2-17) INSTR APCH CHART.pdf p1 (OCR) | heading 구간 근사 |
| iaps | I06RY.IKAPO | 제외: 현재 AIP 차트에서 확인 안 됨 | 50% | 50% |  | (2-17) INSTR APCH CHART.pdf p1 (OCR) |  |
| iaps | I24L | 반영 | 100% | 67% | 0 m | (2-17) INSTR APCH CHART.pdf p9 (OCR) | heading 구간 근사 |
| iaps | I24L.IKAPO | 반영 | 100% | 100% | 19 m | (2-17) INSTR APCH CHART.pdf p9 (OCR) | AIP 미확인 fix: CHO13 |
| iaps | I24RY | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 67% |  | (2-17) INSTR APCH CHART.pdf p9 (OCR) |  |
| iaps | I24RY.IKAPO | 반영 (AIP 표 절차 I24R.IKAPO 형상 교체) | 100% | 100% | 872 m | (2-17) INSTR APCH CHART.pdf p9 (OCR) |  |
| iaps | I24RZ | 제외: 현재 AIP 차트에서 확인 안 됨 | 33% | 100% |  | (2-17) INSTR APCH CHART.pdf p9 (OCR) |  |
| iaps | L06LY | 반영 | 100% | 100% | 12 m | (2-17) INSTR APCH CHART.pdf p1 (OCR) | AIP 미확인 fix: CI06I, ML06L; heading 구간 근사 |
| iaps | L06LY.IKAPO | 제외: 현재 AIP 차트에서 확인 안 됨 | 50% | 50% |  | (2-17) INSTR APCH CHART.pdf p1 (OCR) |  |
| iaps | L06LZ | 제외: 현재 AIP 차트에서 확인 안 됨 | 67% | 100% |  | (2-17) INSTR APCH CHART.pdf p1 (OCR) |  |
| iaps | L06LZ.JIKJI | 제외: 현재 AIP 차트에서 확인 안 됨 | 40% | 100% |  | (2-17) INSTR APCH CHART.pdf p1 (OCR) |  |
| iaps | L06R | 반영 | 100% | 100% | 0 m | (2-17) INSTR APCH CHART.pdf p1 (OCR) | AIP 미확인 fix: ML06R; heading 구간 근사 |
| iaps | L06R.IKAPO | 제외: 현재 AIP 차트에서 확인 안 됨 | 50% | 50% |  | (2-17) INSTR APCH CHART.pdf p1 (OCR) |  |
| iaps | L24L | 반영 | 100% | 67% | 0 m | (2-17) INSTR APCH CHART.pdf p9 (OCR) | AIP 미확인 fix: 32LO2; heading 구간 근사 |
| iaps | L24L.IKAPO | 반영 | 100% | 100% | 19 m | (2-17) INSTR APCH CHART.pdf p9 (OCR) | AIP 미확인 fix: CHO13 |
| iaps | L24RY | 제외: 현재 AIP 차트에서 확인 안 됨 | 0% | 67% |  | (2-17) INSTR APCH CHART.pdf p9 (OCR) |  |
| iaps | L24RY.IKAPO | 반영 | 100% | 100% | 872 m | (2-17) INSTR APCH CHART.pdf p9 (OCR) |  |
| iaps | L24RZ | 제외: 현재 AIP 차트에서 확인 안 됨 | 33% | 100% |  | (2-17) INSTR APCH CHART.pdf p9 (OCR) |  |
| iaps | L24RZ.HYEIN | 반영 | 100% | 100% | 0 m | (2-17) INSTR APCH CHART.pdf p9 (OCR) | AIP 미확인 fix: TU743 |
| iaps | L24RZ.IKAPO | 제외: 현재 AIP 차트에서 확인 안 됨 | 67% | 100% |  | (2-17) INSTR APCH CHART.pdf p9 (OCR) |  |
| sids | GUKD1C.RW24L | AIP 명칭 적용 (CHO5.RW24B + CHO5.GUKDO → GUKDO 1C) | 100% | 100% |  |  |  |
| sids | OLME1C.RW24L | AIP 명칭 적용 (CHO5.RW24B + CHO5.OLMEN → OLMEN 1C) | 100% | 100% |  |  |  |
| sids | BULT1C.RW24L | AIP 명칭 적용 (CHO5.RW24B + CHO5.BULTI → BULTI 1C) | 100% | 100% |  |  |  |
| sids | MAKD1C.RW24L | AIP 명칭 적용 (CHO5.RW24B + CHO5.MAKDU → MAKDU 1C) | 100% | 100% |  |  |  |
| sids | OSPO1C.RW24L | AIP 명칭 적용 (CHO5.RW24B + CHO5.OSPOT → OSPOT 1C) | 100% | 100% |  |  |  |
