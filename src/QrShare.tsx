import { createSignal, Show, onCleanup } from "solid-js";
import { ActionIcon } from "./Icons";
import { createShareLink } from "./extras.mjs";
import { makeQRMatrix } from "./qr.mjs";
type SharedWheel = {
  name: string;
  options: { label: string; color: string; disabled?: boolean }[];
  noRepeat?: boolean;
};
export function QrShare(props: { wheel?: SharedWheel; busy: boolean }) {
  const [open, setOpen] = createSignal(false);
  const [name, setName] = createSignal("");
  const [url, setUrl] = createSignal("");
  const [image, setImage] = createSignal("");
  const [error, setError] = createSignal("");
  const [copied, setCopied] = createSignal(false);
  const [manualCopy, setManualCopy] = createSignal(false);
  let request = 0;
  let button!: HTMLButtonElement;
  onCleanup(() => {
    request++;
  });
  const close = () => {
    request++;
    setOpen(false);
    queueMicrotask(() => button?.focus());
  };
  const show = async () => {
    const wheel = props.wheel;
    if (!wheel || props.busy) return;
    const token = ++request;
    setName(wheel.name);
    setUrl("");
    setImage("");
    setError("");
    setCopied(false);
    setManualCopy(false);
    setOpen(true);
    try {
      const link = createShareLink(wheel, location.href);
      setUrl(link);
      const matrix = await makeQRMatrix(link);
      if (request !== token) return;
      const canvas = document.createElement("canvas"),
        cell = 4,
        quiet = 4;
      canvas.width = canvas.height = (matrix.length + quiet * 2) * cell;
      const context = canvas.getContext("2d");
      if (!context) throw Error("Não foi possível desenhar o QR Code.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#000000";
      matrix.forEach((row, y) =>
        row.forEach((dark, x) => {
          if (dark)
            context.fillRect(
              (x + quiet) * cell,
              (y + quiet) * cell,
              cell,
              cell,
            );
        }),
      );
      setImage(canvas.toDataURL("image/png"));
    } catch (err) {
      if (request === token)
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível gerar o QR Code.",
        );
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
    } catch {
      setManualCopy(true);
    }
  };
  const download = () => {
    const link = document.createElement("a");
    link.href = image();
    link.download = "volta-qr-code.png";
    link.click();
  };
  return (
    <>
      <button
        ref={button}
        class="icon-button qr-toggle"
        aria-label="Compartilhar por QR Code"
        title="Compartilhar por QR Code"
        disabled={!props.wheel || props.busy}
        onClick={show}
      >
        <ActionIcon name="qr" />
      </button>
      <Show when={open()}>
        <dialog
          class="share-dialog qr-dialog"
          aria-labelledby="qr-title"
          ref={(el) =>
            queueMicrotask(() => {
              if (el.isConnected) el.showModal();
            })
          }
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
        >
          <div class="qr-heading">
            <h2 id="qr-title">Compartilhar roleta</h2>
            <button
              class="icon-button"
              aria-label="Fechar QR Code"
              onClick={close}
            >
              <ActionIcon name="close" />
            </button>
          </div>
          <p class="muted">{name()}</p>
          <Show
            when={error()}
            fallback={
              <Show
                when={image()}
                fallback={<p role="status">Gerando QR Code…</p>}
              >
                <img
                  class="qr-image"
                  src={image()}
                  alt={`QR Code para abrir uma cópia de ${name()}`}
                />
              </Show>
            }
          >
            <p class="qr-error" role="alert">
              {error()}
            </p>
          </Show>
          <div class="qr-actions">
            <Show when={url()}>
              <button class="secondary-button" onClick={copy}>
                {copied() ? "Link copiado" : "Copiar link"}
              </button>
            </Show>
            <Show when={image()}>
              <button class="secondary-button" onClick={download}>
                Baixar QR Code
              </button>
            </Show>
          </div>
          <Show when={manualCopy()}>
            <label class="setting-field">
              Link da roleta
              <input
                readonly
                value={url()}
                onFocus={(e) => e.currentTarget.select()}
              />
            </label>
          </Show>
        </dialog>
      </Show>
    </>
  );
}
