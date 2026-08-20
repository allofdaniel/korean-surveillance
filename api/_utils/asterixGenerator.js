/**
 * ASTERIX JSON Generator (Eurocontrol Standard Categories)
 * 과제 인터페이스 요구사항 준수:
 * - Cat.062: 융합 항적 (System Track) (NO.1)
 * - Cat.021: ADS-B 개별 항적 (NO.2)
 * - Cat.048: Radar (Combined PSR/SSR) 개별 항적 (NO.3, 6, 7)
 * - Cat.010: G-SMGCS 지상 이동체 항적 (NO.4)
 * - Cat.034: Mode-S North Mark / Radar Status (NO.5)
 */

function getSecondsOfDay(date = new Date()) {
  const midnight = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return (date.getTime() - midnight.getTime()) / 1000;
}

/**
 * 대원거리 및 방위각(Polar) 계산
 */
function calculatePolarCoordinates(centerLat, centerLon, targetLat, targetLon) {
  const R_NM = 3440.065; // 지구 반경 (NM)
  const dLat = (targetLat - centerLat) * Math.PI / 180;
  const dLon = (targetLon - centerLon) * Math.PI / 180;
  const lat1 = centerLat * Math.PI / 180;
  const lat2 = targetLat * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const rhoNM = R_NM * c;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  let thetaDeg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

  return {
    rhoNM: Math.round(rhoNM * 100) / 100,
    thetaDeg: Math.round(thetaDeg * 100) / 100,
  };
}

/**
 * 1. ASTERIX Cat.062 (System Track 융합 항적)
 */
export function generateAsterixCat062(ac) {
  const speedKts = ac.ground_speed ?? ac.gs ?? 0;
  const headingDeg = ac.track ?? 0;
  const speedMs = speedKts * 0.514444;
  const headingRad = headingDeg * Math.PI / 180;
  const vxMs = Math.round(Math.sin(headingRad) * speedMs * 10) / 10;
  const vyMs = Math.round(Math.cos(headingRad) * speedMs * 10) / 10;

  const altFt = ac.altitude_ft ?? 0;
  const fl = altFt >= 10000 ? `FL${Math.round(altFt / 100)}` : `${Math.round(altFt)}FT`;

  return {
    asterixCategory: 62,
    sac: 116,
    sic: 251,
    timeOfTrackSec: Math.round(getSecondsOfDay() * 100) / 100,
    trackNumber: parseInt((ac.hex || '0000').slice(-4), 16) || 7936,
    trackStatus: {
      monitored: true,
      spi: false,
      mostReliableHeight: 'BARO',
      confirmedTrack: true,
    },
    calculatedPositionWGS84: {
      latitude: Number(Number(ac.lat).toFixed(6)),
      longitude: Number(Number(ac.lon).toFixed(6)),
    },
    calculatedTrackVelocity: {
      vxMs,
      vyMs,
      speedKts: Math.round(speedKts * 10) / 10,
      headingDeg: Math.round(headingDeg * 10) / 10,
    },
    mode3ACode: ac.squawk || '3412',
    flightLevel: fl,
    targetAddress: (ac.hex || '').toUpperCase(),
    targetIdentification: (ac.callsign || ac.flight || ac.hex || '').trim(),
  };
}

/**
 * 2. ASTERIX Cat.021 (ADS-B 개별 항적)
 */
export function generateAsterixCat021(ac) {
  const speedKts = ac.ground_speed ?? ac.gs ?? 0;
  const headingDeg = ac.track ?? 0;
  const altFt = ac.altitude_ft ?? 0;
  const fl = altFt >= 10000 ? `FL${Math.round(altFt / 100)}` : `${Math.round(altFt)}FT`;

  return {
    asterixCategory: 21,
    sac: 116,
    sic: 43,
    serviceIdentification: 1,
    timeOfReportSec: Math.round(getSecondsOfDay() * 100) / 100,
    targetReportDescriptor: {
      addressType: 'ICAO_24BIT',
      simulation: false,
      selectedAltitudeAvailable: true,
    },
    positionWGS84: {
      latitude: Number(Number(ac.lat).toFixed(6)),
      longitude: Number(Number(ac.lon).toFixed(6)),
    },
    targetAddress: (ac.hex || '').toUpperCase(),
    geometricAltitudeFt: Number(Number(altFt || 0).toFixed(1)),
    flightLevel: fl,
    airborneVelocity: {
      subType: 'GROUND_SPEED',
      speedKts: Math.round(speedKts * 10) / 10,
      headingDeg: Math.round(headingDeg * 10) / 10,
    },
    targetIdentification: (ac.callsign || ac.flight || ac.hex || '').trim(),
  };
}

