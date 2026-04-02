import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "presentation_assets", "screenshots");
const BASE_URL = "http://localhost:5173";

function createAccessToken(email = "demo@example.com") {
  const payload = {
    type: "otp_access",
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
  };

  const encoded = Buffer.from(JSON.stringify(payload), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${encoded}.local`;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function captureHomeSections(page) {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.locator(".cookie-banner button", { hasText: "Принять все" }).click().catch(() => {});

  await page.locator(".hero").screenshot({
    path: path.join(OUT_DIR, "site-hero.png"),
  });

  await page.locator("#comparison").scrollIntoViewIfNeeded();
  await page.locator("#comparison").screenshot({
    path: path.join(OUT_DIR, "site-comparison.png"),
  });

  await page.locator("#ai-engine").scrollIntoViewIfNeeded();
  await page.locator("#ai-engine").screenshot({
    path: path.join(OUT_DIR, "site-ai-engine.png"),
  });

  await page.goto(`${BASE_URL}/about-system`, { waitUntil: "networkidle" });
  await page.locator(".about-system-page").screenshot({
    path: path.join(OUT_DIR, "site-about-system.png"),
  });
}

async function capturePlatform(page) {
  const token = createAccessToken();

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate((accessToken) => {
    localStorage.setItem("smetacore_auth_token", accessToken);
    sessionStorage.setItem("smetacore_site_auth", "ok");
  }, token);

  await page.goto(`${BASE_URL}/system`, { waitUntil: "networkidle" });
  await page.locator(".app-wrap").screenshot({
    path: path.join(OUT_DIR, "platform-object.png"),
  });

  const steps = [
    { label: "Системы", file: "platform-systems.png" },
    { label: "Бюджет", file: "platform-budget.png" },
    { label: "Стоимость проекта", file: "platform-cost.png" },
    { label: "Логика расчетов", file: "platform-logic.png" },
    { label: "AI-риски проекта", file: "platform-risks.png" },
  ];

  for (const step of steps) {
    await page.getByRole("button", { name: step.label, exact: true }).click();
    await page.waitForTimeout(500);
    await page.locator(".app-wrap").screenshot({
      path: path.join(OUT_DIR, step.file),
    });
  }
}

async function main() {
  await ensureDir(OUT_DIR);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1024 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();

  await captureHomeSections(page);
  await capturePlatform(page);

  await browser.close();
  console.log(`Saved screenshots to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
