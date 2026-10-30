import {
  createSignal,
  Show,
  onMount,
  onCleanup,
  type Component,
} from "solid-js";
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
  let panel!: HTMLDetailsElement;
  const close = (restoreFocus = true) => {
    panel.open = false;
    if (restoreFocus)
      panel.querySelector<HTMLElement>(":scope > summary")?.focus();
  };
  const updateViewport = () => {
    if (!panel.open) return;
    const viewport = window.visualViewport;
    panel.style.setProperty(
      "--settings-viewport-height",
      `${viewport?.height ?? window.innerHeight}px`,
    );
    panel.style.setProperty(
      "--settings-viewport-top",
      `${viewport?.offsetTop ?? 0}px`,
    );
  };
  onMount(() => {
    const outside = (event: Event) => {
      if (
        panel.open &&
        event.target instanceof Node &&
        !panel.contains(event.target)
      )
        close(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    window.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);
    onCleanup(() => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      window.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
    });
  });
  const [diagnosticsOpen, setDiagnosticsOpen] = createSignal(false);
  const [Diagnostics, setDiagnostics] =
    createSignal<Component<{ busy: boolean }>>();
  const [diagnosticsError, setDiagnosticsError] = createSignal("");
  let diagnosticsLoading = false;
  const openDiagnostics = async (open: boolean) => {
    setDiagnosticsOpen(open);
    if (!open || Diagnostics() || diagnosticsLoading) return;
    diagnosticsLoading = true;
    try {
      const module = await import("./PerformanceDiagnostics");
      setDiagnostics(() => module.default);
    } catch {
      setDiagnosticsError(
        "Conecte-se e recarregue a página para abrir o diagnóstico pela primeira vez.",
      );
    } finally {
      diagnosticsLoading = false;
    }
  };
  const [link, setLink] = createSignal("");
  const [surpriseTip, setSurpriseTip] = createSignal(false);
  return (
    <details
      ref={panel}
      class="settings-panel"
      onToggle={(e) => {
        if (e.target === panel) updateViewport();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && panel.open) {
          close();
          e.stopPropagation();
        }
      }}
    >
      <summary aria-label="Configurações" title="Configurações">
        <ActionIcon name="settings" />
      </summary>
      <div
        class="settings-content"
        role="region"
        aria-label="Configurações da roleta"
      >
        <div class="settings-heading">
          <h2>Configurações</h2>
          <button
            type="button"
            class="icon-button settings-close"
            aria-label="Fechar configurações"
            title="Fechar configurações"
            onClick={() => close()}
          >
            <ActionIcon name="close" />
          </button>
        </div>
        <div class="settings-body">
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
              onChange={(e) => {
                const enabled = e.currentTarget.checked;
                props.onMystery(enabled);
                setSurpriseTip(enabled);
              }}
            />
            Modo surpresa
          </label>
          <Show when={props.mystery && surpriseTip()}>
            <p class="muted surprise-tip" role="status">
              Para mais imersão, use o modo apresentação: ele oculta o editor e
              deixa só a roleta em destaque.
            </p>
          </Show>
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
          <details
            class="performance-panel"
            onToggle={(e) => void openDiagnostics(e.currentTarget.open)}
          >
            <summary>Desempenho</summary>
            <Show when={diagnosticsOpen()}>
              <Show
                when={Diagnostics()}
                fallback={
                  <p class="muted" role="status">
                    {diagnosticsError() || "Carregando diagnóstico…"}
                  </p>
                }
              >
                {(Panel) => {
                  const Component = Panel();
                  return <Component busy={props.busy} />;
                }}
              </Show>
            </Show>
          </details>
          <OfflineControls
            busy={props.busy || props.updateBlocked}
            onMessage={props.onMessage}
          />
        </div>
      </div>
    </details>
  );
}
