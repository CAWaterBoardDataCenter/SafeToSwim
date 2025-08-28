// Generic helpers 

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

function toDate(d) { 
  const t=new Date(d); 
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
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
// Safe default for the options bag so destructuring never throws
export function computeWindowMetrics(records, asOfDate, opts = {}) {
  const { indicatorAnalyte = null } = opts;

  const asOf = toDate(asOfDate);
  const msPerDay = 24 * 3600 * 1000;

  const isValid = (r) => {
    if (!r) return false;

    // exclude ddPCR (be tolerant of null/undefined MethodName)
    const method = (r.MethodName ?? "").toString().toLowerCase();
    if (method.includes("ddpcr")) return false;

    // only keep matching indicator bacteria (exact string match)
    if (indicatorAnalyte && r.Analyte !== indicatorAnalyte) return false;

    return true;
  };

  const inLast = (r, days) => {
    const dt = toDate(r.SampleDate);
    return dt <= asOf && (asOf - dt) <= days * msPerDay;
  };

  const filterWindow = (days) => records.filter(r => isValid(r) && inLast(r, days));

  // 42-day window (geomean + count)
  const sixW = filterWindow(42);
  const sixWVals = sixW.map(r => +r.Result).filter(Number.isFinite);

  // 30-day window (p90 + count)
  const thirtyD = filterWindow(30);
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

// daily status grid
export async function buildStatusSeriesForStation(stationRecord) {
  const code = stationRecord?.[0]?.StationCode;
  const [criteria, saltFlags] = await Promise.all([getCriteria(), getSaltwaterFlags()]);
  const isSaltwater = saltFlags.get(code) ?? false;

  const analyte   = pickAnalyteForEnvironment(stationRecord, isSaltwater, criteria);
  const typeRules = selectTypeRules(criteria, { isSaltwater, analyte });

  // helpers
  const toDay = (d) => toDate(d);
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return toDay(x); };
  const canonicalizeReasons = (arr) =>
    (arr ?? [])
      .filter(Boolean)
      .map(s => String(s).trim())
      .filter(s => s.length)         // drop empty after trim
      .sort((a,b) => a.localeCompare(b))
      .join("|");                    // order-insensitive key

  const windowDays = typeRules?.window_days ?? criteria?.rules?.default?.window_days ?? 30;

  // normalize & sort records
  const recs = (stationRecord || [])
    .filter(r => r?.Analyte === analyte && r?.SampleDate != null)
    .map(r => ({ ...r, SampleDate: toDay(r.SampleDate) }))
    .sort((a,b) => a.SampleDate - b.SampleDate);

  const today = toDay(new Date());
  const firstSample = recs.length ? recs[0].SampleDate : today;
  const start = addDays(firstSample, -(windowDays - 1));

  // 1) daily grid
  const daily = [];
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const m = computeWindowMetrics(recs, d);
    let status = evaluateStatusFromMetrics(m, typeRules, criteria) || criteria?.statuses?.not_enough_data;

    // pull reasons from status or metrics (whichever your evaluator populates)
    const reasons = status?._reasons ?? m?._reasons ?? [];
    const reasonsKey = canonicalizeReasons(reasons);

    daily.push({
      date: d,
      status,
      status_name: status?.name ?? null,
      metrics: m,
      reasons,
      reasonsKey,
      reasonStr: reasons.length ? reasons.join("\n") : "No specific reason"
    });
  }

  // 2) compress to change points by (status, reasonsKey)
  const keyOf = (row) => `${row.status?.name ?? row.status_name ?? ""}||${row.reasonsKey}`;
  const base = [];
  for (let i = 0; i < daily.length; i++) {
    if (i === 0 || keyOf(daily[i]) !== keyOf(daily[i - 1])) base.push(daily[i]);
  }

  // ensure last point is today
  if (!base.length || +toDay(base[base.length - 1].date) !== +today) {
    base.push(daily[daily.length - 1]);
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
  // Treat only culture-method samples of the indicator analyte
  const isCulture = (r) => !((r.MethodName ?? "").toString().toLowerCase().includes("ddpcr"));

  // 1) Filter to indicator analyte AND exclude ddPCR; normalize dates
  const recs = (stationRecord || [])
    .filter(r => r && r.Analyte === analyte && r.SampleDate != null && isCulture(r))
    .map(r => ({ ...r, SampleDate: toDate(r.SampleDate) })) // normalize to midnight
    .sort((a, b) => a.SampleDate - b.SampleDate);

  if (recs.length === 0) return [];

  // 2) Unique culture-sample dates only (ascending)
  const asOfDates = Array.from(new Set(recs.map(r => +r.SampleDate)))
    .sort((a, b) => a - b)
    .map(t => new Date(t));

  // 3) Evaluate metrics + status per as-of date (metrics also exclude ddPCR)
  return asOfDates.map(asOf => {
    const metrics = computeWindowMetrics(recs, asOf, { indicatorAnalyte: analyte });
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
    // normalize salt flag (handles boolean true or string "True")
    const saltFlag = saltFlags.get(code);
    const isSalt = saltFlag === true || (typeof saltFlag === "string" && saltFlag.toLowerCase() === "true");

    // environment-specific rules
    const typeRules = criteria?.rules?.waterbody_types?.[isSalt ? "saltwater" : "freshwater"] ?? {};

    // pull indicator analyte from rules; fall back to convention if missing
    const indicatorAnalyte =
      typeRules?.bacteria ?? (isSalt ? "Enterococcus" : "E. coli");

    // compute metrics restricted to:
    //  - non-ddPCR
    //  - indicator analyte for this environment
    const metrics = computeWindowMetrics(records ?? [], asOf, { indicatorAnalyte });

    // evaluate status using the thresholds in typeRules
    out.set(code, evaluateStatusFromMetrics(metrics, typeRules, criteria));
  }

  return out;
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
  const single_sample =
    env?.low_risk?.p90_30day?.max ?? null;

  return {
    isSaltwater,
    bacteria,
    thresholds: {
      geomean,
      single_sample
    }
  };
}

// envSpec helper
function envSpec(criteria, envKey) {
  const env = criteria?.rules?.waterbody_types?.[envKey] || {};
  return {
    analyteKey: env?.bacteria,  // "Enterococcus" / "E. coli"
    thresholds: {
      geomean: env?.low_risk?.six_week_geomean?.max ?? null,
      single_sample: env?.low_risk?.p90_30day?.max ?? null,
      min_samples_six_week: env?.low_risk?.min_samples_six_week ?? null
    }
  };
}

export async function getAllThresholds() {
  const criteria = await getCriteria();
  const salt = envSpec(criteria, "saltwater");
  const fresh = envSpec(criteria, "freshwater");

  const out = {};
  if (salt.analyteKey) out[salt.analyteKey] = salt.thresholds;
  if (fresh.analyteKey) out[fresh.analyteKey] = fresh.thresholds;

  return out;
}

// convenience
export function thresholdsFor(all, analyte) {
  return all?.[analyte] ?? null;
}

//  Slice a timeseries into contiguous segments where y(d) >= T,
//  inserting exact crossing points at the threshold.
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
      const cross = {...a, date: xCross, sixWeekGeoMean: T};

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


export function isWithinWeeks(isoDateStr, weeks = 6, today = new Date()) {
  if (!isoDateStr) return false;
  const d = new Date(isoDateStr);
  if (isNaN(+d)) return false;

  // Compare by UTC calendar day to avoid TZ wobble
  const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const cutoff = new Date(utcToday);
  cutoff.setUTCDate(cutoff.getUTCDate() - weeks * 7);

  return d >= cutoff;
}

export function isDdPCR(row) {
  const method = (row?.MethodName ?? "").toString().toLowerCase();
  const unit = (row?.Unit ?? "").toString().toLowerCase();

  if (method.includes("ddpcr") || method.includes("digital pcr")) return true;
  // fallback heuristics based on typical ddPCR units
  if (unit.includes("copies") || unit.includes("gc/") || unit.includes("gene") || unit.includes("cn/")) return true;

  return false;
}