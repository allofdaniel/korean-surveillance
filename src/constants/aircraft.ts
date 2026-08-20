/**
 * Aircraft Constants
 * 항공기 관련 상수 및 유틸리티
 */

// ICAO → IATA 항공사 코드 변환 (한국 및 주요 항공사)
export const ICAO_TO_IATA: Record<string, string> = {
  'KAL': 'KE', 'AAR': 'OZ', 'JNA': 'LJ', 'JJA': '7C', 'TWB': 'TW', 'ABL': 'BX', 'EOK': 'ZE', 'ASV': 'RF',
  'ANA': 'NH', 'JAL': 'JL', 'CPA': 'CX', 'CSN': 'CZ', 'CES': 'MU', 'CCA': 'CA', 'HVN': 'VN', 'THA': 'TG',
  'SIA': 'SQ', 'MAS': 'MH', 'EVA': 'BR', 'CAL': 'CI', 'UAL': 'UA', 'AAL': 'AA', 'DAL': 'DL',
  'AFR': 'AF', 'BAW': 'BA', 'DLH': 'LH', 'KLM': 'KL', 'QFA': 'QF', 'UAE': 'EK', 'ETD': 'EY',
  'FDX': 'FX', 'UPS': '5X', 'GTI': 'GT', // 화물기
};

// 기종별 고화질 대표 항공기 사진
export const AIRCRAFT_MODEL_IMAGES: Record<string, string> = {
  'A320': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Airbus_A320-214%2C_Airbus_Industrie_JP7617615.jpg/640px-Airbus_A320-214%2C_Airbus_Industrie_JP7617615.jpg',
  'A321': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Airbus_A321-231%2C_Airbus_Industrie_JP7617616.jpg/640px-Airbus_A321-231%2C_Airbus_Industrie_JP7617616.jpg',
  'A20N': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Airbus_A320-214%2C_Airbus_Industrie_JP7617615.jpg/640px-Airbus_A320-214%2C_Airbus_Industrie_JP7617615.jpg',
  'A21N': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Airbus_A321-231%2C_Airbus_Industrie_JP7617616.jpg/640px-Airbus_A321-231%2C_Airbus_Industrie_JP7617616.jpg',
  'A332': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Delta_Air_Lines_Airbus_A330-300_N830NW_departing_Boston_July_2026_1.jpg/640px-Delta_Air_Lines_Airbus_A330-300_N830NW_departing_Boston_July_2026_1.jpg',
  'A333': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Delta_Air_Lines_Airbus_A330-300_N830NW_departing_Boston_July_2026_1.jpg/640px-Delta_Air_Lines_Airbus_A330-300_N830NW_departing_Boston_July_2026_1.jpg',
  'A339': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Delta_Air_Lines_Airbus_A330-300_N830NW_departing_Boston_July_2026_1.jpg/640px-Delta_Air_Lines_Airbus_A330-300_N830NW_departing_Boston_July_2026_1.jpg',
  'A359': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/EGLF_-_Airbus_A350-941_-_F-WZNW.jpg/640px-EGLF_-_Airbus_A350-941_-_F-WZNW.jpg',
  'A35K': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/EGLF_-_Airbus_A350-941_-_F-WZNW.jpg/640px-EGLF_-_Airbus_A350-941_-_F-WZNW.jpg',
  'A388': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/A6-EDY_A380_Emirates_31_jan_2013_jfk_%288442269364%29_%28cropped%29.jpg/640px-A6-EDY_A380_Emirates_31_jan_2013_jfk_%288442269364%29_%28cropped%29.jpg',
  'B737': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Delta_Boeing_737-800_N371DA_departing_Boston_June_2025.jpg/640px-Delta_Boeing_737-800_N371DA_departing_Boston_June_2025.jpg',
  'B738': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Delta_Boeing_737-800_N371DA_departing_Boston_June_2025.jpg/640px-Delta_Boeing_737-800_N371DA_departing_Boston_June_2025.jpg',
  'B739': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Delta_Boeing_737-800_N371DA_departing_Boston_June_2025.jpg/640px-Delta_Boeing_737-800_N371DA_departing_Boston_June_2025.jpg',
  'B38M': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Delta_Boeing_737-800_N371DA_departing_Boston_June_2025.jpg/640px-Delta_Boeing_737-800_N371DA_departing_Boston_June_2025.jpg',
  'B744': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/B-747_Iberia.jpg/640px-B-747_Iberia.jpg',
  'B748': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/B-747_Iberia.jpg/640px-B-747_Iberia.jpg',
  'B772': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Cathay_Pacific_Boeing_777-200%3B_B-HNL%40HKG.jpg/640px-Cathay_Pacific_Boeing_777-200%3B_B-HNL%40HKG.jpg',
  'B77W': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Cathay_Pacific_Boeing_777-200%3B_B-HNL%40HKG.jpg/640px-Cathay_Pacific_Boeing_777-200%3B_B-HNL%40HKG.jpg',
  'B77L': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Cathay_Pacific_Boeing_777-200%3B_B-HNL%40HKG.jpg/640px-Cathay_Pacific_Boeing_777-200%3B_B-HNL%40HKG.jpg',
  'B788': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Boeing_787_N1015B_ANA_Airlines_%2827611880663%29_%28cropped%29.jpg/640px-Boeing_787_N1015B_ANA_Airlines_%2827611880663%29_%28cropped%29.jpg',
  'B789': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Boeing_787_N1015B_ANA_Airlines_%2827611880663%29_%28cropped%29.jpg/640px-Boeing_787_N1015B_ANA_Airlines_%2827611880663%29_%28cropped%29.jpg',
  'B78X': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Boeing_787_N1015B_ANA_Airlines_%2827611880663%29_%28cropped%29.jpg/640px-Boeing_787_N1015B_ANA_Airlines_%2827611880663%29_%28cropped%29.jpg',
  'B752': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Delta_Air_Lines_Boeing_757-200_N6705Y_departing_Boston_August_2025.jpg/640px-Delta_Air_Lines_Boeing_757-200_N6705Y_departing_Boston_August_2025.jpg',
  'B763': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Boeing_767-300ER_Austrian_OE-LAT_01.jpg/640px-Boeing_767-300ER_Austrian_OE-LAT_01.jpg'
};

