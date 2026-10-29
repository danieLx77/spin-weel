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
  randomIndex,
  MAX_BACKUP_BYTES,
  MAX_TOTAL_OPTIONS,
  totalOptions,
} from "./logic.mjs";
import "./style.css";
import {
  readSettings,
  parseWorkspace,
  createShareLink,
  parseSharedWheel,
  parseCSV,
  duplicateIds,
  normalize,
} from "./extras.mjs";
import { drawSequence } from "./results.mjs";
import { ResultsActions, type SavedResult } from "./ResultsActions";
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
  drawn?: boolean;
  disabled?: boolean;
};
type Wheel = {
  id: string;
  name: string;
  options: Option[];
  history: { label: string; date: string }[];
  noRepeat?: boolean;
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
  const [duration, setDuration] = createSignal(preferences.duration);
  const [volume, setVolume] = createSignal(preferences.volume);
  createEffect(() => {
    setWheelVolume(volume());
    try {
      localStorage.setItem(
        "volta:settings",
        JSON.stringify({ duration: duration(), volume: volume() }),
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
      "Não foi possível ler os dados salvos. Importe um backup ou salve novamente.";
  }
  const [storageBlocked, setStorageBlocked] = createSignal(
    Boolean(initialError),
  );
  const [sessions, setSessions] = createSignal<Session[]>(initialSessions);
  const [sessionName, setSessionName] = createSignal("");
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
  const [presentation, setPresentation] = createSignal(false);
  type UndoEntry = { label: string; restore: () => boolean };
  const [undoStack, setUndoStack] = createSignal<UndoEntry[]>([]);
  const rememberDeletion = (entry: UndoEntry) =>
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
  const recordResult = (
    id: string,
    selected: Option,
    date = new Date().toISOString(),
  ) =>
    setWheels((all) =>
      all.map((w) =>
        w.id === id
          ? {
              ...markDrawn(w, selected.id),
              history: [{ label: selected.label, date }, ...w.history].slice(
                0,
                20,
              ),
            }
          : w,
      ),
    );
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
    rememberDeletion({
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
    const eligible = availableOptions(w);
    const selected = eligible[randomIndex(eligible.length)];
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
      if (incoming() || batchSummary()) return;
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
    if (!w || !canSpin(w) || spinning() || !singleWheel) return;
    const eligible = availableOptions(w);
    const index = randomIndex(eligible.length),
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
        wheel: w,
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
    rememberDeletion({
      label: "Roleta excluída.",
      restore: () => {
        if (
          wheels().length >= 100 ||
          totalOptions(wheels()) + removed.options.length > MAX_TOTAL_OPTIONS
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
      const workspace = parseWorkspace(await f.text());
      const loaded = workspace.wheels as Wheel[];
      if (sessions().length + workspace.sessions.length > 20)
        throw Error("Limite de 20 sessões atingido.");
      if (totalOptions(wheels()) + totalOptions(loaded) > MAX_TOTAL_OPTIONS)
        throw Error("O conjunto deve ter até 5.000 opções.");
      if (wheels().length + loaded.length > 100)
        throw Error("O total deve ser de até 100 roletas.");
      if (spinning()) throw Error("Espere o giro terminar para importar.");
      setWheels([...wheels(), ...loaded]);
      setSessions((all) => [...all, ...(workspace.sessions as Session[])]);
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
  let csvInput!: HTMLInputElement;
  const importCSV = async (e: Event) => {
    const input = e.target as HTMLInputElement,
      f = input.files?.[0],
      id = activeId();
    if (!f) return;
    try {
      if (f.size > MAX_BACKUP_BYTES) throw Error("CSV deve ter até 5 MB.");
      const rows = parseCSV(await f.text());
      const wheel = wheels().find((w) => w.id === id);
      if (spinning() || id !== activeId())
        throw Error("Espere o giro terminar e tente novamente.");
      if (
        !wheel ||
        wheel.options.length + rows.length > 500 ||
        totalOptions(wheels()) + rows.length > MAX_TOTAL_OPTIONS
      )
        throw Error("Limite de opções atingido.");
      const colors = optionColors(rows.length, [
        ...wheel.options.map((o) => o.color),
        ...rows.filter((o) => o.color).map((o) => o.color as string),
      ]);
      update((w) => ({
        ...w,
        options: [
          ...w.options,
          ...rows.map((row, i) => ({
            id: uid(),
            label: row.label as string,
            color: row.color || colors[i],
          })),
        ],
      }));
      notify(`${rows.length} opções importadas.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "CSV inválido.");
    }
    input.value = "";
  };
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
    rememberDeletion({
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
    rememberDeletion({
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
  const shareWheel = async () => {
    const w = active();
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
    <div class="app-shell" classList={{ presentation: presentation() }}>
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
          <div class="view-actions">
            <SettingsPanel
              duration={duration()}
              volume={volume()}
              busy={spinning()}
              updateBlocked={saveError() || storageBlocked()}
              canShare={mode() === "single" && Boolean(active())}
              onDuration={setDuration}
              onVolume={setVolume}
              onShare={shareWheel}
              onMessage={notify}
            />

            <Show when={undoStack().length}>
              <button
                class="icon-button"
                disabled={spinning()}
                aria-label="Desfazer exclusão"
                title="Desfazer exclusão"
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
                          options={batchPool() ?? availableOptions(w())}
                          name={w().name}
                          reduced={reduced()}
                          duration={duration()}
                          register={(handle) => (singleWheel = handle)}
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
                                    disabled={spinning()}
                                    onClick={() => csvInput.click()}
                                  >
                                    Importar CSV
                                  </button>
                                  <input
                                    ref={csvInput}
                                    type="file"
                                    accept=".csv,text/csv"
                                    class="hidden"
                                    onChange={importCSV}
                                  />
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
                                      Selecionar visíveis
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
                              <Show when={!w().options.some(matchesOption)}>
                                <p class="muted">Nenhuma opção encontrada.</p>
                              </Show>
                              <fieldset disabled={spinning()}>
                                <div class="option-list">
                                  <Index each={w().options}>
                                    {(o, i) => (
                                      <div
                                        class="option-row"
                                        hidden={!matchesOption(o())}
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
                                          aria-label={`Opção ${i + 1}${o().disabled ? " (desativada)" : ""}`}
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
                                              options: x.options.map((item) =>
                                                item.id === o().id
                                                  ? {
                                                      ...item,
                                                      disabled: !item.disabled,
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
                      options={availableOptions(wheel())}
                      name={wheel().name}
                      reduced={reduced()}
                      duration={duration()}
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
              aria-label="Fechar aviso de exclusão"
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
              <p>Resultado</p>
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
