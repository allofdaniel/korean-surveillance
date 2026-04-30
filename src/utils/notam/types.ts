/**
 * NOTAM Types
 * NOTAM 관련 타입 정의
 */

export interface NotamCoordinates {
  lat: number;
  lon: number;
  radiusNM: number;
  lowerAlt: number;
  upperAlt: number;
}

export interface Notam {
  notam_number?: string;
  full_text?: string;
  location?: string;
  effective_start?: string;
  effective_end?: string;
  [key: string]: unknown;
}

export type NotamValidity = 'active' | 'future' | 'expired' | false;

export interface NotamInterpretation {
  /** "어디" — 위치 + 공항 한글명 */
  where: string;
  /** "언제" — 시작/종료 KST 포맷 */
  when: string;
  /** "무엇" — 제한/내용 한국어 요약 */
  what: string;
  /** 한 줄 요약 (제목 형태) */
  summary: string;
  /** 추가 메타 (qcode 한국어, 고도, 반경 등) */
  meta: { qcode_ko: string; altitude: string; radius: string; type: string };
}
