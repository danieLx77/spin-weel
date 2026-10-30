import { serviceWorkerSource } from "./service-worker.mjs";
import { createHash } from "node:crypto";
export function pwaPlugin(base) {
  return {
    name: "volta-offline",
    apply: "build",
    enforce: "post",
    transformIndexHtml() {
      return [
        {
          tag: "link",
          attrs: { rel: "icon", href: `${base}icons/icon-192.png` },
          injectTo: "head",
        },
        {
          tag: "link",
          attrs: { rel: "manifest", href: `${base}manifest.webmanifest` },
          injectTo: "head",
        },
        {
          tag: "link",
          attrs: {
            rel: "apple-touch-icon",
            href: `${base}icons/apple-touch-icon.png`,
          },
          injectTo: "head",
        },
      ];
    },
    generateBundle(_options, bundle) {
      const version = createHash("sha256")
        .update(
          Object.keys(bundle)
            .sort()
            .map(
              (key) =>
                key + String(bundle[key].source || bundle[key].code || ""),
            )
            .join("|"),
        )
        .digest("hex")
        .slice(0, 16);
      const coreFiles = new Set();
      const include = (name) => {
        if (coreFiles.has(name)) return;
        coreFiles.add(name);
        const item = bundle[name];
        if (item?.type === "chunk") {
          for (const dependency of item.imports) include(dependency);
          for (const css of item.viteMetadata?.importedCss || [])
            coreFiles.add(css);
        }
      };
      for (const [name, item] of Object.entries(bundle))
        if (item.type === "chunk" && item.isEntry) include(name);
      const core = [
        base,
        ...[...coreFiles].map((name) => base + name),
        `${base}manifest.webmanifest`,
        `${base}icons/icon-192.png`,
      ];
      const optional = [
        ...Object.keys(bundle)
          .filter((name) => /\.(js|css)$/.test(name) && !coreFiles.has(name))
          .map((name) => base + name),
        `${base}icons/icon-512.png`,
        `${base}icons/apple-touch-icon.png`,
      ];
      const prefix = `volta:${base}:`;
      const cache =
        prefix +
        createHash("sha256")
          .update(version)
          .update(serviceWorkerSource.toString())
          .update(JSON.stringify({ core, optional }))
          .digest("hex")
          .slice(0, 16);
      const sw = serviceWorkerSource({ base, cache, prefix, core, optional });
      this.emitFile({ type: "asset", fileName: "sw.js", source: sw });
      this.emitFile({
        type: "asset",
        fileName: "manifest.webmanifest",
        source: JSON.stringify({
          id: base,
          name: "Volta — Roletas",
          short_name: "Volta",
          lang: "pt-BR",
          start_url: base,
          scope: base,
          display: "standalone",
          background_color: "#fafafa",
          theme_color: "#fafafa",
          icons: [
            {
              src: "icons/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: "icons/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        }),
      });
    },
  };
}
