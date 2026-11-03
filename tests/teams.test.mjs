import test from "node:test";
import assert from "node:assert/strict";
import { generateTeams, teamsCSV, teamsText } from "../src/teams.mjs";
const options = Array.from({ length: 11 }, (_, i) => ({ id: String(i), label: i < 2 ? "Ana" : `Pessoa ${i}`, drawn: true }));
const fill = (array) => { array.fill(0); return array; };
test("distribui cada participação ativa uma vez e preserva a lista", () => {
  const input = [...options, { id: "off", label: "Ausente", disabled: true }];
  const before = structuredClone(input);
  const teams = generateTeams(input, "teams", 3, fill);
  assert.deepEqual(teams.map((t) => t.length), [4, 4, 3]);
  assert.equal(new Set(teams.flat().map((p) => p.id)).size, 11);
  assert.equal(teams.flat().filter((p) => p.label === "Ana").length, 2);
  assert.deepEqual(input, before);
});
test("respeita limite de pessoas e equilíbrio em todas as quantidades", () => {
  for (let amount = 1; amount <= 11; amount++) {
    for (const mode of ["teams", "size"]) {
      const teams = generateTeams(options, mode, amount, fill);
      const sizes = teams.map((t) => t.length);
      assert.equal(teams.length, mode === "teams" ? amount : Math.ceil(11 / amount));
      assert.equal(teams.flat().length, 11);
      assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
      assert.ok(Math.min(...sizes) >= 1);
      if (mode === "size") assert.ok(Math.max(...sizes) <= amount);
    }
  }
});
test("recusa quantidades inválidas e listas insuficientes", () => {
  for (const n of [0, -1, 1.5, 12, NaN, Infinity])
    assert.throws(() => generateTeams(options, "teams", n), RangeError);
  assert.throws(() => generateTeams(options, "other", 2), RangeError);
  assert.throws(() => generateTeams([], "teams", 1), RangeError);
  assert.throws(() => generateTeams([{ id: "1", label: "Ana" }, { id: "2", disabled: true }], "teams", 1), RangeError);
});
test("exporta equipes com proteção de fórmulas e aspas", () => {
  const teams = [[{ id: "1", label: '=HYPERLINK("x")' }], [{ id: "2", label: "João, Silva" }]];
  const csv = teamsCSV("+Evento", teams);
  assert.ok(csv.startsWith('\uFEFF"Roleta","Equipe","Participante"'));
  assert.ok(csv.includes('"\'+Evento"'));
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));
  assert.ok(csv.includes('"Equipe 2","João, Silva"'));
  assert.equal(teamsText("Evento", teams), 'Evento\n\nEquipe 1\n=HYPERLINK("x")\n\nEquipe 2\nJoão, Silva');
});
