import { PERFORMANCE_ENABLED } from "./performance-store.mjs";
import { cacheLoadedFeatures } from "./offline-feature";
let runtime: Promise<typeof import("./performance-metrics")> | undefined;
export function diagnosticsEnabled() {
  try {
    return localStorage.getItem(PERFORMANCE_ENABLED) === "on";
  } catch {
    return false;
  }
}
export async function setDiagnosticsEnabled(enabled: boolean) {
  if (enabled) {
    runtime ??= import("./performance-metrics").catch((error) => {
      runtime = undefined;
      throw error;
    });
    const metrics = await runtime;
    localStorage.setItem(PERFORMANCE_ENABLED, "on");
    metrics.setCollecting(true);
    cacheLoadedFeatures();
  } else {
    localStorage.setItem(PERFORMANCE_ENABLED, "off");
    if (runtime) (await runtime).setCollecting(false);
  }
}
export function restoreDiagnostics() {
  if (diagnosticsEnabled()) void setDiagnosticsEnabled(true).catch(() => {});
}
