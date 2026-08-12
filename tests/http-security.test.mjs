import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalHttpsUrl,
  SECURITY_HEADERS,
  withSecurityHeaders,
} from "../ops/http-security.mjs";

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

test("security headers replace conflicting upstream values", () => {
  const headers = withSecurityHeaders({
    "content-type": "text/html; charset=utf-8",
    "strict-transport-security": "max-age=0",
    "x-powered-by": "example-framework",
  });

  assert.equal(headers["content-type"], "text/html; charset=utf-8");
  assert.equal(headers["Strict-Transport-Security"], "max-age=86400");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.equal(headers["x-powered-by"], undefined);
  assert.deepEqual(
    Object.keys(SECURITY_HEADERS).sort(),
    Object.keys(headers).filter((name) => name !== "content-type").sort(),
  );
});
