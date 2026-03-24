import React, { useEffect, useMemo, useRef, useState } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import { sendAuthCode, verifyAuthCode } from "../lib/authApi";

const CODE_LENGTH = 6;

function toDigits(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

export default function AuthGate({ onAuthorized }) {
  const [stage, setStage] = useState("email");
  const [email, setEmail] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [expiresAtMs, setExpiresAtMs] = useState(0);
  const [code, setCode] = useState(Array(CODE_LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [timerTick, setTimerTick] = useState(0);
  const inputRefs = useRef([]);
  const verifyingRef = useRef(false);

  const codeValue = useMemo(() => code.join(""), [code]);

  useEffect(() => {
    if (!expiresAtMs) return;
    const timer = setInterval(() => setTimerTick((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [expiresAtMs]);

  useEffect(() => {
    if (stage !== "code") return;
    if (codeValue.length !== CODE_LENGTH) return;
    if (verifyingRef.current) return;

    let cancelled = false;
    verifyingRef.current = true;
    setBusy(true);
    setError("");

    (async () => {
      try {
        const result = await verifyAuthCode({
          email,
          code: codeValue,
          challengeToken,
        });
        if (cancelled) return;
        onAuthorized?.(result.accessToken);
      } catch (verifyError) {
        if (cancelled) return;
        setError(verifyError?.message || "Код не подтвержден");
        setCode(Array(CODE_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
      } finally {
        verifyingRef.current = false;
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [challengeToken, codeValue, email, onAuthorized, stage]);

  const remainingSeconds = useMemo(() => {
    if (!expiresAtMs) return 0;
    return Math.max(Math.ceil((expiresAtMs - Date.now()) / 1000), 0);
  }, [expiresAtMs, timerTick]);

  const requestCode = async () => {
    const normalizedEmail = String(email || "").trim();
    if (!normalizedEmail) {
      setError("Введите email");
      return;
    }

    verifyingRef.current = false;
    setBusy(true);
    setError("");
    setHint("");
    setCode(Array(CODE_LENGTH).fill(""));

    try {
      const result = await sendAuthCode(normalizedEmail);
      setStage("code");
      setChallengeToken(result.challengeToken || "");
      setExpiresAtMs(Date.now() + Number(result.expiresInSeconds || 600) * 1000);

      if (result.delivery === "debug" && result.debugCode) {
        setHint(`Тестовый код: ${result.debugCode}`);
      } else {
        setHint("Код отправлен на почту");
      }

      setTimeout(() => inputRefs.current[0]?.focus(), 60);
    } catch (sendError) {
      setError(sendError?.message || "Не удалось отправить код");
    } finally {
      setBusy(false);
    }
  };

  const handleCodeChange = (index, rawValue) => {
    if (busy) return;
    const value = toDigits(rawValue).slice(-1);
    setCode((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });

    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index, event) => {
    if (busy) return;
    if (event.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePasteCode = (event) => {
    if (busy) return;
    event.preventDefault();
    const pasted = toDigits(event.clipboardData.getData("text")).slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = Array(CODE_LENGTH)
      .fill("")
      .map((_, index) => pasted[index] || "");
    setCode(next);
    const nextFocus = Math.min(pasted.length, CODE_LENGTH - 1);
    inputRefs.current[nextFocus]?.focus();
  };

  const resetToEmail = () => {
    setStage("email");
    verifyingRef.current = false;
    setChallengeToken("");
    setCode(Array(CODE_LENGTH).fill(""));
    setError("");
  };

  return (
    <div className="auth-overlay">
      <section className="auth-card">
        <div className="auth-kicker">SmetaCore</div>
        <h2>Вход по почте</h2>
        <p>Для запуска системы введите email и подтвердите шестизначный код.</p>

        {stage === "email" ? (
          <div className="auth-email-row">
            <div className="auth-email-field">
              <Mail size={16} />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (!busy) requestCode();
                  }
                }}
              />
            </div>
            <button type="button" className="primary-btn" onClick={requestCode} disabled={busy}>
              Получить код
            </button>
          </div>
        ) : (
          <div className="auth-code-block">
            <div className="auth-code-header">
              <span>Код отправлен на {email}</span>
              <button type="button" className="ghost-btn" onClick={resetToEmail} disabled={busy}>
                Изменить почту
              </button>
            </div>
            <div className="auth-code-grid" onPaste={handlePasteCode}>
              {code.map((digit, index) => (
                <input
                  key={`otp-${index}`}
                  ref={(node) => {
                    inputRefs.current[index] = node;
                  }}
                  value={digit}
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  className="auth-code-cell"
                  disabled={busy}
                  onChange={(event) => handleCodeChange(index, event.target.value)}
                  onKeyDown={(event) => handleCodeKeyDown(index, event)}
                />
              ))}
            </div>
            <small className="hint-inline">{busy ? "Проверка кода..." : `Код действует: ${Math.max(remainingSeconds, 0)} сек.`}</small>
          </div>
        )}

        {hint ? (
          <p className="hint-inline auth-hint">
            <ShieldCheck size={14} /> {hint}
          </p>
        ) : null}
        {error ? <p className="warn-inline auth-error">{error}</p> : null}
      </section>
    </div>
  );
}
