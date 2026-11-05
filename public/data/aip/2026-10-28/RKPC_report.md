# RKPC AIP 자동판독 리포트 (AIRAC 2026-10-28)

- 절차 46개 / Fix 109개 / 홀딩 20개 / 장애물 0개
- 지도 반영 45개 / 제외(검토 필요) 1개
- 원본: (2-12) SID.pdf, (2-18) STAR.pdf, (2-21) INSTR APCH CHART.pdf, (2-9) AD OBSTACLE CHART TYPE B.pdf, RKPC-TEXT.pdf

## 검증 결과
- [warn] fix RW31 differs 411 m in AD2.12
- [warn] fix THR RWY 07 differs 2256 m in RKPC AD CHART 2-25-1 (AIP AMDT 4/26)
- [warn] fix D4.0 YDM differs 321 m in RKPC AD CHART 2-25-1 (AIP AMDT 4/26)
- [warn] fix D15.0 YDM differs 487 m in RKPC AD CHART 2-30-1 (AIP AMDT 4/26)
- [warn] RNAV TAMNA 2M 004 PC764→PC767: 게재 21.8 NM, 계산 27.99 NM
- [warn] RNAV TAMNA 2M 004: 게재 진방위 26.9°, 계산 359.6°

## 절차
| 종류 | 이름 | 활주로 | 구간 | 근사 | 판정 |
|---|---|---|---|---|---|
| SID | RNAV PANSI 2E  | 07 | 5 |  |  |
| SID | RNAV LIMDI 1E  | 07 | 5 |  |  |
| SID | RNAV KAMIT 2E  | 07 | 4 | 예 |  |
| SID | RNAV AKPON 1E  | 07 | 2 |  |  |
| SID | RNAV TAMNA 2E  | 07 | 2 |  |  |
| SID | IPDAS 4K  | 07 | 0 | 예 |  |
| SID | MAKET 4K  | 07 | 0 |  |  |
| SID | TAMNA 2K  | 07 | 0 | 예 |  |
| SID | RNAV KAMIT 1W  | 25 | 5 |  |  |
| SID | RNAV IPDAS 1W  | 25 | 5 |  |  |
| SID | RNAV AKPON 1W  | 25 | 6 |  |  |
| SID | RNAV TAMNA 3W  | 25 | 6 |  |  |
| SID | RNAV PANSI 2W  | 25 | 2 |  |  |
| SID | RNAV LIMDI 1W  | 25 | 3 |  |  |
| SID | IPDAS 1L  | 25 | 0 |  |  |
| SID | RNAV KAMIT 2N  | 31 | 6 |  |  |
| SID | RNAV AKPON 1N  | 31 | 6 |  |  |
| SID | RADAR 2E  |  | 0 |  |  |
| SID | RADAR 3W  |  | 0 |  |  |
| SID | RADAR 1N  |  | 0 |  |  |
| STAR | RNAV DOTOL 2P  | 07 | 15 |  |  |
| STAR | RNAV UPGOS 1P  | 07 | 16 |  |  |
| STAR | RNAV TAMNA 2P  | 07 | 15 |  |  |
| STAR | RNAV TOSAN 2P  | 07 | 15 |  |  |
| STAR | RNAV SOSDO 2P  | 07 | 15 |  |  |
| STAR | RNAV LIMDI 1P  | 07 | 17 |  |  |
| STAR | RNAV DOTOL 2M  | 25 | 11 |  |  |
| STAR | RNAV UPGOS 2M  | 25 | 10 |  |  |
| STAR | RNAV TAMNA 2M  | 25 | 2 |  | 제외: PC764→PC767 거리 불일치, PC764→PC767 방위 불일치 |
| STAR | RNAV TOSAN 2M  | 25 | 0 |  |  |
| STAR | RNAV SOSDO 2M  | 25 | 4 |  |  |
| STAR | RNAV LIMDI 2M  | 25 | 4 |  |  |
| IAP | ILS Z or LOC Z RWY 07 from YUMIN | 07 | 6 |  |  |
| IAP | ILS Y or LOC Y RWY 07 from AKBIN | 07 | 6 |  |  |
| IAP | RNP Z RWY 07(AR)  | 07 | 7 |  |  |
| IAP | RNP Y RWY 07  | 07 | 8 |  |  |
| IAP | VOR RWY 07 from AKBIN | 07 | 6 |  |  |
| IAP | ILS Z or LOC Z RWY 25 from DUKAL | 25 | 5 |  |  |
| IAP | ILS Y or LOC Y RWY 25  | 25 | 4 |  |  |
| IAP | ILS Y or LOC Y RWY 25 from OMKEL | 25 | 2 |  |  |
| IAP | ILS Y or LOC Y RWY 25 from PETAA | 25 | 2 |  |  |
| IAP | RNP Z RWY 25(AR)  | 25 | 7 |  |  |
| IAP | RNP Y RWY 25  | 25 | 7 |  |  |
| IAP | VOR RWY 25  | 25 | 4 |  |  |
| IAP | VOR RWY 25 from OMKEL | 25 | 2 |  |  |
| IAP | VOR RWY 25 from PETAA | 25 | 2 |  |  |
