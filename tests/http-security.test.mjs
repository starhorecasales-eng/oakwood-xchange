import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalHttpsUrl,
  contentSecurityPolicyForPath,
  permissionsPolicyForPath,
  SECURITY_HEADERS,
  withSecurityHeaders,
} from "../ops/http-security.mjs";

test("allows WebAssembly only on the camera and local OCR asset routes", () => {
  assert.doesNotMatch(contentSecurityPolicyForPath("/"), /wasm-unsafe-eval/);
  assert.match(contentSecurityPolicyForPath("/camera"), /wasm-unsafe-eval/);
  assert.match(contentSecurityPolicyForPath("/camera/scan"), /wasm-unsafe-eval/);
  assert.match(contentSecurityPolicyForPath("/ocr/worker.min.js"), /wasm-unsafe-eval/);
  assert.doesNotMatch(contentSecurityPolicyForPath("/convert/try/gbp/100"), /wasm-unsafe-eval/);
});

test("redirects only canonical public HTTP requests to a fixed HTTPS host", () => {
  assert.equal(
    canonicalHttpsUrl({
      headers: {
        host: "xchange.oakwoodapps.co.uk",
        "x-forwarded-proto": "http",
      },
      url: "/?amount=100",
    }),
    "https://xchange.oakwoodapps.co.uk/?amount=100",
  );

  assert.equal(
    canonicalHttpsUrl({
      headers: { host: "attacker.example", "x-forwarded-proto": "http" },
      url: "/",
    }),
    null,
  );
  assert.equal(
    canonicalHttpsUrl({
      headers: {
        host: "xchange.oakwoodapps.co.uk",
        "x-forwarded-proto": "https",
      },
      url: "/",
    }),
    null,
  );
});

test("keeps camera blocked except on the dedicated future camera route", () => {
  assert.equal(permissionsPolicyForPath("/"), "camera=(), microphone=(), geolocation=()");
  assert.equal(
    permissionsPolicyForPath("/camera"),
    "camera=(self), microphone=(), geolocation=()",
  );
  assert.equal(
    permissionsPolicyForPath("/camera/scan"),
    "camera=(self), microphone=(), geolocation=()",
  );
  assert.equal(
    permissionsPolicyForPath("/camera-guide"),
    "camera=(), microphone=(), geolocation=()",
  );
});

test("security headers replace conflicting upstream values", () => {
  const headers = withSecurityHeaders({
    "content-type": "text/html; charset=utf-8",
    "strict-transport-security": "max-age=0",
    "x-powered-by": "example-framework",
  });

  assert.equal(headers["content-type"], "text/html; charset=utf-8");
  assert.equal(headers["Strict-Transport-Security"], "max-age=86400");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["Permissions-Policy"], "camera=(), microphone=(), geolocation=()");
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.equal(headers["x-powered-by"], undefined);
  assert.deepEqual(
    Object.keys(SECURITY_HEADERS).sort(),
    Object.keys(headers).filter((name) => name !== "content-type").sort(),
  );

  const cameraHeaders = withSecurityHeaders({}, { pathname: "/camera" });
  assert.equal(
    cameraHeaders["Permissions-Policy"],
    "camera=(self), microphone=(), geolocation=()",
  );
});
