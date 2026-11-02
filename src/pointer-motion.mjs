// Keep pin contact visible even when the OS requests less motion.
// Reduced motion uses a small, non-oscillating return instead of a spring.
export function pointerDeflection(elapsed, reduced) {
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > 210) return 0;
  return reduced
    ? -10 * Math.exp(-elapsed / 45)
    : -28 * Math.exp(-elapsed / 65) * Math.cos(elapsed / 32);
}
