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
  assert.match(html, /aria-label="İngiliz sterlini tutarı" value="15,49"/);
  assert.match(html, /1 GBP = 64,564 TL/);
  assert.match(html, /Son kur tarihi:/);
  assert.match(html, /Hesapladığınız tutarlar kaydedilmez/);
  assert.match(html, /Oakwood Apps tarafından hazırlandı/);
  assert.match(html, /brand\/logo-primary-no-tagline\.svg/);
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.doesNotMatch(html, /Kur bağlantısı bekleniyor/);
});

test("ships last-rate fallback and installable offline assets", async () => {
  const [page, camera, layout, rateCache, rates, provider, manifest, serviceWorker] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/camera/CameraScanner.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/rate-cache.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/rates.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/frankfurter.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);

  assert.match(page, /loadRateTable\(localStorage\)/);
  assert.match(page, /saveRateTable\(localStorage, latest\)/);
  assert.match(page, /new AbortController\(\)/);
  assert.match(page, /setTimeout\(\(\) => controller\.abort\(\), 3000\)/);
  assert.match(page, /REFRESH_COOLDOWN_MS = 30_000/);
  assert.match(page, /beforeinstallprompt/);
  assert.match(page, /Ana Ekrana Ekle/);
  assert.match(page, /setCurrencyOrder\(nextOrder\)/);
  assert.match(page, /renderCurrencyBlock\(currencyOrder\[0\]\)/);
  assert.match(page, /renderCurrencyBlock\(currencyOrder\[1\]\)/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /href="\/camera"/);
  assert.match(camera, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(camera, /workerBlobURL: false/);
  assert.match(camera, /workerPath: "\/ocr\/worker\.min\.js"/);
  assert.match(camera, /Fotoğraf cihazınızda işlenir|Kamera karesi/);
  assert.match(rateCache, /cebimde-kur-rates-v3/);
  assert.match(rateCache, /cebimde-kur-rates-v2/);
  assert.match(rateCache, /cebimde-kur-gbp-try/);
  assert.match(rates, /PACKAGED_RATE_TABLE/);
  assert.match(rates, /TRY:\s*64\.564/);
  assert.match(rates, /EUR:\s*1\.1692/);
  assert.match(rates, /USD:\s*1\.3504/);
  assert.match(provider, /api\.frankfurter\.dev\/v2\/rates/);

  assert.match(manifest, /display:\s*"standalone"/);
  assert.match(manifest, /icon-192\.png\?v=3/);
  assert.match(manifest, /icon-512\.png\?v=3/);
  assert.match(serviceWorker, /cebimde-kur-v4/);
  assert.match(serviceWorker, /caches\.match\(event\.request\)/);
  assert.match(serviceWorker, /event\.request\.mode === "navigate"/);
  assert.match(serviceWorker, /response\.ok/);
  assert.doesNotMatch(layout, /maximumScale/);

  await Promise.all([
    access(new URL("../public/icon-180.png", import.meta.url)),
    access(new URL("../public/icon-192.png", import.meta.url)),
    access(new URL("../public/icon-512.png", import.meta.url)),
    access(new URL("../public/ocr/worker.min.js", import.meta.url)),
    access(new URL("../public/ocr/core/tesseract-core-lstm.wasm.js", import.meta.url)),
    access(new URL("../public/ocr/lang/eng.traineddata.gz", import.meta.url)),
  ]);
});

test("ships the supplied brand artwork with intact currency glyphs", async () => {
  const assets = await Promise.all([
    readFile(new URL("../public/brand/app-icon.svg", import.meta.url), "utf8"),
    readFile(new URL("../public/brand/logo-primary.svg", import.meta.url), "utf8"),
    readFile(new URL("../public/brand/logo-primary-no-tagline.svg", import.meta.url), "utf8"),
    readFile(new URL("../public/brand/logo-reversed-dark.svg", import.meta.url), "utf8"),
    readFile(new URL("../public/favicon.svg", import.meta.url), "utf8"),
  ]);

  for (const asset of assets) {
    assert.match(asset, /₺/);
    assert.match(asset, /£/);
    assert.doesNotMatch(asset, /â‚º|Â£/);
  }

  assert.match(assets[0], /↔/);
});