/**
 * 3. ASTERIX Cat.048 (Radar 개별 항적 - Combined / Single PSR / Single SSR)
 */
export function generateAsterixCat048(ac, radarCenter = { lat: 33.3617, lon: 126.5332 }, typ = 'COMBINED_PSR_SSR') {
  const polar = calculatePolarCoordinates(radarCenter.lat, radarCenter.lon, ac.lat, ac.lon);
  const altFt = ac.altitude_ft ?? 0;
  const fl = altFt >= 10000 ? `FL${Math.round(altFt / 100)}` : `${Math.round(altFt)}FT`;

  const record = {
    asterixCategory: 48,
    sac: 129,
    sic: 239,
    timeOfDaySec: Math.round(getSecondsOfDay() * 1000) / 1000,
    targetReportDescriptor: {
      typ,
      sim: false,
      rab: false,
    },
    polarCoordinates: polar,
    calculatedPositionWGS84: {
      latitude: Number(Number(ac.lat).toFixed(6)),
      longitude: Number(Number(ac.lon).toFixed(6)),
    },
  };

  if (typ !== 'SINGLE_PSR') {
    record.mode3ACode = ac.squawk || '3412';
    record.flightLevel = fl;
    record.targetAddress = (ac.hex || '').toUpperCase();
    if (typ === 'COMBINED_PSR_SSR') {
      record.targetIdentification = (ac.callsign || ac.flight || '').trim().slice(0, 7);
    }
  }

  return record;
}

/**
 * 4. ASTERIX Cat.034 (Mode-S North Mark & System Status)
 */
export function generateAsterixCat034(sac = 129, sic = 239) {
  return {
    asterixCategory: 34,
    sac,
    sic,
    messageType: 'NORTH_MARK',
    timeOfDaySec: Math.round(getSecondsOfDay() * 1000) / 1000,
    sectorNumber: 0,
    antennaRotationSpeedSec: 4.0,
    systemConfigurationAndStatus: {
      psrStatus: 'OK',
      ssrStatus: 'OK',
      modeSStatus: 'OK',
    },
  };
}

/**
 * 5. ASTERIX Cat.010 (G-SMGCS 지상 이동체 항적)
 */
export function generateAsterixCat010(ac, airportCenter = { lat: 37.4601, lon: 126.4402 }) {
  const dLatM = (ac.lat - airportCenter.lat) * 111320;
  const dLonM = (ac.lon - airportCenter.lon) * (40075000 * Math.cos(airportCenter.lat * Math.PI / 180) / 360);

  return {
    asterixCategory: 10,
    sac: 116,
    sic: 251,
    messageType: 'TARGET_REPORT',
    timeOfDaySec: Math.round(getSecondsOfDay() * 100) / 100,
    positionWGS84: {
      latitude: Number(Number(ac.lat).toFixed(6)),
      longitude: Number(Number(ac.lon).toFixed(6)),
    },
    cartesianCoordinates: {
      xM: Math.round(dLonM * 10) / 10,
      yM: Math.round(dLatM * 10) / 10,
    },
    targetAddress: (ac.hex || '').toUpperCase(),
    targetIdentification: (ac.callsign || ac.flight || '').trim(),
    targetReportDescriptor: {
      typ: 'MODE_S',
      dcr: false,
      chn: false,
      gbs: true,
      crt: false,
    },
  };
}
