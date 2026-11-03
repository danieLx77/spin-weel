import { For } from "solid-js";
import { wheelTemplates } from "./templates.mjs";
export function TemplatePicker(props: { busy: boolean; onCreate: (name: string, labels: string[]) => void }) {
  return <details class="template-picker feature-panel"><summary>Modelos prontos de roleta</summary><div class="template-list">
    <For each={wheelTemplates}>{(template) => <div class="template-row"><div><h3>{template.name}</h3><p class="muted">{template.description}</p><details><summary>Ver {template.labels.length} opções</summary><ul><For each={template.labels}>{(label) => <li>{label}</li>}</For></ul></details></div><button class="secondary-button" disabled={props.busy} onClick={() => props.onCreate(template.name, [...template.labels])} aria-label={`Usar modelo ${template.name}`}>Usar modelo</button></div>}</For>
  </div></details>;
}
