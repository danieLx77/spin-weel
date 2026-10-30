import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
const html = (await readFile("dist/index.html", "utf8")).replaceAll(
  "&#39;",
  "'",
);
const base = process.env.BASE_PATH || "/";
assert.match(html, /http-equiv="Content-Security-Policy"/);
assert.match(html, /script-src 'self'/);
assert.match(html, /name="referrer" content="no-referrer"/);
const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(
  (match) => match[1],
);
assert.ok(assets.some((asset) => asset.endsWith(".js")));
assert.ok(assets.some((asset) => asset.endsWith(".css")));
for (const asset of assets) {
  assert.ok(asset.startsWith(base), `Asset fora da base: ${asset}`);
  const relative = asset.slice(base.length);
  assert.ok(!relative.includes(".."));
  await readFile(join("dist", relative));
}
async function inspect(directory) {
  for (const file of await readdir(directory, { withFileTypes: true })) {
    assert.ok(!file.isSymbolicLink(), "Link simbólico no artefato");
    const path = join(directory, file.name);
    if (file.isDirectory()) await inspect(path);
    else
      assert.ok(
        !/\.map$|^\.env|\.(?:pem|key)$/.test(file.name),
        `Arquivo indevido: ${path}`,
      );
  }
}
await inspect("dist");
console.log(`Artefato validado: ${assets.length} assets em ${base}`);

const manifest = JSON.parse(
  await readFile("dist/manifest.webmanifest", "utf8"),
);
assert.equal(manifest.start_url, base);
assert.equal(manifest.scope, base);
assert.equal(manifest.icons.length, 2);
for (const icon of manifest.icons) await readFile(join("dist", icon.src));
const worker = await readFile("dist/sw.js", "utf8");
assert.ok(worker.includes("SKIP_WAITING"));
assert.ok(worker.includes(`SHELL=${JSON.stringify(base)}`));
assert.ok(
  !worker.includes(JSON.stringify(base + "index.html")),
  "HTML duplicado no cache",
);
console.log("Manifesto e cache offline validados.");

for (const name of await readdir("dist/assets")) {
  if (/\.(js|css)$/.test(name))
    assert.ok(
      worker.includes(base + "assets/" + name),
      `Asset sem política de cache: ${name}`,
    );
}

const core = JSON.parse(worker.match(/CORE=(\[[^;]*?\]),OPTIONAL=/)[1]);
const optional = JSON.parse(worker.match(/OPTIONAL=(\[[^;]*?\]);/)[1]);
for (const asset of assets)
  assert.ok(
    core.includes(asset),
    `Asset essencial fora do pré-cache: ${asset}`,
  );
assert.equal(core.filter((path) => path === base).length, 1);
assert.ok(
  !core.some((path) => /qrcode|Diagnostics|web-vitals/.test(path)),
  "Recurso opcional no pré-cache",
);
assert.ok(optional.some((path) => path.includes("qrcode")));
