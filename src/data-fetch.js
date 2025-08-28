/*

Data fetching for Safe To Swim app

- load all stations at startup (meta + recent results)
- station-specific fetch (with caching, windowing, analyte filtering)

Author: Chloe Cheng

*/

import { DATASETS, DEFAULT_RESOURCE_ID } from "./data/data-config.js";

// ##### Startup fetch ######

// load meta + recent results for all stations
async function sql(endpoint) {
  const res = await fetch(
    `https://data.ca.gov/api/3/action/datastore_search_sql?sql=${encodeURIComponent(endpoint)}`
  );
  const j = await res.json();
  return j.result?.records ?? [];
}

export async function loadAllStationsAtStartup({
  windowDays = 42,
  analytes = ["Enterococcus", "E. coli"]
} = {}) {
  // Process datasets in priority order (1 = most recent first),
  // so recent metadata wins and older only fills blanks.
  const ordered = DATASETS.slice().sort((a, b) => a.priority - b.priority);

  const registry = new Map(); // StationCode -> merged object
  const since = new Date(); since.setDate(since.getDate() - windowDays);
  const sinceISO = since.toISOString().slice(0, 10);
  const analyteList = analytes.map(a => `'${a}'`).join(",");

  for (const ds of ordered) {
    const id = ds.id;

    // 1) meta
    const metaQ = `
      SELECT DISTINCT "StationCode","StationName","TargetLatitude","TargetLongitude"
      FROM "${id}"
    `;
    // 2) last sample date
    const lastQ = `
      SELECT "StationCode", MAX("SampleDate") AS "LastSampleDate"
      FROM "${id}"
      GROUP BY "StationCode"
    `;
    // 3) total count
    const countQ = `
      SELECT "StationCode", COUNT(*)::INT AS "TotalCount"
      FROM "${id}"
      GROUP BY "StationCode"
    `;
    // 4) recent window (for latest/recentResults)
    const recentQ = `
      SELECT "StationCode","SampleDate","Analyte","Unit","Result","6WeekGeoMean","6WeekCount","MethodName"
      FROM "${id}"
      WHERE "SampleDate" >= '${sinceISO}' AND "Analyte" IN (${analyteList})
    `;

    const [metaRows, lastRows, countRows, recentRows] = await Promise.all([
      sql(metaQ), sql(lastQ), sql(countQ), sql(recentQ)
    ]);

    const lastBy = Object.fromEntries(lastRows.map(r => [r.StationCode, r.LastSampleDate || null]));
    const countBy = Object.fromEntries(countRows.map(r => [r.StationCode, Number(r.TotalCount) || 0]));

    // group recent rows per station for this dataset
    const recentBy = new Map();
    for (const r of recentRows) {
      const arr = recentBy.get(r.StationCode) ?? [];
      arr.push(r);
      recentBy.set(r.StationCode, arr);
    }

    // merge into registry
    for (const m of metaRows) {
      const code = m.StationCode;
      const prev = registry.get(code);
      const entry = prev ?? {
        StationCode: code,
        StationName: null,
        TargetLatitude: null,
        TargetLongitude: null,
        lastSampleDate: null,
        totalDataPoints: 0,
        datasets: [],
        latest: null,
        recentResults: []
      };

      // prefer most recent dataset's meta
      if (entry.StationName == null && m.StationName != null) entry.StationName = m.StationName;
      if (entry.TargetLatitude == null && m.TargetLatitude != null) entry.TargetLatitude = +m.TargetLatitude;
      if (entry.TargetLongitude == null && m.TargetLongitude != null) entry.TargetLongitude = +m.TargetLongitude;

      // update last date & counts
      const ld = lastBy[code] ?? null;
      if (!entry.lastSampleDate || (ld && ld > entry.lastSampleDate)) entry.lastSampleDate = ld;
      entry.totalDataPoints += countBy[code] ?? 0;

      // dataset tag
      if (!entry.datasets.includes(ds.label)) entry.datasets.push(ds.label);

      // add any recent rows from this dataset
      const rec = recentBy.get(code) ?? [];
      if (rec.length) {
        for (const r of rec) {
          entry.recentResults.push({
            SampleDate: r.SampleDate,
            Analyte: r.Analyte,
            Unit: r.Unit,
            Result: r.Result,
            MethodName: r.MethodName ?? null
          });
          if (!entry.latest || r.SampleDate > entry.latest.SampleDate) {
            entry.latest = r;
          }
        }
      }

      registry.set(code, entry);
    }
  }

  return Object.fromEntries(registry.entries());
}

// ##### Station-specific fetch #####

const ANALYTES = ["Enterococcus", "E. coli"];
const RESULT_SCALE = 1e6;

