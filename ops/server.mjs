import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalHttpsUrl,
  withSecurityHeaders,
} from "./http-security.mjs";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(projectDir, "dist", "client");
const publicPort = Number.parseInt(process.env.PORT ?? "3027", 10);

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
  if (!rawUrl) return null;
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(rawUrl, "http://localhost").pathname);
  } catch {
    return null;
  }

  const relativePath = pathname === "/" ? "index.html" : `.${pathname}`;
  const candidate = path.resolve(clientDir, relativePath);
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
  const shouldRevalidate = extension === ".html" || req.url === "/sw.js";
  res.writeHead(200, withSecurityHeaders({
    "Cache-Control": shouldRevalidate
      ? "no-cache"
      : isHashedAsset
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

const server = createServer(async (req, res) => {
  try {
    const redirectUrl = canonicalHttpsUrl(req);
    if (redirectUrl) {
      res.writeHead(308, withSecurityHeaders({ Location: redirectUrl }));
      res.end();
      return;
    }

    if (await serveStatic(req, res)) return;
    res.writeHead(404, withSecurityHeaders({
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    }));
    res.end("Not Found");
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
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
