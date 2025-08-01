---
toc: false
sidebar: false
---

<div class="hero">
  <h1>Safe To Swim Map</h1>
  <h2>The California recreational water quality tool for nerds and adventurers.</h2>
</div>

<div class="card"><h1>Find stations</h1>

  ```js
  const stationCode = view(Inputs.text(
    {label: "Search by station code", 
    placeholder: "Enter code", 
    value: "DHS108" // Venice Beach, for example
    }));
  ```

  ```js
  let stationRecord = [];

  if (stationCode && stationCode.trim() !== "") {
    const resource_id = "15a63495-8d9f-4a49-b43a-3092ef3106b9";
    let offset = 0;
    const pageSize = 500;

    while (true) {
      const url = `https://data.ca.gov/api/3/action/datastore_search?resource_id=${resource_id}&limit=${pageSize}&offset=${offset}&filters=${encodeURIComponent(JSON.stringify({ StationCode: stationCode }))}`;
      const response = await fetch(url);
      const json = await response.json();
      const records = json.result.records;

      if (records.length === 0) break; // no more rows

      // Keep only desired fields
      const filtered = records.map(r => ({
        StationCode: r.StationCode,
        StationName: r.StationName,
        TargetLatitude: r.TargetLatitude,
        TargetLongitude: r.TargetLongitude,
        SampleDate: r.SampleDate,
        Analyte: r.Analyte,
        Unit: r.Unit,
        Result: r.Result,
        QACode: r.QACode,
        "30DayGeoMean": r["30DayGeoMean"], // string because valid identifiers can't start with a number
        "30DayCount": r["30DayCount"],
        "30DayCutoffDate": r["30DayCutoffDate"],
        "6WeekGeoMean": r["6WeekGeoMean"],
        "6WeekCount": r["6WeekCount"],
        "6WeekCutoffDate": r["6WeekCutoffDate"]
      }));

      stationRecord = stationRecord.concat(filtered);

      offset += pageSize;
      if (records.length < pageSize) break; // last page
    }
  }
  ```

</div>

<div class="grid grid-cols-3">

  <div class="card grid-colspan-2">

  ```js
  import * as L from "npm:leaflet";
  import {resize} from "npm:@observablehq/stdlib";

  const div = display(document.createElement("div"));
  div.style = `height: 500px; border-radius: 8px; overflow: hidden; width: ${resize(width)}px;`;

  // Create map and marker once
  let map = L.map(div).setView([34, -118], 13);

  L.tileLayer("https://api.maptiler.com/maps/dataviz/{z}/{x}/{y}.png?key=VDWZb7VXYyD4ZCvqwBRS", {
    attribution:
      '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'
  }).addTo(map);

  let marker = L.marker([34, -118])
    .addTo(map)
    .bindPopup("A sample site")
    .openPopup();

  div
  ```

  ```js
  let stationName = null;

  if (stationRecord && stationRecord.length > 0) {
    const lat = parseFloat(stationRecord[0].TargetLatitude);
    const lon = parseFloat(stationRecord[0].TargetLongitude);
    stationName = stationRecord[0].StationName.split('-').slice(1).join('-').trim();

    const icon = L.icon({
      iconUrl: status.map_icon_path,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34]
    });

    // If marker was removed previously, recreate it
    if (!map.hasLayer(marker)) {
      marker.addTo(map);
    }

    marker.setIcon(icon)
          .setLatLng([lat, lon])
          .bindPopup(`${stationName}`)
          .openPopup();

    // Keep zoom the same, just pan if far
    const currentCenter = map.getCenter();
    if (map.distance(currentCenter, L.latLng(lat, lon)) > 5000) {
      map.panTo([lat, lon]);
      }
    } else {
    // No input, remove marker
    if (map.hasLayer(marker)) {
      map.removeLayer(marker);
    }
  }
  ```

  </div>

  <div class="card grid-colspan-1">

  ```js
  html`
  <h1><strong>${stationName}</strong></h1>
  <p><strong>Station Code:</strong> <span id="station-code">${stationCode}</span></p>
  <p>Total samples: ${stationRecord.length}</p>
  </div>
  `
  ```

  ```js
  import {csv} from "npm:d3-fetch@3";

  const criteria = FileAttachment("data/criteria.json").json();
  const saltwaterFlagsJson = FileAttachment("data/site_saltwater_flags.json").json();
  ```

  ```js
  // Determine if station is a saltwater or freshwater environment
  const saltwaterFlags = new Map(
  saltwaterFlagsJson.map(d => [d.StationCode, d.saltwater === "True"])
  );
  ```

  ```js
  let status = null;

  if (!stationRecord || stationRecord.length === 0) {
    status = null;
  } else {
    // Determine salt/fresh rules
    const isSaltwater = saltwaterFlags.get(stationCode) === true;
    const typeRules = criteria.rules.waterbody_types[isSaltwater ? "saltwater" : "freshwater"];

    // Manual closure placeholder (if included in stationRecord)
    if (stationRecord.manualClosureFlag) {
      status = criteria.statuses.closure;
    } else {
      // Use existing precomputed metrics
      const sampleCount6W = +stationRecord[0]["6WeekCount"];   // assuming uniform per station
      const geoMean6W = +stationRecord[0]["6WeekGeoMean"];
      const p90 = +stationRecord[0]["30DayGeoMean"];           // Note: dataset gives "30DayGeoMean" (check if that's p90 or geomean)

      if (sampleCount6W < typeRules.low_risk.min_samples_six_week) {
        status = criteria.statuses.not_enough_data;
      } else if (geoMean6W <= typeRules.low_risk.six_week_geomean.max &&
                p90 <= typeRules.low_risk.p90_30day.max) {
        status = criteria.statuses.low_risk;
      } else {
        status = criteria.statuses[typeRules.else_status];
      }
    }
  }
  ```

  Status: ${status ? status.name : "Unknown"}

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
  .filter(d => d.Analyte === analyte)   // keep only selected bacteria type
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
