export function activeOptions(wheel) {
  return wheel.options.filter((option) => !option.disabled);
}
export function availableOptions(wheel) {
  const options = activeOptions(wheel);
  return wheel.noRepeat ? options.filter((option) => !option.drawn) : options;
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
