import { Outlet } from "react-router-dom";
import { CookieBanner } from "./CookieBanner";
import { Footer } from "./Footer";
import { APP_VERSION, SITE_BUILD_NUMBER } from "../config/buildInfo";

export function AppShell() {
  return (
    <div className="app-shell">
      <div className="site-build-badge">Версия сайта {APP_VERSION} · сборка {SITE_BUILD_NUMBER}</div>
      <Outlet />
      <Footer />
      <CookieBanner />
    </div>
  );
}
