import { setCorsHeaders, checkRateLimit } from './_cors.js';

// In-Memory Lightweight Cache & Event Diff Buffer (Zero Storage Overhead)
let lastRunTimestamp = null;
let lastSyncResult = {
  status: 'IDLE',
  airportsSynced: 0,
  flightsTracked: 0,
  weatherStationsSynced: 0,
  notamsSynced: 0,
  changesDetected: 0,
  executionTimeMs: 0
};

// In-memory snapshots for diffing without database bloat
let previousFlightMap = new Map();
const eventLog = []; // Ring buffer of last 100 detected flight events
const MAX_LOG_SIZE = 100;

function pushEvent(event) {
  eventLog.unshift({
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    ...event
  });
  if (eventLog.length > MAX_LOG_SIZE) {
    eventLog.pop();
  }
}

// Major hub list for nationwide schedule sync
const NATIONWIDE_AIRPORTS = ['RKSI', 'RKSS', 'RKPC', 'RKPK', 'RKPU', 'RKTU', 'RKTN', 'RKJJ', 'RKJB', 'RKJY'];

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;
  if (await checkRateLimit(req, res)) return;

  const parsedUrl = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
  const viewEvents = parsedUrl.searchParams.get('events') === 'true' || req.query?.events === 'true';
  const viewStatusOnly = parsedUrl.searchParams.get('status') === 'true' || req.query?.status === 'true';

  // 1. If user asks for detected real-time change events
  if (viewEvents) {
    return res.status(200).json({
      crawler: 'Vercel Pro Zero-Storage In-Memory Sync Engine',
      lastRun: lastRunTimestamp,
      totalEvents: eventLog.length,
      recentEvents: eventLog
    });
  }

  // 2. If user just requests crawler status heartbeat
  if (viewStatusOnly) {
    return res.status(200).json({
      crawler: 'Vercel Pro Zero-Storage In-Memory Sync Engine',
      lastRun: lastRunTimestamp,
      lastSync: lastSyncResult,
      memoryStats: {
        activeTrackedFlights: previousFlightMap.size,
        bufferedEvents: eventLog.length,
        storageFootprintBytes: 0,
        storageNote: 'DB 누적 저장 없음 (메모리 Diff 감지 후 즉시 릴레이)'
      }
    });
  }

  // 3. Execute Crawler Sync Routine
  const startTime = Date.now();
  let totalFlights = 0;
  let changesCount = 0;
  const currentFlightMap = new Map();

  try {
    const host = req.headers?.host || 'www.koreasurveillance.com';
    const protocol = host.includes('localhost') ? 'http' : 'https';

    // A. Sync Nationwide Schedules in Parallel (UBIKAIS)
    const schedulePromises = NATIONWIDE_AIRPORTS.map(async (ap) => {
      try {
        const url = `${protocol}://${host}/api/flight-schedule?airport=${ap}&_t=${Date.now()}`;
        const resp = await fetch(url, { headers: { 'User-Agent': 'Vercel-Pro-Crawler/2.0' } });
        if (resp.ok) {
          const data = await resp.json();
          const items = Array.isArray(data.items) ? data.items : [];
          return { airport: ap, items };
        }
      } catch (e) {
        // Continue on airport error
      }
      return { airport: ap, items: [] };
    });

    // B. Sync Real-time Weather & NOTAM in Parallel
    const weatherPromise = (async () => {
      try {
        const resp = await fetch(`${protocol}://${host}/api/weather?type=amos&icao=ALL&_t=${Date.now()}`);
        return resp.ok ? (await resp.json()).length : 0;
      } catch {
        return 0;
      }
    })();

    const notamPromise = (async () => {
      try {
        const resp = await fetch(`${protocol}://${host}/api/notam?location=RKRR&_t=${Date.now()}`);
        return resp.ok ? (await resp.json()).count || 0 : 0;
      } catch {
        return 0;
      }
    })();

    const [scheduleResults, weatherRunwaysCount, notamsCount] = await Promise.all([
      Promise.all(schedulePromises),
      weatherPromise,
      notamPromise
    ]);

    // C. Perform In-Memory Diffing without DB Storage
    scheduleResults.forEach(({ airport, items }) => {
      items.forEach(flight => {
        const callsign = flight.flightNumber || flight.fn || flight.callsign;
        if (!callsign) return;

        const flightKey = `${airport}_${flight.depArr || 'dep'}_${callsign}`;
        const currentStatus = flight.status || flight.remark || 'NORMAL';
        const std = flight.std || flight.etd || '';
        const etd = flight.etd || flight.std || '';

        currentFlightMap.set(flightKey, {
          callsign,
          airport,
          depArr: flight.depArr,
          origin: flight.origin || flight.depAirport,
          destination: flight.destination || flight.arrAirport,
          status: currentStatus,
          std,
          etd,
          airline: flight.airline
        });
        totalFlights++;

        // Compare with previous cycle
        if (previousFlightMap.has(flightKey)) {
          const prev = previousFlightMap.get(flightKey);

          // 1. Detect Cancellation (CNL)
          if (currentStatus.includes('결항') || currentStatus.includes('CNL') || currentStatus.includes('CANCEL')) {
            if (!prev.status.includes('결항')) {
              changesCount++;
              pushEvent({
                type: 'CNL',
                callsign,
                airport,
                description: `[결항 감지] ${callsign}편이 결항(CNL) 처리되었습니다.`,
                flight
              });
            }
          }

          // 2. Detect Departure (DEP)
          if (currentStatus.includes('출발') || currentStatus.includes('이륙') || currentStatus.includes('DEP')) {
            if (!prev.status.includes('출발') && !prev.status.includes('이륙')) {
              changesCount++;
              pushEvent({
                type: 'DEP',
                callsign,
                airport,
                description: `[이륙 감지] ${callsign}편이 ${airport}에서 이륙(DEP)하였습니다.`,
                flight
              });
            }
          }

          // 3. Detect Arrival (ARR)
          if (currentStatus.includes('도착') || currentStatus.includes('착륙') || currentStatus.includes('ARR')) {
            if (!prev.status.includes('도착') && !prev.status.includes('착륙')) {
              changesCount++;
              pushEvent({
                type: 'ARR',
                callsign,
                airport,
                description: `[착륙 감지] ${callsign}편이 ${airport}에 착륙(ARR)하였습니다.`,
                flight
              });
            }
          }

          // 4. Detect Delay (DLA)
          if (etd && std && etd > std && prev.etd === prev.std) {
            changesCount++;
            pushEvent({
              type: 'DLA',
              callsign,
              airport,
              description: `[지연 감지] ${callsign}편 출발이 ${std}에서 ${etd}로 지연(DLA)되었습니다.`,
              flight
            });
          }
        }
      });
    });

    // Replace previous map with current active flights (Zero Memory Accumulation)
    previousFlightMap = currentFlightMap;
    lastRunTimestamp = new Date().toISOString();

    lastSyncResult = {
      status: 'SUCCESS',
      airportsSynced: scheduleResults.length,
      flightsTracked: totalFlights,
      weatherStationsSynced: weatherRunwaysCount,
      notamsSynced: notamsCount,
      changesDetected: changesCount,
      executionTimeMs: Date.now() - startTime
    };

    return res.status(200).json({
      success: true,
      crawler: 'Vercel Pro Zero-Storage In-Memory Sync Engine',
      summary: lastSyncResult,
      bufferedEventsCount: eventLog.length,
      storagePolicy: 'Zero Persistent DB Storage (Ephemeral In-Memory Diffing)'
    });

  } catch (err) {
    lastSyncResult = {
      status: 'ERROR',
      error: err.message,
      executionTimeMs: Date.now() - startTime
    };
    return res.status(500).json({
      success: false,
      error: err.message,
      summary: lastSyncResult
    });
  }
}
