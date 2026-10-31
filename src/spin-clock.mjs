// Count rendered time, not time spent waiting for a suspended browser tab.
// The first frame starts the clock; long stalls cannot skip the whole spin.
export function createSpinClock(duration) {
  const total = Number.isFinite(duration) && duration > 0 ? duration : 9000;
  let previous;
  let elapsed = 0;
  return (now) => {
    if (previous !== undefined)
      elapsed += Math.max(0, Math.min(100, now - previous));
    previous = now;
    return Math.min(1, elapsed / total);
  };
}
