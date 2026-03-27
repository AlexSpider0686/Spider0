import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { siteConfig } from "../data/siteContent";
import { sendAuthCode, verifyAuthCode } from "../lib/authApi";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
};

const CODE_LENGTH = 6;
const LEGAL_WARNING = "Для продолжения нужно подтвердить согласие с условиями использования сервиса и обработкой персональных данных.";

export function AuthModal({ open, onClose }: AuthModalProps) {
  const navigate = useNavigate();
  const verifyingRef = useRef(false);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

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

  const focusOtpIndex = (index: number) => {
    const bounded = Math.max(0, Math.min(index, CODE_LENGTH - 1));
    otpInputRefs.current[bounded]?.focus();
    otpInputRefs.current[bounded]?.select();
  };

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
      setError("Укажите корректный email.");
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
        const rotatingHint = result.codeMode === "rotating" ? "Код обновляется каждую минуту." : "";
        setHint(`Тестовый код: ${result.debugCode}. ${rotatingHint}`.trim());
      } else {
        setHint("Код отправлен на email.");
      }

      setTimeout(() => focusOtpIndex(0), 0);
    } catch (requestError: any) {
      setError(requestError?.message || "Не удалось отправить код.");
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
      setError("Введите 6 цифр.");
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
      setError(verifyError?.message || "Код не подтвержден.");
      setOtpDigits(Array.from({ length: CODE_LENGTH }, () => ""));
      setTimeout(() => focusOtpIndex(0), 0);
    } finally {
      verifyingRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Авторизация">
      <div className="modal-card">
        <button className="modal-close" onClick={resetAndClose} aria-label="Закрыть" type="button">
          ×
        </button>
        <div className="modal-card__eyebrow">Вход в систему</div>
        <h3>{step === "email" ? "Приступить к расчету" : "Введите код"}</h3>

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
                Я ознакомлен(а) с{" "}
                <Link to="/legal/user-agreement">
                  Пользовательским соглашением
                </Link>{" "}
                и даю согласие на обработку персональных данных в соответствии с{" "}
                <Link to="/legal/personal-data">
                  Политикой обработки ПДн
                </Link>
                .
              </span>
            </label>
            <div className="auth-form__hint">Тестовый код в дебаг-режиме ротируется раз в 60 секунд.</div>
            {hint ? <div className="auth-form__hint">{hint}</div> : null}
            {error ? <div className="form-error">{error}</div> : null}
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {busy ? "Отправка..." : "Получить код"}
            </button>
          </form>
        ) : null}

        {step === "otp" ? (
          <form onSubmit={submitOtp} className="auth-form">
            <div className="auth-form__hint">{hint || "Введите код из 6 цифр."}</div>
            <div className="otp-grid">
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(node) => {
                    otpInputRefs.current[index] = node;
                  }}
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  disabled={busy}
                  onFocus={(event) => event.currentTarget.select()}
                  onPaste={(event) => {
                    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
                    if (!pasted) return;
                    event.preventDefault();
                    const next = Array.from({ length: CODE_LENGTH }, (_, i) => pasted[i] || "");
                    setOtpDigits(next);
                    const lastIndex = Math.min(pasted.length, CODE_LENGTH) - 1;
                    if (lastIndex >= 0) focusOtpIndex(lastIndex);
                    if (next.join("").length === CODE_LENGTH) {
                      const form = event.currentTarget.form;
                      setTimeout(() => form?.requestSubmit(), 0);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
                      focusOtpIndex(index - 1);
                    }
                    if (event.key === "ArrowLeft" && index > 0) {
                      event.preventDefault();
                      focusOtpIndex(index - 1);
                    }
                    if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
                      event.preventDefault();
                      focusOtpIndex(index + 1);
                    }
                  }}
                  onChange={(event) => {
                    const form = event.currentTarget.form;
                    const next = [...otpDigits];
                    const value = event.target.value.replace(/\D/g, "").slice(-1);
                    next[index] = value;
                    setOtpDigits(next);

                    if (value && index < CODE_LENGTH - 1) {
                      focusOtpIndex(index + 1);
                    }

                    if (next.join("").length === CODE_LENGTH) {
                      setTimeout(() => form?.requestSubmit(), 0);
                    }
                  }}
                  aria-label={`Цифра ${index + 1}`}
                />
              ))}
            </div>
            {error ? <div className="form-error">{error}</div> : null}
            <div className="cookie-banner__actions">
              <button className="btn btn--ghost" type="button" onClick={requestCode} disabled={busy}>
                Обновить код
              </button>
              <button className="btn btn--primary" type="submit" disabled={busy}>
                {busy ? "Проверка..." : "Войти"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
