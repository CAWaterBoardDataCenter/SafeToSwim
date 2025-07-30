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

</div>

<div class="grid grid-cols-3">
  
  <div class="grid grid-colspan-2">
  
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
  const resource_id = "15a63495-8d9f-4a49-b43a-3092ef3106b9";

  let stationName = null

  if (stationCode && stationCode.trim() !== "") {
    const sql = `
      SELECT "StationCode","StationName","TargetLatitude","TargetLongitude"
      FROM "${resource_id}"
      WHERE "StationCode"='${stationCode}'
      LIMIT 1
    `;
    const url = `https://data.ca.gov/api/3/action/datastore_search_sql?sql=${encodeURIComponent(sql)}`;
    try {
      const response = await fetch(url);
      const json = await response.json();
      const record = json.result.records[0];

      if (record) {
        const lat = parseFloat(record.TargetLatitude);
        const lon = parseFloat(record.TargetLongitude);
        stationName = record.StationName.split('-').slice(1).join('-').trim();

        // If marker was removed previously, recreate it
        if (!map.hasLayer(marker)) {
          marker.addTo(map);
        }

        marker.setLatLng([lat, lon])
              .bindPopup(`${stationName}`)
              .openPopup();

        // Optional: keep zoom the same, just pan if far
        const currentCenter = map.getCenter();
        if (map.distance(currentCenter, L.latLng(lat, lon)) > 5000) {
          map.panTo([lat, lon]);
        }
      } else {
        console.warn("No record found for station:", stationCode);
        if (map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
      }
    } catch (error) {
      console.error("Error fetching station:", error);
      if (map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
    }
  } else {
    // No input → remove marker
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
  <h2>Status:</h2>
  </div>
  `
  ```

  </div>

<div class="card grid-colspan-3"><h1>Data</h1>

```js
const analyte = view(Inputs.select(
  ["Enterococcus", "E. coli", "Total Coliform"], 
  {label: "Change bacteria", value: "Enterococcus"}
))
```

```js
import * as Plot from "npm:@observablehq/plot";
import d3 from "npm:d3@7";

const resource_id = "15a63495-8d9f-4a49-b43a-3092ef3106b9";

if (stationCode && stationCode.trim() !== "") {
  const sql = `
    SELECT "SampleDate","Analyte","Unit","Result"
    FROM "${resource_id}"
    WHERE "StationCode"='${stationCode}' AND "Analyte"='${analyte}'
    ORDER BY "SampleDate"
  `;
  const url = `https://data.ca.gov/api/3/action/datastore_search_sql?sql=${encodeURIComponent(sql)}`;
  
  try {
    const response = await fetch(url);
    const json = await response.json();
    const records = json.result.records;

    if (records.length === 0) {
      display("No data found for this station.");
    } else {
      // Convert to JS Date + numeric value
      const data = records.map(d => ({
        date: new Date(d.SampleDate),
        result: +d.Result,
        analyte: d.Analyte,
        unit: d.Unit
      }));

      // Build line chart
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
        y: {label: `${data[0].analyte} (${data[0].unit})`, type: "log", nice: true},
        width: width,
        height: 200
      });

      display(plot);
    }
  } catch (error) {
    console.error("Error fetching station data:", error);
    display("Error fetching time series.");
  }
} else {
  display("Enter a station code to see time series.");
}
```

</div>
