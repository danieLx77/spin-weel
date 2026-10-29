import { test } from "node:test";
import assert from "node:assert/strict";
import jsQR from "jsqr";
import { makeQRMatrix, MAX_QR_LENGTH } from "../src/qr.mjs";
import { createShareLink, parseSharedWheel } from "../src/extras.mjs";
function decode(matrix) {
  const cell = 4,
    quiet = 4,
    width = (matrix.length + quiet * 2) * cell;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  matrix.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark)
        for (let dy = 0; dy < cell; dy++)
          for (let dx = 0; dx < cell; dx++) {
            const i =
              (((y + quiet) * cell + dy) * width + (x + quiet) * cell + dx) * 4;
            pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
          }
    }),
  );
  return jsQR(pixels, width, width)?.data;
}
test("QR Code decodifica para a cópia exata da roleta, inclusive Unicode", async () => {
  const url = createShareLink(
    {
      name: "Refeição",
      options: [
        { label: "Pão & café", color: "#123456" },
        { label: "Sushi 🍣", color: "#abcdef", disabled: true },
      ],
    },
    "https://danielx77.github.io/spin-weel/",
  );
  const decoded = decode(await makeQRMatrix(url));
  assert.equal(decoded, url);
  const shared = parseSharedWheel(new URL(decoded).hash);
  assert.equal(shared.name, "Refeição");
  assert.equal(shared.options[1].label, "Sushi 🍣");
  assert.equal(shared.options[1].disabled, true);
});
test("QR no limite mantém conteúdo e códigos excessivos são recusados", async () => {
  const prefix = "https://exemplo.com/#";
  const url = prefix + "a".repeat(MAX_QR_LENGTH - prefix.length);
  assert.equal(decode(await makeQRMatrix(url)), url);
  await assert.rejects(makeQRMatrix(url + "a"), /grande demais/);
  await assert.rejects(makeQRMatrix("javascript:alert(1)"), /inválido/);
});
