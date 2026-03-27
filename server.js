import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveVendorPrices } from "./api/vendor-prices.js";
import { issueOtpChallenge, verifyOtpChallenge } from "./api/auth-otp-core.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");
const port = Number(process.env.PORT || process.env.APP_PORT || 3000);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

async function handleApiRequest(req, res, pathname) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return true;
  }

  try {
    const payload = await readJsonBody(req);

    if (pathname === "/api/auth-send-code") {
      const result = await issueOtpChallenge(payload?.email);
      sendJson(res, 200, result);
      return true;
    }

    if (pathname === "/api/auth-verify-code") {
      const result = await verifyOtpChallenge(payload?.email, payload?.code, payload?.challengeToken);
      sendJson(res, 200, result);
      return true;
    }

    if (pathname === "/api/vendor-prices") {
      const requests = Array.isArray(payload?.requests) ? payload.requests : null;
      if (!requests) {
        sendJson(res, 400, { ok: false, error: "requests must be an array" });
        return true;
      }

      const results = await resolveVendorPrices(requests);
      sendJson(res, 200, {
        ok: true,
        results,
        fetchedAt: new Date().toISOString(),
      });
      return true;
    }

    return false;
  } catch (error) {
    sendJson(res, 400, {
      ok: false,
      error: error?.message || "Request failed",
    });
    return true;
  }
}

function safeResolvePublicPath(requestPath) {
  const decodedPath = decodeURIComponent(requestPath.split("?")[0]);
  const normalizedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const absolutePath = path.resolve(distDir, `.${normalizedPath}`);
  if (!absolutePath.startsWith(distDir)) {
    return null;
  }
  return absolutePath;
}

function serveFile(res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";
  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (pathname.startsWith("/api/")) {
    const handled = await handleApiRequest(req, res, pathname);
    if (handled) return;
    sendJson(res, 404, { ok: false, error: "Not found" });
    return;
  }

  if (!["GET", "HEAD"].includes(req.method || "GET")) {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  const targetPath = safeResolvePublicPath(pathname);
  if (targetPath && fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
    if (req.method === "HEAD") {
      res.statusCode = 200;
      res.end();
      return;
    }
    serveFile(res, targetPath);
    return;
  }

  const fallbackPath = path.join(distDir, "index.html");
  if (fs.existsSync(fallbackPath)) {
    if (req.method === "HEAD") {
      res.statusCode = 200;
      res.end();
      return;
    }
    serveFile(res, fallbackPath);
    return;
  }

  res.statusCode = 404;
  res.end("Not found");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`SmetaCore server listening on ${port}`);
});
