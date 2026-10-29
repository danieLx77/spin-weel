import { test } from "node:test";
import assert from "node:assert/strict";
import {
  randomIndex,
  validateWheels,
  targetRotation,
  spinProgress,
} from "../src/logic.mjs";
test("rejeita valores que causariam viés", () => {
  let calls = 0;
  assert.equal(
    randomIndex(10, (a) => {
      a[0] = calls++ === 0 ? 4294967295 : 19;
    }),
    9,
  );
  assert.equal(calls, 2);
});
test("cada resíduo mapeia ao campo correspondente", () => {
  for (let i = 0; i < 10; i++)
    assert.equal(
      randomIndex(10, (a) => {
        a[0] = i;
      }),
      i,
    );
});
test("não permite sorteio vazio", () => assert.throws(() => randomIndex(0)));
test("valida importações e normaliza cores", () => {
  const w = validateWheels([
    { name: "Teste", options: [{ label: "A", color: "bad" }] },
  ]);
  assert.match(w[0].options[0].color, /^#/);
  assert.throws(() => validateWheels([{ name: "Teste", options: [{}] }]));
});

test("a rotação final coloca o centro do vencedor sob o ponteiro", () => {
  for (const count of [2, 3, 8, 10, 37, 500]) {
    for (let i = 0; i < count; i++) {
      const angle = targetRotation(2837, i, count);
      const final = (((angle + (i + 0.5) * (360 / count)) % 360) + 360) % 360;
      assert.ok(Math.min(final, 360 - final) < 1e-8);
      assert.ok(angle - 2837 >= 720);
    }
  }
});
test("backups preservam rótulos e histórico sem reutilizar identificadores", () => {
  const input = [
    {
      id: "old",
      name: " Teste ",
      options: [{ id: "old", label: " A ", color: "#123456" }],
      history: [{ label: "A", date: "2026-10-29T12:00:00Z" }, null],
    },
  ];
  const result = validateWheels(input);
  assert.equal(result[0].name, "Teste");
  assert.equal(result[0].options[0].label, "A");
  assert.equal(result[0].history.length, 1);
  assert.notEqual(result[0].id, "old");
});

test("giro suave avança sem saltos e desacelera até parar", () => {
  assert.equal(spinProgress(0), 0);
  assert.equal(spinProgress(1), 1);
  let previous = 0;
  for (let i = 1; i <= 1000; i++) {
    const next = spinProgress(i / 1000);
    assert.ok(next >= previous && next - previous < 0.002);
    previous = next;
  }
  assert.ok(spinProgress(0.999) - spinProgress(0.998) < 0.000001);
});
