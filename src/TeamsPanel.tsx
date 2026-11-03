import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { generateTeams, teamsCSV, teamsText } from "./teams.mjs";
type Participant = { id: string; label: string; disabled?: boolean };
type TeamResult = { name: string; teams: { id: string; label: string }[][] };

export function TeamsPanel(props: {
  wheelId: string;
  name: string;
  options: Participant[];
  busy: boolean;
}) {
  const [mode, setMode] = createSignal("teams");
  const [amount, setAmount] = createSignal("2");
  const [result, setResult] = createSignal<TeamResult>();
  const [error, setError] = createSignal("");
  const [copied, setCopied] = createSignal(false);
  const [fallback, setFallback] = createSignal("");
  const count = createMemo(() => props.options.filter((p) => !p.disabled).length);
  createEffect(() => {
    props.wheelId;
    setResult(undefined);
    setError("");
    setCopied(false);
    setFallback("");
  });
  const generate = () => {
    if (props.busy) return;
    try {
      const teams = generateTeams(props.options, mode(), Number(amount()));
      setResult({ name: props.name, teams });
      setError("");
      setCopied(false);
      setFallback("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível gerar equipes. Tente novamente.");
    }
  };
  const copy = async () => {
    const current = result();
    if (!current) return;
    const text = teamsText(current.name, current.teams);
    try {
      await navigator.clipboard.writeText(text);
      if (result() === current) setCopied(true);
    } catch {
      if (result() === current) setFallback(text);
    }
  };
  const download = () => {
    const current = result();
    if (!current) return;
    const url = URL.createObjectURL(new Blob([teamsCSV(current.name, current.teams)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "volta-equipes.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <details class="teams-panel">
      <summary>Gerar equipes</summary>
      <div class="teams-content">
        <p class="muted">{count()} participantes ativos. Nomes iguais contam como participações distintas. Inclui os já sorteados na rodada.</p>
        <div class="teams-fields">
          <label class="setting-field">
            Dividir por
            <select value={mode()} disabled={props.busy} onChange={(e) => setMode(e.currentTarget.value)}>
              <option value="teams">Quantidade de equipes</option>
              <option value="size">Pessoas por equipe</option>
            </select>
          </label>
          <label class="setting-field">
            {mode() === "teams" ? "Equipes" : "Máximo de pessoas por equipe"}
            <input type="number" min="1" max={count()} step="1" value={amount()} disabled={props.busy} onInput={(e) => setAmount(e.currentTarget.value)} />
          </label>
        </div>
        <p class="muted">Distribuição aleatória e equilibrada: a diferença entre equipes é de no máximo uma pessoa.</p>
        <button type="button" class="secondary-button" disabled={props.busy || count() < 2} onClick={generate}>
          {result() ? "Gerar novamente" : "Gerar equipes"}
        </button>
        <Show when={count() < 2}><p class="muted">Ative pelo menos duas opções para gerar equipes.</p></Show>
        <Show when={error()}><p role="alert">{error()}</p></Show>
        <Show when={result()}>{(current) => (
          <section aria-label="Equipes geradas" class="teams-result">
            <p role="status">{current().teams.length} equipes geradas. Copie ou exporte antes de trocar de roleta ou sair.</p>
            <div class="results-actions"><div>
              <button type="button" class="secondary-button" onClick={copy}>{copied() ? "Equipes copiadas" : "Copiar equipes"}</button>
              <button type="button" class="secondary-button" onClick={download}>Exportar CSV</button>
            </div></div>
            <Show when={fallback()}>
              <label class="copy-results">Selecione e copie as equipes<textarea readonly value={fallback()} onFocus={(e) => e.currentTarget.select()} /></label>
            </Show>
            <For each={current().teams}>{(team, index) => (
              <section class="team-group" aria-label={`Equipe ${index() + 1}`}>
                <h3>Equipe {index() + 1} <span class="muted">· {team.length} {team.length === 1 ? "pessoa" : "pessoas"}</span></h3>
                <ul><For each={team}>{(person) => <li>{person.label}</li>}</For></ul>
              </section>
            )}</For>
          </section>
        )}</Show>
      </div>
    </details>
  );
}
