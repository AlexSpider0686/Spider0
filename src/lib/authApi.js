function parseTokenPayload(token) {
  try {
    const [payloadPart] = String(token || "").split(".");
    if (!payloadPart) return null;
    const json = atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

function buildAuthApiBase() {
  const envBase =
    typeof import.meta !== "undefined" && import.meta?.env ? import.meta.env.VITE_AUTH_API_BASE_URL : "";
  return String(envBase || "").replace(/\/+$/, "");
}

async function postJson(path, payload) {
  const base = buildAuthApiBase();
  const endpoint = `${base}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Request timeout");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  return data;
}

export async function sendAuthCode(email) {
  return postJson("/api/auth-send-code", { email });
}

export async function verifyAuthCode({ email, code, challengeToken }) {
  return postJson("/api/auth-verify-code", { email, code, challengeToken });
}

export function isStoredAuthTokenValid(token) {
  const payload = parseTokenPayload(token);
  if (!payload || payload.type !== "otp_access") return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Number(payload.exp || 0) > nowSeconds;
}
