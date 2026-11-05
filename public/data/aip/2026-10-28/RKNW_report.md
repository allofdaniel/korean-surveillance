# RKNW AIP 자동판독 리포트 (AIRAC 2026-10-28)

- 절차 17개 / Fix 38개 / 홀딩 5개 / 장애물 10개
- 지도 반영 17개 / 제외(검토 필요) 0개
- 원본: (2-10) INSTR APCH CHART.pdf, (2-3) SID.pdf, (2-8)_STAR[1].pdf, RKNW-TEXT.pdf

## 검증 결과
- [warn] fix IWNJ differs 2748 m in AD2.19
- [warn] fix IWON differs 2729 m in AD2.19

## 절차
| 종류 | 이름 | 활주로 | 구간 | 근사 | 판정 |
|---|---|---|---|---|---|
| IAP | RNP RWY 21  | 21 | 2 |  |  |
| IAP | RNP RWY 21  | 21 | 10 |  |  |
| IAP | RNP RWY 03  | 03 | 2 |  |  |
| IAP | RNP RWY 03  | 03 | 7 |  |  |
| SID | RNAV IKILA 1  | 03 | 2 |  |  |
| SID | RNAV IKILA 1 KARBU | 03 | 3 |  |  |
| SID | RNAV IKILA 1 BIKSI | 03 | 2 |  |  |
| SID | RNAV SANUV 2  | 21 | 2 |  |  |
| SID | RNAV SANUV 2 KARBU | 21 | 3 |  |  |
| SID | RNAV SANUV 2 BIKSI | 21 | 4 |  |  |
| SID | RNAV SANUV 2 GUKDO | 21 | 4 |  |  |
| STAR | RNAV GANAM 1 KAKSO |  | 2 |  |  |
| STAR | RNAV GANAM 1 GUKDO |  | 2 |  |  |
| STAR | RNAV GANAM 1  |  | 6 |  |  |
| STAR | RNAV GANAM 2 KAKSO |  | 2 |  |  |
| STAR | RNAV GANAM 2 GUKDO |  | 2 |  |  |
| STAR | RNAV GANAM 2  |  | 4 |  |  |

## 재래식 절차 (기준 코딩 구조 + AIP 좌표, 차트 대조)
기준 DB의 레그 구조만 사용하고 좌표는 AIP(항행안전시설 위치·방위/DME·활주로 시단·fix 표)로 다시 계산. 차트 대조 = 현재 AIP 차트에 fix 이름·코스가 실려 있는 비율.

| 종류 | 절차 | 결과 | fix 대조 | 코스 대조 | 기준 대비 최대 편차 | 근거 차트 | 비고 |
|---|---|---|---|---|---|---|---|
| sids | CHISE1.RW03 | 반영 | 100% | 67% | 0 m | (2-3) SID.pdf p1 (OCR) | heading 구간 근사 |
| sids | HGS1D.RW03 | 반영 | 100% | 100% | 0 m | (2-10) INSTR APCH CHART.pdf p3 | heading 구간 근사 |
| sids | HGS1D.RW21 | 반영 | 100% | 100% | 0 m | (2-3) SID.pdf p3 (OCR) | heading 구간 근사 |
| sids | HGS7.BIKSI | 반영 | 100% | 50% | 926 m | (2-3) SID.pdf p3 (OCR) | heading 구간 근사 |
| sids | HGS7.KARBU | 반영 | 100% | 100% | 35 m | (2-3) SID.pdf p3 (OCR) | heading 구간 근사 |
| sids | HGS7.RW21 | 반영 | 100% | 100% | 35 m | (2-3) SID.pdf p3 (OCR) |  |
| iaps | I03-Y | 반영 | 100% | 100% | 29 m | (2-10) INSTR APCH CHART.pdf p11 | heading 구간 근사 |
| iaps | I03-Y.ORINU | 반영 | 100% | 50% | 2858 m | (2-10) INSTR APCH CHART.pdf p11 | heading 구간 근사 |
| iaps | I21 | 반영 | 100% | 100% | 47 m | (2-10) INSTR APCH CHART.pdf p7 | heading 구간 근사 |
| iaps | I21.VEMPU | 반영 | 100% | 50% | 41 m | (2-10) INSTR APCH CHART.pdf p7 | heading 구간 근사 |
| iaps | L03-Y | 반영 | 100% | 100% | 29 m | (2-10) INSTR APCH CHART.pdf p11 | AIP 미확인 fix: LOC10; heading 구간 근사 |
| iaps | L03-Y.ORINU | 반영 | 100% | 50% | 2858 m | (2-10) INSTR APCH CHART.pdf p11 | heading 구간 근사 |
| iaps | L21 | 반영 | 100% | 100% | 47 m | (2-10) INSTR APCH CHART.pdf p7 | AIP 미확인 fix: LOC12, 85LOC; heading 구간 근사 |
| iaps | L21.VEMPU | 반영 | 100% | 50% | 41 m | (2-10) INSTR APCH CHART.pdf p7 | heading 구간 근사 |
| iaps | VDMA | 반영 | 100% | 100% | 29 m | (2-10) INSTR APCH CHART.pdf p5 |  |
| iaps | VDMA.ORINU | 반영 | 100% | 100% | 65 m | (2-10) INSTR APCH CHART.pdf p5 |  |