// 기종 그룹별 색상
export const AIRCRAFT_COLORS: Record<string, string> = {
  'B7': '#4fc3f7', // 보잉 737
  'B77': '#29b6f6', // 보잉 777
  'B78': '#03a9f4', // 보잉 787
  'B74': '#0288d1', // 보잉 747
  'A3': '#ab47bc', // 에어버스 A3xx
  'A38': '#7b1fa2', // 에어버스 A380
  'AT': '#66bb6a', // ATR
  'DH': '#43a047', // Dash
  'E': '#ffa726', // 엠브라에르
  'C': '#ef5350', // 세스나/비즈젯
};

/**
 * 기종 코드로 대표 항공기 사진 가져오기
 */
export const getAircraftImage = (typeCode?: string): string => {
  if (!typeCode) return AIRCRAFT_MODEL_IMAGES['B738'];
  const code = typeCode.trim().toUpperCase();
  if (AIRCRAFT_MODEL_IMAGES[code]) return AIRCRAFT_MODEL_IMAGES[code];
  for (const [key, url] of Object.entries(AIRCRAFT_MODEL_IMAGES)) {
    if (code.startsWith(key) || key.startsWith(code)) {
      return url;
    }
  }
  if (code.startsWith('A32') || code.startsWith('A20') || code.startsWith('A21')) return AIRCRAFT_MODEL_IMAGES['A320'];
  if (code.startsWith('B73') || code.startsWith('B38') || code.startsWith('B39')) return AIRCRAFT_MODEL_IMAGES['B738'];
  if (code.startsWith('B77')) return AIRCRAFT_MODEL_IMAGES['B77W'];
  if (code.startsWith('B78')) return AIRCRAFT_MODEL_IMAGES['B789'];
  if (code.startsWith('A33')) return AIRCRAFT_MODEL_IMAGES['A333'];
  if (code.startsWith('A35')) return AIRCRAFT_MODEL_IMAGES['A359'];
  if (code.startsWith('B74')) return AIRCRAFT_MODEL_IMAGES['B744'];
  return AIRCRAFT_MODEL_IMAGES['B738'];
};

/**
 * 기종 코드로 색상 가져오기
 */
export const getAircraftColor = (typeCode: string | undefined): string => {
  if (!typeCode) return '#64b5f6';
  const code = typeCode.toUpperCase();
  for (const [prefix, color] of Object.entries(AIRCRAFT_COLORS)) {
    if (code.startsWith(prefix)) return color;
  }
  return '#64b5f6';
};
