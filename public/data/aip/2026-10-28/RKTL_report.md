# RKTL AIP 자동판독 리포트 (AIRAC 2026-10-28)

- 절차 24개 / Fix 48개 / 홀딩 3개 / 장애물 0개
- 지도 반영 24개 / 제외(검토 필요) 0개
- 원본: (2-14) STAR(1).pdf, (2-18) INSTR APCH CHART(1).pdf, (2-7) SID(1).pdf, RKTL-TEXT.pdf

## 검증 결과
- [warn] fix IUJS differs 1788 m in AD2.19
- [warn] fix IUJS differs 1789 m in AD2.19
- [warn] fix IUJN differs 1830 m in AD2.19
- [warn] fix IUJN differs 1829 m in AD2.19
- [warn] fix D12.0 UJN differs 43900 m in RKTL AD CHART 2-25-1 (AIP AMDT 1/25)

## 절차
| 종류 | 이름 | 활주로 | 구간 | 근사 | 판정 |
|---|---|---|---|---|---|
| STAR | RNAV NOBUT 1J  | 17 | 3 |  |  |
| STAR | RNAV LOSTO 1J  | 17 | 5 |  |  |
| STAR | RNAV NOBUT 2H  | 35 | 6 |  |  |
| STAR | RNAV LOSTO 1H  | 35 | 3 |  |  |
| IAP | ILS Z/LOC Z RWY 17 from ALDON | 17 | 6 |  |  |
| IAP | ILS Y/LOC Y RWY 17 from ALDON | 17 | 5 |  |  |
| IAP | RNP RWY 17 via ALDON(IAF) to BANYA(MAHF) | 17 | 8 |  |  |
| IAP | VOR RWY 17 from ALDON | 17 | 4 |  |  |
| IAP | ILS Z/LOC Z RWY 35 from BANYA | 35 | 4 |  |  |
| IAP | ILS Y/LOC Y RWY 35 from BANYA | 35 | 3 |  |  |
| IAP | RNP RWY 35 via BANYA(IAF) to ALDON(IAF) | 35 | 9 |  |  |
| IAP | RNP RWY 35 via LIDPA(IAF) to ALDON(IAF) | 35 | 7 |  |  |
| IAP | VOR RWY 35 from BANYA | 35 | 3 |  |  |
| SID | RNAV NOBUT 2M  | 17 | 2 |  |  |
| SID | RNAV LOSTO 1M  | 17 | 3 |  |  |
| SID | NOBUT 2S  | 17 | 0 | 예 |  |
| SID | LOSTO 2S  | 17 | 0 | 예 |  |
| SID | LOSTO 6S  | 17 | 0 | 예 |  |
| SID | RNAV NOBUT 1R  | 35 | 3 |  |  |
| SID | RNAV LOSTO 2R  | 35 | 6 |  |  |
| SID | NOBUT 3N  | 35 | 0 | 예 |  |
| SID | LOSTO 2N  | 35 | 0 | 예 |  |
| SID | LOSTO 2A  | 35 | 0 | 예 |  |
| SID | RADAR 1A  | 25 | 0 |  |  |

## 재래식 절차 (기준 코딩 구조 + AIP 좌표, 차트 대조)
기준 DB의 레그 구조만 사용하고 좌표는 AIP(항행안전시설 위치·방위/DME·활주로 시단·fix 표)로 다시 계산. 차트 대조 = 현재 AIP 차트에 fix 이름·코스가 실려 있는 비율.

| 종류 | 절차 | 결과 | fix 대조 | 코스 대조 | 기준 대비 최대 편차 | 근거 차트 | 비고 |
|---|---|---|---|---|---|---|---|
| sids | LOST2A.RW35 | 반영 | 100% | 50% | 427 m | (2-7) SID(1).pdf p9 (OCR) | heading 구간 근사 |
| sids | LOST2N.RW35 | 반영 | 100% | 100% | 427 m | (2-7) SID(1).pdf p9 (OCR) | heading 구간 근사 |
| sids | LOST2S.RW17 | 반영 | 100% | 100% | 10 m | (2-7) SID(1).pdf p3 (OCR) | heading 구간 근사 |
| sids | LOST6S.RW17 | 반영 | 100% | 100% | 10 m | (2-7) SID(1).pdf p3 (OCR) | heading 구간 근사 |
| sids | NOBU2S.RW17 | 반영 | 100% | 100% | 377 m | (2-7) SID(1).pdf p3 (OCR) | heading 구간 근사 |
| sids | NOBU3N.RW35 | 반영 | 100% | 100% | 402 m | (2-7) SID(1).pdf p9 (OCR) | heading 구간 근사 |
| sids | RADA1A.RW35 | 반영 | 100% | 100% | 0 m | (2-7) SID(1).pdf p9 (OCR) | heading 구간 근사 |
| stars | LOST2C.RW35 | 반영 | 100% | 100% | 342 m | (2-14) STAR(1).pdf p5 |  |
| stars | NOBU2D.RW17 | 반영 | 100% | 100% | 301 m | (2-14) STAR(1).pdf p1 |  |
| iaps | D17 | 반영 | 100% | 100% | 39 m | (2-18) INSTR APCH CHART(1).pdf p3 |  |
| iaps | D17.ALDON | 반영 | 100% | 100% | 3649 m | (2-18) INSTR APCH CHART(1).pdf p3 |  |
| iaps | D35 | 반영 | 100% | 100% | 0 m | (2-18) INSTR APCH CHART(1).pdf p15 |  |
| iaps | D35.BANYA | 반영 | 100% | 100% | 0 m | (2-18) INSTR APCH CHART(1).pdf p11 |  |
| iaps | I17-Y | 반영 | 100% | 100% | 49 m | (2-18) INSTR APCH CHART(1).pdf p1 |  |
| iaps | I17-Y.ALDON | 반영 | 100% | 100% | 268 m | (2-18) INSTR APCH CHART(1).pdf p1 |  |
| iaps | I17-Z | 반영 | 100% | 100% | 0 m | (2-18) INSTR APCH CHART(1).pdf p1 |  |
| iaps | I35-Y | 반영 | 100% | 100% | 44 m | (2-18) INSTR APCH CHART(1).pdf p9 |  |
| iaps | I35-Y.BANYA | 반영 | 100% | 50% | 4 m | (2-18) INSTR APCH CHART(1).pdf p9 | heading 구간 근사 |
| iaps | I35-Z | 반영 | 100% | 100% | 0 m | (2-18) INSTR APCH CHART(1).pdf p9 |  |
