import { createSignal, Show } from "solid-js";
import { OfflineControls } from "./OfflineControls";
import { ActionIcon } from "./Icons";
export function SettingsPanel(props: {
  duration: number;
  volume: number;
  mystery: boolean;
  onMystery: (value: boolean) => void;
  busy: boolean;
  updateBlocked: boolean;
  canShare: boolean;
  onDuration: (value: number) => void;
  onVolume: (value: number) => void;
  onShare: () => Promise<string | undefined>;
  onMessage: (text: string) => void;
}) {
  const [link, setLink] = createSignal("");
  return (
    <details
      class="settings-panel"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.currentTarget.open = false;
          e.currentTarget.querySelector("summary")?.focus();
          e.stopPropagation();
        }
      }}
    >
      <summary aria-label="Configurações" title="Configurações">
        <ActionIcon name="settings" />
      </summary>
      <div class="settings-content">
        <h2>Configurações</h2>
        <label class="setting-field">
          Duração do giro
          <select
            aria-label="Duração do giro"
            value={props.duration}
            disabled={props.busy}
            onChange={(e) => props.onDuration(Number(e.currentTarget.value))}
          >
            <option value={4000}>Curto · 4 segundos</option>
            <option value={9000}>Normal · 9 segundos</option>
            <option value={14000}>Longo · 14 segundos</option>
          </select>
        </label>
        <label class="setting-field">
          Volume <output>{Math.round(props.volume * 100)}%</output>
          <input
            aria-label="Volume do som"
            type="range"
            min="0"
            max="1"
            step=".05"
            value={props.volume}
            onInput={(e) => props.onVolume(Number(e.currentTarget.value))}
          />
        </label>
        <label class="mystery-setting">
          <input
            type="checkbox"
            checked={props.mystery}
            disabled={props.busy}
            onChange={(e) => props.onMystery(e.currentTarget.checked)}
          />
          Modo surpresa
        </label>
        <Show when={props.canShare}>
          <button
            type="button"
            class="secondary-button"
            disabled={props.busy}
            onClick={async () => {
              const url = await props.onShare();
              if (url) setLink(url);
            }}
          >
            Copiar link da roleta
          </button>
          <Show when={link()}>
            <label class="setting-field">
              Link da roleta
              <input
                readOnly
                value={link()}
                onFocus={(e) => e.currentTarget.select()}
              />
            </label>
            <p class="muted">
              Quem receber o link poderá ver as opções e cores.
            </p>
          </Show>
        </Show>
        <OfflineControls
          busy={props.busy || props.updateBlocked}
          onMessage={props.onMessage}
        />
      </div>
    </details>
  );
}
