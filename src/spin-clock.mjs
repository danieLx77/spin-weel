const spinDuration = (duration) => Number.isFinite(duration) && duration > 0 ? duration : 9000;

// Measure from the user's action, including time spent in another tab.
export function createSpinClock(duration, startedAt = performance.now()) {
  const total = spinDuration(duration);
  let elapsed = 0;
  return (now) => {
    elapsed = Math.max(elapsed, now - startedAt);
    return Math.min(1, elapsed / total);
  };
}

// RAF paints visible frames; the timer and wake event also finish hidden spins.
// Both share a clock and a single completion path, so no result is recorded twice.
export function runSpin({
  duration,
  onFrame,
  onComplete,
  now = () => performance.now(),
  requestFrame = (callback) => requestAnimationFrame(callback),
  cancelFrame = (id) => cancelAnimationFrame(id),
  setTimer = (callback, delay) => setTimeout(callback, delay),
  clearTimer = (id) => clearTimeout(id),
  subscribeWake = (_wake) => () => {},
}) {
  const total = spinDuration(duration);
  const startedAt = now();
  const progress = createSpinClock(total, startedAt);
  let stopped = false;
  let frameId;
  let timerId;
  let unsubscribe = () => {};
  const cancel = () => {
    if (stopped) return;
    stopped = true;
    if (frameId !== undefined) cancelFrame(frameId);
    if (timerId !== undefined) clearTimer(timerId);
    unsubscribe();
  };
  const update = (timestamp) => {
    if (stopped) return;
    const value = progress(timestamp);
    onFrame(value, timestamp);
    if (value >= 1) {
      cancel();
      onComplete();
    }
  };
  const paint = (timestamp) => {
    frameId = undefined;
    update(timestamp);
    if (!stopped) frameId = requestFrame(paint);
  };
  const checkTime = () => {
    timerId = undefined;
    update(now());
    if (!stopped) timerId = setTimer(checkTime, Math.min(250, Math.max(1, startedAt + total - now())));
  };
  unsubscribe = subscribeWake(() => update(now()));
  if (stopped) unsubscribe();
  else {
    frameId = requestFrame(paint);
    timerId = setTimer(checkTime, Math.min(250, total));
  }
  return cancel;
}
