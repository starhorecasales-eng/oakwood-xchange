import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders an immediately usable GBP/TRY converter", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Cebimde Kur — TL ↔ Sterlin<\/title>/);
  assert.match(html, /aria-label="Türk lirası tutarı" value="1000"/);
  assert.match(html, /aria-label="İngiliz sterlini tutarı" value="15,51"/);
  assert.match(html, /1 GBP = 64,491 TL/);
  assert.match(html, /Son kur tarihi:/);
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.doesNotMatch(html, /Kur bağlantısı bekleniyor/);
});

test("ships last-rate fallback and installable offline assets", async () => {
  const [page, manifest, serviceWorker] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);

  assert.match(page, /const PACKAGED_RATE/);
  assert.match(page, /localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(page, /new AbortController\(\)/);
  assert.match(page, /setTimeout\(\(\) => controller\.abort\(\), 3000\)/);
  assert.match(page, /REFRESH_COOLDOWN_MS = 30_000/);
  assert.match(page, /MIN_VALID_RATE = 10/);
  assert.match(page, /MAX_VALID_RATE = 250/);
  assert.match(page, /validRate\(latest\)/);
  assert.match(page, /validRate\(cached\)/);
  assert.match(page, /beforeinstallprompt/);
  assert.match(page, /Ana Ekrana Ekle/);

  assert.match(manifest, /display:\s*"standalone"/);
  assert.match(manifest, /icon-192\.png/);
  assert.match(manifest, /icon-512\.png/);
  assert.match(serviceWorker, /cebimde-kur-v2/);
  assert.match(serviceWorker, /caches\.match\(event\.request\)/);

  await Promise.all([
    access(new URL("../public/icon-180.png", import.meta.url)),
    access(new URL("../public/icon-192.png", import.meta.url)),
    access(new URL("../public/icon-512.png", import.meta.url)),
  ]);
});
