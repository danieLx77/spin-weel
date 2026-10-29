export const palette = [
  "#7c3aed",
  "#f97316",
  "#10b981",
  "#e11d48",
  "#2563eb",
  "#eab308",
  "#c026d3",
  "#06b6d4",
  "#ef4444",
  "#84cc16",
  "#4f46e5",
  "#14b8a6",
  "#ec4899",
  "#f59e0b",
  "#0891b2",
  "#ea580c",
  "#16a34a",
  "#9333ea",
  "#0d9488",
  "#d97706",
  "#6366f1",
  "#db2777",
  "#0284c7",
  "#65a30d",
];
// First 24 colors are curated. Further colors use a golden-angle sequence.
export function optionColor(index) {
  if (!Number.isSafeInteger(index) || index < 0)
    throw new RangeError("Índice de cor inválido");
  if (index < palette.length) return palette[index];
  const hue = (index * 137.50776405) % 360;
  const saturation = 0.78 + (index % 4) * 0.05;
  const lightness = 0.44 + (index % 4) * 0.04;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n) => {
    const k = (n + hue / 30) % 12;
    return Math.round(
      255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))),
    )
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}
export function optionColors(count, existing = [], start = 0) {
  if (!Number.isSafeInteger(start) || start < 0 || start > 1_000_024)
    throw new RangeError("Início de paleta inválido");
  if (!Number.isSafeInteger(count) || count < 0 || count > 500)
    throw new RangeError("Quantidade de cores inválida");
  const used = new Set(existing.map((color) => color.toLowerCase()));
  const result = [];
  for (let i = start; result.length < count; i++) {
    const color = optionColor(i);
    if (!used.has(color)) {
      used.add(color);
      result.push(color);
    }
  }
  return result;
}

export function randomIndex(length, fill = (a) => crypto.getRandomValues(a)) {
  if (!Number.isSafeInteger(length) || length < 1 || length > 0xffffffff)
    throw new RangeError("Quantidade inválida");
  const limit = 0x100000000 - (0x100000000 % length);
  const value = new Uint32Array(1);
  do {
    fill(value);
  } while (value[0] >= limit);
  return value[0] % length;
}
export function renewOptionColors(current, fill) {
  return optionColors(
    current.length,
    current,
    24 + randomIndex(1_000_000, fill),
  );
}
export const MAX_BACKUP_BYTES = 5_000_000;
export const MAX_TOTAL_OPTIONS = 5000;
const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const validText = (value, limit) =>
  typeof value === "string" && value.length <= limit && value.trim().length > 0;
export const totalOptions = (wheels) =>
  wheels.reduce((sum, wheel) => sum + wheel.options.length, 0);
export function parseBackup(text) {
  if (typeof text !== "string" || text.length > MAX_BACKUP_BYTES)
    throw new Error("O backup deve ter até 5 MB.");
  const parsed = JSON.parse(text);
  if (!isRecord(parsed) || parsed.version !== 1)
    throw new Error("Formato ou versão de backup não reconhecido.");
  return validateWheels(parsed.wheels);
}
export function validateWheels(data) {
  if (!Array.isArray(data) || data.length > 100)
    throw new Error(
      "Arquivo inválido: use um backup do Volta com até 100 roletas.",
    );
  // Check budgets before allocating identifiers or copying any user-controlled arrays.
  let total = 0;
  for (const w of data) {
    if (
      !isRecord(w) ||
      !validText(w.name, 80) ||
      !Array.isArray(w.options) ||
      w.options.length > 500
    )
      throw new Error(
        "Roleta inválida: nome de até 80 caracteres e até 500 opções.",
      );
    total += w.options.length;
    if (total > MAX_TOTAL_OPTIONS)
      throw new Error("O conjunto deve ter até 5.000 opções.");
    if (
      w.history !== undefined &&
      (!Array.isArray(w.history) || w.history.length > 20)
    )
      throw new Error(
        "Histórico inválido: limite de 20 resultados por roleta.",
      );
    for (const o of w.options)
      if (!isRecord(o) || !validText(o.label, 100))
        throw new Error("Cada opção deve ter de 1 a 100 caracteres.");
  }
  return data.map((w) => ({
    id: crypto.randomUUID(),
    name: w.name.trim(),
    noRepeat: w.noRepeat === true,
    options: w.options.map((o, i) => ({
      id: crypto.randomUUID(),
      label: o.label.trim(),
      drawn: o.drawn === true,
      disabled: o.disabled === true,
      color:
        typeof o.color === "string" && /^#[0-9a-f]{6}$/i.test(o.color)
          ? o.color
          : optionColor(i),
    })),
    history: (w.history || [])
      .filter(
        (h) =>
          isRecord(h) &&
          validText(h.label, 100) &&
          typeof h.date === "string" &&
          h.date.length <= 40 &&
          Number.isFinite(Date.parse(h.date)),
      )
      .map((h) => ({
        label: h.label.trim(),
        date: new Date(h.date).toISOString(),
      })),
  }));
}

export function targetRotation(currentRotation, index, count) {
  const target = 360 - (index + 0.5) * (360 / count);
  const current = ((currentRotation % 360) + 360) % 360;
  return currentRotation + 360 * 2 + ((target - current + 360) % 360);
}

// Integral of a smooth velocity curve: accelerate, cruise, then coast to a stop.
export function spinProgress(t) {
  t = Math.max(0, Math.min(1, t));
  const ramp = 0.12,
    coast = 0.35,
    tail = 1 - coast;
  const area = ramp / 2 + (coast - ramp) + tail / 2;
  if (t < ramp)
    return (
      (t / 2 - (ramp * Math.sin((Math.PI * t) / ramp)) / (2 * Math.PI)) / area
    );
  if (t < coast) return (ramp / 2 + t - ramp) / area;
  const u = (t - coast) / tail;
  return (
    (ramp / 2 +
      coast -
      ramp +
      tail * (u / 2 + Math.sin(Math.PI * u) / (2 * Math.PI))) /
    area
  );
}

export function labelColor(background) {
  const channels = background
    .slice(1)
    .match(/../g)
    .map((value) => parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? "#000000" : "#ffffff";
}
