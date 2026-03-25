import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { siteConfig } from "../data/siteContent";
import { sendAuthCode, verifyAuthCode } from "../lib/authApi";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
};

const CODE_LENGTH = 6;
const LEGAL_WARNING =
  "\u0414\u043b\u044f \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0435\u043d\u0438\u044f \u043d\u0443\u0436\u043d\u043e \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c \u0441\u043e\u0433\u043b\u0430\u0441\u0438\u0435 \u043d\u0430 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0443 \u043f\u0435\u0440\u0441\u043e\u043d\u0430\u043b\u044c\u043d\u044b\u0445 \u0434\u0430\u043d\u043d\u044b\u0445.";

export function AuthModal({ open, onClose }: AuthModalProps) {
  const navigate = useNavigate();
  const verifyingRef = useRef(false);

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");
  const [otpDigits, setOtpDigits] = useState(Array.from({ length: CODE_LENGTH }, () => ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");

  const otp = useMemo(() => otpDigits.join(""), [otpDigits]);

  if (!open) return null;

  const resetAndClose = () => {
    verifyingRef.current = false;
    setStep("email");
    setEmail("");
    setConsentChecked(false);
    setChallengeToken("");
    setOtpDigits(Array.from({ length: CODE_LENGTH }, () => ""));
    setBusy(false);
    setError("");
    setHint("");
    onClose();
  };

  const requestCode = async () => {
    const normalizedEmail = String(email || "").trim();
    if (!consentChecked) {
      setError(LEGAL_WARNING);
      return;
    }
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 email.");
      return;
    }

    setBusy(true);
    setError("");
    setHint("");
    setOtpDigits(Array.from({ length: CODE_LENGTH }, () => ""));

    try {
      const result = await sendAuthCode(normalizedEmail);
      setStep("otp");
      setChallengeToken(result.challengeToken || "");

      if (result.delivery === "debug" && result.debugCode) {
        const rotatingHint =
          result.codeMode === "rotating"
            ? "\u041a\u043e\u0434 \u043e\u0431\u043d\u043e\u0432\u043b\u044f\u0435\u0442\u0441\u044f \u043a\u0430\u0436\u0434\u0443\u044e \u043c\u0438\u043d\u0443\u0442\u0443."
            : "";
        setHint(`\u0422\u0435\u0441\u0442\u043e\u0432\u044b\u0439 \u043a\u043e\u0434: ${result.debugCode}. ${rotatingHint}`.trim());
      } else {
        setHint("\u041a\u043e\u0434 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d \u043d\u0430 email.");
      }
    } catch (requestError: any) {
      setError(requestError?.message || "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u043a\u043e\u0434.");
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    await requestCode();
  };

  const submitOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || verifyingRef.current) return;
    if (otp.length !== CODE_LENGTH) {
      setError("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 6 \u0446\u0438\u0444\u0440.");
      return;
    }

    setBusy(true);
    setError("");
    verifyingRef.current = true;

    try {
      const result = await verifyAuthCode({
        email: String(email || "").trim(),
        code: otp,
        challengeToken,
      });

      if (typeof window !== "undefined" && result?.accessToken) {
        window.localStorage.setItem("smetacore_auth_token", result.accessToken);
        window.sessionStorage.setItem("smetacore_site_auth", "ok");
      }
      resetAndClose();
      navigate(siteConfig.systemPath);
    } catch (verifyError: any) {
      setError(verifyError?.message || "\u041a\u043e\u0434 \u043d\u0435 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d.");
      setOtpDigits(Array.from({ length: CODE_LENGTH }, () => ""));
    } finally {
      verifyingRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="\u0410\u0432\u0442\u043e\u0440\u0438\u0437\u0430\u0446\u0438\u044f">
      <div className="modal-card">
        <button className="modal-close" onClick={resetAndClose} aria-label="\u0417\u0430\u043a\u0440\u044b\u0442\u044c" type="button">
          x
        </button>
        <div className="modal-card__eyebrow">\u0412\u0445\u043e\u0434 \u0432 \u0441\u0438\u0441\u0442\u0435\u043c\u0443</div>
        <h3>{step === "email" ? "\u041f\u0440\u0438\u0441\u0442\u0443\u043f\u0438\u0442\u044c \u043a \u0440\u0430\u0441\u0447\u0435\u0442\u0443" : "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0434"}</h3>

        {step === "email" ? (
          <form onSubmit={submitEmail} className="auth-form">
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.ru"
                autoComplete="email"
                disabled={busy}
              />
            </label>
            <label className="checkbox-line">
              <input type="checkbox" checked={consentChecked} onChange={(event) => setConsentChecked(event.target.checked)} disabled={busy} />
              <span>
                \u042f \u043e\u0437\u043d\u0430\u043a\u043e\u043c\u043b\u0435\u043d(\u0430) \u0441{" "}
                <Link to="/legal/personal-data" target="_blank" rel="noreferrer">
                  \u041f\u043e\u043b\u0438\u0442\u0438\u043a\u043e\u0439 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0438 \u041f\u0414\u043d
                </Link>{" "}
                \u0438 \u0434\u0430\u044e \u0441\u043e\u0433\u043b\u0430\u0441\u0438\u0435 \u043d\u0430 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0443 \u0434\u0430\u043d\u043d\u044b\u0445 \u0434\u043b\u044f \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u0430\u0446\u0438\u0438.
              </span>
            </label>
            <div className="auth-form__hint">
              \u0422\u0435\u0441\u0442\u043e\u0432\u044b\u0439 \u043a\u043e\u0434 \u0432 \u0434\u0435\u0431\u0430\u0433-\u0440\u0435\u0436\u0438\u043c\u0435 \u0440\u043e\u0442\u0438\u0440\u0443\u0435\u0442\u0441\u044f \u0440\u0430\u0437 \u0432 60 \u0441\u0435\u043a\u0443\u043d\u0434.
            </div>
            {hint ? <div className="auth-form__hint">{hint}</div> : null}
            {error ? <div className="form-error">{error}</div> : null}
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {busy ? "\u041e\u0442\u043f\u0440\u0430\u0432\u043a\u0430..." : "\u041f\u043e\u043b\u0443\u0447\u0438\u0442\u044c \u043a\u043e\u0434"}
            </button>
          </form>
        ) : null}

        {step === "otp" ? (
          <form onSubmit={submitOtp} className="auth-form">
            <div className="auth-form__hint">{hint || "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0434 \u0438\u0437 6 \u0446\u0438\u0444\u0440."}</div>
            <div className="otp-grid">
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  disabled={busy}
                  onChange={(event) => {
                    const form = event.currentTarget.form;
                    const next = [...otpDigits];
                    next[index] = event.target.value.replace(/\D/g, "");
                    setOtpDigits(next);
                    if (next.join("").length === CODE_LENGTH) {
                      setTimeout(() => form?.requestSubmit(), 0);
                    }
                  }}
                  aria-label={`\u0426\u0438\u0444\u0440\u0430 ${index + 1}`}
                />
              ))}
            </div>
            {error ? <div className="form-error">{error}</div> : null}
            <div className="cookie-banner__actions">
              <button className="btn btn--ghost" type="button" onClick={requestCode} disabled={busy}>
                \u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u043a\u043e\u0434
              </button>
              <button className="btn btn--primary" type="submit" disabled={busy}>
                {busy ? "\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430..." : "\u0412\u043e\u0439\u0442\u0438"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
