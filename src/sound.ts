// Shared, gesture-unlocked audio: one reusable click buffer for every wheel.
let context: AudioContext | undefined;
let output: GainNode | undefined;
let buffer: AudioBuffer | undefined;
let enabled = true;
let volume = 0.7;
let lastClick = -Infinity;

export function setWheelSound(value: boolean) {
  enabled = value;
  if (context && output) {
    output.gain.cancelScheduledValues(context.currentTime);
    output.gain.setTargetAtTime(
      value ? volume * 0.4 : 0,
      context.currentTime,
      0.008,
    );
  }
}

export function prepareWheelSound() {
  if (!enabled) return;
  try {
    if (!context) {
      context = new AudioContext();
      output = context.createGain();
      output.gain.value = enabled ? volume * 0.4 : 0;
      output.connect(context.destination);
      const length = Math.ceil(context.sampleRate * 0.045);
      buffer = context.createBuffer(1, length, context.sampleRate);
      const samples = buffer.getChannelData(0);
      let seed = 37;
      for (let i = 0; i < length; i++) {
        const time = i / context.sampleRate;
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const noise = (seed / 0x100000000) * 2 - 1;
        const attack = Math.min(1, time / 0.0007);
        samples[i] =
          attack *
          (0.55 * noise * Math.exp(-time * 380) +
            0.35 * Math.sin(2 * Math.PI * 1350 * time) * Math.exp(-time * 180));
      }
    }
    if (context.state === "suspended") void context.resume().catch(() => {});
  } catch {
    // Unsupported or blocked sound never prevents a draw.
    if (context) void context.close().catch(() => {});
    context = undefined;
    output = undefined;
    buffer = undefined;
  }
}

export function playWheelClick() {
  if (
    !enabled ||
    !context ||
    context.state !== "running" ||
    !output ||
    !buffer ||
    document.hidden
  )
    return;
  const now = context.currentTime;
  // Coalesce very dense pin crossings and simultaneous wheels to avoid clipping.
  if (now - lastClick < 0.025) return;
  lastClick = now;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(output);
  source.onended = () => source.disconnect();
  source.start(now);
}

export function disposeWheelSound() {
  if (context) void context.close().catch(() => {});
  context = undefined;
  output = undefined;
  buffer = undefined;
  lastClick = -Infinity;
}

export function setWheelVolume(value: number) {
  volume = Math.max(0, Math.min(1, value));
  setWheelSound(enabled);
}
