import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createShareLink,
  parseSharedWheel,
  parseWorkspace,
  parseCSV,
  duplicateIds,
  readSettings,
} from "../src/extras.mjs";
const w = {
  id: "old",
  name: "Açaí & opções",
  noRepeat: true,
  options: [{ id: "a", label: "João 🍕", color: "#2563eb", drawn: true }],
  history: [{ label: "João", date: "2026-10-29" }],
};
test("compartilhamento Unicode preserva nome e cores, reinicia rodada e não inclui histórico", () => {
  const link = createShareLink(w, "https://example.com/app/?x=1");
  const url = new URL(link);
  assert.equal(url.search, "");
  const parsed = parseSharedWheel(url.hash);
  assert.equal(parsed.name, w.name);
  assert.equal(parsed.options[0].label, w.options[0].label);
  assert.equal(parsed.options[0].drawn, false);
  assert.equal(parsed.history.length, 0);
  assert.equal(parsed.noRepeat, true);
});
test("links inválidos e excessivos são recusados", () => {
  assert.equal(parseSharedWheel("#outro"), null);
  assert.throws(() => parseSharedWheel("#roleta=%bad"));
  assert.throws(() => parseSharedWheel("#roleta=" + "a".repeat(8001)));
  assert.throws(() =>
    createShareLink(
      {
        ...w,
        options: Array(100).fill({ ...w.options[0], label: "x".repeat(100) }),
      },
      "https://example.com/",
    ),
  );
});
test("sessões reconstroem referências após regeneração de IDs", () => {
  const parsed = parseWorkspace(
    JSON.stringify({
      version: 1,
      wheels: [w],
      sessions: [{ name: "Mesa", wheelIds: ["old", "excluída", "old"] }],
    }),
  );
  assert.deepEqual(parsed.sessions[0].wheelIds, [parsed.wheels[0].id]);
  assert.equal(
    parseWorkspace(JSON.stringify({ version: 1, wheels: [w] })).sessions.length,
    0,
  );
});
test("CSV suporta BOM, delimitadores, aspas e cores opcionais", () => {
  assert.deepEqual(
    parseCSV('\uFEFFnome;cor\r\n"João; Silva";#ff0000\r\n"Ana ""A""";#00ff00'),
    [
      { label: "João; Silva", color: "#ff0000" },
      { label: 'Ana "A"', color: "#00ff00" },
    ],
  );
  assert.deepEqual(
    parseCSV("Ana\nBruno").map((o) => o.label),
    ["Ana", "Bruno"],
  );
  assert.equal(parseCSV('nome,cor\n"A, B",invalid')[0].color, undefined);
});
test("CSV malformado e limites não passam silenciosamente", () => {
  assert.throws(() => parseCSV('"não fechou'));
  assert.throws(() => parseCSV('"Ana"x'));
  assert.throws(() => parseCSV("x".repeat(101)));
  assert.throws(() => parseCSV(Array(502).fill("Ana").join("\n")));
  assert.throws(() => parseCSV("nome\n"));
});
test("duplicados consideram acentos, caixa e espaços sem remover participações", () => {
  const ids = duplicateIds([
    { id: "1", label: " João " },
    { id: "2", label: "joao" },
    { id: "3", label: "Ana" },
  ]);
  assert.deepEqual([...ids], ["1", "2"]);
});
test("preferências inválidas voltam ao padrão e volume é limitado", () => {
  assert.deepEqual(readSettings("invalid"), { duration: 9000, volume: 0.7 });
  assert.deepEqual(readSettings('{"duration":4000,"volume":9}'), {
    duration: 4000,
    volume: 1,
  });
});
test("sessões excessivas ou malformadas não são descartadas silenciosamente", () => {
  assert.throws(() =>
    parseWorkspace(
      JSON.stringify({
        version: 1,
        wheels: [w],
        sessions: Array(21).fill({ name: "Mesa", wheelIds: ["old"] }),
      }),
    ),
  );
  assert.throws(() =>
    parseWorkspace(
      JSON.stringify({
        version: 1,
        wheels: [w],
        sessions: [{ name: "Mesa", wheelIds: "bad" }],
      }),
    ),
  );
});
