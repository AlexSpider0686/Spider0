const OTP_TTL_SECONDS = 10 * 60;
const ACCESS_TTL_SECONDS = 12 * 60 * 60;
const OTP_ROTATION_STEP_SECONDS = 60;
const CODE_LENGTH = 6;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function toBase64Url(value) {
  const encoded = btoa(unescape(encodeURIComponent(value)));
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(String(value || "").length / 4) * 4, "=");
  return decodeURIComponent(escape(atob(normalized)));
}

function parseTokenPayload(token) {
  try {
    const [payloadPart] = String(token || "").split(".");
    if (!payloadPart) return null;
    return JSON.parse(fromBase64Url(payloadPart));
  } catch (_) {
    return null;
  }
}

function createUnsignedToken(payload) {
  return `${toBase64Url(JSON.stringify(payload))}.local`;
}

function hashString(value) {
  let hash = 0;
  const source = String(value || "");
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) % 1000000;
  }
  return Math.abs(hash);
}

function buildRotatingOtpCode(email, step = Math.floor(nowSeconds() / OTP_ROTATION_STEP_SECONDS)) {
  const numeric = hashString(`${normalizeEmail(email)}:${step}`) % 1000000;
  return String(numeric).padStart(CODE_LENGTH, "0");
}

export async function sendAuthCode(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("Некорректный email");
  }

  const issuedAt = nowSeconds();
  const code = buildRotatingOtpCode(normalizedEmail);
  const challengeToken = createUnsignedToken({
    type: "otp_challenge",
    email: normalizedEmail,
    codeMode: "rotating",
    iat: issuedAt,
    exp: issuedAt + OTP_TTL_SECONDS,
  });

  return {
    ok: true,
    email: normalizedEmail,
    challengeToken,
    expiresInSeconds: OTP_TTL_SECONDS,
    codeMode: "rotating",
    codeRotateEverySeconds: OTP_ROTATION_STEP_SECONDS,
    secondsToCodeRotation: OTP_ROTATION_STEP_SECONDS - (issuedAt % OTP_ROTATION_STEP_SECONDS),
    delivery: "debug",
    debugCode: code,
    warning: "local_debug_mode",
  };
}

export async function verifyAuthCode({ email, code, challengeToken }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = String(code || "").replace(/[^\d]/g, "").slice(0, CODE_LENGTH);
  const payload = parseTokenPayload(challengeToken);

  if (!payload || payload.type !== "otp_challenge") {
    throw new Error("Некорректный код доступа");
  }

  if (normalizedEmail !== normalizeEmail(payload.email)) {
    throw new Error("Email не совпадает");
  }

  if (normalizedCode.length !== CODE_LENGTH) {
    throw new Error("Введите 6 цифр");
  }

  if (Number(payload.exp || 0) <= nowSeconds()) {
    throw new Error("Срок действия кода истек");
  }

  const currentStep = Math.floor(nowSeconds() / OTP_ROTATION_STEP_SECONDS);
  const acceptedCodes = [buildRotatingOtpCode(normalizedEmail, currentStep), buildRotatingOtpCode(normalizedEmail, currentStep - 1)];
  if (!acceptedCodes.includes(normalizedCode)) {
    throw new Error("Неверный код");
  }

  const issuedAt = nowSeconds();
  const accessToken = createUnsignedToken({
    type: "otp_access",
    email: normalizedEmail,
    iat: issuedAt,
    exp: issuedAt + ACCESS_TTL_SECONDS,
  });

  return {
    ok: true,
    accessToken,
    expiresInSeconds: ACCESS_TTL_SECONDS,
    email: normalizedEmail,
  };
}

export function isStoredAuthTokenValid(token) {
  const payload = parseTokenPayload(token);
  if (!payload || payload.type !== "otp_access") return false;
  return Number(payload.exp || 0) > nowSeconds();
}
