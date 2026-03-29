import React, { useEffect, useMemo, useState } from "react";
import { Building2, Layers, Wallet, Download, PieChart, FileText, Ruler, ShieldAlert } from "lucide-react";
import useEstimate from "../hooks/useEstimate";
import ObjectStep from "./ObjectStep";
import SystemsStep from "./SystemsStep";
import ProjectDesignStep from "./ProjectDesignStep";
import BudgetStep from "./BudgetStep";
import CostBreakdownStep from "./CostBreakdownStep";
import ProjectRisksStep from "./ProjectRisksStep";
import CalculationLogicStep from "./CalculationLogicStep";
import Summary from "./Summary";
import AuthGate from "./AuthGate";
import { APP_VERSION_LABEL, BUILD_NUMBER } from "../config/estimateConfig";
import { isStoredAuthTokenValid } from "../lib/authApi";

const ASSET_BASE = import.meta.env.BASE_URL || "/";

function assetUrl(path) {
  const normalizedBase = ASSET_BASE.endsWith("/") ? ASSET_BASE : `${ASSET_BASE}/`;
  return `${normalizedBase}${String(path).replace(/^\/+/, "")}`;
}

const BACKGROUND_VIDEO_URLS = [
  assetUrl("assets/background/city-loop.mp4"),
  assetUrl("assets/background/manhattan-loop-2min.mp4"),
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
    { key: "logic", label: "Логика расчетов", icon: FileText },
    { key: "risks", label: "AI-риски проекта", icon: ShieldAlert },
  ];
  const stepRows = [steps.slice(0, 4), steps.slice(4)];

  const currentVideoUrl = useMemo(() => BACKGROUND_VIDEO_URLS[Math.min(videoIndex, BACKGROUND_VIDEO_URLS.length - 1)], [videoIndex]);
  const hideSummary = vm.step >= 4;

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

      <div className="build-badge">Версия {APP_VERSION_LABEL} · сборка {BUILD_NUMBER}</div>

      <div className={`app-wrap ${authorized ? "" : "locked"}`} aria-hidden={!authorized}>
        <header className="hero-card">
          <div>
            <div className="hero-kicker">Project.Core™</div>
            <h1>Project.Core™ — предварительный расчет бюджета систем безопасности</h1>
            <p>С AI-аудитом цен и трудозатрат, рыночной верификацией и защитой от недооценки бюджета.</p>
          </div>
          <button className="primary-btn" onClick={vm.exportEstimate} type="button">
            <Download size={16} /> Экспорт ТКП
          </button>
        </header>

        <section className="stepper-card">
          <div className="stepper">
            {stepRows.map((row, rowIndex) => (
              <div
                className="stepper-row"
                key={`step-row-${rowIndex}`}
                style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
              >
                {row.map((item) => {
                  const index = steps.findIndex((step) => step.key === item.key);
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
                        <Icon size={16} />
                      </span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        {vm.step === 0 ? <ObjectStep {...vm} /> : null}
        {vm.step === 1 ? <SystemsStep {...vm} /> : null}
        {vm.step === 2 ? <ProjectDesignStep {...vm} /> : null}
        {vm.step === 3 ? <BudgetStep {...vm} /> : null}
        {vm.step === 4 ? <CostBreakdownStep systemResults={vm.systemResults} totals={vm.totals} /> : null}
        {vm.step === 5 ? <CalculationLogicStep {...vm} /> : null}
        {vm.step === 6 ? <ProjectRisksStep projectRisks={vm.projectRisks} /> : null}

        {!hideSummary ? <Summary totals={vm.totals} systemResults={vm.systemResults} objectData={vm.objectData} /> : null}
      </div>

      {!authorized ? <AuthGate onAuthorized={handleAuthorized} /> : null}
    </div>
  );
}
