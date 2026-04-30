/**
 * NOTAM Korean Translation Utilities
 * NOTAM 한국어 해석 관련 유틸리티 함수 모음
 */

import type { NotamInterpretation } from './types';

// ============================================================================
// NOTAM 한국어 해석기 — interpretNotam(notam) → 사람이 읽기 쉬운 구조화 해석
// ============================================================================

/** Q-Code 4글자 코드 → 한국어 의미 (자주 쓰이는 50여 개) */
export const QCODE_KO: Record<string, string> = {
  // Movement Area
  QMRLC: '활주로 폐쇄', QMRLT: '활주로 제한', QMRMT: '활주로 정비',
  QMRHW: '활주로 위해요인', QMRWX: '활주로 미상',
  QMXLC: '유도로 폐쇄', QMXLT: '유도로 제한', QMXCN: '유도로 변경/취소',
  QMAHW: '계류장 위해요인', QMAHC: '계류장 변경',
  // Lighting
  QLALC: '진입등 정전/폐쇄', QLAAS: '진입등 작동중',
  QLLCS: '활주로 등화 변경',
  // NAV / COM
  QICAS: 'ILS 작동 가능', QICAU: 'ILS 운용 중지',
  QICCH: 'ILS 변경', QICTT: 'ILS 시험중',
  QCAAS: '관제 주파수 작동', QCAXX: '관제 무선 미정',
  // Airspace
  QRPCA: '금지구역 활성', QRRCA: '제한구역 활성', QRDCA: '위험구역 활성',
  QRTCA: '훈련공역 활성',
  // Obstacles / Hazards
  QOBCE: '장애물 설치', QOBCN: '장애물 변경/취소', QOLCE: '장애물 등화 설치',
  QWMLW: '레이저쇼/공연 (임시 항행 경고)', QWPLW: '낙하산 강하 활성',
  QWULW: '무인항공기 활동', QWELW: '훈련 비행 활동',
  // Snow / Weather
  QFAHX: '공항 위해요인', QFASW: '공항 변경 (snow)',
  // Personnel / Service
  QSAAS: 'ATS 사용 가능', QSACA: 'ATS 변경/취소',
  QSPCH: '자료 변경', QSPCF: '드론 활동',
  // Other
  QFASZ: '공항 정상화', QPMCH: '절차 변경',
  QPMXX: '절차 미상', QPDCH: '비행 절차 변경', QPIXX: '계기절차 미상',
  QGAXX: 'GNSS/위성 미상', QGWXX: 'GNSS 미상',
  QPALL: 'ATS 정상화', QKKKK: '기타',
};

/** 자주 쓰이는 약어 → 한국어 풀이 */
export const ABBR_KO: Array<[RegExp, string]> = [
  [/U\/S/g, '운용 중지'],
  [/CLSD/g, '폐쇄'],
  [/DUE TO/g, '사유:'],
  [/MAINT/gi, '정비'],
  [/WIP/g, '공사'],
  [/RWY/g, '활주로'],
  [/TWY/g, '유도로'],
  [/APN?/g, '계류장'],
  [/PAR/g, 'PAR(정밀진입레이더)'],
  [/TAR/g, 'TAR(터미널레이더)'],
  [/ILS/g, 'ILS(계기착륙시스템)'],
  [/VOR/g, 'VOR'],
  [/NDB/g, 'NDB'],
  [/DME/g, 'DME'],
  [/MHZ/gi, 'MHz'],
  [/DRONE ACT/gi, '드론 활동'],
  [/ACFT/g, '항공기'],
  [/STAND NR/g, '계류구역'],
  [/AVBL/g, '사용가능'],
  [/NAVAID/gi, '항행안전시설'],
  [/TEMP OBST/gi, '임시 장애물'],
  [/CRANE/gi, '크레인'],
  [/ERECTED/gi, '설치됨'],
  [/AS FLW/gi, '아래와 같이'],
  [/LASER LIGHT SHOW/gi, '레이저쇼'],
  [/WILL TAKE PLACE/gi, '예정'],
  [/AEROBATICS/gi, '곡예비행'],
  [/FLT AREA/gi, '비행 구역'],
  [/WI A RADIUS OF/gi, '반경'],
  [/CENTERED ON/gi, '중심'],
  [/NAV WRNG/gi, '항행경고'],
];

