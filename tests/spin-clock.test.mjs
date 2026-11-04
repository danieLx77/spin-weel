import { test } from "node:test";
import assert from "node:assert/strict";
import { createSpinClock, runSpin } from "../src/spin-clock.mjs";

test("time is counted from the click even when the first frame is delayed", () => {
  assert.equal(createSpinClock(4000, 100)(2100), .5);
  assert.equal(createSpinClock(4000, 100)(60100), 1);
});
test("switching tabs or a long stall does not pause the clock", () => {
  const progress = createSpinClock(4000, 0);
  assert.equal(progress(20), .005);
  assert.equal(progress(2020), .505);
  assert.equal(progress(60000), 1);
});
test("progress is monotonic and every configured duration ends on time", () => {
  for (const duration of [4000, 9000, 14000]) {
    const progress = createSpinClock(duration, 100);
    assert.equal(progress(0), 0);
    assert.equal(progress(100 + duration / 2), .5);
    assert.equal(progress(100), .5);
    assert.ok(progress(99 + duration) < 1);
    assert.equal(progress(100 + duration), 1);
    assert.equal(progress(200 + duration), 1);
  }
});
test("invalid durations fall back to nine seconds", () => {
  for (const duration of [0, -1, NaN, Infinity, undefined]) {
    const progress = createSpinClock(duration, 0);
    assert.equal(progress(100), 100 / 9000);
    assert.equal(progress(9000), 1);
  }
});

function harness() {
  let time = 0, nextId = 0, wake;
  const frames = new Map(), timers = new Map(), values = [];
  let completed = 0, unsubscribed = 0;
  const cancel = runSpin({
    duration: 4000,
    now: () => time,
    onFrame: (value) => values.push(value),
    onComplete: () => { completed++; },
    requestFrame: (callback) => { const id = ++nextId; frames.set(id, callback); return id; },
    cancelFrame: (id) => frames.delete(id),
    setTimer: (callback, delay) => { const id = ++nextId; timers.set(id, {callback, at: time + delay}); return id; },
    clearTimer: (id) => timers.delete(id),
    subscribeWake: (callback) => { wake = callback; return () => { wake = undefined; unsubscribed++; }; },
  });
  return { frames, timers, values, cancel,
    get completed() { return completed; },
    get unsubscribed() { return unsubscribed; },
    get wake() { return wake; },
    time: (value) => { time = value; },
    timer: (value) => {
      time = value;
      for (const [id, timer] of [...timers]) if (timer.at <= time) { timers.delete(id); timer.callback(); }
    },
    frame: (value) => {
      time = value;
      const callbacks = [...frames.values()]; frames.clear();
      for (const callback of callbacks) callback(value);
    },
  };
}
test("a hidden spin completes through the timer without any animation frames", () => {
  const h = harness();
  h.timer(1000);
  assert.equal(h.values.at(-1), .25);
  h.timer(4000);
  assert.equal(h.values.at(-1), 1);
  assert.equal(h.completed, 1);
  assert.equal(h.frames.size, 0);
  assert.equal(h.timers.size, 0);
  assert.equal(h.unsubscribed, 1);
});
test("returning to a tab resumes at the right position or final result", () => {
  const h = harness();
  h.time(2000); h.wake();
  assert.equal(h.values.at(-1), .5);
  h.frame(3000);
  assert.equal(h.values.at(-1), .75);
  h.time(60000); h.wake();
  assert.equal(h.completed, 1);
  assert.equal(h.values.at(-1), 1);
  assert.equal(h.frames.size, 0);
  assert.equal(h.timers.size, 0);
});
test("racing frame, timer and visibility callbacks complete only once", () => {
  const h = harness();
  const frame = [...h.frames.values()][0];
  const timer = [...h.timers.values()][0].callback;
  const wake = h.wake;
  h.time(4000);
  timer(); frame(4000); wake(); h.cancel();
  assert.equal(h.completed, 1);
  assert.equal(h.unsubscribed, 1);
  assert.deepEqual(h.values, [1]);
});
test("cancelling a spin removes all scheduled work without recording a result", () => {
  const h = harness();
  h.cancel(); h.cancel();
  h.timer(60000); h.frame(60000);
  assert.equal(h.completed, 0);
  assert.equal(h.unsubscribed, 1);
  assert.equal(h.wake, undefined);
  assert.equal(h.frames.size, 0);
  assert.equal(h.timers.size, 0);
});
