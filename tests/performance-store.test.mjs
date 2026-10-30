import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePerformanceHistory } from "../src/performance-store.mjs";
test("diagnóstico só aceita métricas numéricas e não preserva dados da roleta", () => {
  const result = parsePerformanceHistory(
    JSON.stringify([
      {
        id: "test",
        at: "2026-10-29T12:00:00Z",
        label: "Pessoa privada",
        url: "https://privado/",
        values: {
          LCP: 120,
          CLS: 0,
          INP: -1,
          FCP: "1",
          TTFB: Infinity,
          secret: "nomes",
        },
      },
    ]),
  );
  assert.deepEqual(result, [
    {
      id: "test",
      at: "2026-10-29T12:00:00.000Z",
      values: { LCP: 120, CLS: 0 },
    },
  ]);
});
test("histórico local é limitado e lida com dados inválidos", () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({
    id: String(i),
    at: "2026-10-29T12:00:00Z",
    values: { LCP: i },
  }));
  assert.equal(parsePerformanceHistory(JSON.stringify(rows)).length, 30);
  assert.equal(parsePerformanceHistory(JSON.stringify(rows))[0].id, "10");
  for (const raw of [null, "invalid", "{}", '[{"id":"a","at":"inválida"}]'])
    assert.deepEqual(parsePerformanceHistory(raw), []);
});