function orderedDatasets() {
  return DATASETS.slice().sort((a, b) => a.priority - b.priority);
}
function sinceISO(years = 5) {
  const d = new Date(); d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}
const esc = s => String(s).replace(/'/g, "''");

// SQL fetcher: from timecutoff (>= since) or all (since=null)
async function sqlFetchStation(resourceId, stationCode, { signal, analytes = ANALYTES, since = null }) {
  const list = analytes.map(a => `'${esc(a)}'`).join(",");
  const whereSince = since ? `AND "SampleDate" >= '${since}'` : "";
  const sql = `
    SELECT "StationCode","SampleDate","Analyte","Unit","Result","6WeekGeoMean","6WeekCount","MethodName"
    FROM "${resourceId}"
    WHERE "StationCode"='${esc(stationCode)}'
      AND "Analyte" IN (${list})
      ${whereSince}
    ORDER BY "SampleDate" ASC
  `;
  const url = `https://data.ca.gov/api/3/action/datastore_search_sql?sql=${encodeURIComponent(sql)}`;
  const resp = await fetch(url, { signal });
  const json = await resp.json();
  return json.result?.records ?? [];
}

// SQL fetcher: older slice only (< cutoff)
async function sqlFetchStationOlder(resourceId, stationCode, { signal, analytes = ANALYTES, olderThan }) {
  const list = analytes.map(a => `'${esc(a)}'`).join(",");
  const sql = `
    SELECT "StationCode","SampleDate","Analyte","Unit","Result","6WeekGeoMean","6WeekCount","MethodName"
    FROM "${resourceId}"
    WHERE "StationCode"='${esc(stationCode)}'
      AND "Analyte" IN (${list})
      AND "SampleDate" < '${olderThan}'
    ORDER BY "SampleDate" ASC
  `;
  const url = `https://data.ca.gov/api/3/action/datastore_search_sql?sql=${encodeURIComponent(sql)}`;
  const resp = await fetch(url, { signal });
  const json = await resp.json();
  return json.result?.records ?? [];
}

function normalizeRow(r, sourceLabel) {
  const t = Date.parse(r.SampleDate);
  return {
    StationCode: r.StationCode,
    SampleDate: r.SampleDate,
    ts: Number.isFinite(t) ? t : null,
    Analyte: r.Analyte,
    Unit: r.Unit,
    Result: r.Result != null ? +r.Result : null,
    "6WeekGeoMean": r["6WeekGeoMean"] != null ? +r["6WeekGeoMean"] : null,
    "6WeekCount": r["6WeekCount"] != null ? +r["6WeekCount"] : null,
    MethodName: r.MethodName ?? null,
    _source: sourceLabel
  };
}

function sameKey(a, b) {
  return (
    a.StationCode === b.StationCode &&
    a.SampleDate === b.SampleDate &&
    a.Analyte === b.Analyte &&
    a.Unit === b.Unit &&
    (a.MethodName ?? null) === (b.MethodName ?? null) &&
    Math.round((a.Result ?? NaN) * RESULT_SCALE) === Math.round((b.Result ?? NaN) * RESULT_SCALE)
  );
}

// merge multiple already-sorted lists, de-duping between resources
function mergeSortedLists(lists) {
  if (lists.length === 1) return lists[0];
  const idx = Array(lists.length).fill(0);
  const out = [];
  let last = null;
  for (;;) {
    let k = -1, best = null;
    for (let i = 0; i < lists.length; i++) {
      const arr = lists[i], j = idx[i];
      if (j >= arr.length) continue;
      const cur = arr[j];
      if (!best) { best = cur; k = i; continue; }
      const ta = cur.ts ?? Date.parse(cur.SampleDate);
      const tb = best.ts ?? Date.parse(best.SampleDate);
      if (ta < tb) { best = cur; k = i; }
    }
    if (k === -1) break;
    const next = lists[k][idx[k]++];
    if (!last || !sameKey(last, next)) { out.push(next); last = next; }
  }
  return out;
}

// --- cache keys now include analytes to avoid collisions
const _cache = new Map();    // key -> rows
const _inflight = new Map(); // key -> Promise

function analyteKeyOf(analytes) { return (analytes ?? []).join(","); }

/** find a cached WINDOW that is a superset of the requested cutoff (same scope+analytes). */
function findSupersetWindowKey({ scope, stationCode, cutoffISO, analyteKey }) {
  // choose the CLOSEST longer window (largest sinceKey <= cutoff) to minimize filtering work
  let bestKey = null;
  let bestSince = null;
  for (const k of _cache.keys()) {
    // format: `${scope}|${sinceKey}|a=${analyteKey}|${stationCode}`
    if (!k.endsWith(`|${stationCode}`)) continue;
    if (!k.startsWith(`${scope}|`)) continue;
    if (!k.includes(`|a=${analyteKey}|`)) continue;
    const parts = k.split("|");
    const sinceKey = parts[1]; // "ALL" or ISO
    if (sinceKey === "ALL") continue; // handled elsewhere
    // ISO dates compare lexicographically
    if (sinceKey <= cutoffISO && (bestSince == null || sinceKey > bestSince)) {
      bestSince = sinceKey;
      bestKey = k;
    }
  }
  return bestKey;
}

export async function stationRecordFetch(
  stationCode,
  { signal, recentOnly = false, timePreset = "window", sinceYears = 5, analytes = ["Enterococcus", "E. coli"] } = {}
) {
  if (!stationCode || stationCode.trim() === "") return [];

  const datasets = orderedDatasets();
  const list = recentOnly ? [datasets[0]] : datasets;

  // cutoff for window requests (ISO yyyy-mm-dd)
  const cutoffISO = (() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - sinceYears);
    return d.toISOString().slice(0, 10);
  })();
  const scope = recentOnly ? "recent" : "all";
  const aKey  = analyteKeyOf(analytes);

  const allKey  = `${scope}|ALL|a=${aKey}|${stationCode}`;
  const winKey  = `${scope}|${cutoffISO}|a=${aKey}|${stationCode}`;
  const cacheKey = timePreset === "all" ? allKey : winKey;

  // direct cache/inflight hits
  if (_cache.has(cacheKey)) return _cache.get(cacheKey);
  if (_inflight.has(cacheKey)) return _inflight.get(cacheKey);

  // ===== Reuse paths to avoid refetching =====

  // (A) WINDOW requested: derive from ALL if available
  if (timePreset === "window" && _cache.has(allKey)) {
    const fromAll = _cache.get(allKey).filter(r => (r.ts ?? Date.parse(r.SampleDate)) >= Date.parse(cutoffISO));
    _cache.set(winKey, fromAll);
    return fromAll;
  }
  // Piggyback if ALL is currently loading
  if (timePreset === "window" && _inflight.has(allKey)) {
    const p = _inflight.get(allKey).then(rows => {
      const subset = rows.filter(r => (r.ts ?? Date.parse(r.SampleDate)) >= Date.parse(cutoffISO));
      _cache.set(winKey, subset);
      return subset;
    });
    _inflight.set(winKey, p);
    return await p;
  }

  // (B) WINDOW requested: derive from any LONGER window in cache (e.g., 5y → 1y)
  if (timePreset === "window") {
    const supKey = findSupersetWindowKey({ scope, stationCode, cutoffISO, analyteKey: aKey });
    if (supKey) {
      const sup = _cache.get(supKey);
      const subset = sup.filter(r => (r.ts ?? Date.parse(r.SampleDate)) >= Date.parse(cutoffISO));
      _cache.set(winKey, subset);
      return subset;
    }
  }

  // (C) ALL requested → if a window exists, fetch only the OLDER slice and merge
  if (timePreset === "all" && _cache.has(winKey)) {
    const olderParts = await Promise.all(
      list.map(ds =>
        sqlFetchStationOlder(ds.id, stationCode, { signal, analytes, olderThan: cutoffISO })
          .then(rows => rows.map(r => normalizeRow(r, ds.label)))
      )
    );
    const merged = mergeSortedLists([...olderParts, _cache.get(winKey)]);
    _cache.set(allKey, merged);
    // backfill window if missing (helps future toggles)
    if (!_cache.has(winKey)) {
      const subset = merged.filter(r => (r.ts ?? Date.parse(r.SampleDate)) >= Date.parse(cutoffISO));
      _cache.set(winKey, subset);
    }
    return merged;
  }

  // ===== Network fetch fallbacks =====
  const since = (timePreset === "window") ? cutoffISO : null;
  const p = (async () => {
    const parts = await Promise.all(
      list.map(ds =>
        sqlFetchStation(ds.id, stationCode, { signal, analytes, since })
          .then(rows => rows.map(r => normalizeRow(r, ds.label)))
      )
    );
    const merged = mergeSortedLists(parts);
    _cache.set(cacheKey, merged);

    // cross-fill: if we fetched ALL, also seed the window; if we fetched WINDOW, no need to seed ALL
    if (timePreset === "all" && !_cache.has(winKey)) {
      const subset = merged.filter(r => (r.ts ?? Date.parse(r.SampleDate)) >= Date.parse(cutoffISO));
      _cache.set(winKey, subset);
    }
    return merged;
  })();

  _inflight.set(cacheKey, p);
  try {
    return await p;
  } finally {
    _inflight.delete(cacheKey);
  }
}