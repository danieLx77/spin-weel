import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";
import {
  PERFORMANCE_ENABLED,
  PERFORMANCE_KEY,
  parsePerformanceHistory,
} from "./performance-store.mjs";
let collecting = false,
  initialized = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let current = fresh();
function fresh(restored = false) {
  return {
    id: crypto.randomUUID(),
    at: new Date(restored ? Date.now() : performance.timeOrigin).toISOString(),
    values: {} as Record<string, number>,
  };
}
function save() {
  clearTimeout(timer);
  if (!collecting || !Object.keys(current.values).length) return;
  try {
    if (localStorage.getItem(PERFORMANCE_ENABLED) !== "on") return;
    const history = parsePerformanceHistory(
      localStorage.getItem(PERFORMANCE_KEY),
    ).filter((item) => item.id !== current.id);
    localStorage.setItem(
      PERFORMANCE_KEY,
      JSON.stringify([...history, current].slice(-30)),
    );
    window.dispatchEvent(new Event("volta:performance"));
  } catch {
    /* Storage denial does not affect the wheel. */
  }
}
function report(metric: Metric) {
  if (!collecting || !Number.isFinite(metric.value) || metric.value < 0) return;
  current.values[metric.name] = metric.value;
  clearTimeout(timer);
  if (document.visibilityState === "hidden") save();
  else timer = setTimeout(save, 500);
}
export function setCollecting(enabled: boolean) {
  collecting = enabled;
  if (!enabled) {
    clearTimeout(timer);
    return;
  }
  if (initialized) return;
  initialized = true;
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) current = fresh(true);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save();
  });
  window.addEventListener("pagehide", save);
  const options = { reportAllChanges: true };
  onTTFB(report, options);
  onFCP(report, options);
  onLCP(report, options);
  onCLS(report, options);
  onINP(report, options);
}
