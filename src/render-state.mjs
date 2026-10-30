// Compare what is actually painted, not array identity or history/round metadata.
export function sameWheelAppearance(previous, next) {
  return Boolean(
    previous &&
    previous.length === next.length &&
    previous.every(
      (item, i) =>
        item.id === next[i].id &&
        item.label === next[i].label &&
        item.color === next[i].color,
    ),
  );
}
export const EDITOR_PAGE_SIZE = 50;
export function optionPage(options, page, size = EDITOR_PAGE_SIZE) {
  const last = Math.max(0, Math.ceil(options.length / size) - 1);
  const index = Math.max(0, Math.min(last, page));
  return { index, last, rows: options.slice(index * size, (index + 1) * size) };
}
