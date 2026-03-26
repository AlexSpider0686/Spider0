import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";
import { resolveVendorPrices } from "./api/vendor-prices.js";
import { issueOtpChallenge, verifyOtpChallenge } from "./api/auth-otp-core.js";

const packageJson = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf8"));
function toBuildTimestamp(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}

function parseTimestampCandidate(value) {
  if (value === undefined || value === null || value === "") return "";
  const raw = String(value).trim();
  if (!raw) return "";

  if (/^\d{13}$/u.test(raw)) {
    return toBuildTimestamp(Number(raw));
  }
  if (/^\d{10}$/u.test(raw)) {
    return toBuildTimestamp(Number(raw) * 1000);
  }
  return toBuildTimestamp(raw);
}

function resolveBuildTimestamp() {
  const envCandidates = [
    process.env.BUILD_TIMESTAMP,
    process.env.VERCEL_GIT_COMMIT_TIMESTAMP,
    process.env.GIT_COMMIT_TIMESTAMP,
    process.env.CI_COMMIT_TIMESTAMP,
    process.env.SOURCE_DATE_EPOCH,
  ];

  for (const candidate of envCandidates) {
    const parsed = parseTimestampCandidate(candidate);
    if (parsed) return parsed;
  }

  return toBuildTimestamp(Date.now());
}

const buildTimestamp = resolveBuildTimestamp();
const buildNumberBase = `${packageJson.version}.${buildTimestamp}`;
const systemBuildNumber = `${buildNumberBase}.system`;
const siteBuildNumber = `${buildNumberBase}.site`;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function localVendorPriceApiPlugin() {
  return {
    name: "local-vendor-price-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) {
          next();
          return;
        }

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        try {
          const payload = await readJsonBody(req);
          let body = null;
          if (req.url.startsWith("/api/vendor-prices")) {
            const requests = Array.isArray(payload?.requests) ? payload.requests : [];
            const results = await resolveVendorPrices(requests);
            body = { results, fetchedAt: new Date().toISOString() };
          } else if (req.url.startsWith("/api/auth-send-code")) {
            body = await issueOtpChallenge(payload?.email);
          } else if (req.url.startsWith("/api/auth-verify-code")) {
            body = await verifyOtpChallenge(payload?.email, payload?.code, payload?.challengeToken);
          } else {
            next();
            return;
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(body));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: error?.message || "Internal server error" }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localVendorPriceApiPlugin()],
  define: {
    __APP_BUILD_NUMBER__: JSON.stringify(systemBuildNumber),
    __SYSTEM_BUILD_NUMBER__: JSON.stringify(systemBuildNumber),
    __SITE_BUILD_NUMBER__: JSON.stringify(siteBuildNumber),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
