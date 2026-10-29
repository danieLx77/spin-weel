/// <reference types="vite/client" />
import { createSignal, onMount, onCleanup, Show } from "solid-js";
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function OfflineControls(props: {
  busy: boolean;
  onMessage: (text: string) => void;
}) {
  const [install, setInstall] = createSignal<InstallEvent>();
  const [installed, setInstalled] = createSignal(
    matchMedia("(display-mode: standalone)").matches,
  );
  const [waiting, setWaiting] = createSignal<ServiceWorker>();
  const [ready, setReady] = createSignal(false);
  const [help, setHelp] = createSignal(false);
  let registration: ServiceWorkerRegistration | undefined,
    reload = false;
  onMount(() => {
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    const complete = () => {
      setInstalled(true);
      setInstall(undefined);
    };
    const changed = () => {
      if (reload) location.reload();
    };
    const refresh = () => {
      if (navigator.onLine && document.visibilityState === "visible")
        void registration?.update().catch(() => {});
    };
    window.addEventListener("beforeinstallprompt", prompt);
    window.addEventListener("appinstalled", complete);
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.addEventListener("controllerchange", changed);
      void navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`, {
          scope: import.meta.env.BASE_URL,
          updateViaCache: "none",
        })
        .then((reg) => {
          registration = reg;
          if (reg.waiting) setWaiting(reg.waiting);
          reg.addEventListener("updatefound", () => {
            const worker = reg.installing;
            worker?.addEventListener("statechange", () => {
              if (
                worker.state === "installed" &&
                navigator.serviceWorker.controller
              )
                setWaiting(worker);
            });
          });
          return navigator.serviceWorker.ready;
        })
        .then(() => setReady(true))
        .catch(() =>
          props.onMessage(
            "Não foi possível preparar o modo offline. O site continua disponível online.",
          ),
        );
      window.addEventListener("online", refresh);
      document.addEventListener("visibilitychange", refresh);
    }
    onCleanup(() => {
      window.removeEventListener("beforeinstallprompt", prompt);
      window.removeEventListener("appinstalled", complete);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
      navigator.serviceWorker?.removeEventListener("controllerchange", changed);
    });
  });
  return (
    <div class="offline-controls">
      <Show when={!installed()}>
        <button
          type="button"
          class="secondary-button"
          onClick={async () => {
            const event = install();
            if (!event) {
              setHelp(!help());
              return;
            }
            try {
              await event.prompt();
              await event.userChoice;
              setInstall(undefined);
            } catch {
              props.onMessage(
                "Use o menu do navegador para instalar o aplicativo.",
              );
            }
          }}
        >
          Instalar aplicativo
        </button>
      </Show>
      <Show when={help()}>
        <p class="muted">
          No menu do navegador, use “Instalar aplicativo” ou “Adicionar à tela
          inicial”. No Safari, abra Compartilhar.
        </p>
      </Show>
      <Show when={ready()}>
        <span class="offline-ready" role="status">
          Pronto para uso offline
        </span>
      </Show>
      <Show when={waiting()}>
        <button
          type="button"
          class="secondary-button"
          disabled={props.busy}
          onClick={() => {
            reload = true;
            waiting()?.postMessage("SKIP_WAITING");
          }}
        >
          Atualizar aplicativo
        </button>
      </Show>
    </div>
  );
}
