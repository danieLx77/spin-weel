import { test } from "node:test";
import assert from "node:assert/strict";
import { pointerDeflection } from "../src/pointer-motion.mjs";

test("pin contact moves the pointer with either OS motion preference", () => {
  for (const reduced of [false, true]) {
    assert.ok(pointerDeflection(0, reduced) < 0);
    assert.notEqual(pointerDeflection(16, reduced), 0);
    assert.equal(pointerDeflection(211, reduced), 0);
  }
});

test("reduced motion returns gently without spring oscillation", () => {
  let previous = 10;
  for (let elapsed = 0; elapsed <= 210; elapsed++) {
    const value = pointerDeflection(elapsed, true);
    assert.ok(value < 0);
    assert.ok(Math.abs(value) <= previous);
    previous = Math.abs(value);
  }
  assert.equal(pointerDeflection(0, true), -10);
  assert.equal(pointerDeflection(0, false), -28);
  assert.ok(pointerDeflection(100, false) > 0);
});

test("idle pointer is stable before contact and after settling", () => {
  for (const reduced of [false, true])
    for (const elapsed of [-1, 211, 1000, Infinity, NaN])
      assert.equal(pointerDeflection(elapsed, reduced), 0);
});
