---
toc: false
sidebar: false
---

<div class="hero">

  <h1>Safe To Swim Map</h1>

  <h2>The California recreational water quality tool for nerds and adventurers.</h2>

  *This map from the California State Water Resources Control Board shows the latest water quality data to help you make informed decisions about where to swim. See [How to Use](how-to-use) and our [FAQ](faq) for more information.*

</div>

```js
import * as L from "npm:leaflet";
import "npm:leaflet.fullscreen";
import { resize } from "npm:@observablehq/stdlib";

import * as mod from "./modules.js"; // utilities
import * as stat from "./status.js"; // status helpers
import { setSelectedStation, selectedStation } from "./station-state.js"; // station selection

function toDate(d) { 
  const t=new Date(d); 
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}
```

```js
import { loadAllStationsAtStartup } from "./data-fetch.js";

// Fetch all station data (cached after first call)
let stations = await loadAllStationsAtStartup();

const statusesByCode = await stat.computeAllStatuses(
  new Map(Object.entries(stations).map(([code, st]) => [code, st.recentResults]))
);

// Attach status to each station
for (const [code, st] of Object.entries(stations)) {
  st.status = statusesByCode.get(code);
}
```

```js

// Initialize Leaflet map (div is placed later)
const div = document.createElement("div");
div.style = `height: 650px; border-radius: 8px; overflow: hidden; width: ${resize(width)}px;`;

const map = L.map(div, {
  wheelPxPerZoomLevel: 60,
  preferCanvas: true,
  zoomAnimation: true
}).setView([37.5, -120], 6);    // initial view centered on California

map.createPane("historicalPane");
map.getPane("historicalPane").style.zIndex = 385;
map.getPane("historicalPane").style.pointerEvents = "auto";

map.createPane("recentPane");
map.getPane("recentPane").style.zIndex = 395;
map.getPane("recentPane").style.pointerEvents = "auto";

const sharedRenderer = L.canvas({ padding: 0.3 });

// Two groups for z order and toggling between recent vs historical
const recentGroup = L.layerGroup().addTo(map);
const historicGroup = L.layerGroup();        // start hidden
const markerMap = {};

L.control.fullscreen({
  position: "topleft",
  title: "Tip: For best results, put your browser in full screen first",
  titleCancel: "Exit fullscreen"
}).addTo(map);

L.tileLayer("https://api.maptiler.com/maps/dataviz/{z}/{x}/{y}.png?key=VDWZb7VXYyD4ZCvqwBRS", {
  attribution:
    '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'
}).addTo(map);
```

<style>
  .two-col { display:grid; gap:1rem; align-items:stretch; grid-template-columns:1fr; }
  @media (min-width: 900px) { .two-col { grid-template-columns: 2fr 1fr; } }
</style>

<div class="not-prose mx-auto w-full max-w-screen-md two-col">

<div class="card" id="map-card" style="min-height: 600px; margin: 0">

```js
display(div);
map.invalidateSize();
```

