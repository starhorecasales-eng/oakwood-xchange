import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request } from "node:http";
import test from "node:test";

const PUBLIC_PORT = 3127;

function send(path, headers) {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: "127.0.0.1",
        port: PUBLIC_PORT,
        path,
        method: "GET",
        headers,
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function waitUntilReady() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await send("/", { Host: "localhost" });
      if (response.statusCode === 200) return;
    } catch {
      // The child process may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Temporary Xchange server did not become ready");
}

test("production server enforces canonical HTTPS and emits security headers", async () => {
  const child = spawn(process.execPath, ["ops/server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(PUBLIC_PORT),
    },
    stdio: "ignore",
    windowsHide: true,
  });

  try {
    await waitUntilReady();

    const secure = await send("/", {
      Host: "xchange.oakwoodapps.co.uk",
      "X-Forwarded-Proto": "https",
    });
    assert.equal(secure.statusCode, 200);
    assert.equal(secure.headers["strict-transport-security"], "max-age=86400");
    assert.equal(secure.headers["x-frame-options"], "DENY");
    assert.match(secure.headers["content-security-policy"], /frame-ancestors 'none'/);
    assert.equal(
      secure.headers["permissions-policy"],
      "camera=(), microphone=(), geolocation=()",
    );

    const camera = await send("/camera", {
      Host: "xchange.oakwoodapps.co.uk",
      "X-Forwarded-Proto": "https",
    });
    assert.equal(camera.statusCode, 404);
    assert.equal(
      camera.headers["permissions-policy"],
      "camera=(self), microphone=(), geolocation=()",
    );

    const insecure = await send("/test?q=1", {
      Host: "xchange.oakwoodapps.co.uk",
      "X-Forwarded-Proto": "http",
    });
    assert.equal(insecure.statusCode, 308);
    assert.equal(
      insecure.headers.location,
      "https://xchange.oakwoodapps.co.uk/test?q=1",
    );

    const missing = await send("/not-found", {
      Host: "xchange.oakwoodapps.co.uk",
      "X-Forwarded-Proto": "https",
    });
    assert.equal(missing.statusCode, 404);
  } finally {
    child.kill();
  }
});
