import { optionsForMode } from "./modes.mjs";
import { weightedIndex, optionWeight, chanceText } from "./weighted.mjs";
import { archiveBudget, MAX_DRAW_RESULTS, MAX_DRAW_PARTICIPANTS } from "./draw-sessions.mjs";
import { DrawSessionsPanel, type DrawSession } from "./DrawSessionsPanel";
import { PresentationSettings, readPresentation, presentationThemes } from "./PresentationSettings";
import { restoreDiagnostics } from "./performance-loader";
import { optionPage, EDITOR_PAGE_SIZE } from "./render-state.mjs";
import { render } from "solid-js/web";
import {
  createSignal,
  createEffect,
  createMemo,
  onCleanup,
  onMount,
  For,
  Index,
  Show,
} from "solid-js";
import {
  optionColors,
  renewOptionColors,
  MAX_TOTAL_OPTIONS,
  totalOptions,
} from "./logic.mjs";
import "./style.css";
import {
  readSettings,
  parseWorkspace,
  createShareLink,
  parseSharedWheel,
  duplicateIds,
  normalize,
} from "./extras.mjs";
import { drawSequence } from "./results.mjs";
import { ResultsActions, type SavedResult } from "./ResultsActions";
import { TeamsPanel, type TeamsHandle } from "./TeamsPanel";
import { reorderOptions, restoreOrder } from "./list-order.mjs";
import { SettingsPanel } from "./SettingsPanel";
import {
  activeOptions,
  availableOptions,
  canSpin,
  markDrawn,
  resetRound,
} from "./round.mjs";
import { RoundControls } from "./RoundControls";
import { writeSnapshot, StorageConflictError } from "./persistence.mjs";
import {
  setWheelSound,
  disposeWheelSound,
  prepareWheelSound,
  setWheelVolume,
} from "./sound";
import { WheelIcon, GridIcon, ActionIcon } from "./Icons";
import { Wheel as WheelVisual, type WheelHandle } from "./Wheel";
type Session = { id: string; name: string; wheelIds: string[] };
type Option = {
  id: string;
  label: string;
  color: string;
  weight?: number;
  drawn?: boolean;
  disabled?: boolean;
};
type Wheel = {
  id: string;
  name: string;
  options: Option[];
  history: { label: string; date: string }[];
  noRepeat?: boolean;
  drawSessions?: DrawSession[];
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
  let preferences = readSettings(null);
  try {
    preferences = readSettings(localStorage.getItem("volta:settings"));
  } catch {}
  let initialPresentation = readPresentation(null);
  try { initialPresentation = readPresentation(localStorage.getItem("volta:presentation")); } catch {}
  const [presentationStyle, setPresentationStyle] = createSignal(initialPresentation);
  createEffect(() => {
    try { localStorage.setItem("volta:presentation", JSON.stringify(presentationStyle())); } catch {}
  });
  const presentationTheme = () => presentationThemes.find((t) => t.id === presentationStyle().theme) || presentationThemes[0];
  const [duration, setDuration] = createSignal(preferences.duration);
  const [volume, setVolume] = createSignal(preferences.volume);
  const [mystery, setMystery] = createSignal(preferences.mystery);
  createEffect(() => {
    setWheelVolume(volume());
    try {
      localStorage.setItem(
        "volta:settings",
        JSON.stringify({
          duration: duration(),
          volume: volume(),
          mystery: mystery(),
        }),
      );
    } catch {}
  });
  let initialSessions: Session[] = [];
  let initial: Wheel[];
  let initialError = "";
  let originalData = "";
  try {
    const saved = localStorage.getItem("volta:v1");
    originalData = saved || "";
    if (saved) {
      const workspace = parseWorkspace(saved);
      initial = workspace.wheels;
      initialSessions = workspace.sessions as Session[];
    } else initial = defaults();
  } catch {
    initial = defaults();
    initialError =
      "Não foi possível ler as roletas salvas. Recarregue a página para tentar novamente.";
  }
  const [storageBlocked, setStorageBlocked] = createSignal(
    Boolean(initialError),
  );
  const [sessions, setSessions] = createSignal<Session[]>(initialSessions);
  const [sessionName, setSessionName] = createSignal("");
  const [wheels, setWheels] = createSignal<Wheel[]>(initial);
  const [activeId, setActiveId] = createSignal(initial[0]?.id || "");
  const active = createMemo(() => wheels().find((w) => w.id === activeId()));
  const [spinning, setSpinning] = createSignal(false),
    [winner, setWinner] = createSignal<Option>(),
    [tab, setTab] = createSignal("options"),
    [bulk, setBulk] = createSignal(false),
    [bulkText, setBulkText] = createSignal(""),
    [notice, setNotice] = createSignal(initialError),
    [saveError, setSaveError] = createSignal(false),
    [reduced, setReduced] = createSignal(false);
  const [mode, setMode] = createSignal<"single" | "multi" | "weighted" | "teams">("single");
  const [selectedIds, setSelectedIds] = createSignal<string[]>(
    initial.slice(0, 3).map((w) => w.id),
  );
  const [runningIds, setRunningIds] = createSignal<string[]>([]);
  const [multiResults, setMultiResults] = createSignal<Record<string, string>>(
    {},
  );
  const controllers = new Map<string, WheelHandle>();
  let singleWheel: WheelHandle;
  let teamsController: TeamsHandle | undefined;
  const drawingOptions = (w: Wheel) => optionsForMode(availableOptions(w), mode());
  const shareableWheel = () => {
    const w = active();
    return w && (mode() === "single" || mode() === "weighted")
      ? { ...w, options: optionsForMode(w.options, mode()) }
      : undefined;
  };
  const changeMode = (next: "single" | "multi" | "weighted" | "teams") => {
    if (spinning() || next === mode()) return;
    teamsController = undefined;
    setMode(next);
    setTab("options");
    setWinner(undefined);
    setBatchSummary(false);
    setBatchResults([]);
  };
  const selectedWheels = () =>
    selectedIds().filter((id) => wheels().some((w) => w.id === id));
  const [search, setSearch] = createSignal("");
  const [onlyDuplicates, setOnlyDuplicates] = createSignal(false);
  const [picking, setPicking] = createSignal(false);
  const [selectedOptions, setSelectedOptions] = createSignal<string[]>([]);
  const [incoming, setIncoming] = createSignal<Wheel>();
  const duplicateOptions = createMemo(() =>
    duplicateIds(active()?.options || []),
  );
  const query = createMemo(() => normalize(search()));
  const matchesOption = (option: Option) =>
    (!query() || normalize(option.label).includes(query())) &&
    (!onlyDuplicates() || duplicateOptions().has(option.id));
  createEffect(() => {
    activeId();
    setSearch("");
    setOnlyDuplicates(false);
    setPicking(false);
    setSelectedOptions([]);
  });
  const [batchCount, setBatchCount] = createSignal("3");
  const [batchRunning, setBatchRunning] = createSignal(false);
  const [batchStopped, setBatchStopped] = createSignal(false);
  const [batchResults, setBatchResults] = createSignal<SavedResult[]>([]);
  const [batchSummary, setBatchSummary] = createSignal(false);
  const [batchPool, setBatchPool] = createSignal<Option[]>();
  const [batchTarget, setBatchTarget] = createSignal(0);
  let batchPause: ReturnType<typeof setTimeout>;
  let resolvePause: (() => void) | undefined;
  let disposed = false;
  createEffect(() => {
    activeId();
    setBatchResults([]);
    setBatchSummary(false);
  });
  createEffect(() => {
    const available = active() ? availableOptions(active()!).length : 0;
    if (!spinning())
      setBatchCount((value) =>
        String(Math.min(Math.max(1, available), Number(value) || 3)),
      );
  });
  const [editorPage, setEditorPage] = createSignal(0);
  const editorMatches = createMemo(() =>
    (active()?.options || [])
      .map((option, index) => ({ option, index }))
      .filter((row) => matchesOption(row.option)),
  );
  const editorWindow = createMemo(() =>
    optionPage(editorMatches(), editorPage()),
  );
  let optionList: HTMLDivElement | undefined;
  createEffect(() => {
    activeId();
    query();
    onlyDuplicates();
    setEditorPage(0);
    if (optionList) optionList.scrollTop = 0;
  });
  const changeEditorPage = (index: number) => {
    setEditorPage(index);
    if (optionList) optionList.scrollTop = 0;
  };
  const [presentation, setPresentation] = createSignal(false);
  type UndoEntry = { label: string; restore: () => boolean };
  const [undoStack, setUndoStack] = createSignal<UndoEntry[]>([]);
  const rememberAction = (entry: UndoEntry) =>
    setUndoStack((stack) => [...stack, entry].slice(-20));
  const undoDelete = () => {
    if (spinning()) return;
    const entry = undoStack().at(-1);
    if (entry?.restore()) setUndoStack((stack) => stack.slice(0, -1));
  };
  const exitPresentation = () => {
    setPresentation(false);
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
    queueMicrotask(() =>
      document
        .querySelector<HTMLButtonElement>(".presentation-toggle")
        ?.focus(),
    );
  };
  const togglePresentation = () => {
    if (presentation()) {
      exitPresentation();
      return;
    }
    setPresentation(true);
    if (document.documentElement.requestFullscreen)
      void document.documentElement.requestFullscreen().catch(() => {});
  };
  const changeRound = (id: string, reset = false) => {
    if (spinning()) return;
    setWheels((all) =>
      all.map((w) =>
        w.id === id
          ? reset
            ? resetRound(w)
            : { ...w, noRepeat: !w.noRepeat }
          : w,
      ),
    );
    if (reset) {
      setWinner(undefined);
      setMultiResults((old) => ({ ...old, [id]: "" }));
    }
  };
  const participantSnapshot = (w: Wheel) => optionsForMode(activeOptions(w), mode()).map((p: Option) => ({ id: p.id, label: p.label.trim() || "Sem nome", weight: optionWeight(p) }));
  const sameParticipants = (a: DrawSession["participants"], b: DrawSession["participants"]) => a.length === b.length && a.every((p, i) => p.label === b[i].label && p.weight === b[i].weight);
  const prepareSession = (w: Wheel, count = 1, force = false, name = "") => {
    const participants = participantSnapshot(w);
    if (!participants.length) { notify("Ative pelo menos uma opção para iniciar uma sessão."); return false; }
    const previous = w.drawSessions?.at(-1);
    const reuse = !force && previous && !previous.endedAt && sameParticipants(previous.participants, participants);
    const budget = archiveBudget(wheels());
    if (budget.results + count + runningIds().length > MAX_DRAW_RESULTS || budget.participants + (reuse ? 0 : participants.length) > MAX_DRAW_PARTICIPANTS) {
      notify("O arquivo de sessões atingiu o limite. Copie os resultados e exclua sessões antigas antes de continuar."); return false;
    }
    if (reuse) return true;
    if ((w.drawSessions?.length || 0) >= 20) { notify("Limite de 20 sessões nesta roleta. Copie os resultados e exclua uma sessão antiga."); return false; }
    const date = new Date().toISOString();
    const session: DrawSession = { id: uid(), name: name.trim().slice(0, 80) || `Sorteio ${new Date().toLocaleString("pt-BR")}`, startedAt: date, endedAt: null, participants, results: [] };
    setWheels((all) => all.map((wheel) => wheel.id === w.id ? { ...wheel, drawSessions: [...(wheel.drawSessions || []).map((s) => s.endedAt ? s : { ...s, endedAt: date }), session] } : wheel));
    return true;
  };
  const endSession = (id: string) => {
    if (spinning()) return;
    setWheels((all) => all.map((w) => w.id === id ? { ...w, drawSessions: w.drawSessions?.map((s) => s.endedAt ? s : { ...s, endedAt: new Date().toISOString() }) } : w));
  };
  const deleteDrawSession = (wheelId: string, id: string) => {
    if (spinning()) return;
    const session = wheels().find((w) => w.id === wheelId)?.drawSessions?.find((s) => s.id === id);
    if (!session) return;
    setWheels((all) => all.map((w) => w.id === wheelId ? { ...w, drawSessions: w.drawSessions?.filter((s) => s.id !== id) } : w));
    rememberAction({ label: "Sessão excluída", restore: () => {
      const w = wheels().find((w) => w.id === wheelId);
      const budget = archiveBudget(wheels());
      if (!w || (w.drawSessions?.length || 0) >= 20 || budget.results + session.results.length > MAX_DRAW_RESULTS || budget.participants + session.participants.length > MAX_DRAW_PARTICIPANTS) { notify("Não há espaço para restaurar a sessão."); return false; }
      setWheels((all) => all.map((w) => w.id === wheelId ? { ...w, drawSessions: [...(w.drawSessions || []), { ...session, endedAt: session.endedAt || new Date().toISOString() }].sort((a,b) => a.startedAt.localeCompare(b.startedAt)) } : w));
      return true;
    } });
  };
  const recordResult = (id: string, selected: Option, date = new Date().toISOString()) => {
    setWheels((all) => all.map((w) => {
      if (w.id !== id) return w;
      const index = activeOptions(w).findIndex((p: Option) => p.id === selected.id);
      return { ...markDrawn(w, selected.id),
        history: [{ label: selected.label, date }, ...w.history].slice(0, 20),
        drawSessions: w.drawSessions?.map((s, i) => i === w.drawSessions!.length - 1 && !s.endedAt ? { ...s, results: [...s.results, { id: s.participants[index].id, label: selected.label.trim() || "Sem nome", date }] } : s),
      };
    }));
  };
  const removeOption = (wheelId: string, optionId: string) => {
    if (spinning()) return;
    const w = wheels().find((w) => w.id === wheelId),
      index = w?.options.findIndex((o) => o.id === optionId) ?? -1;
    if (!w || index < 0) return;
    const removed = w.options[index];
    setWheels((all) =>
      all.map((w) =>
        w.id === wheelId
          ? { ...w, options: w.options.filter((o) => o.id !== optionId) }
          : w,
      ),
    );
    rememberAction({
      label: "Opção excluída.",
      restore: () => {
        const current = wheels().find((w) => w.id === wheelId);
        if (!current) {
          notify("Restaure a roleta antes de restaurar esta opção.");
          return false;
        }
        if (
          current.options.length >= 500 ||
          totalOptions(wheels()) >= MAX_TOTAL_OPTIONS
        ) {
          notify("Limite de opções atingido.");
          return false;
        }
        setWheels((all) =>
          all.map((w) =>
            w.id === wheelId
              ? {
                  ...w,
                  options: [
                    ...w.options.slice(0, index),
                    removed,
                    ...w.options.slice(index),
                  ],
                }
              : w,
          ),
        );
        return true;
      },
    });
  };
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
    if (!w || !canSpin(w) || !controller || runningIds().includes(id)) return;
    const eligible = drawingOptions(w);
    if (!prepareSession(w)) return;
    const selected = eligible[weightedIndex(eligible)];
    setRunningIds((ids) => [...ids, id]);
    setSpinning(true);
    setMultiResults((old) => ({ ...old, [id]: "" }));
    const completed = await controller.spin(eligible.indexOf(selected));
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
    setMode((previous) => previous === "multi" ? "single" : previous);
    setWinner(undefined);
    setTab("options");
  };
  const snapshot = () => ({
    version: 1,
    sessions: sessions(),
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
  let persistedSnapshot: string | null =
    originalData && !initialError ? JSON.stringify(snapshot()) : null;
  const persist = () => {
    if (storageBlocked()) return;
    try {
      const data = JSON.stringify(snapshot());
      if (data === persistedSnapshot) return;
      lastStored = writeSnapshot(localStorage, "volta:v1", lastStored, data);
      persistedSnapshot = data;
      setSaveError(false);
    } catch (error) {
      setSaveError(true);
      notify(
        error instanceof StorageConflictError
          ? error.message
          : "Não foi possível salvar. Mantenha esta aba aberta e libere espaço no navegador para tentar novamente.",
      );
    }
  };
  createEffect(() => {
    if (storageBlocked() || spinning()) return;
    wheels();
    sessions(); // Track references; normalize and serialize only when writing.
    const t = setTimeout(persist, 350);
    onCleanup(() => clearTimeout(t));
  });
  onMount(() => {
    restoreDiagnostics();
    const openShare = () => {
      try {
        const wheel = parseSharedWheel(location.hash);
        if (wheel) {
          setIncoming(wheel);
          history.replaceState(null, "", location.pathname + location.search);
        }
      } catch (error) {
        notify(error instanceof Error ? error.message : "Link inválido.");
        history.replaceState(null, "", location.pathname + location.search);
      }
    };
    openShare();
    window.addEventListener("hashchange", openShare);
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    const enter = (e: KeyboardEvent) => {
      if (
        incoming() ||
        batchSummary() ||
        (e.target as HTMLElement).closest("dialog")
      )
        return;
      if (e.key === "Escape" && presentation() && !winner()) {
        e.preventDefault();
        exitPresentation();
        return;
      }
      const editing = (e.target as HTMLElement).closest(
        "input,textarea,[contenteditable=true]",
      );
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === "z" &&
        !editing &&
        !winner() &&
        undoStack().length
      ) {
        e.preventDefault();
        undoDelete();
        return;
      }
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
      if (
        el.closest(
          "input,textarea,select,button,a,summary,dialog,[role=dialog],[contenteditable=true]",
        )
      )
        return;
      e.preventDefault();
      if (mode() === "multi") spinAll();
      else if (mode() === "teams") teamsController?.generate();
      else void spin();
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") persist();
    };
    const fullscreenChange = () => {
      if (!document.fullscreenElement) setPresentation(false);
    };
    document.addEventListener("fullscreenchange", fullscreenChange);
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", flushWhenHidden);
    window.addEventListener("keydown", enter);
    onCleanup(() => {
      window.removeEventListener("hashchange", openShare);
      media.removeEventListener("change", change);
      window.removeEventListener("keydown", enter);
      document.removeEventListener("fullscreenchange", fullscreenChange);
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    });
  });
  onCleanup(() => {
    disposed = true;
    clearTimeout(batchPause);
    resolvePause?.();
    clearTimeout(noticeTimer);
    disposeWheelSound();
  });
  const add = () => {
    if (!active() || active()!.options.length >= 500) return;
    const id = uid(),
      index = active()!.options.length;
    update((w) => ({
      ...w,
      options: [
        ...w.options,
        {
          id,
          label: `Opção ${w.options.length + 1}`,
          color: optionColors(
            1,
            w.options.map((o) => o.color),
          )[0],
        },
      ],
    }));
    setSearch("");
    setOnlyDuplicates(false);
    changeEditorPage(Math.floor(index / EDITOR_PAGE_SIZE));
    queueMicrotask(() => document.getElementById(`option-${id}`)?.focus());
  };
  const spin = async () => {
    const w = active();
    if (!w || !canSpin(w) || spinning() || !singleWheel) return;
    const eligible = drawingOptions(w);
    if (!prepareSession(w)) return;
    const index = weightedIndex(eligible),
      selected = eligible[index];
    setWinner(undefined);
    setSpinning(true);
    const completed = await singleWheel.spin(index);
    if (completed) {
      recordResult(w.id, selected);
      setWinner(selected);
    }
    setSpinning(false);
  };
  const spinBatch = async () => {
    const w = active(),
      count = Number(batchCount());
    if (!w || spinning() || !singleWheel) return;
    if (
      !Number.isSafeInteger(count) ||
      count < 1 ||
      count > availableOptions(w).length
    ) {
      notify("Escolha uma quantidade válida de vencedores.");
      return;
    }
    if (!prepareSession(w, count)) return;
    setWinner(undefined);
    setBatchSummary(false);
    setBatchResults([]);
    setBatchTarget(count);
    setBatchStopped(false);
    setBatchRunning(true);
    setSpinning(true);
    prepareWheelSound();
    try {
      await drawSequence({
        wheel: { ...w, options: optionsForMode(w.options, mode()) },
        count,
        shouldStop: () => batchStopped() || disposed,
        spin: async (pool: Option[], index: number) => {
          setBatchPool(pool);
          return singleWheel.spin(index);
        },
        onResult: (result: Option & { date: string }) => {
          recordResult(w.id, result, result.date);
          setBatchResults((all) => [...all, result]);
        },
        between: () =>
          new Promise<void>((resolve) => {
            resolvePause = resolve;
            batchPause = setTimeout(
              () => {
                resolvePause = undefined;
                resolve();
              },
              reduced() ? 0 : 700,
            );
          }),
      });
    } catch {
      notify(
        "Não foi possível concluir o sorteio. Os resultados concluídos foram preservados.",
      );
    } finally {
      if (!disposed) {
        setBatchPool(undefined);
        setBatchRunning(false);
        setSpinning(false);
        if (batchResults().length) setBatchSummary(true);
      }
    }
  };
  const stopBatch = () => {
    setBatchStopped(true);
    clearTimeout(batchPause);
    resolvePause?.();
    resolvePause = undefined;
  };
  const closeBatchSummary = () => {
    setBatchSummary(false);
    queueMicrotask(() =>
      document.querySelector<HTMLButtonElement>(".spin-button")?.focus(),
    );
  };
  const closeResult = () => {
    setWinner(undefined);
    queueMicrotask(() =>
      document.querySelector<HTMLButtonElement>(".spin-button")?.focus(),
    );
  };
  const trapResult = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeResult();
      return;
    }
    if (e.key === "Tab") {
      const controls = (
        e.currentTarget as HTMLElement
      ).querySelectorAll<HTMLElement>("button,textarea");
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
    const index = wheels().findIndex((w) => w.id === id),
      removed = wheels()[index];
    if (!removed || spinning()) return;
    const selected = selectedIds().includes(id),
      wasActive = activeId() === id;
    setSelectedIds((ids) => ids.filter((x) => x !== id));
    controllers.delete(id);
    const next = wheels().filter((w) => w.id !== id);
    setWheels(next);
    if (wasActive) setActiveId(next[0]?.id || "");
    setWinner(undefined);
    rememberAction({
      label: "Roleta excluída.",
      restore: () => {
        if (
          wheels().length >= 100 ||
          totalOptions(wheels()) + removed.options.length > MAX_TOTAL_OPTIONS ||
          archiveBudget([...wheels(), removed]).results > MAX_DRAW_RESULTS ||
          archiveBudget([...wheels(), removed]).participants > MAX_DRAW_PARTICIPANTS
        ) {
          notify("Limite de roletas ou opções atingido.");
          return false;
        }
        setWheels((all) => [
          ...all.slice(0, index),
          removed,
          ...all.slice(index),
        ]);
        if (wasActive) setActiveId(id);
        if (selected && selectedIds().length < 6)
          setSelectedIds((ids) => [...ids, id]);
        return true;
      },
    });
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
    copy.noRepeat = w.noRepeat;
    copy.options = w.options.map((o) => ({ ...o, id: uid(), drawn: false }));
    setWheels([...wheels(), copy]);
    select(copy.id);
    notify("Roleta duplicada.");
  };
  const move = (index: number, delta: number) => update((w) => {
    const options = [...w.options];
    [options[index], options[index + delta]] = [options[index + delta], options[index]];
    return { ...w, options };
  });
  const removeSelected = () => {
    if (spinning()) return;
    const w = active();
    if (!w) return;
    const ids = new Set(selectedOptions());
    const removed = w.options
      .map((option, index) => ({ option, index }))
      .filter((item) => ids.has(item.option.id));
    if (!removed.length) return;
    setWheels((all) =>
      all.map((x) =>
        x.id === w.id
          ? { ...x, options: x.options.filter((o) => !ids.has(o.id)) }
          : x,
      ),
    );
    setSelectedOptions([]);
    rememberAction({
      label:
        removed.length === 1
          ? "Opção excluída."
          : `${removed.length} opções excluídas.`,
      restore: () => {
        const current = wheels().find((x) => x.id === w.id);
        if (
          !current ||
          current.options.length + removed.length > 500 ||
          totalOptions(wheels()) + removed.length > MAX_TOTAL_OPTIONS
        ) {
          notify("Não há espaço para restaurar as opções.");
          return false;
        }
        const options = [...current.options];
        for (const item of removed)
          options.splice(Math.min(item.index, options.length), 0, item.option);
        setWheels((all) =>
          all.map((x) => (x.id === w.id ? { ...x, options } : x)),
        );
        return true;
      },
    });
  };
  const saveSession = () => {
    const name = sessionName().trim(),
      ids = selectedWheels();
    if (!name || !ids.length) {
      notify("Informe um nome e selecione pelo menos uma roleta.");
      return;
    }
    if (sessions().length >= 20) {
      notify("Limite de 20 sessões atingido.");
      return;
    }
    setSessions((all) => [
      ...all,
      { id: uid(), name: name.slice(0, 80), wheelIds: [...ids] },
    ]);
    setSessionName("");
  };
  const loadSession = (session: Session) => {
    if (spinning()) return;
    const ids = session.wheelIds.filter((id) =>
      wheels().some((w) => w.id === id),
    );
    if (!ids.length) {
      notify("As roletas desta sessão foram excluídas.");
      return;
    }
    setSelectedIds(ids);
    setMultiResults({});
    if (ids.length !== session.wheelIds.length)
      notify("Algumas roletas da sessão foram excluídas.");
  };
  const deleteSession = (session: Session) => {
    if (spinning()) return;
    const index = sessions().findIndex((s) => s.id === session.id);
    setSessions((all) => all.filter((s) => s.id !== session.id));
    rememberAction({
      label: "Sessão excluída.",
      restore: () => {
        if (sessions().length >= 20) {
          notify("Limite de sessões atingido.");
          return false;
        }
        setSessions((all) => [
          ...all.slice(0, index),
          session,
          ...all.slice(index),
        ]);
        return true;
      },
    });
  };
  const reorderList = (order: "asc" | "desc" | "shuffle") => {
    const w = active();
    if (!w || spinning() || w.options.length < 2) return;
    const ids = w.options.map((o) => o.id);
    const options = reorderOptions(w.options, order);
    if (options.every((o, i) => o.id === ids[i])) {
      notify("A lista já está nessa ordem.");
      return;
    }
    update((current) => ({ ...current, options }));
    rememberAction({
      label: order === "shuffle" ? "Lista embaralhada." : "Lista ordenada.",
      restore: () => {
        if (!wheels().some((x) => x.id === w.id)) {
          notify("Restaure a roleta antes de desfazer a ordem.");
          return false;
        }
        setWheels((all) =>
          all.map((x) =>
            x.id === w.id ? { ...x, options: restoreOrder(x.options, ids) } : x,
          ),
        );
        return true;
      },
    });
  };
  const shareWheel = async () => {
    const w = shareableWheel();
    if (!w) return;
    try {
      const url = createShareLink(w, location.href);
      try {
        await navigator.clipboard.writeText(url);
        notify("Link copiado.");
      } catch {
        notify("Copie o link no campo abaixo.");
      }
      return url;
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o link.",
      );
    }
  };
  const duplicates = () => {
    const labels =
      active()?.options.map((o) => o.label.trim().toLowerCase()) || [];
    return new Set(labels).size < labels.length;
  };
  return (
    <div class="app-shell" classList={{ presentation: presentation() }} style={{ "--presentation-bg": presentationTheme().background, "--presentation-text": presentationTheme().text }}>
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
      </aside>
      <main>
        <Show when={saveError()}>
          <div class="save-failure" role="alert">
            Não foi possível salvar. Mantenha esta aba aberta e libere espaço no navegador para tentar novamente.
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
                onClick={() => {
                  if (
                    confirm(
                      "Substituir os dados antigos pelas roletas atuais? Os dados antigos serão apagados deste navegador.",
                    )
                  ) {
                    try {
                      lastStored = localStorage.getItem("volta:v1");
                      setStorageBlocked(false);
                    } catch {
                      notify(
                        "O armazenamento não está disponível. Mantenha esta aba aberta para continuar usando suas roletas.",
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
              onClick={() => changeMode("single")}
            >
              <WheelIcon /> Uma roleta
            </button>
            <button
              aria-pressed={mode() === "multi"}
              classList={{ active: mode() === "multi" }}
              disabled={spinning()}
              onClick={() => changeMode("multi")}
            >
              <GridIcon /> Roletas simultâneas
            </button>
            <button aria-pressed={mode() === "weighted"} classList={{ active: mode() === "weighted" }} disabled={spinning()} onClick={() => changeMode("weighted")}>
              <ActionIcon name="weights" /> Roleta com pesos
            </button>
            <button aria-pressed={mode() === "teams"} classList={{ active: mode() === "teams" }} disabled={spinning()} onClick={() => changeMode("teams")}>
              <ActionIcon name="teams" /> Gerar equipes
            </button>
          </div>
          <div class="view-actions">
            <SettingsPanel
              duration={duration()}
              volume={volume()}
              mystery={mystery()}
              onMystery={setMystery}
              busy={spinning()}
              updateBlocked={saveError() || storageBlocked()}
              canShare={Boolean(shareableWheel())}
              onDuration={setDuration}
              onVolume={setVolume}
              onShare={shareWheel}
              onMessage={notify}
            />
            <PresentationSettings value={presentationStyle()} onChange={setPresentationStyle} busy={spinning()} />
            <Show when={undoStack().length}>
              <button
                class="icon-button"
                disabled={spinning()}
                aria-label="Desfazer última ação"
                title="Desfazer última ação"
                onClick={undoDelete}
              >
                <ActionIcon name="undo" />
              </button>
            </Show>
            <button
              class="icon-button presentation-toggle"
              aria-label={
                presentation() ? "Sair da apresentação" : "Modo apresentação"
              }
              title={
                presentation() ? "Sair da apresentação" : "Modo apresentação"
              }
              aria-pressed={presentation()}
              onClick={togglePresentation}
            >
              <ActionIcon name={presentation() ? "collapse" : "expand"} />
            </button>
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
                <Show
                  when={soundOn()}
                  fallback={<path d="m16 9 6 6m-6 0 6-6" />}
                >
                  <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
                </Show>
              </svg>
            </button>
          </div>
        </div>
        <Show when={presentation() && presentationStyle().title.trim()}><h1 class="presentation-event-title">{presentationStyle().title}</h1></Show>
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
                    <div class="workspace-grid" classList={{ "weighted-workspace": mode() === "weighted", "team-workspace": mode() === "teams" }}>
                      <section class="play-card">
                        <Show when={mode() === "teams"} fallback={<>
                        <WheelVisual
                          options={batchPool() ?? drawingOptions(w())}
                          name={w().name}
                          reduced={reduced()}
                          duration={duration()}
                          mystery={mystery()}
                          register={(handle) => (singleWheel = handle)}
                          disabled={spinning() || !canSpin(w())}
                          onSpin={() => void spin()}
                        />
                        <div class="spin-controls">
                          <button
                            class="spin-button"
                            disabled={spinning() || !canSpin(w())}
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
                          <Show when={!canSpin(w())}>
                            <p>
                              {w().noRepeat
                                ? activeOptions(w()).length
                                  ? "Ative uma opção ou reinicie a rodada."
                                  : "Ative ou adicione uma opção para girar."
                                : "Ative ou adicione pelo menos 2 opções para girar."}
                            </p>
                          </Show>
                        </div>
                        <RoundControls
                          enabled={Boolean(w().noRepeat)}
                          remaining={availableOptions(w()).length}
                          total={activeOptions(w()).length}
                          used={w().options.some((o) => o.drawn)}
                          busy={spinning()}
                          onToggle={() => changeRound(w().id)}
                          onReset={() => changeRound(w().id, true)}
                        />
                        <details
                          data-running={batchRunning()}
                          class="batch-controls"
                          open={batchRunning() ? true : undefined}
                        >
                          <summary>Sortear vários vencedores</summary>
                          <div class="batch-setup">
                            <label for="batch-count">Vencedores</label>
                            <input
                              id="batch-count"
                              type="number"
                              min="1"
                              max={availableOptions(w()).length}
                              step="1"
                              value={batchCount()}
                              disabled={spinning()}
                              onInput={(e) =>
                                setBatchCount(e.currentTarget.value)
                              }
                            />
                            <button
                              class="secondary-button"
                              disabled={
                                spinning() || !availableOptions(w()).length
                              }
                              onClick={spinBatch}
                            >
                              Iniciar sequência
                            </button>
                          </div>
                          <Show
                            when={batchRunning()}
                            fallback={
                              <Show when={batchResults().length}>
                                <button
                                  class="text-button"
                                  onClick={() => setBatchSummary(true)}
                                >
                                  Ver resultados ({batchResults().length})
                                </button>
                              </Show>
                            }
                          >
                            <div class="batch-progress" role="status">
                              <span>
                                {batchResults().length} de {batchTarget()}{" "}
                                concluídos
                                <Show when={batchResults().at(-1)}>
                                  {" "}
                                  · {batchResults().at(-1)?.label}
                                </Show>
                              </span>
                              <button
                                class="text-button"
                                disabled={batchStopped()}
                                onClick={stopBatch}
                              >
                                {batchStopped()
                                  ? "Encerrando…"
                                  : "Parar após este giro"}
                              </button>
                            </div>
                          </Show>
                        </details>
                        </>}>
                          <TeamsPanel wheelId={w().id} name={w().name} options={w().options} busy={spinning()} reduced={reduced()} duration={duration()} mystery={mystery()} onBusy={setSpinning} register={(handle) => { teamsController = handle; }} />
                        </Show>
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
                            if (mode() === "teams") { setTab("options"); document.getElementById("tab-options")?.focus(); return; }
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
                            {mode() === "teams" ? "Participantes" : "Opções"} <span>{w().options.length}</span>
                          </button>
                          <Show when={mode() !== "teams"}>
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
                          </Show>
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
                                <DrawSessionsPanel wheelId={w().id} sessions={w().drawSessions || []} busy={spinning()} onStart={(name) => prepareSession(w(), 0, true, name)} onEnd={() => endSession(w().id)} onDelete={(id) => deleteDrawSession(w().id, id)} />
                                <h3>Histórico</h3>
                                <ResultsActions
                                  name={w().name}
                                  results={w().history}
                                />
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
                                      const colors = renewOptionColors(
                                        x.options.map((o) => o.color),
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
                                  {mode() === "teams" ? "PARTICIPANTES" : "OPÇÕES DA ROLETA"}
                                </label>
                              </div>
                              <Show when={mode() === "weighted"}><p class="muted weight-help">Peso 2 tem o dobro da chance de peso 1. Ajuste os pesos de 1 a 1.000; as chances aparecem abaixo.</p></Show>
                              <input
                                class="search-options"
                                aria-label="Buscar opções"
                                placeholder="Buscar opções"
                                value={search()}
                                onInput={(e) =>
                                  setSearch(e.currentTarget.value)
                                }
                              />
                              <details class="list-tools">
                                <summary>Ferramentas da lista</summary>
                                <div>
                                  <button
                                    type="button"
                                    class="secondary-button"
                                    disabled={
                                      spinning() || w().options.length < 2
                                    }
                                    onClick={() => reorderList("asc")}
                                  >
                                    Ordenar A–Z
                                  </button>
                                  <button
                                    type="button"
                                    class="secondary-button"
                                    disabled={
                                      spinning() || w().options.length < 2
                                    }
                                    onClick={() => reorderList("desc")}
                                  >
                                    Ordenar Z–A
                                  </button>
                                  <button
                                    type="button"
                                    class="secondary-button"
                                    disabled={
                                      spinning() || w().options.length < 2
                                    }
                                    onClick={() => reorderList("shuffle")}
                                  >
                                    Embaralhar
                                  </button>
                                  <label>
                                    <input
                                      type="checkbox"
                                      checked={onlyDuplicates()}
                                      onChange={(e) =>
                                        setOnlyDuplicates(
                                          e.currentTarget.checked,
                                        )
                                      }
                                    />
                                    Apenas duplicados
                                  </label>
                                  <button
                                    type="button"
                                    class="secondary-button"
                                    disabled={spinning()}
                                    onClick={() => {
                                      setPicking(!picking());
                                      setSelectedOptions([]);
                                    }}
                                  >
                                    {picking()
                                      ? "Cancelar seleção"
                                      : "Selecionar opções"}
                                  </button>
                                  <Show when={picking()}>
                                    <button
                                      type="button"
                                      class="secondary-button"
                                      disabled={spinning()}
                                      onClick={() =>
                                        setSelectedOptions(
                                          w()
                                            .options.filter(matchesOption)
                                            .map((o) => o.id),
                                        )
                                      }
                                    >
                                      Selecionar filtradas
                                    </button>
                                    <button
                                      type="button"
                                      class="secondary-button danger"
                                      disabled={
                                        spinning() || !selectedOptions().length
                                      }
                                      onClick={removeSelected}
                                    >
                                      Excluir ({selectedOptions().length})
                                    </button>
                                  </Show>
                                </div>
                              </details>
                              <Show when={!editorMatches().length}>
                                <p class="muted">Nenhuma opção encontrada.</p>
                              </Show>
                              <fieldset disabled={spinning()}>
                                <div class="option-list" ref={optionList}>
                                  <Index each={editorWindow().rows}>
                                    {(entry) => {
                                      const o = () => entry().option,
                                        i = () => entry().index;
                                      return (
                                        <div
                                          class="option-row"
                                          classList={{
                                            "option-disabled": Boolean(
                                              o().disabled,
                                            ),
                                            "option-drawn": Boolean(
                                              w().noRepeat && o().drawn,
                                            ),
                                          }}
                                        >
                                          <Show when={picking()}>
                                            <label class="selection-cell">
                                              <input
                                                class="option-select"
                                                type="checkbox"
                                                aria-label={`Selecionar ${o().label}`}
                                                checked={selectedOptions().includes(
                                                  o().id,
                                                )}
                                                onChange={(e) =>
                                                  setSelectedOptions((ids) =>
                                                    e.currentTarget.checked
                                                      ? [...ids, o().id]
                                                      : ids.filter(
                                                          (id) => id !== o().id,
                                                        ),
                                                  )
                                                }
                                              />
                                            </label>
                                          </Show>
                                          <div class="reorder">
                                            <button
                                              aria-label={`Mover ${o().label} para cima`}
                                              disabled={i() === 0 || spinning()}
                                              onClick={() => move(i(), -1)}
                                            >
                                              <ActionIcon name="up" />
                                            </button>
                                            <button
                                              aria-label={`Mover ${o().label} para baixo`}
                                              disabled={
                                                i() ===
                                                  w().options.length - 1 ||
                                                spinning()
                                              }
                                              onClick={() => move(i(), 1)}
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
                                              const color =
                                                e.currentTarget.value;
                                              update((x) => ({
                                                ...x,
                                                options: x.options.map(
                                                  (item) =>
                                                    item.id === o().id
                                                      ? { ...item, color }
                                                      : item,
                                                ),
                                              }));
                                            }}
                                          />
                                          <input
                                            id={`option-${o().id}`}
                                            class="option-input"
                                            aria-label={`${mode() === "teams" ? "Participante" : "Opção"} ${i() + 1}${o().disabled ? " (desativada)" : ""}`}
                                            maxLength={100}
                                            value={o().label}
                                            onInput={(e) => {
                                              const label =
                                                e.currentTarget.value;
                                              update((x) => ({
                                                ...x,
                                                options: x.options.map(
                                                  (item) =>
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
                                                            label: `Opção ${i() + 1}`,
                                                          }
                                                        : item,
                                                  ),
                                                }));
                                            }}
                                          />
                                          <Show when={mode() === "weighted"}><label class="option-weight">Peso
                                            <input type="number" min="1" max="1000" step="1" value={o().weight ?? 1} aria-label={`Peso de ${o().label}`} onChange={(e) => {
                                              const weight = Number(e.currentTarget.value);
                                              if (!Number.isSafeInteger(weight) || weight < 1 || weight > 1000) { e.currentTarget.value = String(o().weight ?? 1); notify("Use um peso inteiro entre 1 e 1.000."); return; }
                                              update((x) => ({ ...x, options: x.options.map((p) => p.id === o().id ? { ...p, weight } : p) }));
                                            }} />
                                            <span>{chanceText(o(), w(), availableOptions(w()))}</span>
                                          </label></Show>
                                          <button
                                            class="toggle-option"
                                            aria-pressed={!o().disabled}
                                            aria-label={`${o().disabled ? "Ativar" : "Desativar"} ${o().label}`}
                                            title={
                                              o().disabled
                                                ? "Ativar opção"
                                                : "Desativar opção"
                                            }
                                            onClick={() =>
                                              update((x) => ({
                                                ...x,
                                                options: x.options.map(
                                                  (item) =>
                                                    item.id === o().id
                                                      ? {
                                                          ...item,
                                                          disabled:
                                                            !item.disabled,
                                                        }
                                                      : item,
                                                ),
                                              }))
                                            }
                                          >
                                            <ActionIcon
                                              name={
                                                o().disabled ? "eyeOff" : "eye"
                                              }
                                            />
                                          </button>
                                          <button
                                            class="remove-option"
                                            aria-label={`Remover ${o().label}`}
                                            onClick={() =>
                                              removeOption(w().id, o().id)
                                            }
                                          >
                                            <ActionIcon name="close" />
                                          </button>
                                        </div>
                                      );
                                    }}
                                  </Index>
                                </div>
                                <Show when={editorWindow().last > 0}>
                                  <nav
                                    class="option-pagination"
                                    aria-label="Páginas das opções"
                                  >
                                    <button
                                      class="secondary-button"
                                      disabled={
                                        spinning() || editorWindow().index === 0
                                      }
                                      onClick={() =>
                                        changeEditorPage(
                                          editorWindow().index - 1,
                                        )
                                      }
                                    >
                                      Anteriores
                                    </button>
                                    <span aria-live="polite">
                                      {editorWindow().index * EDITOR_PAGE_SIZE +
                                        1}
                                      –
                                      {Math.min(
                                        (editorWindow().index + 1) *
                                          EDITOR_PAGE_SIZE,
                                        editorMatches().length,
                                      )}{" "}
                                      de {editorMatches().length}
                                    </span>
                                    <button
                                      class="secondary-button"
                                      disabled={
                                        spinning() ||
                                        editorWindow().index ===
                                          editorWindow().last
                                      }
                                      onClick={() =>
                                        changeEditorPage(
                                          editorWindow().index + 1,
                                        )
                                      }
                                    >
                                      Próximas
                                    </button>
                                  </nav>
                                </Show>
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
                !selectedWheels().some((id) =>
                  canSpin(wheels().find((w) => w.id === id)),
                )
              }
              onClick={spinAll}
            >
              <ActionIcon name="spin" />{" "}
              {spinning() ? "Roletas girando…" : "Girar todas"}
            </button>
          </section>
          <details class="sessions-panel">
            <summary>Sessões</summary>
            <div class="session-save">
              <input
                aria-label="Nome da sessão"
                placeholder="Nome da sessão"
                maxLength={80}
                value={sessionName()}
                onInput={(e) => setSessionName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !spinning()) {
                    e.preventDefault();
                    saveSession();
                  }
                }}
              />
              <button
                class="secondary-button"
                disabled={spinning() || !selectedWheels().length}
                onClick={saveSession}
              >
                Salvar seleção
              </button>
            </div>
            <For each={sessions()}>
              {(session) => (
                <div class="session-row">
                  <button
                    class="session-load"
                    disabled={spinning()}
                    onClick={() => loadSession(session)}
                  >
                    {session.name}
                  </button>
                  <button
                    class="icon-button delete-button"
                    aria-label={`Excluir sessão ${session.name}`}
                    title="Excluir sessão"
                    disabled={spinning()}
                    onClick={() => deleteSession(session)}
                  >
                    <ActionIcon name="close" />
                  </button>
                </div>
              )}
            </For>
          </details>
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
                const wheel = createMemo(() =>
                  wheels().find((w) => w.id === id)!,
                );
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
                      options={drawingOptions(wheel())}
                      name={wheel().name}
                      reduced={reduced()}
                      duration={duration()}
                      mystery={mystery()}
                      register={(handle) => controllers.set(id, handle)}
                      disabled={runningIds().includes(id) || !canSpin(wheel())}
                      onSpin={() => void spinMulti(id)}
                    />
                    <div class="multi-result" role="status">
                      <Show when={multiResults()[id]}>
                        <small>Resultado</small>
                        <strong>{presentation() && presentationStyle().message.trim() ? `${presentationStyle().message} · ${multiResults()[id]}` : multiResults()[id]}</strong>
                      </Show>
                    </div>
                    <div class="spin-controls">
                      <button
                        class="spin-button"
                        disabled={
                          runningIds().includes(id) || !canSpin(wheel())
                        }
                        onClick={() => void spinMulti(id)}
                      >
                        <ActionIcon name="spin" />{" "}
                        {runningIds().includes(id)
                          ? "Girando…"
                          : "Girar esta roleta"}
                      </button>
                    </div>
                    <RoundControls
                      enabled={Boolean(wheel().noRepeat)}
                      remaining={availableOptions(wheel()).length}
                      total={activeOptions(wheel()).length}
                      used={wheel().options.some((o) => o.drawn)}
                      busy={spinning()}
                      onToggle={() => changeRound(id)}
                      onReset={() => changeRound(id, true)}
                    />
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
      <Show when={incoming()}>
        {(shared) => (
          <dialog
            class="share-dialog"
            ref={(el) =>
              queueMicrotask(() => {
                if (el.isConnected) el.showModal();
              })
            }
            onCancel={(e) => {
              e.preventDefault();
              setIncoming(undefined);
            }}
            aria-labelledby="share-title"
          >
            <h2 id="share-title">Adicionar roleta compartilhada?</h2>
            <h3>{shared().name}</h3>
            <p class="muted">{shared().options.length} opções</p>
            <ul>
              <For each={shared().options.slice(0, 12)}>
                {(o) => <li>{o.label}</li>}
              </For>
            </ul>
            <div class="dialog-actions">
              <button
                class="secondary-button"
                onClick={() => setIncoming(undefined)}
              >
                Cancelar
              </button>
              <button
                class="primary"
                disabled={spinning()}
                onClick={() => {
                  const w = shared();
                  if (
                    wheels().length >= 100 ||
                    totalOptions(wheels()) + w.options.length >
                      MAX_TOTAL_OPTIONS
                  ) {
                    notify("Limite de roletas ou opções atingido.");
                    return;
                  }
                  setWheels((all) => [...all, w]);
                  setIncoming(undefined);
                  select(w.id);
                  if (w.options.some((option) => (option.weight ?? 1) !== 1)) changeMode("weighted");
                }}
              >
                Adicionar roleta
              </button>
            </div>
          </dialog>
        )}
      </Show>
      <Show when={undoStack().at(-1)}>
        {(entry) => (
          <div class="undo-toast" role="status">
            <span>{entry().label}</span>
            <button disabled={spinning()} onClick={undoDelete}>
              Desfazer
            </button>
            <button
              aria-label="Fechar aviso de desfazer"
              onClick={() => setUndoStack([])}
            >
              <ActionIcon name="close" />
            </button>
          </div>
        )}
      </Show>
      <Show when={notice()}>
        <div class="toast" role="status">
          {notice()}
          <button aria-label="Fechar aviso" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      </Show>
      <Show when={batchSummary()}>
        <dialog
          class="share-dialog batch-dialog"
          aria-labelledby="batch-title"
          ref={(el) =>
            queueMicrotask(() => {
              if (el.isConnected) el.showModal();
            })
          }
          onCancel={(e) => {
            e.preventDefault();
            closeBatchSummary();
          }}
        >
          <h2 id="batch-title">
            {batchResults().length === batchTarget()
              ? "Vencedores"
              : "Sorteio interrompido"}
          </h2>
          <p class="muted">
            {active()?.name} · {batchResults().length} de {batchTarget()}
          </p>
          <Show when={presentation() && presentationStyle().message.trim()}><p>{presentationStyle().message}</p></Show>
          <ol class="batch-winners">
            <For each={batchResults()}>
              {(result) => <li>{result.label}</li>}
            </For>
          </ol>
          <ResultsActions
            name={active()?.name || "Roleta"}
            results={batchResults()}
          />
          <div class="dialog-actions">
            <button class="primary" onClick={closeBatchSummary}>
              Fechar
            </button>
          </div>
        </dialog>
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
              <p>{presentation() && presentationStyle().message.trim() ? presentationStyle().message : "Resultado"}</p>
              <h2 id="result-title" aria-live="assertive">
                {result().label}
              </h2>
              <ResultsActions
                name={active()?.name || "Roleta"}
                results={active()?.history.slice(0, 1) || []}
              />
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
                  if (active()) removeOption(activeId(), id);
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
