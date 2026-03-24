import crypto from "node:crypto";

const OTP_TTL_SECONDS = 10 * 60;
const ACCESS_TTL_SECONDS = 12 * 60 * 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function toBase64Url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value) {
  return Buffer.from(String(value || ""), "base64url").toString("utf8");
}

function buildFallbackSecret() {
  const seed = [
    process.env.VERCEL_PROJECT_PRODUCTION_URL || "",
    process.env.VERCEL_GIT_COMMIT_SHA || "",
    process.env.VERCEL_URL || "",
  ]
    .filter(Boolean)
    .join(":");
  const source = seed || "smetacore-public-demo-secret";
  return crypto.createHash("sha256").update(`smetacore:${source}`).digest("hex");
}

function getOtpSecret() {
  const fromEnv = String(process.env.AUTH_OTP_SECRET || "").trim();
  if (fromEnv) return fromEnv;
  return buildFallbackSecret();
}

function signPayload(payload) {
  const secret = getOtpSecret();
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function createSignedToken(payloadObject, ttlSeconds) {
  const payload = {
    ...payloadObject,
    iat: nowSeconds(),
    exp: nowSeconds() + ttlSeconds,
  };
  const payloadPart = toBase64Url(JSON.stringify(payload));
  const signaturePart = signPayload(payloadPart);
  return `${payloadPart}.${signaturePart}`;
}

function verifySignedToken(token) {
  const [payloadPart, signaturePart] = String(token || "").split(".");
  if (!payloadPart || !signaturePart) {
    throw new Error("Malformed token");
  }

  const expected = signPayload(payloadPart);
  if (!crypto.timingSafeEqual(Buffer.from(signaturePart), Buffer.from(expected))) {
    throw new Error("Token signature mismatch");
  }

  const payloadRaw = fromBase64Url(payloadPart);
  const payload = JSON.parse(payloadRaw);
  if (!payload?.exp || nowSeconds() > Number(payload.exp)) {
    throw new Error("Token expired");
  }

  return payload;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validateEmail(email) {
  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("Некорректный адрес электронной почты");
  }
}

function normalizeOtpCode(code) {
  return String(code || "").replace(/[^\d]/g, "").slice(0, 6);
}

function generateOtpCode() {
  const value = crypto.randomInt(0, 1_000_000);
  return String(value).padStart(6, "0");
}

async function sendCodeViaResend(email, code) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const fromAddress = String(process.env.RESEND_FROM || "").trim();
  if (!apiKey || !fromAddress) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [email],
      subject: "Код входа SmetaCore",
      text: `Ваш код входа: ${code}. Код действует 10 минут.`,
      html: `<div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.4">
        <h2 style="margin:0 0 12px 0">SmetaCore</h2>
        <p style="margin:0 0 10px 0">Ваш код входа:</p>
        <p style="font-size:28px;letter-spacing:6px;font-weight:700;margin:0 0 12px 0">${code}</p>
        <p style="margin:0;color:#4b5563">Код действует 10 минут.</p>
      </div>`,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Resend API error: ${response.status}${details ? ` ${details}` : ""}`);
  }

  return true;
}

async function dispatchOtpCode(email, code) {
  const strictEmail = String(process.env.AUTH_STRICT_EMAIL || "0") === "1";
  const forceDebug = String(process.env.AUTH_DEBUG_CODE || "0") === "1";
  let resendError = null;

  try {
    const sentByResend = await sendCodeViaResend(email, code);
    if (sentByResend) {
      return { delivery: "email" };
    }
  } catch (error) {
    resendError = error;
  }

  if (forceDebug || !strictEmail) {
    return {
      delivery: "debug",
      debugCode: code,
      warning: resendError
        ? `email_provider_failed_debug_mode:${String(resendError?.message || "unknown_error").slice(0, 180)}`
        : "email_provider_not_configured_debug_mode",
    };
  }

  if (resendError) {
    throw new Error("Не удалось отправить код на почту. Проверьте настройки почтового провайдера.");
  }
  throw new Error("Почтовый провайдер не настроен (нужны RESEND_API_KEY и RESEND_FROM).");
}

export async function issueOtpChallenge(rawEmail) {
  const email = normalizeEmail(rawEmail);
  validateEmail(email);
  const code = generateOtpCode();

  const challengeToken = createSignedToken(
    {
      type: "otp_challenge",
      email,
      code,
      nonce: crypto.randomUUID(),
    },
    OTP_TTL_SECONDS
  );

  const deliveryInfo = await dispatchOtpCode(email, code);
  return {
    ok: true,
    email,
    challengeToken,
    expiresInSeconds: OTP_TTL_SECONDS,
    delivery: deliveryInfo.delivery,
    debugCode: deliveryInfo.debugCode,
    warning: deliveryInfo.warning,
  };
}

export async function verifyOtpChallenge(rawEmail, rawCode, challengeToken) {
  const email = normalizeEmail(rawEmail);
  validateEmail(email);
  const code = normalizeOtpCode(rawCode);

  if (code.length !== 6) {
    throw new Error("Код должен содержать 6 цифр");
  }

  const payload = verifySignedToken(challengeToken);
  if (payload?.type !== "otp_challenge") {
    throw new Error("Некорректный тип токена");
  }

  if (normalizeEmail(payload.email) !== email) {
    throw new Error("Email не совпадает с отправленным кодом");
  }

  if (normalizeOtpCode(payload.code) !== code) {
    throw new Error("Неверный код");
  }

  const accessToken = createSignedToken(
    {
      type: "otp_access",
      email,
      nonce: crypto.randomUUID(),
    },
    ACCESS_TTL_SECONDS
  );

  return {
    ok: true,
    accessToken,
    expiresInSeconds: ACCESS_TTL_SECONDS,
    email,
  };
}

export function checkAccessToken(accessToken) {
  try {
    const payload = verifySignedToken(accessToken);
    return payload?.type === "otp_access";
  } catch (_) {
    return false;
  }
}
