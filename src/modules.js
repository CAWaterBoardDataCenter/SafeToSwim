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

import {FileAttachment} from "observablehq:stdlib";

let _criteriaPromise = null;
let _saltFlagsPromise = null;

// Helper
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
      .then(rows => new Map(rows.map(d => [
        String(d.StationCode).trim(),
        d.saltwater === true || d.saltwater === "True"
      ])));
  }
  return _saltFlagsPromise;
}

// Helper: Preferred analyte lists if not provided in criteria
const DEFAULT_ANALYTE_MAP = {
  saltwater: ["Enterococcus", "Entero", "ENT"],
  freshwater: ["E. coli", "E Coli", "E.Coli", "EC"]
};

// Helper: Pull analyte preferences out of criteria if available
function analytePrefsFromCriteria(criteria) {
  const c = criteria || {};
  const prefs = c.analytes || c.rules?.analytes || {};
  return {
    saltwater: prefs.saltwater || DEFAULT_ANALYTE_MAP.saltwater,
    freshwater: prefs.freshwater || DEFAULT_ANALYTE_MAP.freshwater
  };
}

// Helper: Case-insensitive membership test
function makeLowerSet(arr) {
  const s = new Set();
  for (const v of arr || []) if (v != null) s.add(String(v).toLowerCase());
  return s;
}

