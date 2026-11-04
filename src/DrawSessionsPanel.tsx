import { createSignal, createEffect, For, Show } from "solid-js";
import { ResultsActions } from "./ResultsActions";
export type DrawSession = {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string | null;
  participants: { id: string; label: string; weight: number }[];
  results: { id: string; label: string; date: string }[];
};
export function DrawSessionsPanel(props: {
  wheelId: string;
  sessions: DrawSession[];
  busy: boolean;
  onStart: (name: string) => void;
  onEnd: () => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = createSignal("");
  createEffect(() => { props.wheelId; setName(""); });
  return <details class="draw-sessions feature-panel">
    <summary>Sessões de sorteio · {props.sessions.length}/20</summary>
    <div class="feature-content">
      <p class="muted">Cada sessão guarda os participantes, pesos e resultados em ordem de sorteio. O primeiro giro abre uma sessão automaticamente; editar os participantes inicia outra no próximo giro.</p>
      <label class="setting-field">Nome da próxima sessão
        <input maxLength={80} value={name()} placeholder="Ex.: Dinâmica de novembro" disabled={props.busy} onInput={(e) => setName(e.currentTarget.value)} />
      </label>
      <button class="secondary-button" disabled={props.busy || props.sessions.length >= 20} onClick={() => props.onStart(name())}>Iniciar nova sessão</button>
      <Show when={!props.sessions.length}><p class="muted">Nenhuma sessão de sorteio ainda.</p></Show>
      <For each={[...props.sessions].reverse()}>{(session) => <details class="draw-session">
        <summary>{session.name} · {session.results.length} {session.results.length === 1 ? "resultado" : "resultados"}{session.endedAt ? "" : " · Em andamento"}</summary>
        <div class="feature-content">
          <p class="muted">Início: {new Date(session.startedAt).toLocaleString("pt-BR")}{session.endedAt ? ` · Fim: ${new Date(session.endedAt).toLocaleString("pt-BR")}` : ""}</p>
          <details><summary>Participantes · {session.participants.length}</summary><ul class="session-participants"><For each={session.participants}>{(p) => <li>{p.label} · peso {p.weight}</li>}</For></ul></details>
          <ResultsActions name={session.name} results={session.results} />
          <ol class="session-results"><For each={session.results}>{(r) => <li>{r.label} <time class="muted" dateTime={r.date}>{new Date(r.date).toLocaleString("pt-BR")}</time></li>}</For></ol>
          <Show when={!session.endedAt}><button class="secondary-button" disabled={props.busy} onClick={props.onEnd}>Encerrar sessão</button></Show>
          <button class="text-button" disabled={props.busy} onClick={() => props.onDelete(session.id)}>Excluir sessão</button>
        </div>
      </details>}</For>
      <p class="muted">Salvas automaticamente neste navegador. Limite do conjunto: 5.000 resultados e 10.000 participantes arquivados. Copie os resultados e exclua sessões antigas para liberar espaço.</p>
    </div>
  </details>;
}
