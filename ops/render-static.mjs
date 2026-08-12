import { writeFile } from "node:fs/promises";

const workerUrl = new URL(`../dist/server/index.js?render=${Date.now()}`, import.meta.url);
const { default: worker } = await import(workerUrl.href);

const environment = {
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
};
const context = {
  waitUntil() {},
  passThroughOnException() {},
};

async function render(path, output) {
  const response = await worker.fetch(
    new Request(`https://xchange.oakwoodapps.co.uk${path}`),
    environment,
    context,
  );
  if (!response.ok) {
    throw new Error(`Static render failed for ${path}: HTTP ${response.status}`);
  }
  await writeFile(new URL(`../dist/client/${output}`, import.meta.url), await response.text());
}

await render("/", "index.html");
await render("/manifest.webmanifest", "manifest.webmanifest");
