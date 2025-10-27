/*

Utility functions for Safe To Swim app

- data loading (criteria, saltwater flags)
- date formatting
- station name formatting
- status color mapping
- station assessment spec (saltwater, bacteria, thresholds)
- threshold lookup
- segmentsAboveThreshold (for plotting)
- etc.

Author: Chloe Cheng

*/

import {FileAttachment} from "observablehq:stdlib";

// Helpers: get criteria and saltwater flags (cached)

let _criteriaPromise = null;
let _saltFlagsPromise = null;

export async function getCriteria() {
  if (!_criteriaPromise) {
    _criteriaPromise = FileAttachment("data/criteria.json").json();
  }
  return _criteriaPromise;
}
export async function getSaltwaterFlags() {
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

// Misc helpers

export function toDate(d) {
  const t = new Date(d);
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

// Remove leading station code from station name if present
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

// Get mapping of status name to color
export async function getStatusColors() {
  const criteria = await getCriteria();
  const mapping = {};
  for (const [, info] of Object.entries(criteria.statuses)) {
    mapping[info.name] = info.color;
  }
  return mapping;
}

// Get saltwater flag, bacteria, and thresholds for a station
export async function getStationAssessmentSpec(stationCode) {
  if (!stationCode) return { isSaltwater: null, bacteria: null, thresholds: { geomean: null, single_sample: null } };

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

// Get thresholds for both saltwater and freshwater (by analyte)
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

// 10/27/2025 - May not longer need this function after replacing the geomean line plot with a dot point. Keep for reference but may remove in the future
// Slice a timeseries into contiguous segments where y(d) >= T, inserting exact crossing points at the threshold.
/*
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
*/

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

// modules.js
export function initHelpTooltips(root = document) {
  const helps = root.querySelectorAll('.help');

  helps.forEach(el => {
    // Show on keyboard focus as well
    el.setAttribute('tabindex', '0');
    const tip = el.querySelector('.tooltip');
    if (!tip) return;

    const positionSafely = () => {
      // reset to defaults first
      tip.style.left = '50%';
      tip.style.right = 'auto';
      tip.style.transform = 'translateX(-50%)';
      tip.style.bottom = '125%';
      tip.style.top = 'auto';
      tip.style.maxWidth = '260px';

      // measure
      tip.style.visibility = 'hidden';
      tip.style.opacity = '0';
      // force layout by temporarily showing it offscreen-ish
      const rect = tip.getBoundingClientRect();

      // horizontal flip if needed
      if (rect.right > window.innerWidth) {
        tip.style.left = 'auto';
        tip.style.right = '0';
        tip.style.transform = 'none';
      }
      if (rect.left < 0) {
        tip.style.left = '0';
        tip.style.transform = 'none';
      }

      // vertical flip if too close to top
      const newRect = tip.getBoundingClientRect();
      if (newRect.top < 0) {
        // place below the icon
        tip.style.bottom = 'auto';
        tip.style.top = '125%';
        // flip arrow
        tip.style.setProperty('--arrow-dir', 'down');
        tip.classList.add('below');
      } else {
        tip.classList.remove('below');
        tip.style.removeProperty('--arrow-dir');
      }

      // restore visibility controlled by CSS hover/focus
      tip.style.visibility = '';
      tip.style.opacity = '';
    };

    // Position on show events
    el.addEventListener('mouseenter', positionSafely);
    el.addEventListener('focus', positionSafely, true);
  });
}
