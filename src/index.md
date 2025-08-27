---
toc: false
sidebar: false
---

```js
import * as L from "npm:leaflet";
import "npm:leaflet.fullscreen";

import { resize } from "npm:@observablehq/stdlib";
import * as mod from "./modules.js";
import { setSelectedStation, selectedStation } from "./station-state.js";

function toDate(d) { 
  const t=new Date(d); 
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}
```

```js
// Initialize Leaflet map
const div = document.createElement("div");
div.style = `height: 600px; border-radius: 8px; overflow: hidden; width: ${resize(width)}px;`;

const map = L.map(div, {
  wheelPxPerZoomLevel: 60,
}).setView([37.5, -120], 6); // Initial view centered on California

L.control.fullscreen({
  position: "topleft",
  // 👇 This shows as the native hover tooltip
  title: "Tip: For best results, put your browser in full screen first",
  titleCancel: "Exit fullscreen"
}).addTo(map);

L.tileLayer("https://api.maptiler.com/maps/dataviz/{z}/{x}/{y}.png?key=VDWZb7VXYyD4ZCvqwBRS", {
  attribution:
    '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);
const markerMap = {};
```

```js
// Fetch all station data (cached after first call)
const stations = await mod.fetchAllStations();

const statusesByCode = await mod.computeAllStatuses(
  new Map(Object.entries(stations).map(([code, st]) => [code, st.recentResults]))
);

// Attach status to each station
for (const [code, st] of Object.entries(stations)) {
  st.status = statusesByCode.get(code);
}
```

<div class="hero">

  <h1>Safe To Swim Map</h1>

  <h2>The California recreational water quality tool for nerds and adventurers.</h2>

  *This map from the California State Water Resources Control Board shows the latest water quality data to help you make informed decisions about where to swim. See [How to Use](how-to-use) and our [FAQ](faq) for more information.*

</div>

</div>

<div style="
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1rem;
  align-items: stretch; /* make columns same height */
">
<div class="card" id="map-card" style="min-height: 600px; margin: 0">

```js
display(div);
map.invalidateSize();

// Ensure markers layer is on the map
markersLayer.addTo(map);
```

```js
const statusColors = await mod.getStatusColors();
const BASE_SIZE = 7;
const SELECTED_SIZE = 10;

// --- icon helpers (no images needed) ---
function circleDivIcon({ size = BASE_SIZE, color = "#7f7f7f", ring = false }) {
  const border = 2;
  const inner = ring
    ? `
      background: ${color};
      box-shadow:
        0 0 0 ${border}px ${color},
        0 0 0 ${border + 4}px rgba(230, 2, 255, 0.8);
    `
    : `
      background: ${color};
      border: ${border}px solid ${color};
      box-shadow: 0 0 0 0.5px rgba(0,0,0);
    `;
  const half = size / 2; // center anchor

  return L.divIcon({
    className: "station-circle",
    iconSize: [size, size],
    iconAnchor: [half, half],       
    popupAnchor: [0, -half],        
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      box-sizing:border-box;        /* border doesn't change center */
      ${inner}
    "></div>`
  });
}

function colorForStation(st) {
  const status = st?.status?.name ?? "unknown";
  return statusColors[status] || statusColors.unknown;
}

// --- registry & selection state ---
const __state = (globalThis.__wbfMapState ??= {});   // one global bucket

__state.divMarkerMap ??= Object.create(null);
__state.selectedCode ??= null;

const divMarkerMap = __state.divMarkerMap;   // use these throughout the cell

// --- draw markers as divIcons ---
function drawStationDivMarkers() {
  for (const [code, st] of Object.entries(stations)) {
    const lat = +st?.TargetLatitude, lon = +st?.TargetLongitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const color = colorForStation(st);
    const icon  = circleDivIcon({ size: BASE_SIZE, color });

    const marker = L.marker([lat, lon], {
      icon,
      zIndexOffset: 0 // raise selected marker
    })
    .bindPopup(`<b>${st.StationName}</b><br>Code: ${code}<br>Status: ${st.status?.name ?? "unknown"}`)
    .on("click", () => {
      setSelectedStation(code, "map");
      highlightSelected(code);
    })
    .addTo(markersLayer);

    // optional hover effect
    marker.on("mouseover", () => {
      marker._icon?.firstChild?.style && (marker._icon.firstChild.style.transform = "scale(1.3)");
    });
    marker.on("mouseout", () => {
      marker._icon?.firstChild?.style && (marker._icon.firstChild.style.transform = "scale(1.0)");
    });

    divMarkerMap[code] = marker;
  }

  invalidation?.then(() => {
    Object.values(divMarkerMap).forEach(m => {
      m.off();
      if (markersLayer.hasLayer?.(m)) markersLayer.removeLayer(m);
    });
  });
}

