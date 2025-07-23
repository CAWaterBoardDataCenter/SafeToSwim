---
toc: false
sidebar: false
---

<div class="hero">
  <h1>Safe To Swim Map</h1>
  <h2>Explore the water quality of beaches in California</h2>
</div>

<div class="card"><h1>Find a site</h1></div>

<div class="grid grid-cols-3">
  
  <div class="grid grid-colspan-2">
  
  ```js
  import * as L from "npm:leaflet";
  import {resize} from "npm:@observablehq/stdlib";

  const div = display(document.createElement("div"));

  div.style = `height: 500px; border-radius: 8px; overflow: hidden; width: ${resize(width)}px;`;

  const map = L.map(div)
    .setView([34, -118], 13);

  L.tileLayer("https://api.maptiler.com/maps/dataviz/{z}/{x}/{y}.png?key=VDWZb7VXYyD4ZCvqwBRS", {
    attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'
  })
    .addTo(map);

  L.marker([34, -118])
    .addTo(map)
    .bindPopup("A sample site")
    .openPopup();
  ```
  </div>
  
  <div class="card grid-colspan-1"><h1>Site summary</h1></div>
</div>

<div class="card grid-colspan-1"><h1>Data</h1></div>