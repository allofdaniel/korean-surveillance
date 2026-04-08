/**
 * Weather Utilities Test Suite
 * Tests for weather data parsing and processing utilities
 */

import { describe, it, expect } from 'vitest';
import { parseMetarTime, parseMetar, formatUTC, formatKST, type MetarData } from '@utils/weather';

describe('Weather Utilities', () => {
  describe('parseMetarTime', () => {
    it('should parse valid METAR time', () => {
      const metar: MetarData = { obsTime: '20240208093000' };
      const result = parseMetarTime(metar);
      expect(result).toBe('8일 0930L');
    });

    it('should handle null input', () => {
      const result = parseMetarTime(null);
      expect(result).toBe('');
    });

    it('should handle undefined input', () => {
      const result = parseMetarTime(undefined);
      expect(result).toBe('');
    });

    it('should handle METAR without obsTime', () => {
      const metar: MetarData = {};
      const result = parseMetarTime(metar);
      expect(result).toBe('');
    });

    it('should handle invalid obsTime format', () => {
      const metar: MetarData = { obsTime: 'invalid' };
      const result = parseMetarTime(metar);
      // parseInt on invalid string creates 'NaN일 L'
      expect(result).toContain('L');
    });
  });

  describe('parseMetar', () => {
    it('should return null for null input', () => {
      const result = parseMetar(null);
      expect(result).toBeNull();
    });

    it('should return null for undefined input', () => {
      const result = parseMetar(undefined);
      expect(result).toBeNull();
    });

    it('should parse wind data', () => {
      const metar: MetarData = { wdir: 90, wspd: 10 };
      const result = parseMetar(metar);
      expect(result?.wind).toBe('090°/10kt');
    });

    it('should parse wind with gusts', () => {
      const metar: MetarData = { wdir: 180, wspd: 15, wgst: 25 };
      const result = parseMetar(metar);
      expect(result?.wind).toBe('180°/15ktG25');
    });

    it('should parse visibility', () => {
      const metar: MetarData = { visib: 5 };
      const result = parseMetar(metar);
      expect(result?.visibility).toBe('5km');
    });

    it('should format visibility >= 10km as 10km+', () => {
      const metar: MetarData = { visib: 15 };
      const result = parseMetar(metar);
      expect(result?.visibility).toBe('10km+');
    });

    it('should parse temperature with dew point', () => {
      const metar: MetarData = { temp: 15, dewp: 8 };
      const result = parseMetar(metar);
      expect(result?.temp).toBe('15°C/8°C');
    });

    it('should parse RVR (both runways)', () => {
      const metar: MetarData = { lRvr: 1200, rRvr: 1500 };
      const result = parseMetar(metar);
      expect(result?.rvr).toBe('RVR L1200m/R1500m');
    });

    it('should parse ceiling', () => {
      const metar: MetarData = { ceiling: 2500 };
      const result = parseMetar(metar);
      expect(result?.ceiling).toBe('CIG 2500ft');
    });

    it('should parse cloud coverage', () => {
      const metar: MetarData = { cloud: 5 };
      const result = parseMetar(metar);
      expect(result?.cloud).toBe('5/10');
    });
  });

  describe('formatUTC', () => {
    it('should format UTC time correctly', () => {
      const date = new Date('2024-02-08T09:30:45Z');
      const result = formatUTC(date);
      expect(result).toBe('09:30:45Z');
    });

    it('should handle midnight', () => {
      const date = new Date('2024-02-08T00:00:00Z');
      const result = formatUTC(date);
      expect(result).toBe('00:00:00Z');
    });
  });

  describe('formatKST', () => {
    it('should format KST time correctly', () => {
      const date = new Date('2024-02-08T09:30:45Z');
      const result = formatKST(date);
      expect(result).toMatch(/^\d{2}:\d{2}:\d{2}L$/);
    });

    it('should convert to Asia/Seoul timezone', () => {
      const date = new Date('2024-02-08T00:00:00Z');
      const result = formatKST(date);
      expect(result).toBe('09:00:00L');
    });
  });
});