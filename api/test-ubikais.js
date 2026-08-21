import { fetchUbikaisAirportLive } from './_utils/ubikaisAuthScraper.js';

export default async function handler(req, res) {
  try {
    const data = await fetchUbikaisAirportLive('RKSS');
    return res.status(200).json({
      success: true,
      depCount: data.departures.length,
      arrCount: data.arrivals.length,
      sampleDep: data.departures[0],
      sampleArr: data.arrivals[0]
    });
  } catch(e) {
    return res.status(500).json({
      success: false,
      error: e.message,
      stack: e.stack
    });
  }
}
