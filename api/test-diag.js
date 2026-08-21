import { fetchUbikaisAirportLive } from './_utils/ubikaisAuthScraper.js';
import { fetchLiveAmoMetarTaf, fetchLiveAmosData } from './_utils/amosScraper.js';

export default async function handler(req, res) {
  const airport = (req.query.airport || 'RKTL').toUpperCase();
  const errors = [];

  let schedule = null;
  try {
    schedule = await fetchUbikaisAirportLive(airport);
  } catch (e) {
    errors.push({ step: 'schedule', error: e.message, stack: e.stack });
  }

  let amos = null;
  try {
    amos = await fetchLiveAmosData(airport);
  } catch (e) {
    errors.push({ step: 'amos', error: e.message, stack: e.stack });
  }

  let wx = null;
  try {
    wx = await fetchLiveAmoMetarTaf(airport);
  } catch (e) {
    errors.push({ step: 'metar', error: e.message, stack: e.stack });
  }

  return res.status(200).json({
    airport,
    scheduleCount: schedule?.totalFlights || 0,
    depCount: schedule?.departures?.length || 0,
    arrCount: schedule?.arrivals?.length || 0,
    scheduleRecordsSample: schedule?.departures?.slice(0, 2),
    amosCount: amos?.length || 0,
    amosSample: amos?.slice(0, 1),
    metar: wx?.metar,
    taf: wx?.taf,
    errors
  });
}
