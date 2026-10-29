import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseBackup,
  validateWheels,
  MAX_BACKUP_BYTES,
} from "../src/logic.mjs";
import { contentSecurityPolicy, securityHeaders } from "../security-policy.mjs";
const option = { label: "Opção", color: "#abcdef" };
const wheel = { name: "Teste", options: [option] };
test("rejeita envelopes e versões de backup inválidos antes de importar", () => {
  for (const data of [
    null,
    [],
    {},
    { version: 2, wheels: [] },
    { version: 1, wheels: null },
  ])
    assert.throws(() => parseBackup(JSON.stringify(data)));
  assert.throws(() => parseBackup("{invalid"));
  assert.throws(() => parseBackup(" ".repeat(MAX_BACKUP_BYTES + 1)));
});
test("limita textos, listas e trabalho total de importação", () => {
  assert.throws(() => validateWheels([{ ...wheel, name: "a".repeat(81) }]));
  assert.throws(() =>
    validateWheels([{ ...wheel, options: [{ label: "a".repeat(101) }] }]),
  );
  assert.throws(() =>
    validateWheels([{ ...wheel, options: Array(501).fill(option) }]),
  );
  assert.throws(() =>
    validateWheels(
      Array(11).fill({ ...wheel, options: Array(500).fill(option) }),
    ),
  );
  assert.throws(() =>
    validateWheels([{ ...wheel, history: Array(21).fill({}) }]),
  );
  assert.equal(
    validateWheels(
      Array(10).fill({ ...wheel, options: Array(500).fill(option) }),
    ).length,
    10,
  );
});
test("descarta propriedades não reconhecidas, IDs externos e cores injetadas", () => {
  const input = JSON.parse(
    '{"name":"Teste","options":[{"id":"__proto__","label":"<img src=x onerror=alert(1)>","color":"url(https://attacker.test)"}],"__proto__":{"polluted":true}}',
  );
  const result = validateWheels([input])[0];
  assert.equal(Object.hasOwn(result, "__proto__"), false);
  assert.equal({}.polluted, undefined);
  assert.notEqual(result.options[0].id, "__proto__");
  assert.equal(result.options[0].label, "<img src=x onerror=alert(1)>"); // text, never HTML
  assert.match(result.options[0].color, /^#[a-f0-9]{6}$/i);
});
test("normaliza datas e elimina resultados de histórico malformados", () => {
  const result = validateWheels([
    {
      ...wheel,
      history: [
        { label: "A", date: "2026-10-29T10:00:00Z" },
        { label: "B", date: "not-a-date" },
        { label: "x".repeat(101), date: "2026-10-29" },
        null,
      ],
    },
  ]);
  assert.deepEqual(result[0].history, [
    { label: "A", date: "2026-10-29T10:00:00.000Z" },
  ]);
});
test("política de produção bloqueia scripts inline, plugins, formulários e enquadramento", () => {
  assert.match(contentSecurityPolicy, /script-src 'self';/);
  assert.doesNotMatch(contentSecurityPolicy, /script-src[^;]*unsafe-/);
  assert.match(contentSecurityPolicy, /object-src 'none'/);
  assert.match(contentSecurityPolicy, /base-uri 'none'/);
  assert.match(contentSecurityPolicy, /form-action 'none'/);
  assert.match(
    securityHeaders["Content-Security-Policy"],
    /frame-ancestors 'none'/,
  );
  assert.equal(securityHeaders["X-Content-Type-Options"], "nosniff");
});
