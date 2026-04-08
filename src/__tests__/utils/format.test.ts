/**
 * Format Utilities Test Suite
 * Tests for formatting utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  formatUTC,
  formatKST,
  formatDate,
  formatTime,
  formatAltitude,
  formatSpeed,
  formatDistanceNM,
  formatCallsign,
  icaoToIata,
  extractAirlineCode,
  parseMetarTime,
  parseNotamDateString,
  formatRelativeTime,
  formatCacheAge
} from '@utils/format';

describe('Format Utilities', () => {
  describe('formatUTC', () => {
    it('should format UTC time correctly', () => {
      const date = new Date('2024-02-08T09:30:45Z');
      expect(formatUTC(date)).toBe('09:30:45Z');
    });

    it('should handle midnight', () => {
      const date = new Date('2024-02-08T00:00:00Z');
      expect(formatUTC(date)).toBe('00:00:00Z');
    });
  });

  describe('formatKST', () => {
    it('should format KST time with KST suffix', () => {
      const date = new Date('2024-02-08T09:30:45Z');
      const result = formatKST(date);
      expect(result).toContain(' KST');
      expect(result).toMatch(/\d{2}:\d{2}:\d{2} KST/);
    });
  });

  describe('formatDate', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2024-02-08T09:30:45Z');
      expect(formatDate(date)).toBe('2024-02-08');
    });
  });

  describe('formatTime', () => {
    it('should format time as HH:MM', () => {
      const date = new Date('2024-02-08T09:30:45Z');
      const result = formatTime(date);
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('formatAltitude', () => {
    it('should format altitude with ft suffix', () => {
      expect(formatAltitude(5000)).toBe('5,000ft');
    });

    it('should return GND for null', () => {
      expect(formatAltitude(null)).toBe('GND');
    });

    it('should return GND for undefined', () => {
      expect(formatAltitude(undefined)).toBe('GND');
    });

    it('should return GND for ground string', () => {
      expect(formatAltitude('ground')).toBe('GND');
    });

    it('should round altitude', () => {
      expect(formatAltitude(5432.7)).toBe('5,433ft');
    });
  });

  describe('formatSpeed', () => {
    it('should format speed with kt suffix', () => {
      expect(formatSpeed(250)).toBe('250kt');
    });

    it('should return dash for null', () => {
      expect(formatSpeed(null)).toBe('-');
    });

    it('should return dash for undefined', () => {
      expect(formatSpeed(undefined)).toBe('-');
    });

    it('should round speed', () => {
      expect(formatSpeed(250.7)).toBe('251kt');
    });
  });

  describe('formatDistanceNM', () => {
    it('should convert meters to nautical miles', () => {
      const result = formatDistanceNM(1852);
      expect(result).toBe('1.0NM');
    });

    it('should show decimal for distances < 10 NM', () => {
      const result = formatDistanceNM(9260);
      expect(result).toBe('5.0NM');
    });

    it('should round for distances >= 10 NM', () => {
      const result = formatDistanceNM(18520);
      expect(result).toBe('10NM');
    });
  });

  describe('formatCallsign', () => {
    it('should add space between airline code and flight number', () => {
      expect(formatCallsign('KAL123')).toBe('KAL 123');
    });

    it('should return dash for null', () => {
      expect(formatCallsign(null)).toBe('-');
    });

    it('should return dash for undefined', () => {
      expect(formatCallsign(undefined)).toBe('-');
    });

    it('should not modify non-matching callsigns', () => {
      expect(formatCallsign('TEST')).toBe('TEST');
    });
  });

  describe('icaoToIata', () => {
    it('should convert Korean Air ICAO to IATA', () => {
      expect(icaoToIata('KAL')).toBe('KE');
    });

    it('should convert Asiana ICAO to IATA', () => {
      expect(icaoToIata('AAR')).toBe('OZ');
    });

    it('should return original code if not found', () => {
      expect(icaoToIata('XXX')).toBe('XXX');
    });
  });

  describe('extractAirlineCode', () => {
    it('should extract airline code from callsign', () => {
      expect(extractAirlineCode('KAL123')).toBe('KAL');
    });

    it('should return null for null input', () => {
      expect(extractAirlineCode(null)).toBeNull();
    });

    it('should return null for invalid callsign', () => {
      expect(extractAirlineCode('123')).toBeNull();
    });
  });

  describe('parseMetarTime', () => {
    it('should parse METAR time', () => {
      const result = parseMetarTime('RKPU 081030Z ...');
      expect(result).toBe('08일 10:30Z');
    });

    it('should return null for null input', () => {
      expect(parseMetarTime(null)).toBeNull();
    });

    it('should return null for invalid format', () => {
      expect(parseMetarTime('INVALID')).toBeNull();
    });
  });

  describe('parseNotamDateString', () => {
    it('should parse valid NOTAM date', () => {
      const result = parseNotamDateString('2402081030');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCFullYear()).toBe(2024);
      expect(result?.getUTCMonth()).toBe(1); // February
      expect(result?.getUTCDate()).toBe(8);
    });

    it('should return null for null input', () => {
      expect(parseNotamDateString(null)).toBeNull();
    });

    it('should return null for short input', () => {
      expect(parseNotamDateString('240208')).toBeNull();
    });

    it('should return null for invalid month', () => {
      expect(parseNotamDateString('2413081030')).toBeNull();
    });

    it('should return null for invalid day', () => {
      expect(parseNotamDateString('2402321030')).toBeNull();
    });

    it('should return null for invalid hour', () => {
      expect(parseNotamDateString('2402082530')).toBeNull();
    });
  });

  describe('formatRelativeTime', () => {
    it('should format past time in minutes', () => {
      const past = new Date(Date.now() - 5 * 60 * 1000);
      expect(formatRelativeTime(past)).toBe('5분 전');
    });

    it('should format past time in hours', () => {
      const past = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(formatRelativeTime(past)).toBe('3시간 전');
    });

    it('should format future time in minutes', () => {
      const future = new Date(Date.now() + 5 * 60 * 1000);
      expect(formatRelativeTime(future)).toBe('5분 후');
    });

    it('should format future time in hours', () => {
      const future = new Date(Date.now() + 3 * 60 * 60 * 1000);
      expect(formatRelativeTime(future)).toBe('3시간 후');
    });
  });

  describe('formatCacheAge', () => {
    it('should format seconds', () => {
      expect(formatCacheAge(30000)).toBe('30초 전');
    });

    it('should format minutes', () => {
      expect(formatCacheAge(120000)).toBe('2분 전');
    });

    it('should return dash for null', () => {
      expect(formatCacheAge(null)).toBe('-');
    });
  });
});