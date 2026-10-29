import { render } from "solid-js/web";
import {
  createSignal,
  createEffect,
  onCleanup,
  onMount,
  For,
  Index,
  Show,
} from "solid-js";
import {
  optionColors,
  randomIndex,
  parseBackup,
  MAX_BACKUP_BYTES,
  MAX_TOTAL_OPTIONS,
  totalOptions,
} from "./logic.mjs";
import "./style.css";
import { writeSnapshot, StorageConflictError } from "./persistence.mjs";
import { setWheelSound, disposeWheelSound, prepareWheelSound } from "./sound";
import { WheelIcon, GridIcon, ActionIcon } from "./Icons";
import { Wheel as WheelVisual, type WheelHandle } from "./Wheel";
type Option = { id: string; label: string; color: string };
type Wheel = {
  id: string;
  name: string;
  options: Option[];
  history: { label: string; date: string }[];
};
const uid = () => crypto.randomUUID();
const makeWheel = (name: string, labels: string[]): Wheel => {
  const colors = optionColors(labels.length);
  return {
    id: uid(),
    name,
    options: labels.map((label, i) => ({ id: uid(), label, color: colors[i] })),
    history: [],
  };
};
const defaults = () => [
  makeWheel("O que vamos comer?", [
    "Pizza",
    "Hambúrguer",
    "Sushi",
    "Mexicana",
    "Massa",
    "Salada",
    "Churrasco",
    "Surpresa!",
  ]),
  makeWheel("Próximo destino", ["Praia", "Montanha", "Campo", "Cidade"]),
  makeWheel("Quem começa?", ["Ana", "Bruno", "Clara", "Daniel"]),
];
function App() {
  let soundPreference = true;
  try {
    soundPreference = localStorage.getItem("volta:sound") !== "off";
  } catch {}
  const [soundOn, setSoundOn] = createSignal(soundPreference);
  createEffect(() => {
    const value = soundOn();
    setWheelSound(value);
    try {
      localStorage.setItem("volta:sound", value ? "on" : "off");
    } catch {}
  });
  let initial: Wheel[];
  let initialError = "";
  let originalData = "";
  try {
    const saved = localStorage.getItem("volta:v1");
    originalData = saved || "";
    initial = saved ? parseBackup(saved) : defaults();
  } catch {
    initial = defaults();
    initialError =
      "Não foi possível ler os dados salvos. Importe um backup ou salve novamente.";
  }
  const [storageBlocked, setStorageBlocked] = createSignal(
    Boolean(initialError),
  );
  const [wheels, setWheels] = createSignal<Wheel[]>(initial);
  const [activeId, setActiveId] = createSignal(initial[0]?.id || "");
  const active = () => wheels().find((w) => w.id === activeId());
  const [spinning, setSpinning] = createSignal(false),
    [winner, setWinner] = createSignal<Option>(),
    [tab, setTab] = createSignal("options"),
    [bulk, setBulk] = createSignal(false),
    [bulkText, setBulkText] = createSignal(""),
    [notice, setNotice] = createSignal(initialError),
    [saveError, setSaveError] = createSignal(false),
    [reduced, setReduced] = createSignal(false);
  const [mode, setMode] = createSignal<"single" | "multi">("single");
  const [selectedIds, setSelectedIds] = createSignal<string[]>(
    initial.slice(0, 3).map((w) => w.id),
  );
  const [runningIds, setRunningIds] = createSignal<string[]>([]);
  const [multiResults, setMultiResults] = createSignal<Record<string, string>>(
    {},
  );
  const controllers = new Map<string, WheelHandle>();
  let singleWheel: WheelHandle;
  const selectedWheels = () =>
    selectedIds().filter((id) => wheels().some((w) => w.id === id));
  const recordResult = (id: string, selected: Option) =>
    setWheels((all) =>
      all.map((w) =>
        w.id === id
          ? {
              ...w,
              history: [
                { label: selected.label, date: new Date().toISOString() },
                ...w.history,
              ].slice(0, 20),
            }
          : w,
      ),
    );
  const toggleSelected = (id: string) => {
    if (spinning()) return;
    if (selectedIds().includes(id))
      setSelectedIds((ids) => ids.filter((x) => x !== id));
    else if (selectedWheels().length < 6) setSelectedIds((ids) => [...ids, id]);
    else notify("Escolha até 6 roletas para girar simultaneamente.");
  };
  const spinMulti = async (id: string) => {
    const w = wheels().find((w) => w.id === id),
      controller = controllers.get(id);
    if (!w || w.options.length < 2 || !controller || runningIds().includes(id))
      return;
    const selected = w.options[randomIndex(w.options.length)];
    setRunningIds((ids) => [...ids, id]);
    setSpinning(true);
    setMultiResults((old) => ({ ...old, [id]: "" }));
    const completed = await controller.spin(w.options.indexOf(selected));
    if (completed) {
      recordResult(id, selected);
      setMultiResults((old) => ({ ...old, [id]: selected.label }));
    }
    setRunningIds((ids) => ids.filter((x) => x !== id));
    setSpinning(runningIds().length > 0);
  };
  const spinAll = () => {
    if (spinning()) return;
    for (const id of selectedWheels()) void spinMulti(id);
  };
  let file!: HTMLInputElement;
  let noticeTimer: ReturnType<typeof setTimeout>;
  const notify = (text: string) => {
    setNotice(text);
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => setNotice(""), 5000);
  };
  const update = (fn: (w: Wheel) => Wheel) => {
    if (spinning()) return;
    const next = wheels().map((w) => (w.id === activeId() ? fn(w) : w));
    if (totalOptions(next) > MAX_TOTAL_OPTIONS) {
      notify("Limite de 5.000 opções no conjunto de roletas.");
      return;
    }
    setWheels(next);
  };
  const select = (id: string) => {
    if (spinning()) return;
    setActiveId(id);
    setMode("single");
    setWinner(undefined);
    setTab("options");
  };
  const snapshot = () => ({
    version: 1,
    wheels: wheels().map((w) => ({
      ...w,
      name: w.name.trim() || "Sem título",
      options: w.options.map((o, i) => ({
        ...o,
        label: o.label.trim() || `Opção ${i + 1}`,
      })),
    })),
  });
  let lastStored: string | null = originalData || null;
  const persist = () => {
    if (storageBlocked()) return;
    try {
      lastStored = writeSnapshot(
        localStorage,
        "volta:v1",
        lastStored,
        JSON.stringify(snapshot()),
      );
      setSaveError(false);
    } catch (error) {
      setSaveError(true);
      notify(
        error instanceof StorageConflictError
          ? error.message
          : "Não foi possível salvar. Exporte um backup para preservar suas roletas.",
      );
    }
  };
  createEffect(() => {
    if (storageBlocked() || spinning()) return;
    snapshot(); // Track edits; serialize the latest state only when writing.
    const t = setTimeout(persist, 350);
    onCleanup(() => clearTimeout(t));
  });
  onMount(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    const enter = (e: KeyboardEvent) => {
      if (
        e.key !== "Enter" ||
        e.repeat ||
        winner() ||
        spinning() ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey
      )
        return;
      const el = e.target as HTMLElement;
      if (el.closest("input,textarea,button,a,[role=dialog]")) return;
      e.preventDefault();
      if (mode() === "multi") spinAll();
      else void spin();
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") persist();
    };
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", flushWhenHidden);
    window.addEventListener("keydown", enter);
    onCleanup(() => {
      media.removeEventListener("change", change);
      window.removeEventListener("keydown", enter);
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    });
  });
  onCleanup(() => {
    clearTimeout(noticeTimer);
    disposeWheelSound();
  });
  const add = () => {
    if (!active() || active()!.options.length >= 500) return;
    update((w) => ({
      ...w,
      options: [
        ...w.options,
        {
          id: uid(),
          label: `Opção ${w.options.length + 1}`,
          color: optionColors(
            1,
            w.options.map((o) => o.color),
          )[0],
        },
      ],
    }));
  };
  const spin = async () => {
    const w = active();
    if (!w || w.options.length < 2 || spinning() || !singleWheel) return;
    const index = randomIndex(w.options.length),
      selected = w.options[index];
    setWinner(undefined);
    setSpinning(true);
    const completed = await singleWheel.spin(index);
    if (completed) {
      recordResult(w.id, selected);
      setWinner(selected);
    }
    setSpinning(false);
  };
  const closeResult = () => {
    setWinner(undefined);
    queueMicrotask(() =>
      document.querySelector<HTMLButtonElement>(".spin-button")?.focus(),
    );
  };
  const trapResult = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      closeResult();
      return;
    }
    if (e.key === "Tab") {
      const controls = (
        e.currentTarget as HTMLElement
      ).querySelectorAll<HTMLButtonElement>("button");
      const first = controls[0],
        last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  const create = () => {
    if (spinning()) return;
    if (totalOptions(wheels()) + 4 > MAX_TOTAL_OPTIONS) {
      notify("Limite de 5.000 opções no conjunto de roletas.");
      return;
    }
    if (wheels().length >= 100) {
      notify("Limite de 100 roletas atingido.");
      return;
    }
    const w = makeWheel("Nova roleta", [
      "Opção 1",
      "Opção 2",
      "Opção 3",
      "Opção 4",
    ]);
    setWheels([...wheels(), w]);
    select(w.id);
  };
  const removeWheel = (id: string) => {
    const w = wheels().find((w) => w.id === id);
    if (
      !w ||
      spinning() ||
      !confirm(`Excluir “${w.name}”? Essa ação não pode ser desfeita.`)
    )
      return;
    const next = wheels().filter((x) => x.id !== w.id);
    setSelectedIds((ids) => ids.filter((x) => x !== id));
    controllers.delete(id);
    setWheels(next);
    if (activeId() === id) setActiveId(next[0]?.id || "");
    setWinner(undefined);
    notify("Roleta excluída.");
  };
  const duplicate = () => {
    const w = active();
    if (!w || spinning()) return;
    if (totalOptions(wheels()) + w.options.length > MAX_TOTAL_OPTIONS) {
      notify("Limite de 5.000 opções no conjunto de roletas.");
      return;
    }
    if (wheels().length >= 100) {
      notify("Limite de 100 roletas atingido.");
      return;
    }
    const copy = makeWheel(`${w.name} (cópia)`.slice(0, 80), []);
    copy.options = w.options.map((o) => ({ ...o, id: uid() }));
    setWheels([...wheels(), copy]);
    select(copy.id);
    notify("Roleta duplicada.");
  };
  const exportData = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(snapshot(), null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "volta-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importData = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    try {
      if (f.size > MAX_BACKUP_BYTES)
        throw Error("O arquivo deve ter até 5 MB.");
      const loaded = parseBackup(await f.text()) as Wheel[];
      if (totalOptions(wheels()) + totalOptions(loaded) > MAX_TOTAL_OPTIONS)
        throw Error("O conjunto deve ter até 5.000 opções.");
      if (wheels().length + loaded.length > 100)
        throw Error("O total deve ser de até 100 roletas.");
      if (spinning()) throw Error("Espere o giro terminar para importar.");
      setWheels([...wheels(), ...loaded]);
      if (loaded[0]) select(loaded[0].id);
      notify(`${loaded.length} roleta(s) importada(s).`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Arquivo inválido.");
    }
    input.value = "";
  };
  const move = (index: number, delta: number) =>
    update((w) => {
      const opts = [...w.options];
      [opts[index], opts[index + delta]] = [opts[index + delta], opts[index]];
      return { ...w, options: opts };
    });
  const duplicates = () => {
    const labels =
      active()?.options.map((o) => o.label.trim().toLowerCase()) || [];
    return new Set(labels).size < labels.length;
  };
  return (
    <div class="app-shell">
      <aside class="sidebar">
        <a class="brand" href="./" aria-label="Volta, início">
          <span class="brand-icon">
            <WheelIcon />
          </span>
          volta<span class="brand-dot">.</span>
        </a>
        <button class="new-button" onClick={create} disabled={spinning()}>
          <ActionIcon name="plus" /> Nova roleta
        </button>
        <div class="nav-heading">
          MINHAS ROLETAS{" "}
          <span>{wheels().length.toString().padStart(2, "0")}</span>
        </div>
        <nav aria-label="Minhas roletas">
          <For each={wheels()}>
            {(w) => (
              <button
                aria-current={activeId() === w.id ? "true" : undefined}
                class={`wheel-nav ${activeId() === w.id ? "selected" : ""}`}
                disabled={spinning()}
                onClick={() => select(w.id)}
              >
                <span class="nav-wheel">
                  <WheelIcon />
                </span>
                <span>{w.name}</span>
                <span class="nav-chevron">›</span>
              </button>
            )}
          </For>
        </nav>
        <div class="sidebar-bottom">
          <button onClick={exportData}>
            <ActionIcon name="download" /> Exportar backup
          </button>
          <button disabled={spinning()} onClick={() => file.click()}>
            <ActionIcon name="upload" /> Importar roletas
          </button>
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            class="hidden"
            onChange={importData}
          />
        </div>
      </aside>
      <main>
        <Show when={saveError()}>
          <div class="save-failure" role="alert">
            Não foi possível salvar. Exporte um backup para preservar suas
            roletas.
          </div>
        </Show>
        <Show when={storageBlocked()}>
          <div class="recovery-banner" role="alert">
            <strong>Seus dados antigos foram preservados.</strong>
            <p>
              Não conseguimos ler o armazenamento. O salvamento está pausado
              para evitar substituí-lo.
            </p>
            <div>
              <button
                disabled={!originalData}
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([originalData], { type: "application/json" }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "volta-dados-recuperacao.json";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                Baixar dados antigos
              </button>
              <button
                onClick={() => {
                  if (
                    confirm(
                      "Substituir os dados antigos pelas roletas atuais? Baixe os dados antigos antes de continuar.",
                    )
                  ) {
                    try {
                      lastStored = localStorage.getItem("volta:v1");
                      setStorageBlocked(false);
                    } catch {
                      notify(
                        "O armazenamento não está disponível. Exporte um backup.",
                      );
                    }
                  }
                }}
              >
                Salvar roletas atuais
              </button>
            </div>
          </div>
        </Show>
        <div class="view-controls">
          <div class="mode-switch" role="group" aria-label="Modo de roletas">
            <button
              aria-pressed={mode() === "single"}
              classList={{ active: mode() === "single" }}
              disabled={spinning()}
              onClick={() => setMode("single")}
            >
              <WheelIcon /> Uma roleta
            </button>
            <button
              aria-pressed={mode() === "multi"}
              classList={{ active: mode() === "multi" }}
              disabled={spinning()}
              onClick={() => setMode("multi")}
            >
              <GridIcon /> Roletas simultâneas
            </button>
          </div>
          <button
            class="icon-button sound-toggle"
            aria-label={soundOn() ? "Silenciar som" : "Ativar som"}
            title={soundOn() ? "Silenciar som" : "Ativar som"}
            aria-pressed={soundOn()}
            onClick={() => {
              const next = !soundOn();
              setWheelSound(next);
              setSoundOn(next);
              if (next) prepareWheelSound();
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M11 4 6 8H3v8h3l5 4z" />
              <Show when={soundOn()} fallback={<path d="m16 9 6 6m-6 0 6-6" />}>
                <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
              </Show>
            </svg>
          </button>
        </div>
        <Show
          when={mode() === "multi"}
          fallback={
            <>
              <Show
                when={active()}
                fallback={
                  <div class="empty">
                    <span>
                      <WheelIcon />
                    </span>
                    <h1>Nenhuma roleta criada.</h1>
                    <p>Crie uma roleta para começar.</p>
                    <button class="primary" onClick={create}>
                      <ActionIcon name="plus" /> Criar minha primeira roleta
                    </button>
                  </div>
                }
              >
                {(w) => (
                  <>
                    <section class="page-heading">
                      <div>
                        <h1>{w().name}</h1>
                      </div>
                      <div class="heading-actions">
                        <button
                          class="icon-button"
                          title="Duplicar roleta"
                          aria-label="Duplicar roleta"
                          disabled={spinning()}
                          onClick={duplicate}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.6"
                            aria-hidden="true"
                          >
                            <rect x="8" y="8" width="12" height="12" rx="2" />
                            <path d="M15 8V4H4v11h4" />
                          </svg>
                        </button>
                        <button
                          class="icon-button delete-button"
                          title="Excluir roleta"
                          aria-label="Excluir roleta"
                          disabled={spinning()}
                          onClick={() => removeWheel(activeId())}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.6"
                            aria-hidden="true"
                          >
                            <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
                          </svg>
                        </button>
                      </div>
                    </section>
                    <div class="workspace-grid">
                      <section class="play-card">
                        <WheelVisual
                          options={w().options}
                          name={w().name}
                          reduced={reduced()}
                          register={(handle) => (singleWheel = handle)}
                        />
                        <div class="spin-controls">
                          <button
                            class="spin-button"
                            disabled={spinning() || w().options.length < 2}
                            onClick={spin}
                          >
                            <span>
                              <ActionIcon name="spin" />
                            </span>
                            {spinning()
                              ? "A sorte está girando…"
                              : "Girar roleta"}
                            <kbd>↵</kbd>
                          </button>
                          <Show when={w().options.length < 2}>
                            <p>Adicione pelo menos 2 opções para girar.</p>
                          </Show>
                        </div>
                      </section>
                      <section class="editor-card">
                        <div
                          class="editor-tabs"
                          role="tablist"
                          aria-label="Editor da roleta"
                          onKeyDown={(e) => {
                            if (
                              ![
                                "ArrowLeft",
                                "ArrowRight",
                                "Home",
                                "End",
                              ].includes(e.key)
                            )
                              return;
                            e.preventDefault();
                            const next =
                              e.key === "Home"
                                ? "options"
                                : e.key === "End"
                                  ? "history"
                                  : tab() === "options"
                                    ? "history"
                                    : "options";
                            setTab(next);
                            document.getElementById(`tab-${next}`)?.focus();
                          }}
                        >
                          <button
                            role="tab"
                            id="tab-options"
                            aria-controls="editor-panel"
                            tabIndex={tab() === "options" ? 0 : -1}
                            aria-selected={tab() === "options"}
                            class={tab() === "options" ? "active" : ""}
                            onClick={() => setTab("options")}
                          >
                            Opções <span>{w().options.length}</span>
                          </button>
                          <button
                            role="tab"
                            id="tab-history"
                            aria-controls="editor-panel"
                            tabIndex={tab() === "history" ? 0 : -1}
                            aria-selected={tab() === "history"}
                            class={tab() === "history" ? "active" : ""}
                            onClick={() => setTab("history")}
                          >
                            Histórico <span>{w().history.length}</span>
                          </button>
                        </div>
                        <div
                          id="editor-panel"
                          role="tabpanel"
                          aria-labelledby={`tab-${tab()}`}
                          tabIndex={0}
                        >
                          <Show
                            when={tab() === "options"}
                            fallback={
                              <div class="history-panel">
                                <h3>As últimas voltas</h3>
                                <p class="muted">
                                  Até 20 resultados desta roleta.
                                </p>
                                <Show
                                  when={w().history.length}
                                  fallback={
                                    <div class="history-empty">
                                      ◷<p>Nenhum resultado ainda.</p>
                                    </div>
                                  }
                                >
                                  <For each={w().history}>
                                    {(h) => (
                                      <div class="history-row">
                                        <span>
                                          <WheelIcon />
                                        </span>
                                        <strong>{h.label}</strong>
                                        <time>
                                          {new Date(h.date).toLocaleString(
                                            "pt-BR",
                                            {
                                              day: "2-digit",
                                              month: "2-digit",
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            },
                                          )}
                                        </time>
                                      </div>
                                    )}
                                  </For>
                                  <button
                                    class="text-button"
                                    disabled={spinning()}
                                    onClick={() =>
                                      update((x) => ({ ...x, history: [] }))
                                    }
                                  >
                                    Limpar histórico
                                  </button>
                                </Show>
                              </div>
                            }
                          >
                            <div class="editor-content">
                              <label class="field-label" for="wheel-name">
                                NOME DA ROLETA
                              </label>
                              <input
                                id="wheel-name"
                                class="name-input"
                                maxLength={80}
                                value={w().name}
                                disabled={spinning()}
                                onInput={(e) =>
                                  update((x) => ({
                                    ...x,
                                    name: e.currentTarget.value,
                                  }))
                                }
                                onBlur={() => {
                                  if (!w().name.trim())
                                    update((x) => ({
                                      ...x,
                                      name: "Sem título",
                                    }));
                                }}
                              />
                              <div class="palette-toolbar">
                                <button
                                  class="text-button"
                                  disabled={spinning() || !w().options.length}
                                  onClick={() =>
                                    update((x) => {
                                      const colors = optionColors(
                                        x.options.length,
                                      );
                                      return {
                                        ...x,
                                        options: x.options.map((o, i) => ({
                                          ...o,
                                          color: colors[i],
                                        })),
                                      };
                                    })
                                  }
                                >
                                  Renovar cores
                                </button>
                              </div>
                              <div class="options-heading">
                                <label class="field-label">
                                  OPÇÕES DA ROLETA
                                </label>
                              </div>
                              <fieldset disabled={spinning()}>
                                <div class="option-list">
                                  <Index each={w().options}>
                                    {(o, i) => (
                                      <div class="option-row">
                                        <div class="reorder">
                                          <button
                                            aria-label={`Mover ${o().label} para cima`}
                                            disabled={i === 0 || spinning()}
                                            onClick={() => move(i, -1)}
                                          >
                                            <ActionIcon name="up" />
                                          </button>
                                          <button
                                            aria-label={`Mover ${o().label} para baixo`}
                                            disabled={
                                              i === w().options.length - 1 ||
                                              spinning()
                                            }
                                            onClick={() => move(i, 1)}
                                          >
                                            <ActionIcon name="down" />
                                          </button>
                                        </div>
                                        <input
                                          class="color-input"
                                          type="color"
                                          value={o().color}
                                          aria-label={`Cor de ${o().label}`}
                                          onInput={(e) => {
                                            const color = e.currentTarget.value;
                                            update((x) => ({
                                              ...x,
                                              options: x.options.map((item) =>
                                                item.id === o().id
                                                  ? { ...item, color }
                                                  : item,
                                              ),
                                            }));
                                          }}
                                        />
                                        <input
                                          class="option-input"
                                          aria-label={`Opção ${i + 1}`}
                                          maxLength={100}
                                          value={o().label}
                                          onInput={(e) => {
                                            const label = e.currentTarget.value;
                                            update((x) => ({
                                              ...x,
                                              options: x.options.map((item) =>
                                                item.id === o().id
                                                  ? { ...item, label }
                                                  : item,
                                              ),
                                            }));
                                          }}
                                          onBlur={() => {
                                            if (!o().label.trim())
                                              update((x) => ({
                                                ...x,
                                                options: x.options.map(
                                                  (item) =>
                                                    item.id === o().id
                                                      ? {
                                                          ...item,
                                                          label: `Opção ${i + 1}`,
                                                        }
                                                      : item,
                                                ),
                                              }));
                                          }}
                                        />
                                        <button
                                          class="remove-option"
                                          aria-label={`Remover ${o().label}`}
                                          onClick={() =>
                                            update((x) => ({
                                              ...x,
                                              options: x.options.filter(
                                                (item) => item.id !== o().id,
                                              ),
                                            }))
                                          }
                                        >
                                          <ActionIcon name="close" />
                                        </button>
                                      </div>
                                    )}
                                  </Index>
                                </div>
                                <button
                                  class="add-option"
                                  disabled={
                                    w().options.length >= 500 || spinning()
                                  }
                                  onClick={add}
                                >
                                  <ActionIcon name="plus" /> Adicionar opção
                                </button>
                                <button
                                  class="bulk-button"
                                  onClick={() => setBulk(!bulk())}
                                >
                                  <ActionIcon name="list" /> Colar uma lista de
                                  opções
                                </button>
                                <Show when={bulk()}>
                                  <div class="bulk-panel">
                                    <textarea
                                      maxLength={51000}
                                      aria-label="Lista de opções, uma por linha"
                                      placeholder={
                                        "Uma opção por linha\nPizza\nSushi"
                                      }
                                      value={bulkText()}
                                      onInput={(e) =>
                                        setBulkText(e.currentTarget.value)
                                      }
                                    />
                                    <button
                                      class="primary"
                                      onClick={() => {
                                        const labels = bulkText()
                                          .split("\n")
                                          .map((s) => s.trim())
                                          .filter(Boolean);
                                        if (!labels.length) return;
                                        if (
                                          labels.length + w().options.length >
                                          500
                                        ) {
                                          notify(
                                            "Limite de 500 opções por roleta.",
                                          );
                                          return;
                                        }
                                        update((x) => {
                                          const colors = optionColors(
                                            labels.length,
                                            x.options.map((o) => o.color),
                                          );
                                          return {
                                            ...x,
                                            options: [
                                              ...x.options,
                                              ...labels.map((label, i) => ({
                                                id: uid(),
                                                label: label.slice(0, 100),
                                                color: colors[i],
                                              })),
                                            ],
                                          };
                                        });
                                        setBulkText("");
                                        setBulk(false);
                                      }}
                                    >
                                      Adicionar à roleta
                                    </button>
                                  </div>
                                </Show>
                              </fieldset>
                              <Show when={duplicates()}>
                                <p class="duplicate-warning">
                                  Nomes repetidos contam como participações
                                  separadas.
                                </p>
                              </Show>
                            </div>
                          </Show>
                        </div>
                      </section>
                    </div>
                  </>
                )}
              </Show>
            </>
          }
        >
          <section class="page-heading multi-heading">
            <div>
              <h1>Roletas simultâneas</h1>
            </div>
            <button
              class="primary spin-all"
              disabled={
                spinning() ||
                !selectedWheels().some(
                  (id) =>
                    (wheels().find((w) => w.id === id)?.options.length || 0) >=
                    2,
                )
              }
              onClick={spinAll}
            >
              <ActionIcon name="spin" />{" "}
              {spinning() ? "Roletas girando…" : "Girar todas"}
            </button>
          </section>
          <div
            class="multi-picker"
            role="group"
            aria-label="Escolher roletas simultâneas"
          >
            <For each={wheels().map((w) => w.id)}>
              {(id) => (
                <label classList={{ chosen: selectedIds().includes(id) }}>
                  <input
                    type="checkbox"
                    checked={selectedIds().includes(id)}
                    disabled={spinning()}
                    onChange={() => toggleSelected(id)}
                  />
                  <span>{wheels().find((w) => w.id === id)?.name}</span>
                </label>
              )}
            </For>
            <Show when={!wheels().length}>
              <p>Crie uma roleta para começar.</p>
            </Show>
          </div>
          <div class="multi-grid">
            <For each={selectedWheels()}>
              {(id) => {
                const wheel = () => wheels().find((w) => w.id === id)!;
                return (
                  <section class="play-card multi-card">
                    <div class="multi-card-heading">
                      <h2>{wheel().name}</h2>
                      <div class="multi-card-actions">
                        <button
                          class="card-action"
                          disabled={spinning()}
                          onClick={() => select(id)}
                          aria-label={`Editar roleta ${wheel().name}`}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z" />
                          </svg>
                          Editar
                        </button>
                        <button
                          class="card-action card-action-delete"
                          disabled={spinning()}
                          onClick={() => removeWheel(id)}
                          aria-label={`Excluir roleta ${wheel().name}`}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
                          </svg>
                          Excluir
                        </button>
                      </div>
                    </div>
                    <WheelVisual
                      options={wheel().options}
                      name={wheel().name}
                      reduced={reduced()}
                      register={(handle) => controllers.set(id, handle)}
                    />
                    <div class="multi-result" role="status">
                      <Show when={multiResults()[id]}>
                        <small>Resultado</small>
                        <strong>{multiResults()[id]}</strong>
                      </Show>
                    </div>
                    <div class="spin-controls">
                      <button
                        class="spin-button"
                        disabled={
                          runningIds().includes(id) ||
                          wheel().options.length < 2
                        }
                        onClick={() => void spinMulti(id)}
                      >
                        <ActionIcon name="spin" />{" "}
                        {runningIds().includes(id)
                          ? "Girando…"
                          : "Girar esta roleta"}
                      </button>
                    </div>
                  </section>
                );
              }}
            </For>
          </div>
          <Show when={!selectedWheels().length}>
            <div class="multi-empty">
              <WheelIcon />
              <p>Nenhuma roleta selecionada.</p>
            </div>
          </Show>
        </Show>
      </main>
      <Show when={notice()}>
        <div class="toast" role="status">
          {notice()}
          <button aria-label="Fechar aviso" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      </Show>
      <Show when={winner()}>
        {(result) => (
          <div
            class="modal-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeResult();
            }}
          >
            <section
              class="result-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="result-title"
              onKeyDown={trapResult}
            >
              <p>Resultado</p>
              <h2 id="result-title" aria-live="assertive">
                {result().label}
              </h2>
              <button
                autofocus
                ref={(el) => queueMicrotask(() => el.focus())}
                class="primary"
                onClick={closeResult}
              >
                Fechar
              </button>
              <button
                class="text-button"
                onClick={() => {
                  const id = result().id;
                  update((w) => ({
                    ...w,
                    options: w.options.filter((o) => o.id !== id),
                  }));
                  closeResult();
                }}
              >
                Remover vencedor da roleta
              </button>
            </section>
          </div>
        )}
      </Show>
    </div>
  );
}
render(() => <App />, document.getElementById("root")!);
