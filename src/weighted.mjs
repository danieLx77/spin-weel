import { randomIndex } from "./logic.mjs";
export const optionWeight = (option) => option.weight ?? 1;
export function weightTotal(options) {
  return options.reduce((sum, option) => {
    const weight = optionWeight(option);
    if (!Number.isSafeInteger(weight) || weight < 1 || weight > 1000) throw new RangeError("Use pesos inteiros entre 1 e 1.000.");
    return sum + weight;
  }, 0);
}
export function weightedIndex(options, fill) {
  const total = weightTotal(options);
  let ticket = randomIndex(total, fill);
  for (let index = 0; index < options.length; index++) {
    ticket -= optionWeight(options[index]);
    if (ticket < 0) return index;
  }
  throw new RangeError("Pesos inválidos.");
}
export function sectorLayout(options) {
  const total = weightTotal(options);
  let offset = 0;
  return options.map((option) => {
    const start = offset / total;
    offset += optionWeight(option);
    return { start, end: offset / total };
  });
}
export function weightedRotation(currentRotation, index, options) {
  const sector = sectorLayout(options)[index];
  const target = 360 - (sector.start + sector.end) * 180;
  const current = ((currentRotation % 360) + 360) % 360;
  return currentRotation + 720 + ((target - current + 360) % 360);
}
export function pinBoundary(rotation, sectors) {
  const turns = Math.floor(rotation / 360);
  const fraction = ((rotation % 360) + 360) % 360 / 360;
  return turns * sectors.length + sectors.filter((sector) => 1 - sector.end <= fraction + 1e-9).length;
}

export function chanceText(option, wheel, eligible) {
  if (option.disabled || (wheel.noRepeat && option.drawn)) return "0%";
  const percentage = optionWeight(option) / weightTotal(eligible) * 100;
  return percentage < 0.01 ? "<0,01%" : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(percentage)}%`;
}
