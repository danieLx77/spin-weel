import { test } from "node:test";
import assert from "node:assert/strict";
import { drawSequence, resultsCSV, resultsText } from "../src/results.mjs";
import { createShareLink, parseSharedWheel } from "../src/extras.mjs";
const wheel = () => ({
  name: "Participantes",
  options: [
    { id: "a", label: "Mesmo nome", color: "#111111" },
    { id: "b", label: "Mesmo nome", color: "#222222" },
    { id: "c", label: "Ausente", color: "#333333", disabled: true },
    { id: "d", label: "Anterior", color: "#444444", drawn: true },
  ],
  noRepeat: true,
});
test("sequência anima antes de registrar e nunca repete IDs ou inclui indisponíveis", async () => {
  const drawn = [],
    animations = [];
  const results = await drawSequence({
    wheel: wheel(),
    count: 2,
    shouldStop: () => false,
    spin: async (pool, index) => {
      assert.equal(drawn.length, animations.length);
      animations.push(pool[index].id);
      return true;
    },
    onResult: (r) => drawn.push(r.id),
  });
  assert.deepEqual(new Set(drawn), new Set(["a", "b"]));
  assert.deepEqual(drawn, animations);
  assert.equal(results.length, 2);
  assert.ok(results.every((r) => Number.isFinite(Date.parse(r.date))));
});
test("parar a sequência preserva somente os giros concluídos", async () => {
  let stopped = false;
  const results = await drawSequence({
    wheel: wheel(),
    count: 2,
    shouldStop: () => stopped,
    spin: async () => true,
    onResult: () => {
      stopped = true;
    },
  });
  assert.equal(results.length, 1);
  const aborted = await drawSequence({
    wheel: wheel(),
    count: 2,
    shouldStop: () => false,
    spin: async () => false,
    onResult: () => assert.fail("giro cancelado"),
  });
  assert.equal(aborted.length, 0);
});
test("limites inválidos não iniciam animação nem sorteio", async () => {
  for (const count of [0, -1, 3, 1.5, NaN])
    await assert.rejects(
      drawSequence({
        wheel: wheel(),
        count,
        shouldStop: () => false,
        spin: () => assert.fail(),
        onResult: () => assert.fail(),
      }),
      RangeError,
    );
});
test("exportação mantém Unicode, aspas e linhas, neutralizando fórmulas", () => {
  const rows = [
    { label: 'João, "Júnior"\nSilva', date: "2026-10-29T12:00:00.000Z" },
    {
      label: ' =HYPERLINK("https://exemplo")',
      date: "2026-10-29T12:01:00.000Z",
    },
  ];
  const csv = resultsCSV("@roleta", rows);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'@roleta"'));
  assert.ok(csv.includes('"João, ""Júnior""\nSilva"'));
  assert.ok(csv.includes("\"' =HYPERLINK"));
  assert.ok(csv.includes(rows[0].date));
  assert.equal(
    resultsText("Minha roleta", rows),
    'Minha roleta\n1. João, "Júnior"\nSilva\n2.  =HYPERLINK("https://exemplo")',
  );
});
test("link compartilhado preserva opções desativadas sem levar resultados", () => {
  const url = new URL(createShareLink(wheel(), "https://exemplo.com/"));
  const shared = parseSharedWheel(url.hash);
  assert.equal(shared.options[2].disabled, true);
  assert.equal(shared.options[3].drawn, false);
  assert.equal(shared.history.length, 0);
});