interface NotamForInterpret {
  notam_number?: string;
  location?: string;
  fir?: string;
  qcode?: string;
  qcode_mean?: string;
  e_text?: string;
  full_text?: string;
  effective_start?: string;
  effective_end?: string;
  q_lower_alt?: number;
  q_upper_alt?: number;
  q_radius_nm?: number;
}

function fmtNotamTime(t: string | undefined | null): string {
  if (!t) return '-';
  if (t === 'PERM' || t.toUpperCase().includes('PERM')) return '영구';
  // YYMMDDHHMM (UTC) → KST 변환
  const m = String(t).match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (m) {
    const yy = m[1]!, mo = m[2]!, dd = m[3]!, hh = m[4]!, mi = m[5]!;
    const dt = new Date(Date.UTC(2000 + +yy, +mo - 1, +dd, +hh, +mi));
    if (isNaN(dt.getTime())) return t;
    // KST = UTC+9
    const kst = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
    const Y = kst.getUTCFullYear();
    const M = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const D = String(kst.getUTCDate()).padStart(2, '0');
    const H = String(kst.getUTCHours()).padStart(2, '0');
    const I = String(kst.getUTCMinutes()).padStart(2, '0');
    return `${Y}-${M}-${D} ${H}:${I} KST`;
  }
  // ISO 8601
  const dt = new Date(t);
  if (!isNaN(dt.getTime())) {
    const kst = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 16).replace('T', ' ') + ' KST';
  }
  return t;
}

function translateAbbr(s: string): string {
  let out = s || '';
  for (const [re, ko] of ABBR_KO) {
    out = out.replace(re, ko);
  }
  return out;
}

/**
 * NOTAM을 한국어로 해석. 어디/언제/무엇 + 메타 정보.
 */
export function interpretNotam(
  notam: NotamForInterpret,
  airportName?: (loc: string) => string | undefined,
): NotamInterpretation {
  const loc = notam.location || '';
  const fir = notam.fir || '';
  const apName = airportName?.(loc);

  // 어디
  const where = apName ? `${apName} (${loc})${fir ? ' · ' + fir : ''}`
                       : loc + (fir ? ' · ' + fir : '');

  // 언제 (한국시간)
  const start = fmtNotamTime(notam.effective_start);
  const end = fmtNotamTime(notam.effective_end);
  const when = end === '영구' ? `${start} 부터 (영구)` : `${start} ~ ${end}`;

  // 무엇 (e_text 한국어 풀이)
  const eText = (notam.e_text || '').trim();
  const what = translateAbbr(eText) || (notam.qcode_mean || '내용 정보 없음');

  // qcode 한국어
  const qcodeKey = (notam.qcode || '').toUpperCase();
  const qcodeKo = QCODE_KO[qcodeKey] || notam.qcode_mean || qcodeKey || '-';

  // 고도 (FL 단위)
  const flLow = notam.q_lower_alt;
  const flUp = notam.q_upper_alt;
  let altitude = '-';
  if (typeof flLow === 'number' && typeof flUp === 'number') {
    altitude = `FL${String(flLow).padStart(3, '0')} ~ FL${String(flUp).padStart(3, '0')}`;
  }

  // 반경
  const r = notam.q_radius_nm;
  const radius = typeof r === 'number' ? `반경 ${r} NM` : '-';

  // 타입 (NOTAMN/R/C)
  const t = (notam.full_text || '').match(/NOTAM([NRC])/);
  const type = t ? (t[1] === 'C' ? '취소(NOTAMC)'
                  : t[1] === 'R' ? '대체(NOTAMR)'
                  : '신규(NOTAMN)') : '-';

  // 한 줄 요약: "{공항} · {qcode_ko} · {기간 요약}"
  const briefWhen = end === '영구' ? '영구' : `${start.slice(5,16)}~${end.slice(5,16)}`;
  const summary = `${apName || loc} · ${qcodeKo} · ${briefWhen}`;

  return { where, when, what, summary, meta: { qcode_ko: qcodeKo, altitude, radius, type } };
}
