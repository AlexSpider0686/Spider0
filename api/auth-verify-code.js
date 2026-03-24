import { verifyOtpChallenge } from "./auth-otp-core.js";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const payload = req.body || {};
    const result = await verifyOtpChallenge(payload.email, payload.code, payload.challengeToken);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error?.message || "Не удалось проверить код",
    });
  }
}
