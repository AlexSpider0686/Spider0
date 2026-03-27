import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import EstimatorApp from "./components/EstimatorApp";
import { AboutSystemPage } from "./pages/AboutSystemPage";
import { HomePage } from "./pages/HomePage";
import { CookiesPage } from "./pages/legal/CookiesPage";
import { DisclaimerPage } from "./pages/legal/DisclaimerPage";
import { PersonalDataPage } from "./pages/legal/PersonalDataPage";
import { PrivacyPage } from "./pages/legal/PrivacyPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/about-system" element={<AboutSystemPage />} />
        <Route path="/legal/privacy" element={<PrivacyPage />} />
        <Route path="/legal/personal-data" element={<PersonalDataPage />} />
        <Route path="/legal/cookies" element={<CookiesPage />} />
        <Route path="/legal/disclaimer" element={<DisclaimerPage />} />
      </Route>
      <Route path="/system" element={<EstimatorApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