```js
const statusColors = await mod.getStatusColors();
const BASE_SIZE = 7;
const SELECTED_SIZE = 10;

// colors & sizes
const BASE_R = 4;
const SELECTED_R = 7;
const HILITE_RING = "rgba(230, 2, 255, 0.85)";
const OUTLINE = "rgba(0,0,0,0.65)";
const OUTLINE_W = 1;

function colorForStation(st) {
  const status = st?.status?.name ?? "unknown";
  return statusColors[status] || statusColors.unknown;
}

function makeDot(code, st) {
  const lat = +st?.TargetLatitude, lon = +st?.TargetLongitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const formattedName = (mod.formatStationName)
    ? mod.formatStationName(st.StationName, code)
    : st.StationName ?? "(unknown)";

  const dot = L.circleMarker([lat, lon], {
    renderer: sharedRenderer,   // <— single canvas
    interactive: true,          // <— must be true for events
    radius: BASE_R,
    stroke: true, color: OUTLINE, weight: OUTLINE_W,
    fillColor: colorForStation(st), fillOpacity: 0.95
  })
    .bindPopup(
      `<b>${formattedName}</b><br>
       Code: ${code}<br>
       Status: ${st.status?.name ?? "unknown"}`
    )
    .on("click", () => { setSelectedStation(code, "map"); highlightSelected(code); })
    .on("mouseover", () => { dot.setStyle({ radius: BASE_R * 1.3 }); dot.bringToFront(); })
    .on("mouseout",  () => { dot.setStyle({ radius: __state.selectedCode===code ? SELECTED_R : BASE_R }); });

  return dot;
}

// Draw all stations as Canvas dots once
function drawStationDots() {
  const today = new Date();

  for (const [code, st] of Object.entries(stations)) {
    const dot = makeDot(code, st);
    if (!dot) continue;

    const isRecent = mod.isWithinWeeks(st?.lastSampleDate ?? null, 6, today);
    (isRecent ? recentGroup : historicGroup).addLayer(dot);
    markerMap[code] = dot;

    if (isRecent) dot.bringToFront(); // ensure recent above historical in the shared canvas
  }

  // safety: bring all recent layers front (e.g., after bulk adds)
  recentGroup.eachLayer(l => l.bringToFront());

  invalidation?.then(() => {
    recentGroup.clearLayers();
    historicGroup.clearLayers();
    for (const k of Object.keys(markerMap)) delete markerMap[k];
  });
}

drawStationDots();

// 6) Toggle helper: show/hide the whole historical group
function setRecentOnly(on) {
  if (on) {
    map.removeLayer(historicGroup);
  } else {
    map.addLayer(historicGroup);
    // reassert recent above historical after re-adding
    recentGroup.eachLayer(l => l.bringToFront());
  }
}

recentOnly; { setRecentOnly(recentOnly); }

// 7) Selection highlighting (ring + bring to front)
const __state = (globalThis.__wbfMapState ??= {});
__state.selectedCode ??= null;

function highlightSelected(code, { pan = true, openPopup = true } = {}) {
  const prev = __state.selectedCode;
  if (prev && prev !== code && markerMap[prev]) {
    markerMap[prev].setStyle({
      radius: BASE_R,
      stroke: true,
      color: OUTLINE,
      weight: OUTLINE_W,
      fillColor: colorForStation(stations[prev])
    });
  }

  __state.selectedCode = code;

  const st  = stations?.[code];
  const dot = markerMap?.[code];
  if (!st || !dot) return;

  dot.setStyle({
    radius: SELECTED_R,
    stroke: true,
    color: HILITE_RING, // ring color
    weight: 3,
    fillColor: colorForStation(st)
  });
  dot.bringToFront(); // top of its pane

  if (pan) {
    const lat = +st.TargetLatitude, lon = +st.TargetLongitude;
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      map.setView([lat, lon], map.getZoom(), { animate: true });
    }
  }
  if (openPopup) dot.openPopup();
}

recentOnly; // reactive
{
  setRecentOnly(recentOnly);
}
```

```js
// Reset highlighted station
selectedStation;
{
  const code = selectedStation?.code ?? selectedStation ?? null;
  if (code && stations?.[code] && markerMap?.[code]) {
    highlightSelected(code, { pan: true, openPopup: true });
  }
}
```

```js
// LEGEND
// 1) Lightweight CSS (once)
let legendStyleEl = document.getElementById("map-legend-style");
if (!legendStyleEl) {
  legendStyleEl = document.createElement("style");
  legendStyleEl.id = "map-legend-style";
  legendStyleEl.textContent = `
    .leaflet-control.legend {
      background: rgba(255,255,255,0.9);
      padding: 8px 10px;
      border-radius: 6px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.25);
      font: 12px/1.3 system-ui, Arial, sans-serif;
    }
    .legend-title {
      font-weight: 600;
      margin-bottom: 6px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 4px 0;
      white-space: nowrap;
    }
    .legend-swatch {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      box-sizing: border-box;
      border: 2px solid currentColor;
    }
  `;
  document.head.appendChild(legendStyleEl);
}

// 2) Build the legend control
const LegendControl = L.Control.extend({
  options: { position: "bottomright", title: "Status" },
  onAdd: function () {
    const div = L.DomUtil.create("div", "leaflet-control legend");
    // prevent map drag when interacting with legend
    L.DomEvent.disableClickPropagation(div);

    // Explicit whitelist + order
    const legendItems = ["Low risk", "Use caution", "Not enough data"];

    const itemsHtml = legendItems.map(label => `
      <div class="legend-item" style="color:${statusColors[label]}">
        <span class="legend-swatch"></span>
        <span>${label}</span>
      </div>
    `).join("");

    div.innerHTML = `
      <div class="legend-title">${this.options.title}</div>
      ${itemsHtml}
    `;
    return div;
  }
});

// 3) Add to map
const legendCtl = new LegendControl({ title: "Safety status", position: "bottomleft" });
map.addControl(legendCtl);

invalidation?.then(() => {
  if (legendCtl) map.removeControl(legendCtl);
});
```

