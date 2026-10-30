import { test } from "node:test";
import assert from "node:assert/strict";
import { sameWheelAppearance, optionPage } from "../src/render-state.mjs";
test("histórico e metadados não invalidam a imagem, mas alterações visuais invalidam", () => {
  const options = [
    { id: "a", label: "Ana", color: "#123456" },
    { id: "b", label: "Bruno", color: "#abcdef" },
  ];
  assert.equal(
    sameWheelAppearance(
      options,
      options.map((o) => ({ ...o, drawn: true })),
    ),
    true,
  );
  for (const changes of [
    { label: "Outro" },
    { color: "#000000" },
    { id: "novo" },
  ])
    assert.equal(
      sameWheelAppearance(options, [{ ...options[0], ...changes }, options[1]]),
      false,
    );
  assert.equal(sameWheelAppearance(options, [...options].reverse()), false);
  assert.equal(sameWheelAppearance(options, options.slice(1)), false);
  assert.equal(sameWheelAppearance(undefined, options), false);
});
test("paginação limita o DOM sem perder índices originais ou o último item", () => {
  const rows = Array.from({ length: 500 }, (_, index) => ({
    index,
    id: `row-${index}`,
  }));
  assert.equal(optionPage(rows, 0).rows.length, 50);
  assert.equal(optionPage(rows, 1).rows[0].index, 50);
  assert.equal(optionPage(rows, 99).rows.at(-1).index, 499);
  assert.equal(optionPage(rows.slice(0, 40), 9).index, 0);
  assert.deepEqual(optionPage([], 3).rows, []);
  assert.equal(rows.length, 500);
});
