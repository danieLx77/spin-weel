import { test } from "node:test";
import assert from "node:assert/strict";
import { writeSnapshot, StorageConflictError } from "../src/persistence.mjs";
const memory = (initial) => ({
  value: initial,
  getItem() {
    return this.value;
  },
  setItem(_key, value) {
    this.value = value;
  },
});
test("salva edição com base no último valor conhecido", () => {
  const storage = memory("old");
  assert.equal(writeSnapshot(storage, "key", "old", "new"), "new");
  assert.equal(storage.value, "new");
});
test("não substitui dados gravados por outra aba", () => {
  const storage = memory("other-tab");
  assert.throws(
    () => writeSnapshot(storage, "key", "old", "new"),
    StorageConflictError,
  );
  assert.equal(storage.value, "other-tab");
});
test("propaga falha de quota sem alterar o conteúdo existente", () => {
  const storage = memory("old");
  storage.setItem = () => {
    throw Error("QuotaExceededError");
  };
  assert.throws(() => writeSnapshot(storage, "key", "old", "new"));
  assert.equal(storage.value, "old");
});
test("permite salvar no armazenamento inicialmente vazio", () => {
  const storage = memory(null);
  assert.equal(writeSnapshot(storage, "key", null, "first"), "first");
});
