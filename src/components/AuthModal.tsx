import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { siteConfig } from "../data/siteContent";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
};

const LEGAL_WARNING =
  "\u0414\u043b\u044f \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0435\u043d\u0438\u044f \u043d\u0443\u0436\u043d\u043e \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c \u0441\u043e\u0433\u043b\u0430\u0441\u0438\u0435 \u043d\u0430 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0443 \u043f\u0435\u0440\u0441\u043e\u043d\u0430\u043b\u044c\u043d\u044b\u0445 \u0434\u0430\u043d\u043d\u044b\u0445.";

export function AuthModal({ open, onClose }: AuthModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [error, setError] = useState("");
  const [otpDigits, setOtpDigits] = useState(Array.from({ length: 6 }, () => ""));

  const otp = useMemo(() => otpDigits.join(""), [otpDigits]);

  if (!open) return null;

  const submitEmail = (event: React.FormEvent) => {
    event.preventDefault();
    if (!consentChecked) {
      setError(LEGAL_WARNING);
      return;
    }
    if (!email.includes("@")) {
      setError("\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 email.");
      return;
    }
    setError("");
    setStep("otp");
  };

  const submitOtp = (event: React.FormEvent) => {
    event.preventDefault();
    if (otp !== siteConfig.testOtp) {
      setError("\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u0442\u0435\u0441\u0442\u043e\u0432\u044b\u0439 \u043a\u043e\u0434. \u0414\u043b\u044f \u0434\u0435\u043c\u043e \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 123456.");
      return;
    }
    setError("");
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("smetacore_site_auth", "ok");
    }
    resetAndClose();
    navigate(siteConfig.systemPath);
  };

  const resetAndClose = () => {
    setStep("email");
    setEmail("");
    setConsentChecked(false);
    setError("");
    setOtpDigits(Array.from({ length: 6 }, () => ""));
    onClose();
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
              />
            </label>
            <label className="checkbox-line">
              <input type="checkbox" checked={consentChecked} onChange={(event) => setConsentChecked(event.target.checked)} />
              <span>
                \u042f \u043e\u0437\u043d\u0430\u043a\u043e\u043c\u043b\u0435\u043d(\u0430) \u0441{" "}
                <Link to="/legal/personal-data" target="_blank" rel="noreferrer">
                  \u041f\u043e\u043b\u0438\u0442\u0438\u043a\u043e\u0439 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0438 \u041f\u0414\u043d
                </Link>{" "}
                \u0438 \u0434\u0430\u044e \u0441\u043e\u0433\u043b\u0430\u0441\u0438\u0435 \u043d\u0430 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0443 \u0434\u0430\u043d\u043d\u044b\u0445 \u0434\u043b\u044f \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u0430\u0446\u0438\u0438.
              </span>
            </label>
            <div className="auth-form__hint">
              \u0412\u0440\u0435\u043c\u0435\u043d\u043d\u0430\u044f \u0441\u0445\u0435\u043c\u0430 \u0432\u0445\u043e\u0434\u0430: email \u2192 \u0442\u0435\u0441\u0442\u043e\u0432\u044b\u0439 \u043a\u043e\u0434.
            </div>
            {error ? <div className="form-error">{error}</div> : null}
            <button className="btn btn--primary" type="submit">
              \u041f\u043e\u043b\u0443\u0447\u0438\u0442\u044c \u043a\u043e\u0434
            </button>
          </form>
        ) : null}

        {step === "otp" ? (
          <form onSubmit={submitOtp} className="auth-form">
            <div className="auth-form__hint">
              \u0422\u0435\u0441\u0442\u043e\u0432\u044b\u0439 \u043a\u043e\u0434: <strong>{siteConfig.testOtp}</strong>
            </div>
            <div className="otp-grid">
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(event) => {
                    const form = event.currentTarget.form;
                    const next = [...otpDigits];
                    next[index] = event.target.value.replace(/\D/g, "");
                    setOtpDigits(next);
                    if (next.join("").length === 6) {
                      setTimeout(() => {
                        form?.requestSubmit();
                      }, 0);
                    }
                  }}
                  aria-label={`\u0426\u0438\u0444\u0440\u0430 ${index + 1}`}
                />
              ))}
            </div>
            {error ? <div className="form-error">{error}</div> : null}
            <button className="btn btn--primary" type="submit">
              \u0412\u043e\u0439\u0442\u0438
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
