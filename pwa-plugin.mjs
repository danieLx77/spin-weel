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
      const prefix = `volta:${base}:`,
        cache = prefix + version;
      const files = [
        base,
        `${base}index.html`,
        ...Object.keys(bundle)
          .filter((name) => /\.(js|css)$/.test(name))
          .map((name) => base + name),
        `${base}icons/icon-192.png`,
        `${base}icons/icon-512.png`,
        `${base}icons/apple-touch-icon.png`,
        `${base}manifest.webmanifest`,
      ];
      const sw = `const CACHE=${JSON.stringify(cache)},PREFIX=${JSON.stringify(prefix)},FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(${JSON.stringify(base)}))return;
if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match(${JSON.stringify(base + "index.html")}))));return;}
event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request,{ignoreVary:true}).then(cached=>cached||fetch(event.request))));});`;
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
