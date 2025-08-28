/*

Status evaluation helpers for Safe To Swim app

- status evaluation (geomean, p90)
- status computation for all stations
- status time series for a station
- etc.

Author: Chloe Cheng

*/

import { toDate, getCriteria, getSaltwaterFlags } from "./modules.js";

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

// --- selectTypeRules (fallbacks) ---
export function selectTypeRules(criteria, { isSaltwater }) {
  const c = criteria || {};
  const wb = c.rules?.waterbody_types?.[isSaltwater ? "saltwater" : "freshwater"] || {};
  return {
    low_risk: wb.low_risk || c.rules?.default?.low_risk || {},  // NEW fallback
    else_status: wb.else_status || c.rules?.default?.status
  };
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



// ==== utilities ====
const MS_PER_DAY = 86400000;
const toDayIndex = (ts) => Math.floor(ts / MS_PER_DAY);
const fromDayIndex = (d) => new Date(d * MS_PER_DAY);

function cumsum(src) {
  const n = src.length, out = new Float64Array(n + 1);
  // out[0] = 0
  for (let i = 0; i < n; i++) out[i + 1] = out[i] + src[i];
  return out; // length n+1, inclusive prefix sums
}
function windowSum(prefix, i0, i1) {
  // inclusive window on [i0, i1], with clamping
  const a = Math.max(0, Math.min(i0, prefix.length - 2));
  const b = Math.max(0, Math.min(i1 + 1, prefix.length - 1));
  if (b <= a) return 0;
  return prefix[b] - prefix[a];
}

const canonicalizeReasons = (arr) =>
  (arr ?? [])
    .filter(Boolean)
    .map((s) => String(s).trim())
    .filter((s) => s.length)
    .sort((a, b) => a.localeCompare(b))
    .join("|");

// ==== main ====
export async function buildStatusSeriesForStation(stationRecord) {
  const code = stationRecord?.[0]?.StationCode;
  const [criteria, saltFlags] = await Promise.all([getCriteria(), getSaltwaterFlags()]);
  const isSaltwater = saltFlags.get(code) ?? false;

  const analyte   = pickAnalyteForEnvironment(stationRecord, isSaltwater, criteria);
  const typeRules = selectTypeRules(criteria, { isSaltwater, analyte });

  // windows used by your evaluator (keep in sync with criteria semantics)
  const W6  = 42; // six weeks: geomean + min samples
  const W30 = 30; // 30 days: p90

  // build sample list (ts or SampleDate) and exclude ddPCR like your old computeWindowMetrics
  const raw = (stationRecord || [])
    .filter(r => r?.Analyte === analyte && r?.Result != null && (Number.isFinite(r?.ts) || r?.SampleDate))
    .map(r => {
      const ts = Number.isFinite(r?.ts) ? r.ts : Date.parse(r.SampleDate);
      return {
        day: Number.isFinite(ts) ? toDayIndex(ts) : NaN,
        val: +r.Result,
        method: (r.MethodName ?? "").toLowerCase()
      };
    })
    .filter(s => Number.isFinite(s.day) && Number.isFinite(s.val));

  // exclude ddPCR rows to keep culture-only thresholds consistent
  const samples = raw.filter(s => !s.method.includes("ddpcr"));

  const todayIdx = toDayIndex(Date.now());

  // handle no analyte or no samples -> not enough data today
  if (analyte == null || samples.length === 0) {
    const status = criteria?.statuses?.not_enough_data;
    return [{
      date: fromDayIndex(todayIdx),
      status,
      status_name: status?.name ?? null,
      metrics: { sampleCount6W: 0, geoMean6W: NaN, p90_30d: NaN, manualClosureFlag: false },
      reasons: [],
      reasonsKey: "",
      reasonStr: "No specific reason"
    }];
  }

  // determine day range
  let minDay = samples[0].day, maxDay = samples[0].day;
  for (let i = 1; i < samples.length; i++) {
    const d = samples[i].day;
    if (d < minDay) minDay = d;
    if (d > maxDay) maxDay = d;
  }
  const startDay = minDay - (W6 - 1);                 // so early windows are defined
  const endDay   = Math.max(maxDay, todayIdx);        // compute through today
  const N        = endDay - startDay + 1;             // number of daily slots
  const offset   = -startDay;                         // map day -> index via (day + offset)

  // per-day arrays for 6w metrics (counts, log-sum of positives)
  const countPerDay     = new Float64Array(N);
  const posCountPerDay  = new Float64Array(N);
  const logSumPerDay    = new Float64Array(N);

  // also track range for p90 binning
  let vmin = +Infinity, vmax = -Infinity;

  for (const { day, val } of samples) {
    const j = day + offset;
    countPerDay[j] += 1;
    if (val > 0) { posCountPerDay[j] += 1; logSumPerDay[j] += Math.log(val); }
    if (val < vmin) vmin = val;
    if (val > vmax) vmax = val;
  }

  // prefix sums → O(1) rolling 6w aggregates
  const P_count  = cumsum(countPerDay);
  const P_poscnt = cumsum(posCountPerDay);
  const P_logsum = cumsum(logSumPerDay);

  function metrics6wAtIndex(j) {
    const j0 = j - (W6 - 1);
    const sampleCount6W = windowSum(P_count,  j0, j);
    const posCnt6W      = windowSum(P_poscnt, j0, j);
    const logSum6W      = windowSum(P_logsum, j0, j);
    const geoMean6W     = (posCnt6W > 0) ? Math.exp(logSum6W / posCnt6W) : NaN;
    return { sampleCount6W, geoMean6W };
  }

  // vectorized p90 via day×bin histograms with rolling box filter
  const USE_LOG_BINS = true;
  const BINS = 96; // 64–128 is a good range

  // guard degenerate/invalid ranges
  if (!Number.isFinite(vmin) || !Number.isFinite(vmax) || vmin === vmax) {
    const base = Number.isFinite(vmin) ? vmin : 1;
    vmin = 0.5 * base; vmax = 1.5 * base;
  }

  const toBin = USE_LOG_BINS
    ? ((x) => {
        const lx = Math.log(Math.max(x, 1e-12));
        const l0 = Math.log(Math.max(vmin, 1e-12));
        const l1 = Math.log(Math.max(vmax, 1e-12));
        const t = (lx - l0) / (l1 - l0);
        return Math.max(0, Math.min(BINS - 1, Math.floor(t * BINS)));
      })
    : ((x) => {
        const t = (x - vmin) / (vmax - vmin);
        return Math.max(0, Math.min(BINS - 1, Math.floor(t * BINS)));
      });

  // day×bin matrix as array of bins (typed arrays of length N)
  const H = Array.from({ length: BINS }, () => new Float64Array(N));
  for (const { day, val } of samples) {
    const j = day + offset;
    H[toBin(val)][j] += 1;
  }
  const Pbin = H.map(cumsum); // each prefix is length N+1

  function p90_30d_atIndex(j) {
    const j0 = j - (W30 - 1);
    const total = windowSum(P_count, j0, j);  // exact 30d sample count
    if (total <= 0) return NaN;

    const target = 0.9 * total;
    let acc = 0, b = 0;
    for (; b < BINS; b++) {
      acc += windowSum(Pbin[b], j0, j);
      if (acc >= target) break;
    }

    if (USE_LOG_BINS) {
      const l0 = Math.log(Math.max(vmin, 1e-12));
      const l1 = Math.log(Math.max(vmax, 1e-12));
      const t  = (b + 0.5) / BINS;
      return Math.exp(l0 + t * (l1 - l0));
    } else {
      const t = (b + 0.5) / BINS;
      return vmin + t * (vmax - vmin);
    }
  }

  // sweep days once; emit change-points by (status, reasonsKey)
  const out = [];
  let prevKey = null;

  for (let j = 0; j < N; j++) {
    const day = j + startDay;
    if (day > todayIdx) break;

    const { sampleCount6W, geoMean6W } = metrics6wAtIndex(j);
    const p90_30d = p90_30d_atIndex(j);

    const metrics = {
      sampleCount6W,
      geoMean6W,
      p90_30d,
      manualClosureFlag: false // hook up if you have such a flag per day
    };

    let status = evaluateStatusFromMetrics(
      metrics,
      // robust fallback if env missing low_risk:
      { low_risk: typeRules.low_risk || criteria?.rules?.default?.low_risk || {}, else_status: typeRules.else_status },
      criteria
    ) || criteria?.statuses?.not_enough_data;

    const reasons = status?._reasons ?? metrics?._reasons ?? [];
    const reasonsKey = canonicalizeReasons(reasons);
    const key = `${status?.name ?? status?.status_name ?? ""}||${reasonsKey}`;

    if (!out.length || key !== prevKey) {
      out.push({
        date: fromDayIndex(day),
        status,
        status_name: status?.name ?? null,
        metrics,
        reasons,
        reasonsKey,
        reasonStr: reasons.length ? reasons.join("\n") : "No specific reason"
      });
      prevKey = key;
    }
  }

  // ensure last point is exactly today
  const lastIdx = toDayIndex(out[out.length - 1].date.getTime());
  if (lastIdx !== todayIdx) {
    out.push({ ...out[out.length - 1], date: fromDayIndex(todayIdx) });
  }

  return out;
}

