import { test } from "node:test";
import assert from "node:assert/strict";
import { createSpinClock } from "../src/spin-clock.mjs";

test("a delayed first frame never skips the spin", () => {
  const progress = createSpinClock(4000);
  assert.equal(progress(60000), 0);
  assert.equal(progress(60020), 0.005);
});

test("a suspended tab or long stall cannot finish the spin instantly", () => {
  const progress = createSpinClock(4000);
  progress(0);
  assert.equal(progress(20), 0.005);
  assert.equal(progress(60000), 0.03);
  assert.equal(progress(60020), 0.035);
});

test("all configured durations finish only after their rendered time", () => {
  for (const duration of [4000, 9000, 14000]) {
    const progress = createSpinClock(duration);
    assert.equal(progress(0), 0);
    for (let now = 20; now < duration; now += 20)
      assert.ok(progress(now) < 1);
    assert.equal(progress(duration), 1);
    assert.equal(progress(duration + 20), 1);
  }
});

test("invalid durations fall back to nine seconds", () => {
  for (const duration of [0, -1, NaN, Infinity, undefined]) {
    const progress = createSpinClock(duration);
    progress(0);
    assert.equal(progress(100), 100 / 9000);
  }
});
