import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCookieConsent } from '../hooks/useCookieConsent';

export function CookieBanner() {
  const { consent, acceptAll, save } = useCookieConsent();
  const [openSettings, setOpenSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  if (consent) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-live="polite" aria-label="Настройки cookies">
      <div className="cookie-banner__card">
        <div>
          <h3>Мы используем cookies и похожие технологии</h3>
          <p>
            Обязательные cookies нужны для работы сайта. Аналитические и маркетинговые cookies
            включаются только по вашему выбору. Подробности — в{' '}
            <Link to="/legal/cookies">политике cookies</Link> и{' '}
            <Link to="/legal/personal-data">политике обработки персональных данных</Link>.
          </p>
        </div>
        <div className="cookie-banner__actions">
          <button className="btn btn--ghost" onClick={() => setOpenSettings((v) => !v)}>
            Настроить
          </button>
          <button className="btn btn--primary" onClick={acceptAll}>
            Принять все
          </button>
        </div>
        {openSettings ? (
          <div className="cookie-banner__settings">
            <label>
              <input type="checkbox" checked disabled />
              Обязательные cookies
            </label>
            <label>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
              />
              Аналитические cookies
            </label>
            <label>
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
              />
              Маркетинговые cookies
            </label>
            <button
              className="btn btn--secondary"
              onClick={() =>
                save({ necessary: true, analytics, marketing })
              }
            >
              Сохранить настройки
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
