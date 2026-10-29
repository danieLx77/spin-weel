import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availableOptions,
  canSpin,
  markDrawn,
  resetRound,
} from "../src/round.mjs";
import { parseBackup, randomIndex } from "../src/logic.mjs";
const wheel = () => ({
  id: "w",
  name: "Teste",
  noRepeat: true,
  options: [
    { id: "a", label: "Mesmo nome", color: "#2563eb" },
    { id: "b", label: "Mesmo nome", color: "#e11d48" },
    { id: "c", label: "Outro nome", color: "#10b981" },
  ],
  history: [],
});
test("sorteio sem repetição termina sem apagar entradas, inclusive a última", () => {
  let w = wheel();
  const results = [];
  while (canSpin(w)) {
    const available = availableOptions(w);
    const selected = available[randomIndex(available.length)];
    results.push(selected.id);
    w = markDrawn(w, selected.id);
  }
  assert.equal(new Set(results).size, 3);
  assert.equal(w.options.length, 3);
  assert.equal(availableOptions(w).length, 0);
  assert.equal(canSpin(w), false);
});
test("nomes duplicados são participações independentes", () => {
  const w = markDrawn(wheel(), "a");
  assert.deepEqual(
    availableOptions(w).map((o) => o.id),
    ["b", "c"],
  );
});
test("reiniciar a rodada restaura todos sem perder histórico ou cores", () => {
  const original = wheel();
  const reset = resetRound(markDrawn(original, "b"));
  assert.equal(availableOptions(reset).length, 3);
  assert.deepEqual(
    reset.options.map((o) => o.color),
    original.options.map((o) => o.color),
  );
  assert.deepEqual(reset.history, original.history);
});
test("modo normal mantém chance de repetição e exige duas opções", () => {
  const w = { ...wheel(), noRepeat: false };
  assert.equal(markDrawn(w, "a"), w);
  assert.equal(availableOptions(w), w.options);
  assert.equal(canSpin({ ...w, options: [w.options[0]] }), false);
  assert.equal(
    canSpin({ ...w, noRepeat: true, options: [w.options[0]] }),
    true,
  );
});
test("backup preserva rodada com IDs regenerados e suporta arquivos antigos", () => {
  const w = markDrawn(wheel(), "b");
  const saved = parseBackup(JSON.stringify({ version: 1, wheels: [w] }))[0];
  assert.equal(saved.noRepeat, true);
  assert.deepEqual(
    availableOptions(saved).map((o) => o.label),
    ["Mesmo nome", "Outro nome"],
  );
  assert.notEqual(saved.options[0].id, "a");
  const old = parseBackup(
    JSON.stringify({
      version: 1,
      wheels: [{ name: "Antiga", options: [{ label: "A", color: "#ffffff" }] }],
    }),
  )[0];
  assert.equal(old.noRepeat, false);
  assert.equal(old.options[0].drawn, false);
});