// Helper: Choose analyte based on env + availability in records
function pickAnalyteForEnvironment(stationRecord, isSaltwater, criteria) {
  const prefs = analytePrefsFromCriteria(criteria);
  const wantedList = isSaltwater ? prefs.saltwater : prefs.freshwater;

  const available = (stationRecord || []).map(r => r?.Analyte).filter(Boolean);
  const availSet = makeLowerSet(available);

  // 1) try preferred list in order
  for (const name of wantedList) {
    if (availSet.has(String(name).toLowerCase())) return name;
  }

  // 2) otherwise: pick most frequent analyte present
  if (available.length) {
    const counts = new Map();
    for (const a of available) counts.set(a, (counts.get(a) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  return null; // no analytes found
}

// Computes window metrics for a station's records at a given date
export function computeWindowMetrics(records, asOfDate) {
  const asOf = toDate(asOfDate);
  const msPerDay = 24 * 3600 * 1000;

  // Window membership
  const inLast = (r, days) => {
    const dt = toDate(r.SampleDate);
    return dt <= asOf && (asOf - dt) <= days * msPerDay;
  };

  // 42-day window (for geomean + count)
  const sixW = records.filter(r => inLast(r, 42));
  const sixWVals = sixW.map(r => +r.Result).filter(Number.isFinite);

  // 30-day window (for p90 + optional count)
  const thirtyD = records.filter(r => inLast(r, 30));
  const thirtyVals = thirtyD.map(r => +r.Result).filter(Number.isFinite);

  return {
    sampleCount6W: sixWVals.length,
    geoMean6W: geomean(sixWVals),
    p90_30d: quantile(thirtyVals, 0.9),
    sampleCount30D: thirtyVals.length,
    manualClosureFlag: sixW.some(r => r.manualClosureFlag === true)
  };
}

// Determines status of a station based on window metrics and type rules
export function evaluateStatusFromMetrics(
  metrics,
  typeRules,
  criteria,
  opts = {}
) {
  const reasons = [];
  const {
    min_samples_six_week,
    six_week_geomean,
    p90_30day
  } = typeRules.low_risk;

  const elseName = typeRules.else_status; // e.g., "caution"
  const S = criteria.statuses;

  // 0) Hard override: manual closures
  if (metrics.manualClosureFlag) {
    reasons.push("Manual closure");
    return withReasons(S.closure, reasons, metrics);
  }

  // 1) Data sufficiency checks (centralized here)
  // Six-week min samples (primary gate)
  if (!Number.isFinite(metrics.sampleCount6W) || metrics.sampleCount6W < min_samples_six_week) {
    reasons.push("Insufficient samples");
    return withReasons(S.not_enough_data, reasons, metrics);
  }

  // 2) Metric validity (NaNs -> treat as insufficient)
  if (!Number.isFinite(metrics.geoMean6W)) {
    reasons.push("Invalid geomean (6w)");
    return withReasons(S.not_enough_data, reasons, metrics);
  }
  if (!Number.isFinite(metrics.p90_30d)) {
    reasons.push("Invalid p90 (30d)");
    return withReasons(S.not_enough_data, reasons, metrics);
  }

  // 3) Threshold checks (single source of truth)
  const okSixW = metrics.geoMean6W <= six_week_geomean.max;
  const okP90  = metrics.p90_30d   <= p90_30day.max;

  if (okSixW && okP90) {
    reasons.push("Pass geomean", "Pass single sample");
    return withReasons(S.low_risk, reasons, metrics);
  }

  // 4) Else status and reasons
  if (!okSixW) reasons.push("Fail geomean");
  if (!okP90)  reasons.push("Fail single sample");
  return withReasons(S[elseName], reasons, metrics);
}

function withReasons(status, reasons, metrics) {
  return { ...status, _reasons: reasons, _metrics: metrics };
}

// Wrapper function for building status series; selects rules branch based on environment
export async function buildStatusSeriesForStation(stationRecord) {
  const code = stationRecord[0]?.StationCode;
  const [criteria, saltFlags] = await Promise.all([getCriteria(), getSaltwaterFlags()]);
  const isSaltwater = saltFlags.get(code) ?? false;
  const analyte = pickAnalyteForEnvironment(stationRecord, isSaltwater, criteria);
  const typeRules = selectTypeRules(criteria, { isSaltwater, analyte });

  // --- base series on sample dates ---
  const base = buildStatusSeries(stationRecord, analyte, typeRules, criteria);

  // --- ensure it extends to "today" ---
  const today = toDate(new Date());
  const lastDate = base.length ? toDate(base[base.length - 1].date) : null;

  if (!lastDate || lastDate.getTime() < today.getTime()) {
    // compute today's status using same metrics/evaluator
    const recs = (stationRecord || [])
      .filter(r => r?.Analyte === analyte && r?.SampleDate != null)
      .map(r => ({ ...r, SampleDate: toDate(r.SampleDate) }))
      .sort((a,b) => a.SampleDate - b.SampleDate);

    const metricsToday = computeWindowMetrics(recs, today);
    const statusToday  = evaluateStatusFromMetrics(metricsToday, typeRules, criteria);

    base.push({
      date: today,
      status: statusToday,
      status_name: statusToday?.name ?? null,
      metrics: metricsToday
    });
  }

  return base;
}

// Helper: Return the rule-set the evaluator needs
export function selectTypeRules(criteria, { isSaltwater }) {
  const c = criteria || {};
  const wb = c.rules?.waterbody_types?.[isSaltwater ? "saltwater" : "freshwater"] || {};
  return {
    low_risk: wb.low_risk,                                     // { six_week_geomean:{max}, p90_30day:{max}, min_samples_six_week }
    else_status: wb.else_status || c.rules?.default?.status    // e.g., "use_caution" (fallback to default status)
  };
}

// Helper: Get the preferred bacteria/analyte label from criteria (e.g., "enterococcus" / "e_coli")
export function preferredAnalyte(criteria, { isSaltwater }) {
  const wb = criteria?.rules?.waterbody_types?.[isSaltwater ? "saltwater" : "freshwater"];
  return wb?.bacteria || null;
}

// Optional: let callers read the closure field name from criteria (defaults to your existing one)
export function closureFieldName(criteria) {
  return criteria?.rules?.overrides?.closure_field || "manual_closure_flag";
}


// Build status time series.
//
// @param {Array<Object>} stationRecord
// @param {string} analyte
// @param {Object} typeRules
// @param {Object} criteria
// @returns {Array<{date: Date, status: any, status_name: string, metrics: object}>}
export function buildStatusSeries(stationRecord, analyte, typeRules, criteria) {
  // 1) Filter to analyte and normalize dates
  const recs = (stationRecord || [])
    .filter(r => r && r.Analyte === analyte && r.SampleDate != null)
    .map(r => ({ ...r, SampleDate: toDate(r.SampleDate) })) // normalize to midnight
    .sort((a, b) => a.SampleDate - b.SampleDate);

  if (recs.length === 0) return [];

  // 2) Unique sample dates (ascending)
  const asOfDates = Array.from(new Set(recs.map(r => +r.SampleDate)))
    .sort((a, b) => a - b)
    .map(t => new Date(t));

  // 3) Evaluate metrics + status per as-of date
  return asOfDates.map(asOf => {
    const metrics = computeWindowMetrics(recs, asOf);
    const status = evaluateStatusFromMetrics(metrics, typeRules, criteria);
    return {
      date: asOf,
      status,
      status_name: status?.name ?? null,
      metrics
    };
  });
}

// Determine the current status of a station
export function latestStatus(stationRecord, analyte, typeRules, criteria, asOf = new Date()) {
  const recs = (stationRecord || [])
    .filter(r => r && r.Analyte === analyte && r.SampleDate != null)
    .map(r => ({ ...r, SampleDate: toDate(r.SampleDate) }))
    .sort((a, b) => a.SampleDate - b.SampleDate);

  if (!recs.length) return null;

  const metrics = computeWindowMetrics(recs, toDate(asOf));
  const status = evaluateStatusFromMetrics(metrics, typeRules, criteria);
  return { date: toDate(asOf), status, status_name: status?.name ?? null, metrics };
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
  const code = normalizeCode(stationCode);
  if (flags.has(code)) return flags.get(code);

  // Fallback: case-insensitive match if upstream code casing varies
  const lower = code.toLowerCase();
  for (const [k, v] of flags) {
    if (k.toLowerCase() === lower) return v;
  }
  return false;
}

// Compute status for ONE station at a given as-of date, from raw samples
export async function computeStatusAtDateForStation(stationCode, recordsForStation, asOfDate) {
  const [criteria, saltFlags] = await Promise.all([getCriteria(), getSaltwaterFlags()]);
  const isSalt = saltFlags.get(stationCode) === true;
  const typeRules = criteria.rules.waterbody_types[isSalt ? "saltwater" : "freshwater"];
  const metrics = computeWindowMetrics(recordsForStation ?? [], asOfDate ?? new Date());
  return evaluateStatusFromMetrics(metrics, typeRules, criteria);
}

// Current status for all stations using raw per-sample records
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

export async function getStatusColors() {
  const criteria = await getCriteria();
  const mapping = {};
  for (const [, info] of Object.entries(criteria.statuses)) {
    mapping[info.name] = info.color;
  }
  return mapping;
}

// Return: { isSaltwater, bacteria, thresholds: { geomean, single_sample } }
export async function getStationAssessmentSpec(stationCode) {
  const [saltFlags, criteria] = await Promise.all([getSaltwaterFlags(), getCriteria()]);
  const isSaltwater = !!saltFlags.get(stationCode);
  const envKey = isSaltwater ? "saltwater" : "freshwater";

  const env = criteria?.rules?.waterbody_types?.[envKey] || {};
  const bacteria = env.bacteria ?? null;

  const geomean =
    env?.low_risk?.six_week_geomean?.max ?? null;
  const singleSample =
    env?.low_risk?.p90_30day?.max ?? null;

  return {
    isSaltwater,
    bacteria,
    thresholds: {
      geomean,
      single_sample: singleSample
    }
  };
}

// helper: extract one environment's spec from your criteria shape
function envSpec(criteria, envKey) {
  const env = criteria?.rules?.waterbody_types?.[envKey] || {};
  return {
    bacteria: env.bacteria ?? null,
    thresholds: {
      geomean: env?.low_risk?.six_week_geomean?.max ?? null,
      single_sample: env?.low_risk?.p90_30day?.max ?? null,
      min_samples_six_week: env?.low_risk?.min_samples_six_week ?? null
    },
    else_status: env?.else_status ?? null
  };
}

// Return all thresholds from criteria for both environments.
export async function getAllThresholds() {
  const criteria = await getCriteria();
  const salt = envSpec(criteria, "saltwater");
  const fresh = envSpec(criteria, "freshwater");

  // { enterococcus: {...}, e_coli: {...} }
  return {
    [salt.bacteria]: salt.thresholds,
    [fresh.bacteria]: fresh.thresholds
  };
}

//  Slice a timeseries into contiguous segments where y(d) >= T,
//  inserting exact crossing points at the threshold.
//  
//  @param {Array} data  - sorted array of objects with .date and value
//  @param {Function} y  - accessor for the numeric value
//  @param {Number} T    - threshold
//  @returns {Array[]}   - array of segments (each segment is an array of points)
//  
export function segmentsAboveThreshold(data, y, T) {
  const segs = [];
  let cur = [];

  for (let i = 0; i < data.length - 1; i++) {
    const a = data[i], b = data[i + 1];
    const ya = y(a),   yb = y(b);

    const aAbove = ya >= T, bAbove = yb >= T;

    if (aAbove) cur.push(a);

    if (aAbove !== bAbove) {
      // linear interpolate crossing at y = T
      const ta = +a.date, tb = +b.date;
      const t = (T - ya) / (yb - ya);
      const xCross = new Date(ta + t * (tb - ta));
      const cross = {...a, date: xCross, thirtyDayGeoMean: T};

      cur.push(cross);
      if (cur.length) segs.push(cur);
      cur = [];

      if (bAbove) {
        // start new segment with crossing point
        cur.push(cross);
      }
    }
  }

  if (y(data.at(-1)) >= T) cur.push(data.at(-1));
  if (cur.length) segs.push(cur);

  return segs;
}
