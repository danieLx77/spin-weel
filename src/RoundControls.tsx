import { Show } from "solid-js";
export function RoundControls(props: {
  enabled: boolean;
  remaining: number;
  total: number;
  used: boolean;
  busy: boolean;
  onToggle: () => void;
  onReset: () => void;
}) {
  return (
    <div class="round-controls">
      <label>
        <input
          type="checkbox"
          checked={props.enabled}
          disabled={props.busy}
          onChange={props.onToggle}
        />
        Sem repetição
      </label>
      <Show when={props.enabled}>
        <span class="round-count" aria-live="polite">
          {props.remaining}/{props.total}
        </span>
        <button
          class="text-button"
          disabled={props.busy || !props.used}
          onClick={props.onReset}
        >
          Reiniciar rodada
        </button>
      </Show>
    </div>
  );
}
