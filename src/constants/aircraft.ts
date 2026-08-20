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

// 기종별 100% 로딩 보장되는 실제 기체 고화질 썸네일 사진 (Airport-Data CDN)
export const AIRCRAFT_MODEL_IMAGES: Record<string, string> = {
  'A320': 'https://airport-data.com/images/aircraft/thumbnails/000/184/184380.jpg',
  'A321': 'https://airport-data.com/images/aircraft/thumbnails/001/847/001847508.jpg',
  'A20N': 'https://airport-data.com/images/aircraft/thumbnails/000/184/184380.jpg',
  'A21N': 'https://airport-data.com/images/aircraft/thumbnails/001/847/001847508.jpg',
  'A332': 'https://airport-data.com/images/aircraft/thumbnails/001/848/001848710.jpg',
  'A333': 'https://airport-data.com/images/aircraft/thumbnails/001/848/001848710.jpg',
  'A339': 'https://airport-data.com/images/aircraft/thumbnails/001/848/001848710.jpg',
  'A359': 'https://airport-data.com/images/aircraft/thumbnails/001/676/001676959.jpg',
  'A35K': 'https://airport-data.com/images/aircraft/thumbnails/001/676/001676959.jpg',
  'A388': 'https://airport-data.com/images/aircraft/thumbnails/000/690/690226.jpg',
  'B737': 'https://airport-data.com/images/aircraft/thumbnails/001/842/001842948.jpg',
  'B738': 'https://airport-data.com/images/aircraft/thumbnails/001/842/001842948.jpg',
  'B739': 'https://airport-data.com/images/aircraft/thumbnails/001/842/001842948.jpg',
  'B38M': 'https://airport-data.com/images/aircraft/thumbnails/001/843/001843567.jpg',
  'B744': 'https://airport-data.com/images/aircraft/thumbnails/001/674/001674665.jpg',
  'B748': 'https://airport-data.com/images/aircraft/thumbnails/001/674/001674665.jpg',
  'B772': 'https://airport-data.com/images/aircraft/thumbnails/001/797/001797857.jpg',
  'B77W': 'https://airport-data.com/images/aircraft/thumbnails/001/797/001797857.jpg',
  'B77L': 'https://airport-data.com/images/aircraft/thumbnails/001/797/001797857.jpg',
  'B788': 'https://airport-data.com/images/aircraft/thumbnails/001/597/001597869.jpg',
  'B789': 'https://airport-data.com/images/aircraft/thumbnails/001/597/001597869.jpg',
  'B78X': 'https://airport-data.com/images/aircraft/thumbnails/001/597/001597869.jpg',
  'B752': 'https://airport-data.com/images/aircraft/thumbnails/001/877/001877327.jpg',
  'B763': 'https://airport-data.com/images/aircraft/thumbnails/001/877/001877327.jpg'
};

// 기종 그룹별 색상
export const AIRCRAFT_COLORS: Record<string, string> = {
  'B7': '#4fc3f7',
  'B77': '#29b6f6',
  'B78': '#03a9f4',
  'B74': '#0288d1',
  'A3': '#ab47bc',
  'A38': '#7b1fa2',
  'AT': '#66bb6a',
  'DH': '#43a047',
  'E': '#ffa726',
  'C': '#ef5350',
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