// --- call once after stations load ---
drawStationDivMarkers();

// --- selection highlighting (swap icon to ring + raise zIndex) ---
function highlightSelected(code, { pan = true, openPopup = true } = {}) {
  const prevCode = __state.selectedCode;

  // reset previous if different
  if (prevCode && prevCode !== code && divMarkerMap[prevCode]) {
    const prev = divMarkerMap[prevCode];
    prev.setIcon(circleDivIcon({
      size: BASE_SIZE,
      color: colorForStation(stations[prevCode])
    }));
    prev.setZIndexOffset(0);
    prev._icon?.firstChild && (prev._icon.firstChild.style.transform = "scale(1.0)");
  }

  // apply highlight
  __state.selectedCode = code;

  const st = stations?.[code];
  const m  = divMarkerMap?.[code];
  if (!st || !m) return;

  const color = colorForStation(st);
  m.setIcon(circleDivIcon({ size: SELECTED_SIZE, color, ring: true }));
  m.setZIndexOffset(1000);

  if (pan) {
    const lat = +st.TargetLatitude, lon = +st.TargetLongitude;
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      const targetZoom = map?.getZoom?.() ?? 10;
      map.setView([lat, lon], targetZoom, { animate: true });
    }
  }

  if (openPopup) {
    m.openPopup();
  }
}
```

```js
// Reset highlighted station
selectedStation;
{
  const code = selectedStation?.code ?? selectedStation ?? null;
  if (code && stations?.[code] && divMarkerMap?.[code]) {
    highlightSelected(code, { pan: true, openPopup: true });
  }
}
```

```js
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
  // Create once
  const stationInput = Inputs.text({ label: "Station code", value: "" });
  display(stationInput);

  // Publish user edits -> state bus
  const onInput = () => setSelectedStation(stationInput.value, "input");
  stationInput.addEventListener("input", onInput);
  invalidation.then(() => stationInput.removeEventListener("input", onInput));
  ```

  ```js
  selectedStation; // make this cell reactive
  if (selectedStation?.source !== "input") {
    const v = selectedStation?.code ?? "";
    if (stationInput.value !== v) stationInput.value = v;
  }
  ```

  ```js
  const recentOnly = view(
    Inputs.toggle({
      label: "Only show stations sampled in the last 6 weeks",
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
  function updateMarkerVisibility({ recentOnly, hasRecent, divMarkerMap }) {
    if (!divMarkerMap) return;
    for (const [code, marker] of Object.entries(divMarkerMap)) {
      // keep if toggle is off OR station is recent
      const visible = !recentOnly || hasRecent.get(code) || code === selectedStation?.code;
      // Fast + simple: hide the marker’s DOM element
      const el = marker.getElement?.();
      if (el) {
        el.style.display = visible ? "" : "none";
        el.style.pointerEvents = visible ? "" : "none";
      }
    }
  }

  recentOnly; hasRecent; divMarkerMap; // make reactive
  {
    updateMarkerVisibility({ recentOnly, hasRecent, divMarkerMap });

    // (Optional) show a tiny summary
    const total = divMarkerMap ? Object.keys(divMarkerMap).length : 0;
    const visible = divMarkerMap
      ? Object.keys(divMarkerMap).filter(c => !recentOnly || hasRecent.get(c)).length
      : 0;
    // display(`${visible}/${total} stations visible`);
  }
  ```

  ```js

  ```

  </div>

  <div class="card" id="station-info-card" style="margin: 0;">

  ```js
  selectedStation; // make reactive

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
  import { stationRecordFetch } from "./modules.js";

  selectedStation; // reactive
  let stationRecord = null;
  const code = selectedStation?.code;
  if (code) {
    stationRecord = await stationRecordFetch(code);
  }

  const { isSaltwater, bacteria, thresholds } =
    await mod.getStationAssessmentSpec(code);
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

    const hasData = name =>
      stationRecord?.some(d => d.Analyte === name && Number.isFinite(+d.Result)) ?? false;

    const disabledValues = candidates.filter(name => !hasData(name));

    const defaultAnalyte =
      (bacteria && hasData(bacteria)) ? bacteria :
      (candidates.find(hasData) ?? candidates[0]);

    analyte = view(
      Inputs.select(candidates, {
        label: "Display data by bacteria",
        value: defaultAnalyte,
        format: v => hasData(v) ? v : `${v} (no data)`,
        disabled: disabledValues
      })
    );
  } else {
    // optional placeholder text instead of dropdown
    analyte = null;
  }
  ```

  ```js
  let timePreset = null;
  if (selectedStation) {
    // pick time window
    const PRESETS = new Map([
      ["Last 1 year", { kind: "preset", years: 1 }],
      ["Last 5 years", { kind: "preset", years: 5 }],
      ["All data",     { kind: "all" }]
    ]);

    timePreset = view(Inputs.select(PRESETS, {
      label: "Time range",
      value: PRESETS.get("All data")
    }));
  } else { timePreset = null; }
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

  ---

  ```js
  // If no station is selected, show single placeholder plot with message
  if (!stationRecord) {
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

    display(placeholder("Select a station to see status history, 6-week geomean, and single-sample results"));

  } else {

    const statusSeries = await mod.buildStatusSeriesForStation(stationRecord);

    const statusByDay = new Map(
      statusSeries.map(s => [
        s.date.toISOString().slice(0, 10),
        s
      ])
    );

    // Process data for plots
    const data = stationRecord
      ?.filter(d => d.Analyte === analyte)
      .map(d => {
        const date = new Date(d.SampleDate);
        const iso = date.toISOString().slice(0, 10);
        const st = statusByDay.get(iso);

        return {
          date,
          result: +d.Result,
          sixWeekGeoMean: +d["6WeekGeoMean"],
          analyte: d.Analyte,
          unit: d.Unit,
          status: st?.status?.name ?? st?.status_name ?? null,
          statusReason: st?.status?._reasons?.join(", ") ?? null
        };
      })
      // sort ascending by date
      .sort((a, b) => a.date - b.date);

    const hasData = data && data.length > 0;
    const dataExtent = hasData ? d3.extent(data, d => toDate(d.date)) : [null, null];
    const today = toDate(new Date());

    let xDomain;

    if (uiDomain) {
      // If user picked a preset, honor it
      xDomain = uiDomain;
    } else if (dataExtent[0] && dataExtent[1]) {
      // If we have data, use its extent but extend right edge to today
      xDomain = [dataExtent[0], d3.max([dataExtent[1], today])];
    } else {
      // No data → fallback default (last 5 years)
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
        // base band
        Plot.rectY(segments, { x1: "x1", x2: "x2", y1: 0, y2: 1, fill: "color", title: d => d.name }),

        // highlighted rect (nearest xm)
        Plot.rectY(segments, Plot.pointerX({
          x: "xm",         // snap by midpoint
          x1: "x1", x2: "x2",
          y1: 0,  y2: 1,
          fill: "color",
          stroke: "red",
          strokeWidth: 1,
          maxRadius: 100
        })),

        // label with status name + reasons (placed in the ribbon mid-height)
        Plot.text(segments, Plot.pointerX({
          x: "xm",
          y: 0.8,
          text: d => `${d.name}: \n${d.reasonStr}`,
          dx: 6, dy: -6,
          frameAnchor: "top-left",
          lineWidth: 12,
          maxRadius: 100
        }))
      ],
      x: { domain: xDomain, label: "Date" },
      y: { axis: null, domain: [0, 1] },
      height: 80,
      width
    });

    display(ribbon);

    // 6-week geomean plot ------------------------------

    if (!data.length) {
      display(`No data for ${analyte} at this station.`);
    } else {
      // use analyte and unit from the first row
      const labelUnit = `${data[0].analyte} (${data[0].unit})`;

      // Threshold for highlighting
      const T = (await mod.getAllThresholds())[analyte].geomean;
      const y = d => d.sixWeekGeoMean;
      const sorted = data.slice().sort((a,b) => +a.date - +b.date);
      const segments = mod.segmentsAboveThreshold(sorted, y, T);
      const areaMarks = segments.map(seg =>
        Plot.areaY(seg, {
          x: "date",
          y,
          y1: T,
          fill: "orange",
          fillOpacity: 0.5,
          curve: "linear",
          clip: true
        })
      );

      const pplot = Plot.plot({
        title: `6-week average (geometric mean)`,
        marks: [
          // fill above threshold (height only when y >= T)
          ...areaMarks,

          // Line for threshold
          Plot.ruleY([{}], { y: T, stroke: "orange", opacity: 0.25, strokeWidth: 1, title: d => `Threshold: ${T} ${data[0].unit}`}),
          Plot.ruleY([{}], { y: T, stroke: "orange", opacity: 0, strokeWidth: 12, title: d => `Threshold: ${T} ${data[0].unit}`}),

          // Line for 6-week geomean
          Plot.lineY(data, {x: "date", y: "sixWeekGeoMean", stroke: "steelblue", curve: "linear"}),

          // Pointer
          Plot.ruleX(data, Plot.pointerX({x: "date", py: "sixWeekGeoMean", stroke: "lightgray"})),
          Plot.dot(data, Plot.pointerX({x: "date", y: "sixWeekGeoMean", stroke: "red"})),
          Plot.text(data, Plot.pointerX({
            px: "date",
            py: "sixWeekGeoMean",
            dy: -17,
            frameAnchor: "top-right",
            fontVariant: "tabular-nums",
            text: d => {
              const fmt = date =>
                date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

              const start = new Date(d.date.getTime() - 30 * 24 * 60 * 60 * 1000);
              const end = d.date;

              return [`${d.sixWeekGeoMean} ${d.unit}`, `${fmt(start)} – ${fmt(end)}`].join("\n");
            }
          })) 
        ],
        x: {domain: xDomain, label: "Date"},
        y: {label: labelUnit, type: "log", nice: true},
        width: width,
        height: 200
      });

      display(pplot);
    }
  
    // Single results plot ------------------------------
    if (!data.length) {
      display(`No data for ${analyte} at this station.`);
    } else {
      // use analyte and unit from the first row
      const labelUnit = `${data[0].analyte} (${data[0].unit})`;
      const T = (await mod.getAllThresholds())[analyte].single_sample;
      const plot = Plot.plot({
        title: `Single sample results (${data?.length ?? 0} samples, all time)`,
        marks: [
          // Line for threshold
          Plot.ruleY([{}], { y: T, stroke: "orange", opacity: 0.25, strokeWidth: 1, title: d => `Threshold: ${T} ${data[0].unit}`}),
          Plot.ruleY([{}], { y: T, stroke: "orange", opacity: 0, strokeWidth: 12, title: d => `Threshold: ${T} ${data[0].unit}`}),

          // Points for single results
          Plot.dot(data, {
            x: "date", 
            y: "result", 
            r: 2, 
            fill: "steelblue",
            stroke: d => d.result > T ? "orange" : "none",
            strokeWidth: d => d.result > T ? 1 : 0
          }),

          // Pointer
          Plot.ruleX(data, Plot.pointerX({x: "date", py: "result", stroke: "lightgray"})),
          Plot.dot(data, Plot.pointerX({x: "date", y: "result", stroke: "red"})),
          Plot.text(data, Plot.pointerX({
            px: "date",
            py: "result",
            dy: -17,
            frameAnchor: "top-right",
            fontVariant: "tabular-nums",
            text: d => {
            const fmt = date =>
              date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

            return [`${d.result.toFixed(2)} ${d.unit}`, fmt(d.date)].join("\n");
          }}))
        ],
        x: { domain: xDomain, label: "Date"},
        y: {label: labelUnit, type: "log", nice: true},
        width: width,
        height: 200
      });

      display(plot);
    }
  }
  ```

</div>
