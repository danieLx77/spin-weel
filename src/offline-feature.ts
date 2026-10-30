/// <reference types="vite/client" />
// Cover the first-use race: the feature may load before the worker claims the page.
export function cacheLoadedFeatures() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const urls = [
    ...new Set(
      performance
        .getEntriesByType("resource")
        .map((entry) => new URL(entry.name))
        .filter(
          (url) =>
            url.origin === location.origin &&
            !url.search &&
            url.pathname.startsWith(`${import.meta.env.BASE_URL}assets/`),
        )
        .map((url) => url.pathname),
    ),
  ].slice(-20);
  void navigator.serviceWorker.ready
    .then((registration) =>
      registration.active?.postMessage({ type: "CACHE_FEATURES", urls }),
    )
    .catch(() => {});
}
