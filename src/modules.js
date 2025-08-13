// ##### Data Fetching ######

let cachedStartupData = null;
const resource_id = "15a63495-8d9f-4a49-b43a-3092ef3106b9";

// Startup Call
export async function fetchAllStations(forceRefresh = false) {
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


// ##### Status Determination #####

// modules.js
import {FileAttachment} from "observablehq:stdlib";

/* -----------------------------
   Lazy, memoized config loaders
------------------------------ */
let _criteriaPromise = null;
let _saltFlagsPromise = null;

async function getCriteria() {
  if (!_criteriaPromise) {
    _criteriaPromise = FileAttachment("data/criteria.json").json();
  }
  return _criteriaPromise;
}

async function getSaltwaterFlags() {
  if (!_saltFlagsPromise) {
    _saltFlagsPromise = FileAttachment("data/site_saltwater_flags.json")
      .json()
      .then(rows => new Map(
        rows.map(d => [
          d.selectedStation,
          String(d.saltwater).toLowerCase() === "true"
        ])
      ));
  }
  return _saltFlagsPromise;
}

/* -----------------------------
   Generic helpers (sync)
------------------------------ */
function toDate(d) { return (d instanceof Date) ? d : new Date(d); }

export function geomean(values) {
  const vals = values.filter(v => Number.isFinite(v) && v > 0);
  if (vals.length === 0) return NaN;
  const s = vals.reduce((acc, v) => acc + Math.log(v), 0);
  return Math.exp(s / vals.length);
}

export function quantile(arr, p) {
  const a = arr.filter(Number.isFinite).slice().sort((x, y) => x - y);
  if (a.length === 0) return NaN;
  const idx = (a.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return a[lo];
  const t = idx - lo;
  return a[lo] * (1 - t) + a[hi] * t;
}

function startOfISOWeek(d) {
  const dt = new Date(d);
  const day = (dt.getDay() + 6) % 7; // Monday=0
  dt.setDate(dt.getDate() - day);
  dt.setHours(0,0,0,0);
  return dt;
}
function endOfISOWeek(d) {
  const s = startOfISOWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23,59,59,999);
  return e;
}

/* -----------------------------
   Status logic (pure/sync core)
------------------------------ */
function evaluateStatusFromMetrics(metrics, typeRules, criteria) {
  // metrics: { sampleCount6W, geoMean6W, p90_30d, manualClosureFlag }
  if (metrics.manualClosureFlag) return criteria.statuses.closure;

  if (metrics.sampleCount6W < typeRules.low_risk.min_samples_six_week) {
    return criteria.statuses.not_enough_data;
  }

  const okSixW = metrics.geoMean6W <= typeRules.low_risk.six_week_geomean.max;
  const okP90  = metrics.p90_30d   <= typeRules.low_risk.p90_30day.max;

  if (okSixW && okP90) return criteria.statuses.low_risk;
  return criteria.statuses[typeRules.else_status];
}

function computeWindowMetrics(records, asOfDate) {
  const asOf = toDate(asOfDate);
  const msPerDay = 24 * 3600 * 1000;

  const sixW = records.filter(r => {
    const dt = toDate(r.SampleDate);
    return dt <= asOf && (asOf - dt) <= 42 * msPerDay;
  });

  const thirtyD = records.filter(r => {
    const dt = toDate(r.SampleDate);
    return dt <= asOf && (asOf - dt) <= 30 * msPerDay;
  });

  const sixWVals = sixW.map(r => +r.Result);
  const thirtyVals = thirtyD.map(r => +r.Result);

  return {
    sampleCount6W: sixWVals.filter(Number.isFinite).length,
    geoMean6W: geomean(sixWVals),
    p90_30d: quantile(thirtyVals, 0.9),
    manualClosureFlag: sixW.some(r => r.manualClosureFlag === true)
  };
}

/* -----------------------------
   Public API (async wrappers)
------------------------------ */

// Optional preloader (call once if you want)
export async function initStatusModule() {
  await Promise.all([getCriteria(), getSaltwaterFlags()]);
}

// Is a station saltwater?
export async function isSaltwaterStation(stationCode) {
  const flags = await getSaltwaterFlags();
  return flags.get(stationCode) === true;
}

// Compute status for ONE station at a given as-of date, from raw samples
export async function computeStatusAtDateForStation(stationCode, recordsForStation, asOfDate) {
  const [criteria, saltFlags] = await Promise.all([getCriteria(), getSaltwaterFlags()]);
  const isSalt = saltFlags.get(stationCode) === true;
  const typeRules = criteria.rules.waterbody_types[isSalt ? "saltwater" : "freshwater"];
  const metrics = computeWindowMetrics(recordsForStation ?? [], asOfDate ?? new Date());
  return evaluateStatusFromMetrics(metrics, typeRules, criteria);
}

// Current status for ALL stations using raw per-sample records
// recordsByStation: Map(code -> sample[])
export async function computeAllStatuses(recordsByStation, asOf = new Date()) {
  const [criteria, saltFlags] = await Promise.all([getCriteria(), getSaltwaterFlags()]);
  const out = new Map();
  for (const [code, records] of recordsByStation.entries()) {
    const isSalt = saltFlags.get(code) === true;
    const typeRules = criteria.rules.waterbody_types[isSalt ? "saltwater" : "freshwater"];
    const metrics = computeWindowMetrics(records ?? [], asOf);
    out.set(code, evaluateStatusFromMetrics(metrics, typeRules, criteria));
  }
  return out;
}

// Current status for ALL stations using precomputed per-station metrics
// stations: { [code]: { "6WeekCount", "6WeekGeoMean", "30DayP90" (or adjust), manualClosureFlag? } }
export async function computeAllStatusesFast(stations) {
  const [criteria, saltFlags] = await Promise.all([getCriteria(), getSaltwaterFlags()]);
  const out = new Map();
  for (const [code, st] of Object.entries(stations)) {
    const isSalt = saltFlags.get(code) === true;
    const typeRules = criteria.rules.waterbody_types[isSalt ? "saltwater" : "freshwater"];
    const metrics = {
      sampleCount6W: +st["6WeekCount"],
      geoMean6W: +st["6WeekGeoMean"],
      // If your upstream field is actually geomean (named 30DayGeoMean), change this to that field.
      p90_30d: +st["30DayP90"],
      manualClosureFlag: !!st.manualClosureFlag
    };
    out.set(code, evaluateStatusFromMetrics(metrics, typeRules, criteria));
  }
  return out;
}

// Weekly series for plotting for ONE station (uses prior 6 weeks for each week)
export async function buildWeeklyStatusSeriesForStation(stationCode, recordsForStation, opts = {}) {
  const [criteria, saltFlags] = await Promise.all([getCriteria(), getSaltwaterFlags()]);
  const isSalt = saltFlags.get(stationCode) === true;

  const records = (recordsForStation ?? []).slice();
  if (records.length === 0) return [];

  const dates = records.map(r => toDate(r.SampleDate)).sort((a,b) => a - b);
  const start = startOfISOWeek(opts.from ?? dates[0]);
  const end   = endOfISOWeek(opts.to ?? dates[dates.length - 1]);

  const series = [];
  for (let t = new Date(start); t <= end; t.setDate(t.getDate() + 7)) {
    const asOf = endOfISOWeek(t);
    const typeRules = criteria.rules.waterbody_types[isSalt ? "saltwater" : "freshwater"];
    const metrics = computeWindowMetrics(records, asOf);
    const status = evaluateStatusFromMetrics(metrics, typeRules, criteria);
    series.push({
      station: stationCode,
      week_start: new Date(t),
      week_end: new Date(asOf),
      status_key: status.name ?? status.key ?? "unknown",
      status
    });
  }
  return series;
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

