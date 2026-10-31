import { sameWheelAppearance } from "./render-state.mjs";
import { prepareWheelSound, playWheelClick } from "./sound";
import { createEffect, onCleanup, onMount } from "solid-js";
import { spinProgress, targetRotation, labelColor } from "./logic.mjs";
import { createSpinClock } from "./spin-clock.mjs";
export type WheelOption = { id: string; label: string; color: string };
export type WheelHandle = { spin: (index: number) => Promise<boolean> };
export function Wheel(props: {
  options: WheelOption[];
  name: string;
  reduced: boolean;
  duration: number;
  mystery: boolean;
  disabled: boolean;
  onSpin: () => void;
  register: (handle: WheelHandle) => void;
}) {
  let canvas!: HTMLCanvasElement;
  let pointer!: HTMLDivElement;
  let frame!: HTMLDivElement;
  let angle = 0,
    raf = 0,
    busy = false;
  let previousMystery: boolean | undefined;
  let previousOptions: WheelOption[] | undefined;
  let finish: ((completed: boolean) => void) | undefined;
  createEffect(() => {
    const options = props.options;
    const mystery = props.mystery;
    if (
      !canvas ||
      busy ||
      (sameWheelAppearance(previousOptions, options) &&
        mystery === previousMystery)
    )
      return;
    previousMystery = mystery;
    previousOptions = options;
    angle = 0;
    canvas.style.transform = "rotate(0deg)";
    const ctx = canvas.getContext("2d")!;
    canvas.width = canvas.height = 1000;
    ctx.clearRect(0, 0, 1000, 1000);
    ctx.fillStyle = "#d4d4d8";
    ctx.beginPath();
    ctx.arc(500, 500, 495, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8e3ee";
    ctx.beginPath();
    ctx.arc(500, 500, 469, 0, Math.PI * 2);
    ctx.fill();
    const slice = (Math.PI * 2) / Math.max(1, options.length);
    options.forEach((o, i) => {
      const start = -Math.PI / 2 + i * slice;
      ctx.beginPath();
      ctx.moveTo(500, 500);
      ctx.arc(500, 500, 468, start, start + slice);
      ctx.closePath();
      ctx.fillStyle = o.color;
      ctx.fill();
      ctx.strokeStyle = "#ffffffa0";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (options.length <= 60) {
        ctx.save();
        ctx.translate(500, 500);
        ctx.rotate(start + slice / 2);
        ctx.fillStyle = labelColor(o.color);
        ctx.font = `700 ${options.length > 24 ? 23 : options.length > 12 ? 30 : 40}px system-ui`;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(
          mystery
            ? "?"
            : o.label.length > 19
              ? o.label.slice(0, 18) + "…"
              : o.label,
          427,
          0,
          330,
        );
        ctx.restore();
      }
    });
    options.forEach((_, i) => {
      const a = -Math.PI / 2 + i * slice;
      const x = 500 + Math.cos(a) * 481,
        y = 500 + Math.sin(a) * 481;
      ctx.beginPath();
      ctx.arc(x + 1, y + 3, Math.min(7, 1100 / options.length), 0, Math.PI * 2);
      ctx.fillStyle = "#27272a30";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, Math.min(7, 1100 / options.length), 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#71717a";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  });
  onMount(() =>
    props.register({
      spin(index) {
        if (busy || props.options.length < 1) return Promise.resolve(false);
        prepareWheelSound();
        busy = true;
        const from = angle,
          to = targetRotation(from, index, props.options.length);
        // This animation is explicitly requested by the spin button. Reduced
        // motion disables the decorative pointer bounce, not the spin itself.
        const progress = createSpinClock(props.duration);
        const slice = 360 / props.options.length;
        let previousBoundary = Math.floor(from / slice),
          lastHit = -1000;
        frame.classList.add("is-spinning");
        return new Promise<boolean>((resolve) => {
          finish = resolve;
          const tick = (now: number) => {
            const t = progress(now);
            angle = from + (to - from) * spinProgress(t);
            canvas.style.transform = `rotate(${angle}deg)`;
            const boundary = Math.floor((angle + 1e-7) / slice);
            if (boundary !== previousBoundary && t < 1) {
              playWheelClick();
              lastHit = now;
              previousBoundary = boundary;
            }
            const elapsed = now - lastHit;
            const deflection =
              props.reduced || elapsed > 210
                ? 0
                : -28 * Math.exp(-elapsed / 65) * Math.cos(elapsed / 32);
            pointer.style.transform = `translateX(-50%) rotate(${deflection}deg)`;
            if (t < 1) raf = requestAnimationFrame(tick);
            else {
              angle = to % 360;
              canvas.style.transform = `rotate(${angle}deg)`;
              pointer.style.transform = "translateX(-50%) rotate(0deg)";
              frame.classList.remove("is-spinning");
              busy = false;
              finish = undefined;
              resolve(true);
            }
          };
          raf = requestAnimationFrame(tick);
        });
      },
    }),
  );
  onCleanup(() => {
    cancelAnimationFrame(raf);
    finish?.(false);
  });
  return (
    <div class="wheel-stage casino-stage">
      <div ref={frame} class="wheel-frame casino-wheel">
        <div class="pointer-base" />
        <div ref={pointer} class="pointer casino-pointer" aria-hidden="true" />
        <canvas
          ref={canvas}
          role="img"
          aria-label={`Roleta ${props.name}, ${props.options.length} ${props.options.length === 1 ? "opção" : "opções"}${props.mystery ? ", nomes ocultos" : ""}`}
        />
        <button
          type="button"
          class="wheel-center"
          aria-label={`Girar roleta ${props.name}`}
          title="Girar roleta"
          disabled={props.disabled}
          onClick={() => { if (!busy && !props.disabled) props.onSpin(); }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 6 9 6-9 6Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
