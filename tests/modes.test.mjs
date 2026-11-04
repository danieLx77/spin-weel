import test from "node:test";
import assert from "node:assert/strict";
import { optionsForMode } from "../src/modes.mjs";
import { sectorLayout, weightedIndex } from "../src/weighted.mjs";
import { createShareLink, parseSharedWheel } from "../src/extras.mjs";

const options = [{ id: "a", label: "Ana", weight: 9 }, { id: "b", label: "Bruno", weight: 1 }];
test("apenas o modo com pesos muda as chances e os setores", () => {
  const original = structuredClone(options);
  for (const mode of ["single", "multi", "teams"]) {
    const pool = optionsForMode(options, mode);
    assert.deepEqual(pool.map((p) => p.weight), [1, 1]);
    assert.deepEqual(sectorLayout(pool), [{ start: 0, end: .5 }, { start: .5, end: 1 }]);
    assert.equal(weightedIndex(pool, (a) => { a[0] = 1; }), 1);
  }
  const weighted = optionsForMode(options, "weighted");
  assert.deepEqual(weighted.map((p) => p.weight), [9, 1]);
  assert.equal(weightedIndex(weighted, (a) => { a[0] = 1; }), 0);
  assert.deepEqual(options, original);
});
test("links compartilham as chances do modo escolhido", () => {
  for (const mode of ["single", "weighted"]) {
    const wheel = { name: "Lista", options: optionsForMode(options, mode), history: [] };
    const copy = parseSharedWheel(new URL(createShareLink(wheel, "https://example.com")).hash);
    assert.deepEqual(copy.options.map((p) => p.weight), mode === "single" ? [1, 1] : [9, 1]);
  }
});
