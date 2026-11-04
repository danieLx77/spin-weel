import { createEffect, createMemo, createSignal, For, Show, onMount, onCleanup } from "solid-js";
import { generateTeams, animateTeams, teamsText } from "./teams.mjs";
import { Wheel, type WheelHandle, type WheelOption } from "./Wheel";

type Participant = WheelOption & { disabled?: boolean };
type TeamResult = { name: string; teams: { id: string; label: string }[][] };
export type TeamsHandle = { generate: () => void };

export function TeamsPanel(props: {
  wheelId: string;
  name: string;
  options: Participant[];
  busy: boolean;
  reduced: boolean;
  duration: number;
  mystery: boolean;
  onBusy: (value: boolean) => void;
  register: (handle: TeamsHandle) => void;
}) {
  const [division, setDivision] = createSignal("teams");
  const [amount, setAmount] = createSignal("2");
  const [reveal, setReveal] = createSignal("direct");
  const [result, setResult] = createSignal<TeamResult>();
  const [error, setError] = createSignal("");
  const [copied, setCopied] = createSignal(false);
  const [fallback, setFallback] = createSignal("");
  const [running, setRunning] = createSignal(false);
  const [stopping, setStopping] = createSignal(false);
  const [pool, setPool] = createSignal<Participant[]>();
  const [target, setTarget] = createSignal(0);
  const [lastAssignment, setLastAssignment] = createSignal("");
  const participants = createMemo(() => props.options.filter((p) => !p.disabled).map((p) => ({ ...p, weight: 1 })));
  const assigned = () => result()?.teams.reduce((sum, team) => sum + team.length, 0) || 0;
  let wheel: WheelHandle | undefined;
  let disposed = false;
  createEffect(() => {
    props.wheelId;
    setResult(undefined);
    setError("");
    setCopied(false);
    setFallback("");
    setLastAssignment("");
  });
  onCleanup(() => { disposed = true; setStopping(true); if (running()) props.onBusy(false); });

  const generate = async () => {
    if (props.busy || running()) return;
    try {
      const snapshot = [...participants()];
      const teams = generateTeams(snapshot, division(), Number(amount()));
      setError("");
      setCopied(false);
      setFallback("");
      setLastAssignment("");
      setTarget(snapshot.length);
      setStopping(false);
      if (reveal() === "direct") {
        setResult({ name: props.name, teams });
        return;
      }
      if (!wheel) throw new Error("Aguarde a roleta carregar e tente novamente.");
      setResult({ name: props.name, teams: teams.map(() => []) });
      setPool(snapshot);
      setRunning(true);
      props.onBusy(true);
      await animateTeams({
        options: snapshot,
        teams,
        shouldStop: () => disposed || stopping(),
        spin: async (eligible: Participant[], index: number) => {
          if (disposed) return false;
          setPool(eligible);
          return wheel!.spin(index);
        },
        onAssignment: ({ participant, teamIndex }: { participant: { id: string; label: string }; teamIndex: number }) => {
          if (disposed) return;
          setResult((old) => ({ ...old!, teams: old!.teams.map((team, i) => i === teamIndex ? [...team, participant] : team) }));
          setLastAssignment(`${participant.label} entrou na Equipe ${teamIndex + 1}.`);
        },
      });
    } catch (error) {
      if (!disposed) setError(error instanceof Error ? error.message : "Não foi possível gerar equipes. Tente novamente.");
    } finally {
      if (!disposed) {
        setPool(undefined);
        setRunning(false);
        props.onBusy(false);
      }
    }
  };
  onMount(() => props.register({ generate: () => void generate() }));
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
  return (
    <div class="teams-workspace">
      <div class="teams-setup">
        <h2>Gerar equipes</h2>
        <p class="muted">{participants().length} participantes ativos, distribuídos em equipes equilibradas.</p>
        <div class="teams-fields">
          <label class="setting-field">Dividir por
            <select value={division()} disabled={props.busy} onChange={(e) => setDivision(e.currentTarget.value)}>
              <option value="teams">Quantidade de equipes</option>
              <option value="size">Pessoas por equipe</option>
            </select>
          </label>
          <label class="setting-field">{division() === "teams" ? "Equipes" : "Máximo de pessoas por equipe"}
            <input type="number" min="1" max={participants().length} step="1" value={amount()} disabled={props.busy} onInput={(e) => setAmount(e.currentTarget.value)} />
          </label>
          <label class="setting-field">Como gerar
            <select value={reveal()} disabled={props.busy} onChange={(e) => setReveal(e.currentTarget.value)}>
              <option value="direct">Mostrar resultado direto</option>
              <option value="spin">Girar para cada participante</option>
            </select>
          </label>
        </div>
        <button type="button" class="primary teams-generate" disabled={props.busy || participants().length < 2} onClick={() => void generate()}>
          {running() ? "Distribuindo participantes…" : result() ? "Gerar novamente" : "Gerar equipes"}
        </button>
        <Show when={participants().length < 2}><p class="muted">Ative ou adicione pelo menos duas pessoas na lista.</p></Show>
        <Show when={running()}>
          <button type="button" class="text-button" disabled={stopping()} onClick={() => setStopping(true)}>{stopping() ? "Encerrando…" : "Parar após este giro"}</button>
        </Show>
        <Show when={error()}><p role="alert">{error()}</p></Show>
      </div>
      <Show when={reveal() === "spin"}>
        <Wheel options={pool() ?? participants()} name={props.name} reduced={props.reduced} duration={props.duration} mystery={props.mystery}
          disabled={props.busy || participants().length < 2} onSpin={() => void generate()} register={(handle) => { wheel = handle; }} />
      </Show>
      <Show when={result()}>{(current) => (
        <section aria-label="Equipes geradas" class="teams-result">
          <p role="status">{running() ? `${assigned()} de ${target()} participantes distribuídos. ${lastAssignment()}` : assigned() < target() ? `Distribuição interrompida: ${assigned()} de ${target()} participantes. As equipes abaixo estão incompletas.` : `${current().teams.length} equipes prontas.`}</p>
          <Show when={!running() && assigned() > 0}>
            <button type="button" class="secondary-button" onClick={copy}>{copied() ? "Equipes copiadas" : "Copiar equipes"}</button>
          </Show>
          <Show when={fallback()}><label class="copy-results">Selecione e copie as equipes<textarea readonly value={fallback()} onFocus={(e) => e.currentTarget.select()} /></label></Show>
          <For each={current().teams}>{(team, index) => (
            <section class="team-group" aria-label={`Equipe ${index() + 1}`}>
              <h3>Equipe {index() + 1} <span class="muted">· {team.length} {team.length === 1 ? "pessoa" : "pessoas"}</span></h3>
              <ul><For each={team}>{(person) => <li>{person.label}</li>}</For></ul>
            </section>
          )}</For>
          <Show when={!running()}><p class="muted">Copie as equipes antes de trocar de modo, de lista ou sair.</p></Show>
        </section>
      )}</Show>
    </div>
  );
}
