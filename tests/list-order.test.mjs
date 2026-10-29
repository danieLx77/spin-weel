import { test } from "node:test";
import assert from "node:assert/strict";
import { reorderOptions, restoreOrder } from "../src/list-order.mjs";
const options = [
  { id: "a", label: "Opção 10", color: "#123456", disabled: true },
  { id: "b", label: "Álvaro", color: "#654321", drawn: true },
  { id: "c", label: "Opção 2", color: "#abcdef" },
];
test("ordenação em português é natural e preserva dados e entrada", () => {
  const sorted = reorderOptions(options, "asc");
  assert.deepEqual(
    sorted.map((o) => o.id),
    ["b", "c", "a"],
  );
  assert.deepEqual(
    reorderOptions(options, "desc").map((o) => o.id),
    ["a", "c", "b"],
  );
  assert.equal(sorted[2], options[0]);
  assert.deepEqual(
    options.map((o) => o.id),
    ["a", "b", "c"],
  );
});
test("embaralhamento pode produzir todas as permutações sem duplicar participações", () => {
  const seen = new Set();
  for (let a = 0; a < 3; a++)
    for (let b = 0; b < 2; b++) {
      const values = [a, b];
      const next = reorderOptions(options, "shuffle", (array) => {
        array[0] = values.shift();
      });
      assert.deepEqual(
        new Set(next.map((o) => o.id)),
        new Set(["a", "b", "c"]),
      );
      seen.add(next.map((o) => o.id).join(""));
    }
  assert.equal(seen.size, 6);
});
test("desfazer a ordem preserva edições, novas opções e exclusões posteriores", () => {
  const edited = { ...options[0], label: "Editado" },
    added = { id: "new", label: "Novo" };
  const restored = restoreOrder([added, options[2], edited], ["a", "b", "c"]);
  assert.deepEqual(
    restored.map((o) => o.id),
    ["a", "c", "new"],
  );
  assert.equal(restored[0].label, "Editado");
  assert.equal(restored[0].disabled, true);
});
