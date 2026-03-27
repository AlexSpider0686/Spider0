import crypto from "node:crypto";

const OTP_TTL_SECONDS = 10 * 60;
const ACCESS_TTL_SECONDS = 12 * 60 * 60;
const OTP_ROTATION_STEP_SECONDS = 60;
const OTP_ROTATION_WINDOW_STEPS = 1;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_TEST_OTP = "123456";

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validateEmail(email) {
  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("\u041d\u0435\u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 \u0430\u0434\u0440\u0435\u0441 \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u043e\u0439 \u043f\u043e\u0447\u0442\u044b");
  }
}

function normalizeOtpCode(code) {
  return String(code || "").replace(/[^\d]/g, "").slice(0, 6);
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
    process.env.AMVERA_PROJECT_DOMAIN || "",
    process.env.AMVERA_BRANCH || "",
    process.env.HOSTNAME || "",
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

function signPayload(payloadPart) {
  return crypto.createHmac("sha256", getOtpSecret()).update(payloadPart).digest("base64url");
}

function createSignedToken(payloadObject, ttlSeconds) {
  const issuedAt = nowSeconds();
  const payload = {
    ...payloadObject,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
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
  const left = Buffer.from(signaturePart);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw new Error("Token signature mismatch");
  }

  const payloadRaw = fromBase64Url(payloadPart);
  const payload = JSON.parse(payloadRaw);
  if (!payload?.exp || nowSeconds() > Number(payload.exp)) {
    throw new Error("Token expired");
  }
  return payload;
}

function generateOtpCode() {
  const value = crypto.randomInt(0, 1_000_000);
  return String(value).padStart(6, "0");
}

function isStaticTestMode() {
  return String(process.env.AUTH_STATIC_TEST_CODE ?? "0") === "1";
}

function isRotatingTestMode() {
  if (isStaticTestMode()) return false;
  return String(process.env.AUTH_ROTATING_TEST_CODE ?? "1") === "1";
}

function getStaticOtpCode() {
  const fromEnv = String(process.env.AUTH_TEST_CODE || "").replace(/[^\d]/g, "").slice(0, 6);
  return (fromEnv || DEFAULT_TEST_OTP).padStart(6, "0").slice(0, 6);
}

function getMinuteStep(referenceSeconds = nowSeconds()) {
  return Math.floor(referenceSeconds / OTP_ROTATION_STEP_SECONDS);
}

function buildRotatingOtpCode(email, minuteStep = getMinuteStep()) {
  const seed = `${normalizeEmail(email)}:${minuteStep}`;
  const digestHex = crypto.createHmac("sha256", getOtpSecret()).update(seed).digest("hex");
  const tailHex = digestHex.slice(-8);
  const numeric = Number.parseInt(tailHex, 16) % 1_000_000;
  return String(numeric).padStart(6, "0");
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
      subject: "\u041a\u043e\u0434 \u0432\u0445\u043e\u0434\u0430 SmetaCore",
      text: `\u0412\u0430\u0448 \u043a\u043e\u0434 \u0432\u0445\u043e\u0434\u0430: ${code}. \u041a\u043e\u0434 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 10 \u043c\u0438\u043d\u0443\u0442.`,
      html: `<div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.4">
        <h2 style="margin:0 0 12px 0">SmetaCore</h2>
        <p style="margin:0 0 10px 0">\u0412\u0430\u0448 \u043a\u043e\u0434 \u0432\u0445\u043e\u0434\u0430:</p>
        <p style="font-size:28px;letter-spacing:6px;font-weight:700;margin:0 0 12px 0">${code}</p>
        <p style="margin:0;color:#4b5563">\u041a\u043e\u0434 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 10 \u043c\u0438\u043d\u0443\u0442.</p>
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
  const forceTestMode = String(process.env.AUTH_FORCE_TEST_MODE ?? "1") === "1";
  if (forceTestMode) {
    return {
      delivery: "debug",
      debugCode: code,
      warning: "test_mode_enabled",
    };
  }

  const strictEmail = String(process.env.AUTH_STRICT_EMAIL || "0") === "1";
  const forceDebug = String(process.env.AUTH_DEBUG_CODE || "0") === "1";
  let resendError = null;

  try {
    const sentByResend = await sendCodeViaResend(email, code);
    if (sentByResend) return { delivery: "email" };
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
    throw new Error(
      "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u043a\u043e\u0434 \u043d\u0430 \u043f\u043e\u0447\u0442\u0443. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u043f\u043e\u0447\u0442\u043e\u0432\u043e\u0433\u043e \u043f\u0440\u043e\u0432\u0430\u0439\u0434\u0435\u0440\u0430."
    );
  }
  throw new Error(
    "\u041f\u043e\u0447\u0442\u043e\u0432\u044b\u0439 \u043f\u0440\u043e\u0432\u0430\u0439\u0434\u0435\u0440 \u043d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d (\u043d\u0443\u0436\u043d\u044b RESEND_API_KEY \u0438 RESEND_FROM)."
  );
}

export async function issueOtpChallenge(rawEmail) {
  const email = normalizeEmail(rawEmail);
  validateEmail(email);

  const codeMode = isStaticTestMode() ? "static" : isRotatingTestMode() ? "rotating" : "single";
  const issuedMinuteStep = getMinuteStep();
  const code =
    codeMode === "static"
      ? getStaticOtpCode()
      : codeMode === "rotating"
      ? buildRotatingOtpCode(email, issuedMinuteStep)
      : generateOtpCode();

  const challengeToken = createSignedToken(
    {
      type: "otp_challenge",
      email,
      code,
      codeMode,
      issuedMinuteStep,
      nonce: crypto.randomUUID(),
    },
    OTP_TTL_SECONDS
  );

  const deliveryInfo = await dispatchOtpCode(email, code);
  const secondsToRotate = OTP_ROTATION_STEP_SECONDS - (nowSeconds() % OTP_ROTATION_STEP_SECONDS);
  return {
    ok: true,
    email,
    challengeToken,
    expiresInSeconds: OTP_TTL_SECONDS,
    codeMode,
    codeRotateEverySeconds: codeMode === "rotating" ? OTP_ROTATION_STEP_SECONDS : null,
    secondsToCodeRotation: codeMode === "rotating" ? secondsToRotate : null,
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
    throw new Error("\u041a\u043e\u0434 \u0434\u043e\u043b\u0436\u0435\u043d \u0441\u043e\u0434\u0435\u0440\u0436\u0430\u0442\u044c 6 \u0446\u0438\u0444\u0440");
  }

  const payload = verifySignedToken(challengeToken);
  if (payload?.type !== "otp_challenge") {
    throw new Error("\u041d\u0435\u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 \u0442\u0438\u043f \u0442\u043e\u043a\u0435\u043d\u0430");
  }
  if (normalizeEmail(payload.email) !== email) {
    throw new Error("Email \u043d\u0435 \u0441\u043e\u0432\u043f\u0430\u0434\u0430\u0435\u0442 \u0441 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043d\u044b\u043c \u043a\u043e\u0434\u043e\u043c");
  }

  if (payload.codeMode === "rotating") {
    const currentMinute = getMinuteStep();
    const acceptedCodes = [];
    for (let offset = 0; offset <= OTP_ROTATION_WINDOW_STEPS; offset += 1) {
      acceptedCodes.push(buildRotatingOtpCode(email, currentMinute - offset));
    }
    if (!acceptedCodes.includes(code)) {
      throw new Error("\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u043a\u043e\u0434");
    }
  } else if (normalizeOtpCode(payload.code) !== code) {
    throw new Error("\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u043a\u043e\u0434");
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
