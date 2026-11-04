import { ToolbarPanel } from "./ToolbarPanel";
import { For } from "solid-js";
export const presentationThemes = [
  { id: "neutral", name: "Neutro", background: "#fafafa", text: "#27272a" },
  { id: "sand", name: "Areia", background: "#fff7ed", text: "#431407" },
  { id: "sky", name: "Céu", background: "#eff6ff", text: "#172554" },
  { id: "mint", name: "Menta", background: "#f0fdf4", text: "#14532d" },
];
export type PresentationStyle = { title: string; message: string; theme: string };
export function readPresentation(raw: string | null): PresentationStyle {
  try {
    const data = JSON.parse(raw || "{}");
    return {
      title: typeof data.title === "string" ? data.title.slice(0, 80) : "",
      message: typeof data.message === "string" ? data.message.slice(0, 120) : "",
      theme: presentationThemes.some((t) => t.id === data.theme) ? data.theme : "neutral",
    };
  } catch { return { title: "", message: "", theme: "neutral" }; }
}
export function PresentationSettings(props: { value: PresentationStyle; busy: boolean; onChange: (value: PresentationStyle) => void }) {
  return <ToolbarPanel label="Personalizar apresentação" icon="presentation"><div class="feature-content">
    <label class="setting-field">Título do evento<input maxLength={80} value={props.value.title} disabled={props.busy} placeholder="Ex.: Encontro da equipe" onInput={(e) => props.onChange({ ...props.value, title: e.currentTarget.value })} /></label>
    <label class="setting-field">Mensagem do resultado<input maxLength={120} value={props.value.message} disabled={props.busy} placeholder="Ex.: Parabéns!" onInput={(e) => props.onChange({ ...props.value, message: e.currentTarget.value })} /></label>
    <label class="setting-field">Fundo da apresentação<select value={props.value.theme} disabled={props.busy} onChange={(e) => props.onChange({ ...props.value, theme: e.currentTarget.value })}><For each={presentationThemes}>{(theme) => <option value={theme.id}>{theme.name}</option>}</For></select></label>
    <p class="muted">Preferências salvas neste navegador. Entre no modo apresentação para exibir o título, o fundo e a mensagem.</p>
  </div></ToolbarPanel>;
}
