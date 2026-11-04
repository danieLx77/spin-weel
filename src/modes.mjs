// Saved weights belong to the weighted mode; casual and simultaneous draws are equal.
export function optionsForMode(options, mode) {
  return mode === "weighted"
    ? options
    : options.map((option) => ({ ...option, weight: 1 }));
}
