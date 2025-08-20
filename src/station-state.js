// Station selection management
import { Generators } from "@observablehq/stdlib";

// --- Internal state ---
const selectedStationBus = new EventTarget();
let _selected = null;

// --- Public setter (allow clearing by passing null) ---
export function setSelectedStation(code, source = "unknown") {
  _selected = code ? { code, source, ts: Date.now() } : null;
  selectedStationBus.dispatchEvent(new CustomEvent("change", { detail: _selected }));
}

// --- Reactive stream (emit immediately) ---
export const selectedStation = Generators.observe((notify) => {
  // Emit the current value right away (null on fresh load)
  notify(_selected);

  const onChange = (e) => notify(e.detail);
  selectedStationBus.addEventListener("change", onChange);
  return () => selectedStationBus.removeEventListener("change", onChange);
});
