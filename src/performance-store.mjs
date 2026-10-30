export const PERFORMANCE_KEY = "volta:performance:history";
export const PERFORMANCE_ENABLED = "volta:performance:enabled";
export const METRIC_NAMES = ["TTFB", "FCP", "LCP", "CLS", "INP"];
export function parsePerformanceHistory(raw) {
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .slice(-30)
      .filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          item.id.length <= 100 &&
          typeof item.at === "string" &&
          Number.isFinite(Date.parse(item.at)),
      )
      .map((item) => ({
        id: item.id,
        at: new Date(item.at).toISOString(),
        values: Object.fromEntries(
          METRIC_NAMES.filter(
            (name) =>
              typeof item.values?.[name] === "number" &&
              Number.isFinite(item.values[name]) &&
              item.values[name] >= 0 &&
              item.values[name] <= 86_400_000,
          ).map((name) => [name, item.values[name]]),
        ),
      }));
  } catch {
    return [];
  }
}
