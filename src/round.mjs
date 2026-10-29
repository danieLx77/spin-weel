export function availableOptions(wheel) {
  return wheel.noRepeat
    ? wheel.options.filter((option) => !option.drawn)
    : wheel.options;
}
export function canSpin(wheel) {
  return Boolean(
    wheel && availableOptions(wheel).length >= (wheel.noRepeat ? 1 : 2),
  );
}
export function markDrawn(wheel, id) {
  if (!wheel.noRepeat) return wheel;
  return {
    ...wheel,
    options: wheel.options.map((option) =>
      option.id === id ? { ...option, drawn: true } : option,
    ),
  };
}
export function resetRound(wheel) {
  return {
    ...wheel,
    options: wheel.options.map((option) => ({ ...option, drawn: false })),
  };
}
