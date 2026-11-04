import { onMount, onCleanup, type JSX } from "solid-js";
import { ActionIcon } from "./Icons";

export function ToolbarPanel(props: {
  label: string;
  icon: "settings" | "presentation";
  children: JSX.Element;
}) {
  let panel!: HTMLDetailsElement;
  const close = (restoreFocus = true) => {
    panel.open = false;
    if (restoreFocus) panel.querySelector<HTMLElement>(":scope > summary")?.focus();
  };
  const updateViewport = () => {
    if (!panel.open) return;
    const viewport = window.visualViewport;
    panel.style.setProperty("--settings-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
    panel.style.setProperty("--settings-viewport-top", `${viewport?.offsetTop ?? 0}px`);
  };
  onMount(() => {
    const outside = (event: Event) => {
      if (panel.open && event.target instanceof Node && !panel.contains(event.target)) close(false);
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
  return (
    <details ref={panel} class="settings-panel" onToggle={(e) => { if (e.target === panel) updateViewport(); }} onKeyDown={(e) => {
      if (e.key === "Escape" && panel.open) { close(); e.stopPropagation(); }
    }}>
      <summary aria-label={props.label} title={props.label}><ActionIcon name={props.icon} /></summary>
      <div class="settings-content" role="region" aria-label={props.label}>
        <div class="settings-heading">
          <h2>{props.label}</h2>
          <button type="button" class="icon-button settings-close" aria-label={`Fechar ${props.label.toLocaleLowerCase("pt-BR")}`} onClick={() => close()}><ActionIcon name="close" /></button>
        </div>
        <div class="settings-body">{props.children}</div>
      </div>
    </details>
  );
}
