import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { serviceWorkerSource } from "../service-worker.mjs";
const base = "/app/",
  origin = "https://example.com",
  core = [base, base + "assets/main-abc.js", base + "assets/main-abc.css"],
  optional = [base + "assets/qrcode-abc.js", base + "icons/icon.png"];
function worker() {
  const stores = new Map(),
    handlers = {},
    calls = [];
  let offline = false,
    skipped = 0;
  const path = (value) =>
    new URL(typeof value === "string" ? value : value.url, origin).href;
  const fetch = async (request) => {
    calls.push(path(request));
    if (offline) throw Error("offline");
    return new Response("file:" + path(request));
  };
  const open = async (key) => {
    if (!stores.has(key)) stores.set(key, new Map());
    const map = stores.get(key);
    return {
      match: async (req) => map.get(path(req))?.clone(),
      put: async (req, res) => {
        map.set(path(req), res.clone());
      },
      addAll: async (urls) => {
        for (const url of urls) map.set(path(url), await fetch(url));
      },
    };
  };
  const self = {
    location: { origin },
    clients: { claim: async () => {} },
    skipWaiting: () => {
      skipped++;
    },
    addEventListener: (name, fn) => {
      handlers[name] = fn;
    },
  };
  vm.runInNewContext(
    serviceWorkerSource({
      base,
      cache: "volta:/app/:new",
      prefix: "volta:/app/:",
      core,
      optional,
    }),
    {
      self,
      caches: {
        open,
        keys: async () => [...stores.keys()],
        delete: async (key) => stores.delete(key),
      },
      URL,
      fetch,
      Set,
      Promise,
    },
  );
  async function dispatch(name, event = {}) {
    const pending = [];
    let response;
    handlers[name]({
      ...event,
      waitUntil: (p) => pending.push(p),
      respondWith: (p) => {
        response = p;
      },
    });
    const result = await response;
    await Promise.all(pending);
    return result;
  }
  return {
    dispatch,
    open,
    stores,
    calls,
    setOffline: (value) => {
      offline = value;
    },
    get skipped() {
      return skipped;
    },
  };
}
test("instala somente o núcleo, sem HTML duplicado e sem ativar atualização sozinho", async () => {
  const w = worker();
  await w.dispatch("install");
  assert.deepEqual(
    w.calls,
    core.map((x) => origin + x),
  );
  assert.equal(w.skipped, 0);
  w.setOffline(true);
  const response = await w.dispatch("fetch", {
    request: { url: origin + base, method: "GET", mode: "navigate" },
  });
  assert.equal(await response.text(), "file:" + origin + base);
  await w.dispatch("message", { data: "SKIP_WAITING" });
  assert.equal(w.skipped, 1);
});
test("opcional só baixa ao usar e passa a funcionar offline", async () => {
  const w = worker();
  await w.dispatch("install");
  const req = { url: origin + optional[0], method: "GET", mode: "cors" };
  await w.dispatch("fetch", { request: req });
  const before = w.calls.length;
  w.setOffline(true);
  const response = await w.dispatch("fetch", { request: req });
  assert.equal(await response.text(), "file:" + origin + optional[0]);
  assert.equal(w.calls.length, before);
});
test("primeiro uso antes do controle do worker é guardado por mensagem validada", async () => {
  const w = worker();
  await w.dispatch("install");
  const before = w.calls.length;
  await w.dispatch("message", {
    data: {
      type: "CACHE_FEATURES",
      urls: [
        optional[0],
        "https://other.example/private",
        base + "backup.json",
      ],
    },
  });
  assert.equal(w.calls.length, before + 1);
  const cache = await w.open("volta:/app/:new");
  assert.ok(await cache.match(optional[0]));
  assert.equal(await cache.match(base + "backup.json"), undefined);
});
test("não guarda URLs arbitrárias e não interfere em outras origens", async () => {
  const w = worker();
  await w.dispatch("install");
  await w.dispatch("fetch", {
    request: {
      url: origin + base + "unknown.json",
      method: "GET",
      mode: "cors",
    },
  });
  assert.equal(
    await (await w.open("volta:/app/:new")).match(base + "unknown.json"),
    undefined,
  );
  const before = w.calls.length;
  assert.equal(
    await w.dispatch("fetch", {
      request: {
        url: "https://other.example/app/file",
        method: "GET",
        mode: "cors",
      },
    }),
    undefined,
  );
  assert.equal(w.calls.length, before);
});
test("atualização preserva só módulos opcionais com o mesmo hash e caches de outros apps", async () => {
  const w = worker(),
    old = await w.open("volta:/app/:old");
  await old.put(optional[0], new Response("qr"));
  await old.put(optional[1], new Response("ícone antigo"));
  await w.open("other-app");
  await w.dispatch("install");
  await w.dispatch("activate");
  const cache = await w.open("volta:/app/:new");
  assert.equal(await (await cache.match(optional[0])).text(), "qr");
  assert.equal(await cache.match(optional[1]), undefined);
  assert.ok(w.stores.has("other-app"));
  assert.ok(!w.stores.has("volta:/app/:old"));
});
