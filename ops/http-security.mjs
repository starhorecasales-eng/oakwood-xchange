export const CANONICAL_HOST = "xchange.oakwoodapps.co.uk";

export function contentSecurityPolicyForPath(pathname = "/") {
  const usesOcrWasm = pathname === "/"
    || pathname === "/camera"
    || pathname.startsWith("/camera/")
    || pathname.startsWith("/ocr/");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'unsafe-inline'${usesOcrWasm ? " 'wasm-unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.frankfurter.dev",
    "manifest-src 'self'",
    "worker-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy": contentSecurityPolicyForPath("/"),
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=86400",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});

export function permissionsPolicyForPath(pathname = "/") {
  const cameraEnabled = pathname === "/"
    || pathname === "/camera"
    || pathname.startsWith("/camera/");
  return `${cameraEnabled ? "camera=(self)" : "camera=()"}, microphone=(), geolocation=()`;
}

export function withSecurityHeaders(headers = {}, { pathname = "/" } = {}) {
  const securityHeaders = {
    ...SECURITY_HEADERS,
    "Content-Security-Policy": contentSecurityPolicyForPath(pathname),
    "Permissions-Policy": permissionsPolicyForPath(pathname),
  };
  const secured = {};
  const protectedNames = new Set(
    Object.keys(securityHeaders).map((name) => name.toLowerCase()),
  );

  for (const [name, value] of Object.entries(headers)) {
    if (!protectedNames.has(name.toLowerCase()) && name.toLowerCase() !== "x-powered-by") {
      secured[name] = value;
    }
  }

  return { ...secured, ...securityHeaders };
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
