import { createSignal, createEffect, Show } from "solid-js";
import { resultsCSV, resultsText } from "./results.mjs";
export type SavedResult = { label: string; date: string };
export function ResultsActions(props: {
  name: string;
  results: SavedResult[];
}) {
  const [copyFallback, setCopyFallback] = createSignal("");
  const [copied, setCopied] = createSignal(false);
  createEffect(() => {
    props.results;
    setCopied(false);
    setCopyFallback("");
  });
  const copy = async () => {
    const text = resultsText(props.name, props.results);
    try {
      await navigator.clipboard.writeText(text);
      setCopyFallback("");
      setCopied(true);
    } catch {
      setCopyFallback(text);
    }
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([resultsCSV(props.name, props.results)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "volta-resultados.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div class="results-actions">
      <div>
        <button
          class="secondary-button"
          disabled={!props.results.length}
          onClick={copy}
        >
          {copied() ? "Resultados copiados" : "Copiar resultados"}
        </button>
        <button
          class="secondary-button"
          disabled={!props.results.length}
          onClick={download}
        >
          Exportar CSV
        </button>
      </div>
      <Show when={copyFallback()}>
        <label class="copy-results">
          Selecione e copie os resultados
          <textarea
            aria-label="Resultados para copiar"
            readonly
            value={copyFallback()}
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
      </Show>
    </div>
  );
}
