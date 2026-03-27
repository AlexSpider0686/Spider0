import { Link } from "react-router-dom";
import { siteConfig } from "../data/siteContent";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div>
          <div className="footer__brand">{siteConfig.brand}</div>
          <p className="footer__copy">
            Платформа предварительной бюджетной оценки систем безопасности. Расчет не является проектно-сметной документацией и служит для пресейла и ранней
            финансовой модели.
          </p>
          <p className="footer__copy">© 2026 Александр Александрович Тартаковский. Все права защищены. Smeta.Core™</p>
        </div>
        <nav className="footer__nav" aria-label="Юридическая информация">
          <Link to="/legal/privacy">Политика конфиденциальности</Link>
          <Link to="/legal/personal-data">Политика обработки персональных данных</Link>
          <Link to="/legal/user-agreement">Пользовательское соглашение</Link>
          <Link to="/legal/cookies">Cookies</Link>
          <Link to="/legal/disclaimer">Отказ от ответственности</Link>
        </nav>
        <div>
          <div className="footer__meta">Оператор ПДн: {siteConfig.operatorName}</div>
          <div className="footer__meta">Email: {siteConfig.operatorEmail}</div>
          <div className="footer__meta">Версия политики: {siteConfig.policyVersion}</div>
        </div>
      </div>
    </footer>
  );
}
