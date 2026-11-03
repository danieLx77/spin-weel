import test from "node:test";
import assert from "node:assert/strict";
import { weightedIndex, sectorLayout, weightedRotation, pinBoundary } from "../src/weighted.mjs";
import { validateWheels, targetRotation } from "../src/logic.mjs";
import { createShareLink, parseSharedWheel } from "../src/extras.mjs";
import { sameWheelAppearance } from "../src/render-state.mjs";
const options = [{ id: "a", label: "A", color: "#123456", weight: 2 }, { id: "b", label: "B", color: "#654321", weight: 1 }];
test("cada bilhete corresponde ao peso, sem duplicar opções", () => {
  assert.deepEqual([0,1,2].map((ticket) => weightedIndex(options, (a) => { a[0] = ticket; })), [0,0,1]);
  assert.deepEqual(sectorLayout(options), [{ start: 0, end: 2/3 }, { start: 2/3, end: 1 }]);
});
test("ponteiro termina no centro do setor ponderado", () => {
  const sectors = sectorLayout(options);
  for (let index = 0; index < 2; index++) {
    const rotation = weightedRotation(43, index, options);
    const fraction = ((360 - rotation % 360) % 360) / 360;
    assert.ok(Math.abs(fraction - (sectors[index].start + sectors[index].end) / 2) < 1e-10);
  }
  for (let index = 0; index < 2; index++)
    assert.equal(weightedRotation(102, index, options.map((p) => ({ ...p, weight: 1 }))), targetRotation(102, index, 2));
  assert.ok(pinBoundary(130, sectors) > pinBoundary(0, sectors));
});
test("pesos persistem nos backups e links e invalidam o desenho", () => {
  const wheel = { name: "Pesos", options, history: [] };
  assert.equal(validateWheels([wheel])[0].options[0].weight, 2);
  assert.equal(parseSharedWheel(new URL(createShareLink(wheel, "https://example.com")).hash).options[0].weight, 2);
  assert.equal(validateWheels([{ ...wheel, options: [{ label: "Antiga" }] }])[0].options[0].weight, 1);
  assert.equal(sameWheelAppearance(options, options.map((p) => ({ ...p, weight: 3 }))), false);
  for (const weight of [0,-1,1.5,1001,"2",null])
    assert.throws(() => validateWheels([{ ...wheel, options: [{ label: "Inválida", weight }] }]));
});

test("chances pequenas continuam visíveis e ausentes ficam em zero", async () => {
  const { chanceText } = await import("../src/weighted.mjs");
  const pool = [{ weight: 1 }, ...Array.from({ length: 499 }, () => ({ weight: 1000 }))];
  assert.equal(chanceText(pool[0], {}, pool), "<0,01%");
  assert.equal(chanceText({ weight: 2, disabled: true }, {}, pool), "0%");
  assert.equal(chanceText({ weight: 2, drawn: true }, { noRepeat: true }, pool), "0%");
});
