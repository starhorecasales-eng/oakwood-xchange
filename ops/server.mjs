import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startProdServer } from "../node_modules/vinext/dist/server/prod-server.js";
import {
  canonicalHttpsUrl,
  withSecurityHeaders,
} from "./http-security.mjs";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(projectDir, "dist", "client");
const publicPort = Number.parseInt(process.env.PORT ?? "3027", 10);
const internalPort = Number.parseInt(process.env.VINEXT_INTERNAL_PORT ?? "3028", 10);
const bootstrapVersion = "20260812.2";

const contentTypes = new Map([
  [".avif", "image/avif"],
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function localFileFor(rawUrl) {
  if (!rawUrl || rawUrl === "/") return null;
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(rawUrl, "http://localhost").pathname);
  } catch {
    return null;
  }

  const candidate = path.resolve(clientDir, `.${pathname}`);
  const clientPrefix = `${path.resolve(clientDir)}${path.sep}`;
  return candidate.startsWith(clientPrefix) ? candidate : null;
}

async function serveStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const filename = localFileFor(req.url);
  if (!filename) return false;

  let info;
  try {
    info = await stat(filename);
  } catch {
    return false;
  }
  if (!info.isFile()) return false;

  const extension = path.extname(filename).toLowerCase();
  const isHashedAsset = req.url?.startsWith("/assets/");
  res.writeHead(200, withSecurityHeaders({
    "Cache-Control": isHashedAsset
      ? "public, max-age=31536000, immutable"
      : "public, max-age=3600",
    "Content-Length": info.size,
    "Content-Type": contentTypes.get(extension) ?? "application/octet-stream",
  }));

  if (req.method === "HEAD") {
    res.end();
  } else {
    createReadStream(filename).pipe(res);
  }
  return true;
}

function proxyToVinext(req, res) {
  const proxy = httpRequest(
    {
      host: "127.0.0.1",
      port: internalPort,
      method: req.method,
      path: req.url,
      headers: {
        ...req.headers,
        "accept-encoding": "identity",
      },
    },
    (upstream) => {
      const contentType = String(upstream.headers["content-type"] ?? "");
      if (req.method !== "HEAD" && contentType.includes("text/html")) {
        const chunks = [];
        upstream.on("data", (chunk) => chunks.push(chunk));
        upstream.on("end", () => {
          const html = Buffer.concat(chunks)
            .toString("utf8")
            .replace(
              /(<script id="_R_">import\(")([^"?]+\.js)("\)<\/script>)/,
              `$1$2?v=${bootstrapVersion}$3`,
            );
          const body = Buffer.from(html, "utf8");
          const headers = { ...upstream.headers };
          delete headers["content-encoding"];
          delete headers["content-length"];
          delete headers["transfer-encoding"];
          headers["content-length"] = String(body.length);
          headers["cache-control"] = "no-cache";
          res.writeHead(
            upstream.statusCode ?? 502,
            upstream.statusMessage,
            withSecurityHeaders(headers),
          );
          res.end(body);
        });
        return;
      }

      res.writeHead(
        upstream.statusCode ?? 502,
        upstream.statusMessage,
        withSecurityHeaders(upstream.headers),
      );
      upstream.pipe(res);
    },
  );

  proxy.on("error", (error) => {
    console.error("[xchange] Internal server request failed:", error.message);
    if (!res.headersSent) {
      res.writeHead(502, withSecurityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
    }
    res.end("Bad Gateway");
  });
  req.pipe(proxy);
}

process.env.VINEXT_TRUST_PROXY = "1";
process.env.VINEXT_TRUSTED_HOSTS ??= "xchange.oakwoodapps.co.uk";

const vinext = await startProdServer({
  port: internalPort,
  host: "127.0.0.1",
  outDir: path.join(projectDir, "dist"),
});

const server = createServer(async (req, res) => {
  try {
    const redirectUrl = canonicalHttpsUrl(req);
    if (redirectUrl) {
      res.writeHead(308, withSecurityHeaders({ Location: redirectUrl }));
      res.end();
      return;
    }

    if (await serveStatic(req, res)) return;
    proxyToVinext(req, res);
  } catch (error) {
    console.error("[xchange] Request failed:", error);
    if (!res.headersSent) {
      res.writeHead(500, withSecurityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
    }
    res.end("Internal Server Error");
  }
});

server.listen(publicPort, "127.0.0.1", () => {
  console.log(`[xchange] Server running at http://127.0.0.1:${publicPort}`);
});

function stop() {
  server.close(() => {
    vinext.server.close(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
