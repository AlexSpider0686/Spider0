import { buildMsProjectXml, buildProjectPlan } from "./projectPlanModel.js";

export const LOCAL_PROJECT_BRIDGE_PORT = 32123;
const LOCAL_BRIDGE_ORIGIN = `http://127.0.0.1:${LOCAL_PROJECT_BRIDGE_PORT}`;
const LOCAL_BRIDGE_TIMEOUT_MS = 120000;
const LOCAL_BRIDGE_EXE_NAME = "ProjectCoreLocalBridgeAgent.exe";

function toBase64Utf8(value) {
  const input = String(value ?? "");
  if (typeof TextEncoder !== "undefined" && typeof btoa !== "undefined") {
    const bytes = new TextEncoder().encode(input);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary);
  }

  return "";
}

function filePart(value, fallback) {
  return String(value || fallback).replace(/[<>:"/\\|?*]+/g, "_").slice(0, 80) || fallback;
}

function assetUrl(path) {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${String(path).replace(/^\/+/, "")}`;
}

export function isHostedWebContour() {
  if (typeof window === "undefined") return false;
  const host = String(window.location.hostname || "").toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1") return false;
  return host.endsWith(".vercel.app") || host.endsWith(".amvera.io");
}

async function bridgeFetch(path, init = {}, timeoutMs = LOCAL_BRIDGE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${LOCAL_BRIDGE_ORIGIN}${path}`, {
      mode: "cors",
      cache: "no-store",
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getLocalProjectBridgeStatus() {
  if (typeof window === "undefined") {
    return { ok: false, error: "Локальная проверка доступна только в браузере Windows." };
  }

  try {
    const response = await bridgeFetch("/health", { method: "GET" }, 2500);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        error: payload?.error || "Локальный агент ответил ошибкой.",
      };
    }

    return {
      ok: payload?.Ok === true || payload?.ok === true,
      version: payload?.Version || payload?.version || "",
      port: payload?.Port || payload?.port || LOCAL_PROJECT_BRIDGE_PORT,
      msProjectDetected: payload?.MsProjectDetected ?? payload?.msProjectDetected ?? false,
      msProjectVersion: payload?.MsProjectVersion || payload?.msProjectVersion || "",
      installRoot: payload?.InstallRoot || payload?.installRoot || "",
      startupEnabled: payload?.StartupEnabled ?? payload?.startupEnabled ?? false,
      lastError: payload?.LastError || payload?.lastError || "",
    };
  } catch {
    return {
      ok: false,
      error: "Локальный агент не отвечает на localhost. Возможно, он еще не установлен или не запущен.",
    };
  }
}

export async function isLocalProjectBridgeAvailable() {
  const status = await getLocalProjectBridgeStatus();
  return status.ok === true;
}

export function formatLocalProjectBridgeStatus(status) {
  if (!status?.ok) return status?.error || "Локальный агент недоступен.";

  const details = [
    `Агент отвечает на localhost:${status.port || LOCAL_PROJECT_BRIDGE_PORT}.`,
    status.msProjectDetected
      ? `Microsoft Project найден${status.msProjectVersion ? ` (${status.msProjectVersion})` : ""}.`
      : "Microsoft Project пока не найден через COM.",
    status.startupEnabled
      ? "Автозапуск для текущего пользователя включен."
      : "Автозапуск для текущего пользователя выключен.",
  ];

  if (status.installRoot) {
    details.push(`Каталог агента: ${status.installRoot}.`);
  }
  if (status.lastError) {
    details.push(`Последнее сообщение агента: ${status.lastError}.`);
  }

  return details.join(" ");
}

export function getLocalProjectBridgeInstallerUrl() {
  if (typeof window === "undefined") return "";
  return new URL(assetUrl(`downloads/${LOCAL_BRIDGE_EXE_NAME}`), window.location.origin).toString();
}

export function downloadLocalProjectBridgeInstaller() {
  if (typeof window === "undefined" || typeof document === "undefined") return "";
  const href = assetUrl(`downloads/${LOCAL_BRIDGE_EXE_NAME}`);
  const link = document.createElement("a");
  link.href = href;
  link.download = LOCAL_BRIDGE_EXE_NAME;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return new URL(href, window.location.origin).toString();
}

export async function exportMppViaLocalProjectBridge(payload) {
  if (typeof window === "undefined") {
    throw new Error("Локальный мост доступен только в браузере Windows.");
  }

  const plan = buildProjectPlan(payload || {});
  const xml = buildMsProjectXml(plan);
  const requestBody = {
    xmlBase64: toBase64Utf8(xml),
    projectName: plan?.summary?.projectName || payload?.objectData?.projectName || "project",
    fileName: `${filePart(plan?.summary?.projectName, "project")}_project_plan.mpp`,
    sourceOrigin: window.location.origin,
    promptForFolder: true,
    openInMsProject: true,
  };

  let response;
  try {
    response = await bridgeFetch("/export-mpp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    const installerUrl = downloadLocalProjectBridgeInstaller();
    const details =
      error?.name === "AbortError"
        ? "Локальный агент не ответил за отведенное время."
        : "Локальный агент Project.Core не найден на этом ПК.";
    throw new Error(
      `${details} EXE-файл агента уже скачан: ${installerUrl}. Запустите его один раз под текущим пользователем Windows, дождитесь сообщения об установке и затем повторите экспорт.`
    );
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok || (result?.ok !== true && result?.Ok !== true)) {
    throw new Error(result?.error || result?.Error || "Локальный агент не смог сформировать файл .mpp.");
  }

  return result;
}
