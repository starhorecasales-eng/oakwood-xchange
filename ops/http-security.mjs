export const CANONICAL_HOST = "xchange.oakwoodapps.co.uk";

export const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.frankfurter.dev",
    "manifest-src 'self'",
    "worker-src 'self'",
    "upgrade-insecure-requests",
  ].join("; "),
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=86400",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});

export function withSecurityHeaders(headers = {}) {
  const secured = {};
  const protectedNames = new Set(
    Object.keys(SECURITY_HEADERS).map((name) => name.toLowerCase()),
  );

  for (const [name, value] of Object.entries(headers)) {
    if (!protectedNames.has(name.toLowerCase()) && name.toLowerCase() !== "x-powered-by") {
      secured[name] = value;
    }
  }

  return { ...secured, ...SECURITY_HEADERS };
}

export function canonicalHttpsUrl(req) {
  const host = String(req.headers.host ?? "").toLowerCase().split(":", 1)[0];
  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "")
    .split(",", 1)[0]
    .trim()
    .toLowerCase();

  if (host !== CANONICAL_HOST || forwardedProto !== "http") return null;

  const requestTarget = typeof req.url === "string" && req.url.startsWith("/")
    ? req.url
    : "/";
  return `https://${CANONICAL_HOST}${requestTarget}`;
}
