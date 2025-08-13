---
toc: false
sidebar: false
---

```js
import * as L from "npm:leaflet";
import { resize } from "npm:@observablehq/stdlib";
import * as mod from "./modules.js";
import { setSelectedStation, selectedStation } from "./station-state.js";
```

```js
// Initialize Leaflet map
const div = document.createElement("div");
div.style = `height: 600px; border-radius: 8px; overflow: hidden; width: ${resize(width)}px;`;

const map = L.map(div, {
  wheelPxPerZoomLevel: 60
}).setView([37.5, -120], 6); // Initial view centered on California

L.tileLayer("https://api.maptiler.com/maps/dataviz/{z}/{x}/{y}.png?key=VDWZb7VXYyD4ZCvqwBRS", {
  attribution:
    '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);
const markerMap = {};

// Custom icons for different statuses
const LowRiskIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/chloeyn/SafeToSwim/refs/heads/main/src/assets/icons/low_risk.png",
  iconSize: [10, 10],
  iconAnchor: [5, 5],
  popupAnchor: [0, -5]
});
const UseCautionIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/chloeyn/SafeToSwim/refs/heads/main/src/assets/icons/use_caution.png",
  iconSize: [10, 10],
  iconAnchor: [5, 5],
  popupAnchor: [0, -5]
});
const NotEnoughDataIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/chloeyn/SafeToSwim/refs/heads/main/src/assets/icons/not_enough_data.png",
  iconSize: [10, 10],
  iconAnchor: [5, 5],
  popupAnchor: [0, -5]
});

const iconMap = {
  "Low risk": LowRiskIcon,
  "Use caution": UseCautionIcon,
  "Not enough data": NotEnoughDataIcon
};
```

```js
// Fetch all station data (cached after first call)
const stations = await mod.fetchAllStations();

import { computeAllStatuses } from "./modules.js";

// Use stations object directly
const statusesByCode = await computeAllStatuses(
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
// Add markers for all stations
for (const [code, st] of Object.entries(stations)) {
  const { TargetLatitude, TargetLongitude } = st;
  if (!TargetLatitude || !TargetLongitude) continue;

  const formattedName = mod.formatStationName(st.StationName, code);

  const marker = L.marker([TargetLatitude, TargetLongitude], { icon: iconMap[st.status.name] || LowRiskIcon })
    .bindPopup(`<b>${formattedName}</b><br>Station Code: ${code}`);

  // Click -> publish selection
  const onClick = () => setSelectedStation(code, "map");
  marker.on("click", onClick);

  // Cleanup on cell invalidation
  invalidation.then(() => marker.off("click", onClick));

  markerMap[code] = marker;
  markersLayer.addLayer(marker);
}
```

```js
// Keep the map’s popup in sync with the current selection.
selectedStation; // make this cell reactive

{
  const sel = selectedStation?.code;
  if (sel) {
    const m = markerMap[sel];
    if (m) {
      map.panTo(m.getLatLng());
      m.openPopup();
    }
  }
}
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
    const lastSampleDateISO = st.lastSampleDate || null;           // e.g., "2024-07-15"
    const lastSampleDateObj = lastSampleDateISO ? new Date(lastSampleDateISO) : null;
    const lastSampleDate =
      lastSampleDateObj && !isNaN(+lastSampleDateObj)
        ? lastSampleDateObj.toISOString().slice(0, 10)
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
        <p><strong>Station Code:</strong> ${meta.code}</p>
        <p><strong>Lat/Lon:</strong> ${meta.lat}, ${meta.lon}</p>
        <p><strong>Last sample date:</strong> ${meta.lastSampleDate ?? "—"}</p>
        <p><strong>Total data points:</strong> ${meta.totalDataPoints}</p>
        <p><strong>Data points in last 6 weeks:</strong> ${meta.recentDataPoints}</p>
      `
    : html`<p>Select a station to see details.</p>`
  ```
  
  ```js
  import { stationRecordFetch } from "./modules.js";

  selectedStation; // reactive
  let stationRecord = null;
  const code = selectedStation?.code;
  if (code) {
    stationRecord = await stationRecordFetch(code);
  }
  ```
  
  ---

  ## **Status: ${selectedStation?.code ? stations[selectedStation.code]?.status.name : "—"}**  
  ${selectedStation?.code
  ? stations[selectedStation.code]?.status.description
  : "No status available"}

  </div>
  </div>
</div>
</div>

<div class="card grid-colspan-3"><h1>Data</h1>

```js
const analyte = view(Inputs.select(
  ["Enterococcus", "E. coli", "Total Coliform"], 
  {label: "Change bacteria", value: "Enterococcus"}
))
```

```js
const data = stationRecord
  ?.filter(d => d.Analyte === analyte)
  .map(d => ({
    date: new Date(d.SampleDate),
    result: +d.Result,
    analyte: d.Analyte,
    unit: d.Unit
  }));
```

```js

if (!data.length) {
  display(`No data for ${analyte} at this station.`);
} else {
  // use analyte and unit from the first row
  const labelUnit = `${data[0].Analyte} (${data[0].Unit})`;

  const plot = Plot.plot({
    marks: [
      Plot.dot(data, {x: "date", y: "result", r: 2, fill: "steelblue"}),
      Plot.ruleX(data, Plot.pointerX({x: "date", py: "result", stroke: "lightgray"})),
      Plot.dot(data, Plot.pointerX({x: "date", y: "result", stroke: "red"})),
      Plot.text(data, Plot.pointerX({
        px: "date",
        py: "result",
        dy: -17,
        frameAnchor: "top-right",
        fontVariant: "tabular-nums",
        text: (d) =>
          [`Date ${Plot.formatIsoDate(d.date)}`, `${d.analyte} ${d.result.toFixed(2)}`].join("   ")
      }))
    ],
    x: {label: "Date"},
    y: {label: labelUnit, type: "log", nice: true},
    width: width,
    height: 200
  });

  display(plot);
}
```

</div>
