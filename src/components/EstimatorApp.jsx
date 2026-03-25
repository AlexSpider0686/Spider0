import React, { useEffect, useMemo, useState } from "react";
import { Building2, Layers, Wallet, Download, PieChart, FileText, Ruler } from "lucide-react";
import useEstimate from "../hooks/useEstimate";
import ObjectStep from "./ObjectStep";
import SystemsStep from "./SystemsStep";
import ProjectDesignStep from "./ProjectDesignStep";
import BudgetStep from "./BudgetStep";
import CostBreakdownStep from "./CostBreakdownStep";
import CalculationLogicStep from "./CalculationLogicStep";
import Summary from "./Summary";
import AuthGate from "./AuthGate";
import { BUILD_NUMBER } from "../config/estimateConfig";
import { isStoredAuthTokenValid } from "../lib/authApi";

const BACKGROUND_VIDEO_URLS = [
  "/assets/background/city-loop.mp4",
  "https://videos.pexels.com/video-files/3129957/3129957-hd_1920_1080_25fps.mp4",
  "https://storage.coverr.co/videos/O3x8lq1w7f2wV6xTt1lPmIfQ00j00iW4w5?download=1",
];

export default function EstimatorApp() {
  const vm = useEstimate();
  const [videoIndex, setVideoIndex] = useState(0);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [authorized, setAuthorized] = useState(() => {
    if (typeof window === "undefined") return false;
    const storedToken = window.localStorage.getItem("smetacore_auth_token");
    const siteAuth = window.sessionStorage.getItem("smetacore_site_auth") === "ok";
    return isStoredAuthTokenValid(storedToken) || siteAuth;
  });

  const steps = [
    { key: "object", label: "Объект", icon: Building2 },
    { key: "systems", label: "Системы", icon: Layers },
    { key: "design", label: "Проектирование", icon: Ruler },
    { key: "budget", label: "Бюджет", icon: Wallet },
    { key: "breakdown", label: "Стоимость проекта", icon: PieChart },
    { key: "logic", label: "Логика расчета", icon: FileText },
  ];

  const currentVideoUrl = useMemo(() => BACKGROUND_VIDEO_URLS[Math.min(videoIndex, BACKGROUND_VIDEO_URLS.length - 1)], [videoIndex]);
  const hideSummary = vm.step === 5;

  useEffect(() => {
    setVideoReady(false);
  }, [currentVideoUrl]);

  const handleAuthorized = (accessToken) => {
    if (typeof window !== "undefined" && accessToken) {
      window.localStorage.setItem("smetacore_auth_token", accessToken);
      window.sessionStorage.setItem("smetacore_site_auth", "ok");
    }
    setAuthorized(true);
  };

  return (
    <div className="page-shell">
      <div className="bg-video-layer" aria-hidden>
        <div className="bg-video-fallback" />
        {!videoUnavailable ? (
          <video
            key={currentVideoUrl}
            className={videoReady ? "is-ready" : ""}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            onLoadedData={() => setVideoReady(true)}
            onCanPlay={() => setVideoReady(true)}
            onError={() => {
              setVideoReady(false);
              if (videoIndex < BACKGROUND_VIDEO_URLS.length - 1) {
                setVideoIndex((prev) => prev + 1);
              } else {
                setVideoUnavailable(true);
              }
            }}
          >
            <source src={currentVideoUrl} type="video/mp4" />
          </video>
        ) : null}
      </div>

      <div className="build-badge">Сборка: {BUILD_NUMBER}</div>

      <div className={`app-wrap ${authorized ? "" : "locked"}`} aria-hidden={!authorized}>
        <header className="hero-card">
          <div>
            <div className="hero-kicker">SmetaCore</div>
            <h1>SmetaCore — предварительный расчет бюджета систем безопасности</h1>
            <p>С автоматическим формированием сметы и коммерческого предложения</p>
          </div>
          <button className="primary-btn" onClick={vm.exportEstimate} type="button">
            <Download size={16} /> Экспорт ТКП
          </button>
        </header>

        <section className="stepper-card">
          <div className="stepper">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const active = index === vm.step;
              const done = index < vm.step;
              return (
                <button
                  key={item.key}
                  className={`step-chip ${active ? "active" : ""} ${done ? "done" : ""}`}
                  onClick={() => vm.setStep(index)}
                  type="button"
                  disabled={!authorized}
                >
                  <span className="step-icon">
                    <Icon size={14} />
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {vm.step === 0 ? <ObjectStep {...vm} /> : null}
        {vm.step === 1 ? <SystemsStep {...vm} /> : null}
        {vm.step === 2 ? <ProjectDesignStep {...vm} /> : null}
        {vm.step === 3 ? <BudgetStep {...vm} /> : null}
        {vm.step === 4 ? <CostBreakdownStep systemResults={vm.systemResults} totals={vm.totals} /> : null}
        {vm.step === 5 ? <CalculationLogicStep {...vm} /> : null}

        {!hideSummary ? <Summary totals={vm.totals} systemResults={vm.systemResults} objectData={vm.objectData} /> : null}
      </div>

      {!authorized ? <AuthGate onAuthorized={handleAuthorized} /> : null}
    </div>
  );
}