</div>

<div style="
    display: grid;
    gap: 1rem;
    grid-template-rows: auto 1fr; /* top card auto height, bottom fills */
    height: 100%; /* match left card's height */
">

  <div class="card" id="search-card" style="margin: 0;"><h1>Find stations</h1>

  ```js
  const recentOnly = view(
    Inputs.toggle({
      label: "Recent data only (last 6 weeks)",
      value: true
    })
  );
  ``` 

  ```js
  stations; // reactive
  const today = new Date();
  const hasRecent = new Map(
    Object.entries(stations || {}).map(([code, st]) => [
      code,
      mod.isWithinWeeks(st?.lastSampleDate ?? null, 6, today)
    ])
  );
  ```

  ```js
  function updateMarkerVisibility({ recentOnly, hasRecent, markerMap }) {
    if (!markerMap) return;
    for (const [code, marker] of Object.entries(markerMap)) {
      // keep if toggle is off OR station is recent
      const visible = !recentOnly || hasRecent.get(code) || code === selectedStation?.code;
      // Fast + simple: hide the marker
      const el = marker.getElement?.();
      if (el) {
        el.style.display = visible ? "" : "none";
        el.style.pointerEvents = visible ? "" : "none";
      }
    }
  }

  recentOnly; hasRecent; markerMap; // make reactive
  {
    updateMarkerVisibility({ recentOnly, hasRecent, markerMap });

    // (Optional) show a tiny summary
    const total = markerMap ? Object.keys(markerMap).length : 0;
    const visible = markerMap
      ? Object.keys(markerMap).filter(c => !recentOnly || hasRecent.get(c)).length
      : 0;
  }
  ```

  ```js
  // build station options for search
  const stationOptions = Object.entries(stations ?? {}).map(([code, st]) => {
    const name = mod?.formatStationName
      ? mod.formatStationName(st.StationName, code)
      : (st?.StationName ?? "(unknown)");
    return { code, name, label: `${name} (${code})` };
  });

  // filter input
  const filterBox = view(Inputs.text({ placeholder: "Filter by name or code", width: "100%" }));
  ```

  ```js
  // filtered select
  {
    const q = String(filterBox ?? "").trim().toLowerCase();
    const recentFlag = !!recentOnly; // value from the toggle

    // Start from recent-filtered base if needed
    const base = recentFlag
      ? stationOptions.filter(d => hasRecent.get(d.code))
      : stationOptions;

    // Then apply the text filter
    const matches = q
      ? base.filter(d =>
          d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q)
        )
      : base;

    // select menu (multiple rows, single selection)
    const sel = Inputs.select(matches, {
      multiple: 6,                    // show n rows
      format: d => d.label,
      width: "100%"
    });
    display(sel);

    // update selected station on change
    const onChange = () => {
      const first = (sel.value ?? [])[0] ?? null;
      if (first) setSelectedStation(first.code, "filter-select");
    };
    sel.addEventListener?.("input", onChange);
    invalidation?.then?.(() => sel.removeEventListener?.("input", onChange));
  }
  ```

  </div>

  <div class="card" id="station-info-card" style="margin: 0;">

  ```js
  selectedStation;

  const code = selectedStation?.code;
  let meta = null;

  if (code && stations && stations[code]) {
    const st = stations[code];

    const formattedName = (mod.formatStationName)
      ? mod.formatStationName(st.StationName, code)
      : st.StationName;

    // last sample date (string -> Date -> YYYY-MM-DD)
    const lastSampleDateISO = st.lastSampleDate || null;
    const lastSampleDateObj = lastSampleDateISO ? new Date(lastSampleDateISO) : null;
    const lastSampleDate =
      lastSampleDateObj && !isNaN(+lastSampleDateObj)
        ? lastSampleDateObj.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric"
          })
        : null;

    meta = {
      formattedName,
      code,
      lat: st.TargetLatitude != null ? +st.TargetLatitude : null,
      lon: st.TargetLongitude != null ? +st.TargetLongitude : null,
      lastSampleDate,
      totalDataPoints: st.totalDataPoints ?? 0,
      recentDataPoints: st.recentResults.length ?? 0
    };
  }
  ```

  ```js
  meta
    ? html`
        <h1><strong>${meta.formattedName}</strong></h1>
      `
    : html`<h1>Select a station to see details</h1>`
  ```

  ```js
  const code = selectedStation?.code ?? selectedStation;
  const st = stations?.[code];
  const status = st?.status?.name ?? " ";

  // Container for the status info, with background color applied
  const container = document.createElement("div");
  container.style.backgroundColor = statusColors[status] || "lightgray";
  container.style.color = "white";          // make text readable on dark backgrounds
  container.style.padding = "0.5rem 1rem";  // spacing inside
  container.style.borderRadius = "6px";     // optional rounded corners

  container.innerHTML = `
    <br><strong>Status: ${status}</strong><br>
    <br><i>${st?.status?.description ?? "<br>"}</i><br><br>
  `;

  display(container);
  ```

  ```js
  meta
    ? html`
        <p><strong>Station Code:</strong> ${meta.code}</p>
        <p><strong>Lat/Lon:</strong> ${meta.lat.toFixed(5)}, ${meta.lon.toFixed(5)}</p>
        <p><strong>Last sample date:</strong> ${meta.lastSampleDate ?? "—"}</p>
        <p><strong>Samples in last 6 weeks:</strong> ${meta.recentDataPoints}</p>
      `
    : html` `
  ```

  </div>
  </div>
