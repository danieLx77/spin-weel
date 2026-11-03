import test from "node:test";
import assert from "node:assert/strict";
import { validateDrawSessions, archiveBudget } from "../src/draw-sessions.mjs";
import { parseWorkspace, createShareLink, parseSharedWheel } from "../src/extras.mjs";
const session = { id: "s", name: "Evento", startedAt: "2026-11-02T12:00:00Z", endedAt: null,
  participants: [{ id: "p", label: "Ana", weight: 2 }],
  results: Array.from({length: 25}, () => ({ id: "p", label: "Ana", date: "2026-11-02T12:00:01Z" })) };
const wheel = { id: "w", name: "Pessoas", options: [{ id: "p", label: "Ana", weight: 2 }], history: [], drawSessions: [session] };
test("preserva mais de 20 resultados, participantes e datas após recarregar backup", () => {
  const loaded = parseWorkspace(JSON.stringify({ version: 1, wheels: [wheel] })).wheels[0];
  assert.equal(loaded.drawSessions[0].results.length, 25);
  assert.deepEqual(loaded.drawSessions[0].participants, session.participants);
  assert.equal(loaded.drawSessions[0].endedAt, null);
  assert.deepEqual(archiveBudget([loaded]), { results:25, participants:1 });
  assert.deepEqual(parseSharedWheel(new URL(createShareLink(wheel, "https://example.com")).hash).drawSessions, []);
});
test("recusa sessões corrompidas ou acima do limite", () => {
  assert.throws(() => validateDrawSessions(Array(21).fill(session)));
  assert.throws(() => validateDrawSessions([{ ...session, startedAt: "bad" }]));
  assert.throws(() => validateDrawSessions([{ ...session, participants: [{ id: "p", label: "Ana", weight: -1 }] }]));
  assert.throws(() => validateDrawSessions([{ ...session, results: [{ id: "unknown", label: "Ana", date: "2026-11-02" }] }]));
  assert.throws(() => parseWorkspace(JSON.stringify({ version: 1, wheels: [{ ...wheel, drawSessions: Array(20).fill({ ...session, results: Array(251).fill(session.results[0]) }) }] })));
  assert.deepEqual(validateDrawSessions(), []);
});
