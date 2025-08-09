// ##### Data Fetching ######

let cachedStartupData = null;
const resource_id = "15a63495-8d9f-4a49-b43a-3092ef3106b9";

// Startup Call
export async function fetchAllStationsWithStatus(forceRefresh = false) {
  if (cachedStartupData && !forceRefresh) return cachedStartupData;

  // 1) All stations metadata (StationCode, StationName, lat/lon)
  const sqlMeta = `
    SELECT DISTINCT
      "StationCode",
      "StationName",
      "TargetLatitude",
      "TargetLongitude"
    FROM "${resource_id}"
  `;
  const urlMeta = `https://data.ca.gov/api/3/action/datastore_search_sql?sql=${encodeURIComponent(sqlMeta)}`;
  const metaResponse = await fetch(urlMeta);
  const metaJson = await metaResponse.json();
  const metaRecords = metaJson.result.records;

	// 2) True last sample date (all time, any analyte)
	const sqlLastDates = `
		SELECT
			"StationCode",
			max("SampleDate") AS "LastSampleDate"
		FROM "${resource_id}"
		GROUP BY "StationCode"
	`;
	const lastJson = await (await fetch(
		`https://data.ca.gov/api/3/action/datastore_search_sql?sql=${encodeURIComponent(sqlLastDates)}`
	)).json();
	const lastRows = lastJson.result.records;
	const lastByStation = Object.create(null);
	for (const r of lastRows) {
		// r.LastSampleDate is typically an ISO date string from CKAN
		lastByStation[r.StationCode] = r.LastSampleDate || null;
	}

	// 3) Total data points per station
	const sqlCounts = `
    SELECT
      "StationCode",
      COUNT(*) AS "TotalDataPoints"
    FROM "${resource_id}"
    GROUP BY "StationCode"
  `;
  const countResponse = await fetch(
    `https://data.ca.gov/api/3/action/datastore_search_sql?sql=${encodeURIComponent(sqlCounts)}`
  );
  const countJson = await countResponse.json();
  const countRecords = countJson.result.records;
  const countByStation = {};
  for (const row of countRecords) countByStation[row.StationCode] = Number(row.TotalDataPoints) || 0;

  // 4) Recent data (last 6 weeks, Enterococcus & E. coli only)
  const sixWeeksAgo = new Date();
  sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
  const sixWeeksAgoStr = sixWeeksAgo.toISOString().split("T")[0];

  const sqlStatus = `
    SELECT
      "StationCode",
      "SampleDate",
      "Analyte",
      "Unit",
      "Result",
      "30DayGeoMean",
      "6WeekCount"
    FROM "${resource_id}"
    WHERE "SampleDate" >= '${sixWeeksAgoStr}'
      AND ("Analyte" = 'Enterococcus' OR "Analyte" = 'E. coli')
  `;
  const urlStatus = `https://data.ca.gov/api/3/action/datastore_search_sql?sql=${encodeURIComponent(sqlStatus)}`;
  const statusResponse = await fetch(urlStatus);
  const statusJson = await statusResponse.json();
  const statusRecords = statusJson.result.records;

  // Group recent results by StationCode
  const resultsByStation = {};
  for (const r of statusRecords) {
    const code = r.StationCode;
    const dateObj = new Date(r.SampleDate);
    if (!resultsByStation[code]) {
      resultsByStation[code] = { latest: r, recentResults: [] };
    } else if (dateObj > new Date(resultsByStation[code].latest.SampleDate)) {
      resultsByStation[code].latest = r;
    }
    resultsByStation[code].recentResults.push({
      SampleDate: r.SampleDate,
      Analyte: r.Analyte,
      Unit: r.Unit,
      Result: r.Result
    });
  }

  // Combine meta + status into object keyed by StationCode
  const stationsObj = {};
  for (const station of metaRecords) {
    const code = station.StationCode;
    const resultData = resultsByStation[code] || { latest: null, recentResults: [] };

    stationsObj[code] = {
      StationCode: code,
      StationName: station.StationName,
      TargetLatitude: parseFloat(station.TargetLatitude),
      TargetLongitude: parseFloat(station.TargetLongitude),
      latest: resultData.latest,
      recentResults: resultData.recentResults,
			lastSampleDate: lastByStation[code] || null,
			totalDataPoints: countByStation[code] ?? 0
    };
  }

  cachedStartupData = stationsObj; // cache for session
  return cachedStartupData;
}



// Station-specific full history
const _cache = new Map(); // code -> records

export async function stationRecordFetch(stationCode, { signal } = {}) {
  if (!stationCode || stationCode.trim() === "") return [];

  // Cache hit
  if (_cache.has(stationCode)) return _cache.get(stationCode);

  let offset = 0;
  const pageSize = 500;
  const records = [];

  while (true) {
    const url = `https://data.ca.gov/api/3/action/datastore_search?resource_id=${resource_id}&limit=${pageSize}&offset=${offset}&filters=${encodeURIComponent(JSON.stringify({ StationCode: stationCode }))}`;
    const resp = await fetch(url, { signal });
    const json = await resp.json();
    const rows = json.result?.records ?? [];
    if (rows.length === 0) break;
    records.push(...rows);
    offset += pageSize;
    if (rows.length < pageSize) break;
  }

  _cache.set(stationCode, records);
  return records;
}

// Force refresh
export function invalidateStationCache(code) {
  if (code) _cache.delete(code);
}


// ##### Misc #####

export function formatStationName(rawName = "", code = "") {
    if (!rawName) return code;

    // Only remove if rawName starts with the code + "-"
    if (rawName.startsWith(code + "-")) {
      const trimmed = rawName.slice(code.length + 1).trim();
      return trimmed !== "" ? trimmed : rawName;
    }

    // Otherwise, leave as is
    return rawName;
  }