</div>
</div>

<div class="card grid-colspan-3"><h1>Data</h1>

  ```js
  selectedStation; // reactive
  const { isSaltwater, bacteria, thresholds } =
    await mod.getStationAssessmentSpec(selectedStation?.code);
  ```

  ```js
  meta
    ? html`
        <p><i>Showing past results from <strong>${meta.formattedName}</strong>.<br>
        This station is classified as a <strong>${isSaltwater ? "saltwater" : "freshwater"}</strong> station, where status is based on culture samples of the indicator bacteria <strong>${bacteria}.</strong></i></p>
      `
    : html` `
  ```

  ```js
  let analyte = null;

  if (selectedStation) {
    const candidates = Array.from(new Set([bacteria, "Enterococcus", "E. coli"].filter(Boolean)));
    const code = selectedStation?.code;

    const analytesAvailable = stations?.[code]?.analytes ?? [];
    const hasAny = (name) => analytesAvailable.includes(name);
    const disabledValues = candidates.filter(name => !hasAny(name));

    const defaultAnalyte =
      (bacteria && hasAny(bacteria)) ? bacteria :
      (candidates.find(hasAny) ?? candidates[0]);

    analyte = view(
      Inputs.select(candidates, {
        label: "Display data by bacteria",
        value: defaultAnalyte,
        format: v => hasAny(v) ? v : `${v} (no data)`,
        disabled: disabledValues
      })
    );
  } else {
    // optional placeholder text instead of dropdown
    analyte = null;
  }
  ```

  ```js
  const PRESETS = new Map([
    ["Last 1 year", { kind: "preset", years: 1 }],
    ["Last 5 years", { kind: "preset", years: 5 }],
    ["All data",     { kind: "all" }]
  ]);

  const timeRangeInput = Inputs.select(PRESETS, {
    label: "Time range",
    value: PRESETS.get("All data") // default only applied once
  });

  // Expose the reactive value (persists even if hidden)
  const timePreset = view(timeRangeInput);
  ```

  ```js
  // 2) Mount point that shows/hides the input without recreating it
  const timeRangeMount = html`<div></div>`;
  display(timeRangeMount);

  selectedStation; // reactive dependency
  if (selectedStation) {
    timeRangeMount.replaceChildren(timeRangeInput);
  } else {
    timeRangeMount.replaceChildren(); // hide when no station selected
  }
  ```

  ```js
  const today = toDate(new Date());

  // Domain is either [start, end] or null (for "All data")

  const uiDomain =
    timePreset?.kind === "preset"
      ? (() => {
          const start = toDate(new Date(today));
          start.setFullYear(today.getFullYear() - timePreset.years);
          return [start, today];
        })()
      : null; // "All data" → let plots use data extent policy
  ```

  ```js
  // fetch cell
  import { stationRecordFetch, nextStationReqId, getLatestStationReqId } from "./data-fetch.js";

  selectedStation; timePreset;

  let stationRecordTemp = (async () => {
    const code = selectedStation?.code;
    if (!code) return { code: null, data: [] };

    const myReqId = nextStationReqId();

    const ac = new AbortController();
    invalidation.then(() => ac.abort("Selection changed too quickly. Please try again."));

    const presetKind = timePreset?.kind === "all" ? "all" : "preset";
    const sinceYears = timePreset?.kind === "preset" ? timePreset.years : 5;

    try {
      const data = await stationRecordFetch(code, {
        recentOnly: false,
        timePreset: presetKind,
        sinceYears,
        signal: ac.signal
      });

      if (myReqId !== getLatestStationReqId() || ac.signal.aborted) {
        return { code: null, data: [] };
      }
      return { code, data };
    } catch (err) {
      if (err?.name === "AbortError") return { code: null, data: [] };
      console.error(err);
      return { code: null, data: [] };
    }
  })();

  ```
  ---

  ```js
  const stationRecord = Array.isArray(stationRecordTemp)
  ? stationRecordTemp
  : (stationRecordTemp?.data ?? []);

  // If no station is selected, show single placeholder plot with message
  if (!selectedStation) {
    const today = toDate(new Date());

    const defaultDomain = uiDomain ?? [toDate(new Date(today.getFullYear() - 5, today.getMonth(), today.getDate())), today];

    const placeholder = (msg) => Plot.plot({
      width, height: 200,
      x: { domain: defaultDomain, label: "Date"},
      y: {label: analyte},
      marks: [
        Plot.text([{}], {
          text: () => msg,
          frameAnchor: "middle",
          fontSize: 14,
          fill: "gray"
        })
      ]
    });

    display(placeholder("Select a station to see status history, 6-week averages, and single-sample results"));

  } else {

    const statusSeries = await stat.buildStatusSeriesForStation(stationRecord);

    const statusByDay = new Map(
      statusSeries.map(s => [
        s.date.toISOString().slice(0, 10),
        s
      ])
    );
 
    // Process data for plots
    const mapped = stationRecord
      ?.filter(d => d.Analyte === analyte)
      .map(d => {
        const date = new Date(d.SampleDate);
        const iso = date.toISOString().slice(0, 10);
        const st = statusByDay.get(iso);
        const ddpcr = mod.isDdPCR?.(d) ?? false;

        return {
          date,
          result: d.Result != null ? +d.Result : null,
          sixWeekGeoMean: d["6WeekGeoMean"] != null ? +d["6WeekGeoMean"] : null,
          analyte: d.Analyte,
          unit: d.Unit,
          MethodName: d.MethodName ?? null,
          isDdPCR: ddpcr,
          status: st?.status?.name ?? st?.status_name ?? null,
          statusReason: st?.status?._reasons?.join(", ") ?? null
        };
      })
      .sort((a, b) => a.date - b.date) || [];

    const dataCulture = mapped.filter(d => !d.isDdPCR);
    const dataDdPCR   = mapped.filter(d =>  d.isDdPCR);

    // choose extent from culture
    const baseForExtent = dataCulture.length ? dataCulture : dataDdPCR;
    const hasData = baseForExtent.length > 0;
    const dataExtent = hasData ? d3.extent(baseForExtent, d => toDate(d.date)) : [null, null];
    const today = toDate(new Date());

    let xDomain;
    if (uiDomain) {
      xDomain = uiDomain;
    } else if (dataExtent[0] && dataExtent[1]) {
      xDomain = [dataExtent[0], d3.max([dataExtent[1], today])];
    } else {
      const start = toDate(new Date(today));
      start.setFullYear(today.getFullYear() - 5);
      xDomain = [start, today];
    }

    // Build segments with midpoints + reasons pulled from status objects
    const day = 24 * 3600 * 1000;
    const segments = statusSeries.map((s, i) => {
      const x1 = toDate(s.date);
      const x2 = i < statusSeries.length - 1 ? toDate(statusSeries[i + 1].date)
                                            : new Date(+x1 + 7 * day);
      const xm = new Date((+x1 + +x2) / 2); // midpoint for pointer snapping
      const reasons = s.status?._reasons ?? [];
      return {
        x1, x2, xm,
        color: s.status?.color ?? "#eee",
        name:  s.status?.name ?? s.status_name ?? "",
        reasons,
        reasonStr: reasons.length ? reasons.join("\n") : " "
      };
    });

    // Status ribbon plot ------------------------------
    const ribbon = Plot.plot({
      title: `Status history`,
      marks: [
        // status band
        Plot.rectY(segments, { x1: "x1", x2: "x2", y1: 0, y2: 1, fill: "color", title: d => d.name }),

        // highlighted rect (nearest xm)
        Plot.rectY(segments, Plot.pointerX({
          x: "xm",
          x1: "x1", x2: "x2",
          y1: 0,  y2: 1,
          fill: "color",
          stroke: "red",
          strokeWidth: 1,
          maxRadius: 100
        })),

        // text with status name + reasons
        Plot.text(segments, Plot.pointerX({
          x: "xm",
          y: 0.75,
          text: d => `${d.name}: \n${d.reasonStr}`,
          dx: 6, dy: -6,
          frameAnchor: "top-left",
          lineWidth: 12,
          maxRadius: 100
        }))
      ],
      x: { domain: xDomain, label: "Date" },
      y: { domain: [0,1], axis: "left", tickSize: 0, label: null, tickFormat: () => "" },
      height: 100,
      width
    });

    display(ribbon);

    // 6-week geomean plot ------------------------------

    if (dataCulture.length) {
      const labelUnit = `${dataCulture[0].analyte} (${dataCulture[0].unit})`;

      const all = await mod.getAllThresholds();
      const th = mod.thresholdsFor(all, analyte);
      const T = th?.geomean ?? null;

      const y = d => d.sixWeekGeoMean;
      const sorted = dataCulture.slice().sort((a,b) => +a.date - +b.date);
      const segmentsFill = mod.segmentsAboveThreshold(sorted, y, T);
      const areaMarks = segmentsFill.map(seg =>
        Plot.areaY(seg, {
          x: "date", y, y1: T, fill: "orange", fillOpacity: 0.5, curve: "linear", clip: true
        })
      );

      const pplot = Plot.plot({
        title: `6-week average (geometric mean)`,
        marks: [
          ...areaMarks,
          Plot.ruleY([{}], { y: T, stroke: "orange", opacity: 0.25, strokeWidth: 1, title: `Threshold: ${T} ${dataCulture[0].unit}`}),
          Plot.ruleY([{}], { y: T, stroke: "orange", opacity: 0, strokeWidth: 12, title: `Threshold: ${T} ${dataCulture[0].unit}`}),
          Plot.lineY(dataCulture, { x: "date", y: "sixWeekGeoMean", stroke: "steelblue", curve: "linear"}),

          Plot.ruleX(dataCulture, Plot.pointerX({ x: "date", py: "sixWeekGeoMean", stroke: "lightgray"})),
          Plot.dot(dataCulture,   Plot.pointerX({ x: "date", y: "sixWeekGeoMean", stroke: "red"})),
          Plot.text(dataCulture,  Plot.pointerX({
            px: "date", py: "sixWeekGeoMean", dy: -17, frameAnchor: "top-right", fontVariant: "tabular-nums",
            text: d => {
              const fmt = date => date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
              const start = new Date(d.date.getTime() - 30 * 24 * 60 * 60 * 1000);
              const end = d.date;
              return [`${d.sixWeekGeoMean} ${d.unit}`, `${fmt(start)} – ${fmt(end)}`].join("\n");
            }
          }))
        ],
        x: { domain: xDomain, label: "Date" },
        y: { label: labelUnit, type: "log", nice: true },
        width, height: 200
      });

      display(pplot);
    }

    // Single results plot ------------------------------

    if (dataCulture.length) {
      const labelUnit = `${dataCulture[0].analyte} (${dataCulture[0].unit})`;

      const all = await mod.getAllThresholds();
      const th = mod.thresholdsFor(all, analyte);
      const T = th?.single_sample ?? null;

      const plot = Plot.plot({
        title: `Single sample results (${dataCulture.length} samples)`,
        marks: [
          Plot.ruleY([{}], { y: T, stroke: "orange", opacity: 0.25, strokeWidth: 1, title: `Threshold: ${T} ${dataCulture[0].unit}`}),
          Plot.ruleY([{}], { y: T, stroke: "orange", opacity: 0, strokeWidth: 20, title: `Threshold: ${T} ${dataCulture[0].unit}`}),
          Plot.dot(dataCulture, {
            x: "date", y: "result", r: 2, fill: "steelblue",
            stroke: d => (T != null && d.result > T) ? "orange" : "none",
            strokeWidth: d => (T != null && d.result > T) ? 1 : 0
          }),
          Plot.ruleX(dataCulture, Plot.pointerX({ x: "date", py: "result", stroke: "lightgray"})),
          Plot.dot(dataCulture,   Plot.pointerX({ x: "date", y: "result", stroke: "red"})),
          Plot.text(dataCulture,  Plot.pointerX({
            px: "date", py: "result", dy: -17, frameAnchor: "top-right", fontVariant: "tabular-nums",
            text: d => {
              const fmt = date => date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
              return [`${d.result?.toFixed?.(2) ?? d.result} ${d.unit}`, fmt(d.date)].join("\n");
            }
          }))
        ],
        x: { domain: xDomain, label: "Date" },
        y: { label: labelUnit, type: "log", nice: true },
        width, height: 200
      });

      display(plot);
    }

    // ddPCR results plot ------------------------------
    if (dataDdPCR.length) {
      const labelUnitDPCR = `${dataDdPCR[0].analyte} (${dataDdPCR[0].unit})`;
      const plotDPCR = Plot.plot({
        title: `ddPCR results - not used for status (${dataDdPCR.length} samples)`,
        marks: [
          Plot.ruleY([{}], { y: 1413, stroke: "gray", opacity: 0.25, strokeWidth: 1, title: `Threshold: 1,413 ${dataDdPCR[0].unit}`}),
          Plot.dot(dataDdPCR, { x: "date", y: "result", r: 2, strokeWidth: 1 }),
          Plot.ruleX(dataDdPCR, Plot.pointerX({ x: "date", py: "result", stroke: "lightgray"})),
          Plot.dot(dataDdPCR,   Plot.pointerX({ x: "date", y: "result", stroke: "red"})),
          Plot.text(dataDdPCR,  Plot.pointerX({
            px: "date", py: "result", dy: -17, frameAnchor: "top-right", fontVariant: "tabular-nums",
            text: d => {
              const fmt = date => date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
              return [`${d.result?.toFixed?.(2) ?? d.result} ${d.unit}`, fmt(d.date)].join("\n");
            }
          }))
        ],
        x: { domain: xDomain, label: "Date" },
        y: { label: labelUnitDPCR, type: "log", nice: true },
        width, height: 200
      });

      display(plotDPCR);
    }
  }
  ```

</div>
