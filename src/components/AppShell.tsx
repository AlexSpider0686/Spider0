import { Outlet } from 'react-router-dom';
import { CookieBanner } from './CookieBanner';
import { Footer } from './Footer';

export function AppShell() {
  return (
    <div className="app-shell">
      <Outlet />
      <Footer />
      <CookieBanner />
    </div>
  );
}
