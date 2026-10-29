import { randomIndex } from "./logic.mjs";
import { availableOptions } from "./round.mjs";

// Draw on completion of each animation; interrupted spins never become results.
export async function drawSequence({
  wheel,
  count,
  spin,
  onResult,
  shouldStop,
  between = async () => {},
}) {
  const pool = [...availableOptions(wheel)];
  if (!Number.isSafeInteger(count) || count < 1 || count > pool.length)
    throw new RangeError(
      "Escolha uma quantidade entre 1 e o total de opções disponíveis.",
    );
  const results = [];
  for (let i = 0; i < count && !shouldStop(); i++) {
    const index = randomIndex(pool.length);
    const selected = pool[index];
    if (!(await spin([...pool], index))) break;
    const result = { ...selected, date: new Date().toISOString() };
    results.push(result);
    pool.splice(index, 1);
    onResult(result);
    if (i + 1 < count && !shouldStop()) await between();
  }
  return results;
}

export function resultsText(name, results) {
  return `${name}\n${results.map((r, i) => `${i + 1}. ${r.label}`).join("\n")}`;
}
// Quoting alone does not stop spreadsheet formula execution.
const csvCell = (value) => {
  const text = String(value);
  const safe =
    /^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)
      ? `'${text}`
      : text;
  return `"${safe.replaceAll('"', '""')}"`;
};
export function resultsCSV(name, results) {
  return (
    "\uFEFF" +
    [
      ["Roleta", "Posição", "Opção", "Data (UTC)"],
      ...results.map((r, i) => [name, i + 1, r.label, r.date]),
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n") +
    "\r\n"
  );
}
