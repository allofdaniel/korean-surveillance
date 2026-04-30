/**
 * NOTAM Validity Utilities
 * NOTAM 유효성 판단 관련 유틸리티 함수 모음
 */

import { parseNotamDateString } from '../format';
import {
  getNotamType,
  extractDatesFromFullText,
} from './parse';
import type { Notam, NotamValidity } from './types';

/**
 * NOTAM 유효성 확인
 */
export const getNotamValidity = (notam: Notam, cancelledSet: Set<string> = new Set()): NotamValidity => {
  // Skip NOTAMC (cancel) type - these just cancel other NOTAMs
  const notamType = getNotamType(notam.full_text);
  if (notamType === 'C') return false;

  // Check if this NOTAM has been cancelled by another NOTAM
  if (notam.notam_number && cancelledSet.has(notam.notam_number)) return false;

  const now = new Date();
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  // Try to get dates from effective_start/effective_end fields first
  if (notam.effective_start && notam.effective_start.length >= 10) {
    startDate = parseNotamDateString(notam.effective_start);
  }

  if (notam.effective_end && notam.effective_end.length >= 10 &&
      !notam.effective_end.includes('PERM') && !notam.effective_end.includes('EST')) {
    endDate = parseNotamDateString(notam.effective_end);
  } else if (notam.effective_end?.includes('PERM')) {
    endDate = new Date(Date.UTC(2099, 11, 31)); // Permanent (UTC)
  }

  // Fallback: extract dates from full_text if effective_start/end not available
  if (!startDate || !endDate) {
    const extracted = extractDatesFromFullText(notam.full_text);
    if (!startDate && extracted.start) startDate = extracted.start;
    if (!endDate && extracted.end) endDate = extracted.end;
  }

  // If still no start date, we can't determine validity - default to expired (safe gray display)
  if (!startDate) {
    // Has B) field but couldn't parse — assume expired rather than active (파싱 실패 — 만료 가정)
    if (notam.full_text && notam.full_text.includes('B)')) {
      return 'expired'; // 파싱 실패 — 만료 가정 (회색 처리)
    }
    return false;
  }

  // Check if already expired (만료 — 표시는 하되 색상 구분)
  if (endDate && now > endDate) return 'expired';

  // Check if future NOTAM
  if (startDate && now < startDate) return 'future';

  // Currently active
  return 'active';
};

/**
 * NOTAM 활성 여부 확인 (하위 호환용)
 */
export const isNotamActive = (notam: Notam, cancelledSet: Set<string> = new Set()): boolean => {
  const validity = getNotamValidity(notam, cancelledSet);
  return validity === 'active' || validity === 'future';
};

/**
 * NOTAM 기간별 필터링
 * @param notam NOTAM 객체
 * @param period 기간 ('current', '1month', '1year', 'all')
 * @param cancelledSet 취소된 NOTAM Set
 * @returns 표시 여부
 */
export const isNotamInPeriod = (
  notam: Notam,
  period: string,
  cancelledSet: Set<string> = new Set()
): boolean => {
  // Skip NOTAMC (cancel) type
  const notamType = getNotamType(notam.full_text);
  if (notamType === 'C') return false;

  // Check if this NOTAM has been cancelled
  if (notam.notam_number && cancelledSet.has(notam.notam_number)) return false;

  const now = new Date();
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  // Parse dates from effective_start/effective_end
  if (notam.effective_start && notam.effective_start.length >= 10) {
    startDate = parseNotamDateString(notam.effective_start);
  }

  if (notam.effective_end && notam.effective_end.length >= 10 &&
      !notam.effective_end.includes('PERM') && !notam.effective_end.includes('EST')) {
    endDate = parseNotamDateString(notam.effective_end);
  } else if (notam.effective_end?.includes('PERM')) {
    endDate = new Date(2099, 11, 31);
  }

  // Fallback: extract from full_text
  if (!startDate || !endDate) {
    const extracted = extractDatesFromFullText(notam.full_text);
    if (!startDate && extracted.start) startDate = extracted.start;
    if (!endDate && extracted.end) endDate = extracted.end;
  }

  // 영구(Permanent) NOTAM 감지: endDate가 2099년이면 영구 NOTAM
  // Note: isPermanent used implicitly in logic below (permanent NOTAMs always shown in 'current')

  // 날짜 정보가 없는 경우 처리
  if (!startDate && !endDate) {
    // 날짜 정보 없음: 'all'에서만 표시
    return period === 'all';
  }

  // startDate만 없는 경우 (endDate는 있음)
  if (!startDate && endDate) {
    // 만료된 경우 제외
    if (now > endDate) return period === 'all';
    // 영구 또는 유효한 NOTAM: 표시
    return true;
  }

  // Period-based filtering
  switch (period) {
    case 'current': {
      // Only currently active or future NOTAMs (not expired)
      if (endDate && now > endDate) return false;
      return true;
    }
    case '1month': {
      // NOTAMs relevant within 1 month (past or future)
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const oneMonthLater = new Date(now);
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

      // If ended before 1 month ago, exclude
      if (endDate && endDate < oneMonthAgo) return false;
      // If starts after 1 month later, exclude
      if (startDate && startDate > oneMonthLater) return false;
      return true;
    }
    case '1year': {
      // NOTAMs relevant within 1 year
      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const oneYearLater = new Date(now);
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

      if (endDate && endDate < oneYearAgo) return false;
      if (startDate && startDate > oneYearLater) return false;
      return true;
    }
    case 'all':
    default:
      // Show all NOTAMs (including expired)
      return true;
  }
};
