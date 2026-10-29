import { test } from "node:test";
import assert from "node:assert/strict";
import { optionColors, palette, labelColor } from "../src/logic.mjs";
test("a paleta base oferece 24 cores distintas", () => {
  assert.equal(palette.length, 24);
  assert.equal(new Set(palette).size, 24);
});
test("gera 500 cores sem repetir valores e em formato hexadecimal", () => {
  const colors = optionColors(500);
  assert.equal(new Set(colors).size, 500);
  assert.ok(colors.every((c) => /^#[a-f0-9]{6}$/.test(c)));
});
test("adições e lotes evitam cores já utilizadas, inclusive após exclusões", () => {
  const initial = optionColors(35);
  initial.splice(5, 1);
  const added = optionColors(
    100,
    initial.map((c) => c.toUpperCase()),
  );
  assert.equal(new Set([...initial, ...added]).size, 134);
});
test("sequência é determinística e não afeta o sorteio", () =>
  assert.deepEqual(optionColors(50), optionColors(50)));
test("nega quantidades inválidas", () => {
  for (const n of [-1, 501, 1.2]) assert.throws(() => optionColors(n));
});

test("texto adapta ao fundo e mantém contraste mínimo de 4,5:1", () => {
  const luminance = (color) => {
    const c = color
      .slice(1)
      .match(/../g)
      .map((v) => parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  for (const color of [
    ...optionColors(500),
    "#000000",
    "#ffffff",
    "#777777",
    "#888888",
  ]) {
    const a = luminance(color),
      b = luminance(labelColor(color));
    assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5, color);
  }
});

test("renovar muda todas as cores em cliques sucessivos, sem duplicar a paleta", async () => {
  const { renewOptionColors } = await import("../src/logic.mjs");
  let current = optionColors(500);
  for (let click = 0; click < 12; click++) {
    const old = new Set(current.map((c) => c.toLowerCase()));
    const next = renewOptionColors(current, (array) => {
      array[0] = click * 997;
    });
    assert.equal(next.length, 500);
    assert.equal(new Set(next).size, 500);
    assert.ok(next.every((c) => !old.has(c)));
    current = next;
  }
});
