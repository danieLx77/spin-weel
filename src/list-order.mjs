import { randomIndex } from "./logic.mjs";
const collator = new Intl.Collator("pt-BR", {
  sensitivity: "base",
  numeric: true,
});
export function reorderOptions(options, order, fill) {
  const next = [...options];
  if (order === "asc" || order === "desc") {
    next.sort(
      (a, b) => collator.compare(a.label, b.label) * (order === "asc" ? 1 : -1),
    );
  } else if (order === "shuffle") {
    for (let i = next.length - 1; i > 0; i--) {
      const j = randomIndex(i + 1, fill);
      [next[i], next[j]] = [next[j], next[i]];
    }
  } else throw new Error("Ordem inválida.");
  return next;
}
export function restoreOrder(options, ids) {
  const current = new Map(options.map((o) => [o.id, o]));
  const restored = ids
    .filter((id) => current.has(id))
    .map((id) => current.get(id));
  const original = new Set(ids);
  return [...restored, ...options.filter((o) => !original.has(o.id))];
}
