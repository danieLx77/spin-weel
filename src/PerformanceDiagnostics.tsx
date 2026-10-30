import { createSignal, onMount, onCleanup, For, Show } from "solid-js";
import {
  diagnosticsEnabled,
  setDiagnosticsEnabled,
} from "./performance-loader";
import {
  METRIC_NAMES,
  PERFORMANCE_KEY,
  parsePerformanceHistory,
} from "./performance-store.mjs";
import { cacheLoadedFeatures } from "./offline-feature";
export default function PerformanceDiagnostics(props: { busy: boolean }) {
  const read = () => {
    try {
      return parsePerformanceHistory(localStorage.getItem(PERFORMANCE_KEY));
    } catch {
      return [];
    }
  };
  const [enabled, setEnabled] = createSignal(diagnosticsEnabled());
  const [history, setHistory] = createSignal(read());
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  onMount(() => {
    cacheLoadedFeatures();
    const update = () => {
      setHistory(read());
      setEnabled(diagnosticsEnabled());
    };
    window.addEventListener("volta:performance", update);
    window.addEventListener("storage", update);
    onCleanup(() => {
      window.removeEventListener("volta:performance", update);
      window.removeEventListener("storage", update);
    });
  });
  const toggle = async (value: boolean) => {
    setLoading(true);
    setError("");
    try {
      await setDiagnosticsEnabled(value);
      setEnabled(value);
    } catch {
      setError(
        "Não foi possível alterar o diagnóstico. Verifique a conexão e o armazenamento do navegador.",
      );
    } finally {
      setLoading(false);
    }
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ version: 1, visits: history() }, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "volta-desempenho.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const latest = () => history().at(-1);
  return (
    <div class="performance-content">
      <label class="mystery-setting">
        <input
          type="checkbox"
          aria-label="Registrar desempenho neste navegador"
          checked={enabled()}
          disabled={props.busy || loading()}
          onChange={(e) => void toggle(e.currentTarget.checked)}
        />
        Registrar neste navegador
      </label>
      <p class="muted">
        Até 30 visitas, sem enviar dados. Valores em andamento; não representam
        todos os visitantes.
      </p>
      <Show when={error()}>
        <p role="alert">{error()}</p>
      </Show>
      <Show
        when={latest()}
        fallback={
          <p class="muted">
            {enabled()
              ? "Aguardando medições desta visita."
              : "Ative o registro para acompanhar as próximas visitas."}
          </p>
        }
      >
        <p class="muted">
          Última visita registrada:{" "}
          {latest() ? new Date(latest()!.at).toLocaleString("pt-BR") : ""}
        </p>
        <dl class="performance-values">
          <For each={METRIC_NAMES}>
            {(name) => (
              <div>
                <dt>{name}</dt>
                <dd>
                  {latest()?.values[name] === undefined
                    ? "Sem dados"
                    : name === "CLS"
                      ? latest()!.values[name]!.toFixed(3)
                      : `${Math.round(latest()!.values[name]!)} ms`}
                </dd>
              </div>
            )}
          </For>
        </dl>
        <p class="muted">
          {history().length} visita(s) registrada(s). INP depende de interações.
        </p>
        <button class="secondary-button" onClick={download}>
          Exportar diagnóstico
        </button>
      </Show>
    </div>
  );
}
