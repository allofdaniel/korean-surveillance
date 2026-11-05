# RKSS AIP 자동판독 리포트 (AIRAC 2026-10-28)

- 절차 45개 / Fix 158개 / 홀딩 11개 / 장애물 0개
- 지도 반영 44개 / 제외(검토 필요) 1개
- 원본: (2-11) AD OBSTACLE CHART TYPE B.pdf, (2-14) SID.pdf, (2-23) STAR.pdf, (2-29) INSTR APCH CHART.pdf, RKSS-TEXT.pdf

## 검증 결과
- [warn] fix IOFR differs 3207 m in AD2.19
- [warn] fix ISEL differs 3579 m in AD2.19
- [warn] fix ISKP differs 3601 m in AD2.19
- [warn] fix IKMO differs 3201 m in AD2.19
- [warn] fix D5 KIP differs 325 m in RKSS AD CHART 2-32-1 (AIP AMDT 5/23)
- [warn] fix D5 KIP differs 18520 m in RKSS AD CHART 2-34-1 (AIP AMDT 2/26)
- [warn] fix D5 KIP differs 18520 m in RKSS AD CHART 2-37-1 (AIP AMDT 2/26)
- [warn] fix D20 KIP differs 1292 m in RKSS AD CHART 2-39-1 (9 FEB 2023)
- [warn] fix D18 KIP differs 1163 m in RKSS AD CHART 2-39-1 (9 FEB 2023)
- [warn] fix D13.2 KIP differs 866 m in RKSS AD CHART 2-39-1 (9 FEB 2023)
- [warn] fix D9.6 KIP differs 634 m in RKSS AD CHART 2-39-1 (9 FEB 2023)
- [warn] fix D1.3 KIP differs 87 m in RKSS AD CHART 2-39-1 (9 FEB 2023)
- [warn] fix PT075 좌표 판독 실패 → LEGAK에서 진방위/거리로 계산 (RNAV LEGAK 1T)
- [warn] RNAV OSPOT 2T 005 TD040→OSPOT: 게재 190.0 NM, 계산 57.11 NM
- [warn] RNAV EGOBA 2Q 002 QD040→QD050: 게재 5.0 NM, 계산 6.43 NM
- [warn] RNAV EGOBA 2Q 004 QD050→QK080: 게재 5000.0 NM, 계산 9.56 NM
- [warn] RNP RWY 32R [via BUMSI to MOBAK(IF)] 004 NOGUB→MOBAK: 게재 4.9 NM, 계산 4.53 NM
- [warn] RNP RWY 32R [via BUMSI to MOBAK(IF)] 004: 게재 진방위 317.4°, 계산 315.2°

## 절차
| 종류 | 이름 | 활주로 | 구간 | 근사 | 판정 |
|---|---|---|---|---|---|
| SID | RNAV OSPOT 2U  | 14L | 6 |  |  |
| SID | RNAV EGOBA 2U  | 14L | 3 |  |  |
| SID | RNAV NOPIK 2U  | 14L | 6 |  |  |
| SID | RNAV BULTI 2U  | 14L | 6 |  |  |
| SID | RNAV BULTI 2Z  | 14L | 7 |  |  |
| SID | RNAV OSPOT 2Z  | 14L | 6 |  |  |
| SID | RNAV NOPIK 2T  | 32L | 5 |  |  |
| SID | RNAV BULTI 2T  | 32L | 8 |  |  |
| SID | RNAV OSPOT 2T  | 32L | 2 |  |  |
| SID | RNAV EGOBA 2T  | 32L | 1 |  |  |
| SID | RNAV NOPIK 2Q  | 32L | 6 |  |  |
| SID | RNAV BULTI 2Q  | 32L | 8 |  |  |
| SID | RNAV OSPOT 2Q  | 32L | 7 |  |  |
| SID | RNAV EGOBA 2Q  | 32L | 5 |  | 제외: QD040→QD050 거리 불일치 |
| SID | KARBU 1W  | 32L | 0 | 예 |  |
| STAR | RNAV OLMEN 2U  | 14L | 11 |  |  |
| STAR | RNAV GUKDO 2U  | 14L | 10 |  |  |
| STAR | RNAV KARBU 2U  | 14L | 8 |  |  |
| STAR | RNAV REBIT 2U  | 14L | 6 |  |  |
| STAR | RNAV REBIT 2Z  | 14L | 10 |  |  |
| STAR | RNAV OLMEN 2T  | 32L | 6 |  |  |
| STAR | RNAV GUKDO 2T  | 32L | 5 |  |  |
| STAR | RNAV KARBU 2T  | 32L | 4 |  |  |
| STAR | RNAV REBIT 2T  | 32L | 8 |  |  |
| STAR | RNAV REBIT 2Q  | 32L | 7 |  |  |
| STAR | RNAV LEGAK 1U  |  | 5 |  |  |
| STAR | RNAV LEGAK 1T  |  | 6 |  |  |
| STAR | RNAV GONAV TRANSTION  |  | 2 |  |  |
| IAP | ILS/LOC Z RWY 14L from DOKDO | 14L | 6 |  |  |
| IAP | ILS/LOC Y RWY 14L from CAVOI | 14L | 6 |  |  |
| IAP | RNP RWY 14L  | 14L | 9 |  |  |
| IAP | ILS/LOC RWY 14R from DOKDO | 14R | 6 |  |  |
| IAP | RNP RWY 14R  | 14R | 9 |  |  |
| IAP | ILS/LOC RWY 32L from WONKO | 32L | 14 |  |  |
| IAP | RNP RWY 32L via APOMO to WONKO(IF) | 32L | 3 |  |  |
| IAP | RNP RWY 32L via BUMSI to WONKO(IF) | 32L | 3 |  |  |
| IAP | RNP RWY 32L via SUNEM to WONKO(IF) | 32L | 3 |  |  |
| IAP | RNP RWY 32L via WONKO(IF) to MAHF | 32L | 7 |  |  |
| IAP | VOR RWY 32L from BUMSI | 32L | 10 |  |  |
| IAP | ILS/LOC RWY 32R from MOBAK | 32R | 14 |  |  |
| IAP | RNP RWY 32R via APOMO to MOBAK(IF) | 32R | 3 |  |  |
| IAP | RNP RWY 32R via BUMSI to MOBAK(IF) | 32R | 4 |  |  |
| IAP | RNP RWY 32R via SUNEM to MOBAK(IF) | 32R | 3 |  |  |
| IAP | RNP RWY 32R via MOBAK(IF) to MAHF | 32R | 7 |  |  |
| IAP | VOR RWY 32R from BUMSI | 32R | 10 |  |  |
