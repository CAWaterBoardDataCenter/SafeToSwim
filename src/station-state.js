// Station selection management

import { Generators } from "@observablehq/stdlib";

// --- Internal state ---
const selectedStationBus = new EventTarget();
let _selected = null;

// --- Public setter ---
export function setSelectedStation(code, source = "unknown") {
  _selected = { code, source, ts: Date.now() };
  selectedStationBus.dispatchEvent(new CustomEvent("change", { detail: _selected }));
}

// --- Reactive stream ---
export const selectedStation = Generators.observe((notify) => {
  if (_selected) notify(_selected); // emit immediately if exists
  const onChange = (e) => notify(e.detail);
  selectedStationBus.addEventListener("change", onChange);
  return () => selectedStationBus.removeEventListener("change", onChange);
});