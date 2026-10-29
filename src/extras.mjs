import { parseBackup } from "./logic.mjs";
export const DURATIONS = [4000, 9000, 14000];
export const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
export function duplicateIds(options) {
  const counts = new Map();
  for (const o of options) {
    const key = normalize(o.label);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return new Set(
    options.filter((o) => counts.get(normalize(o.label)) > 1).map((o) => o.id),
  );
}
export function readSettings(raw) {
  try {
    const data = JSON.parse(raw);
    return {
      duration: DURATIONS.includes(data.duration) ? data.duration : 9000,
      mystery: data.mystery === true,
      volume: Number.isFinite(data.volume)
        ? Math.max(0, Math.min(1, data.volume))
        : 0.7,
    };
  } catch {
    return { duration: 9000, volume: 0.7, mystery: false };
  }
}
export function parseWorkspace(text) {
  const wheels = parseBackup(text),
    raw = JSON.parse(text);
  if (
    raw.sessions !== undefined &&
    (!Array.isArray(raw.sessions) || raw.sessions.length > 20)
  )
    throw Error("O backup deve ter até 20 sessões.");
  for (const session of raw.sessions || [])
    if (
      !session ||
      typeof session.name !== "string" ||
      !session.name.trim() ||
      session.name.length > 80 ||
      !Array.isArray(session.wheelIds) ||
      session.wheelIds.length > 6 ||
      session.wheelIds.some((id) => typeof id !== "string" || id.length > 200)
    )
      throw Error("Sessão inválida no backup.");
  const ids = new Map(raw.wheels.map((w, i) => [w.id, wheels[i].id]));
  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions
        .slice(0, 20)
        .filter(
          (s) =>
            s &&
            typeof s.name === "string" &&
            s.name.trim() &&
            s.name.length <= 80 &&
            Array.isArray(s.wheelIds) &&
            s.wheelIds.length <= 6,
        )
        .map((s) => ({
          id: crypto.randomUUID(),
          name: s.name.trim(),
          wheelIds: [
            ...new Set(
              s.wheelIds
                .filter((id) => typeof id === "string" && ids.has(id))
                .map((id) => ids.get(id)),
            ),
          ],
        }))
        .filter((s) => s.wheelIds.length)
    : [];
  return { wheels, sessions };
}
export function createShareLink(wheel, href) {
  const data = {
    version: 1,
    wheels: [
      {
        name: wheel.name,
        noRepeat: wheel.noRepeat === true,
        options: wheel.options.map((o) => ({
          label: o.label,
          color: o.color,
          disabled: o.disabled === true,
        })),
        history: [],
      },
    ],
  };
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const payload = btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  const url = new URL(href);
  url.search = "";
  url.hash = `roleta=${payload}`;
  if (url.href.length > 8000)
    throw Error(
      "Esta roleta é grande demais para um link. Use Exportar backup.",
    );
  return url.href;
}
export function parseSharedWheel(hash) {
  if (!hash.startsWith("#roleta=")) return null;
  if (hash.length > 8000) throw Error("O link excede o limite permitido.");
  const payload = hash.slice(8);
  if (!/^[A-Za-z0-9_-]+$/.test(payload))
    throw Error("Link de roleta inválido.");
  try {
    const binary = atob(payload.replaceAll("-", "+").replaceAll("_", "/"));
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(binary, (c) => c.charCodeAt(0)),
    );
    const wheels = parseBackup(text);
    if (wheels.length !== 1) throw Error();
    return wheels[0];
  } catch {
    throw Error("Link de roleta inválido ou corrompido.");
  }
}
// CSV: one choice per row; optional name/color columns, quoted cells and ; or , delimiters.
export function parseCSV(text) {
  if (typeof text !== "string" || text.length > 5_000_000)
    throw Error("CSV deve ter até 5 MB.");
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/, 1)[0];
  let quoted = false;
  const counts = { ",": 0, ";": 0, "\t": 0 };
  for (let i = 0; i < first.length; i++) {
    if (first[i] === '"') quoted = !quoted;
    else if (!quoted && first[i] in counts) counts[first[i]]++;
  }
  const separator = Object.keys(counts).sort(
    (a, b) => counts[b] - counts[a],
  )[0];
  const rows = [];
  let row = [],
    cell = "",
    inside = false,
    closed = false;
  const finishCell = () => {
    row.push(cell.trim());
    cell = "";
    closed = false;
    if (row.length > 20) throw Error("CSV tem colunas demais.");
  };
  const finishRow = () => {
    finishCell();
    if (row.some(Boolean)) rows.push(row);
    row = [];
    if (rows.length > 501) throw Error("CSV aceita até 500 opções.");
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inside && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (inside) {
        inside = false;
        closed = true;
      } else if (!cell.trim() && !closed) {
        inside = true;
      } else throw Error("Aspas inválidas no CSV.");
    } else if (!inside && char === separator) finishCell();
    else if (!inside && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      finishRow();
    } else {
      if (closed && char.trim())
        throw Error("Conteúdo inválido após aspas no CSV.");
      cell += char;
    }
    if (cell.length > 100)
      throw Error("Cada campo do CSV deve ter até 100 caracteres.");
    if (row.length > 20) throw Error("CSV tem colunas demais.");
  }
  if (inside) throw Error("Há aspas não fechadas no CSV.");
  if (cell || row.length) finishRow();
  if (!rows.length) throw Error("O CSV está vazio.");
  const header = rows[0].map(normalize),
    nameIndex = header.findIndex((h) =>
      ["nome", "opcao", "name", "label"].includes(h),
    );
  const colorIndex = header.findIndex((h) => ["cor", "color"].includes(h));
  if (nameIndex >= 0) rows.shift();
  if (rows.length > 500) throw Error("CSV aceita até 500 opções.");
  const result = rows.map((r) => ({
    label: r[nameIndex >= 0 ? nameIndex : 0]?.trim(),
    color:
      colorIndex >= 0 && /^#[0-9a-f]{6}$/i.test(r[colorIndex])
        ? r[colorIndex]
        : undefined,
  }));
  if (!result.length || result.some((o) => !o.label))
    throw Error("Há opções vazias no CSV.");
  return result;
}
