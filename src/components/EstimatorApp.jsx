import React, { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Layers, Wallet, Download, PieChart, FileText, Ruler, ShieldAlert, CalendarRange, Scale, Upload } from "lucide-react";
import useEstimate from "../hooks/useEstimate";
import projectCoreMarkUrl from "../assets/project-core-mark.svg";
import ObjectStep from "./ObjectStep";
import SystemsStep from "./SystemsStep";
import ProjectDesignStep from "./ProjectDesignStep";
import NormativeRequirementsStep from "./NormativeRequirementsStep";
import BudgetStep from "./BudgetStep";
import CostBreakdownStep from "./CostBreakdownStep";
import ProjectRisksStep from "./ProjectRisksStep";
import CalculationLogicStep from "./CalculationLogicStep";
import Summary from "./Summary";
import AuthGate from "./AuthGate";
import ProjectPlanModal from "./ProjectPlanModal";
import { APP_VERSION_LABEL, BUILD_NUMBER } from "../config/estimateConfig";
import { isStoredAuthTokenValid } from "../lib/authApi";

const ASSET_BASE = import.meta.env.BASE_URL || "/";

const UI = {
  object: "\u041e\u0431\u044a\u0435\u043a\u0442",
  systems: "\u0421\u0438\u0441\u0442\u0435\u043c\u044b",
  design: "\u041f\u0440\u043e\u0435\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435",
  norms: "\u041d\u043e\u0440\u043c\u0430\u0442\u0438\u0432\u043d\u044b\u0435 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u044f",
  budget: "\u0411\u044e\u0434\u0436\u0435\u0442",
  breakdown: "\u0420\u0430\u0441\u0447\u0435\u0442 \u0440\u0435\u0441\u0443\u0440\u0441\u0430",
  logic: "\u041b\u043e\u0433\u0438\u043a\u0430 \u0440\u0430\u0441\u0447\u0435\u0442\u043e\u0432",
  risks: "AI-\u0440\u0438\u0441\u043a\u0438 \u043f\u0440\u043e\u0435\u043a\u0442\u0430",
  version: "\u0412\u0435\u0440\u0441\u0438\u044f",
  build: "\u0441\u0431\u043e\u0440\u043a\u0430",
  heroKicker: "Project.Core\u2122",
  heroTitle: "Project.Core\u2122 \u2014 \u043f\u0440\u0435\u0434\u0432\u0430\u0440\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0439 \u0440\u0430\u0441\u0447\u0435\u0442 \u0431\u044e\u0434\u0436\u0435\u0442\u0430 \u0441\u0438\u0441\u0442\u0435\u043c \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u0438",
  heroText:
    "\u0421 AI-\u0430\u0443\u0434\u0438\u0442\u043e\u043c \u0446\u0435\u043d \u0438 \u0442\u0440\u0443\u0434\u043e\u0437\u0430\u0442\u0440\u0430\u0442, \u0440\u044b\u043d\u043e\u0447\u043d\u043e\u0439 \u0432\u0435\u0440\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u0435\u0439 \u0438 Risk Guard AI \u0434\u043b\u044f \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044f \u0441\u0431\u0430\u043b\u0430\u043d\u0441\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u043e\u0441\u0442\u0438 \u0431\u044e\u0434\u0436\u0435\u0442\u0430.",
  exportTkp: "\u042d\u043a\u0441\u043f\u043e\u0440\u0442 \u0422\u041a\u041f",
  generatePlan: "\u0421\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043f\u043b\u0430\u043d \u043f\u0440\u043e\u0435\u043a\u0442\u0430",
  downloadPassport: "\u0421\u043a\u0430\u0447\u0430\u0442\u044c \u043f\u0430\u0441\u043f\u043e\u0440\u0442 \u043f\u0440\u043e\u0435\u043a\u0442\u0430",
  choosePassport: "\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u043f\u0430\u0441\u043f\u043e\u0440\u0442 \u043f\u0440\u043e\u0435\u043a\u0442\u0430",
  uploadPassport: "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043f\u0430\u0441\u043f\u043e\u0440\u0442 \u043f\u0440\u043e\u0435\u043a\u0442\u0430",
  invalidPassport:
    "\u0412\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0439 \u0444\u0430\u0439\u043b \u043d\u0435 \u043f\u043e\u0445\u043e\u0436 \u043d\u0430 \u043f\u0430\u0441\u043f\u043e\u0440\u0442 \u043f\u0440\u043e\u0435\u043a\u0442\u0430. \u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0444\u0430\u0439\u043b \u0432 \u0444\u043e\u0440\u043c\u0430\u0442\u0435 XLS, HTML \u0438\u043b\u0438 MHT.",
};

function assetUrl(path) {
  const normalizedBase = ASSET_BASE.endsWith("/") ? ASSET_BASE : `${ASSET_BASE}/`;
  return `${normalizedBase}${String(path).replace(/^\/+/, "")}`;
}

const BACKGROUND_VIDEO_URLS = [assetUrl("assets/background/city-loop.mp4"), assetUrl("assets/background/manhattan-loop-2min.mp4")];

export default function EstimatorApp() {
  const vm = useEstimate();
  const [videoIndex, setVideoIndex] = useState(0);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [pendingPassportFile, setPendingPassportFile] = useState(null);
  const [passportImportBusy, setPassportImportBusy] = useState(false);
  const [passportHint, setPassportHint] = useState("");
  const passportFileInputRef = useRef(null);
  const [authorized, setAuthorized] = useState(() => {
    if (typeof window === "undefined") return false;
    const storedToken = window.localStorage.getItem("smetacore_auth_token");
    const siteAuth = window.sessionStorage.getItem("smetacore_site_auth") === "ok";
    return isStoredAuthTokenValid(storedToken) || siteAuth;
  });

  const steps = [
    { key: "object", label: UI.object, icon: Building2 },
    { key: "systems", label: UI.systems, icon: Layers },
    { key: "design", label: UI.design, icon: Ruler },
    { key: "norms", label: UI.norms, icon: Scale },
    { key: "budget", label: UI.budget, icon: Wallet },
    { key: "breakdown", label: UI.breakdown, icon: PieChart },
    { key: "logic", label: UI.logic, icon: FileText },
    { key: "risks", label: UI.risks, icon: ShieldAlert },
  ];
  const stepRows = [steps.slice(0, 4), steps.slice(4)];

  const currentVideoUrl = useMemo(() => BACKGROUND_VIDEO_URLS[Math.min(videoIndex, BACKGROUND_VIDEO_URLS.length - 1)], [videoIndex]);
  const hideSummary = vm.step >= 5;

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

  const handlePlanExport = async (format) => {
    setPlanModalOpen(false);
    await vm.generateProjectPlan(format);
  };

  const handlePassportDownload = async () => {
    await vm.exportProjectPassport?.();
  };

  const handlePassportFilePicked = (event) => {
    const [file] = Array.from(event.target.files || []);
    event.target.value = "";

    if (!file) return;

    if (!/\.(xls|html?|mht)$/i.test(file.name)) {
      setPendingPassportFile(null);
      setPassportHint(UI.invalidPassport);
      return;
    }

    setPendingPassportFile(file);
    setPassportHint(
      `${"\u0412\u044b\u0431\u0440\u0430\u043d \u0444\u0430\u0439\u043b"}: ${file.name}. ${"\u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u00ab\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043f\u0430\u0441\u043f\u043e\u0440\u0442 \u043f\u0440\u043e\u0435\u043a\u0442\u0430\u00bb, \u0447\u0442\u043e\u0431\u044b \u043f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435 \u0432 \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u0435."}`
    );
  };

  const handlePassportUpload = async () => {
    if (!pendingPassportFile) {
      passportFileInputRef.current?.click();
      return;
    }

    setPassportImportBusy(true);
    const ok = await vm.importProjectPassport?.(pendingPassportFile);
    setPassportImportBusy(false);
    if (ok) {
      setPassportHint(
        `${"\u041f\u0430\u0441\u043f\u043e\u0440\u0442 \u043f\u0440\u043e\u0435\u043a\u0442\u0430 \u00ab"}${pendingPassportFile.name}${"\u00bb \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d \u0432 \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u0443."}`
      );
      setPendingPassportFile(null);
    }
  };

  return (
    <div className="page-shell">
      <img className="page-shell__watermark" src={projectCoreMarkUrl} alt="" aria-hidden="true" />
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

      <div className="build-badge">
        <img src={projectCoreMarkUrl} alt="Project.Core" className="build-badge__logo" />
        <div className="build-badge__text">
          <strong>Project.Core</strong>
          <span>
            {UI.version} {APP_VERSION_LABEL} · {UI.build} {BUILD_NUMBER}
          </span>
        </div>
      </div>

      <div className={`app-wrap ${authorized ? "" : "locked"}`} aria-hidden={!authorized}>
        <header className="hero-card">
          <div>
            <div className="hero-kicker">{UI.heroKicker}</div>
            <h1 className="hero-title">
              <img className="hero-title__mark" src={projectCoreMarkUrl} alt="" aria-hidden="true" />
              <span>{UI.heroTitle}</span>
            </h1>
            <p>{UI.heroText}</p>
          </div>
          <div className="hero-actions">
            <button className="primary-btn" onClick={vm.exportEstimate} type="button">
              <Download size={16} /> {UI.exportTkp}
            </button>
            <button className="ghost-btn" onClick={() => setPlanModalOpen(true)} type="button">
              <CalendarRange size={16} /> {UI.generatePlan}
            </button>
            <button className="ghost-btn" onClick={handlePassportDownload} type="button">
              <Download size={16} /> {UI.downloadPassport}
            </button>
            <button className="ghost-btn" onClick={handlePassportUpload} type="button" disabled={passportImportBusy}>
              <Upload size={16} /> {pendingPassportFile ? UI.uploadPassport : UI.choosePassport}
            </button>
            <input
              ref={passportFileInputRef}
              className="file-upload-input"
              type="file"
              accept=".xls,.html,.htm,.mht"
              onChange={handlePassportFilePicked}
            />
            {passportHint ? <div className="hero-actions__hint">{passportHint}</div> : null}
          </div>
        </header>

        <section className="stepper-card">
          <div className="stepper">
            {stepRows.map((row, rowIndex) => (
              <div className="stepper-row" key={`step-row-${rowIndex}`} style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
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
        {vm.step === 3 ? <NormativeRequirementsStep {...vm} /> : null}
        {vm.step === 4 ? <BudgetStep {...vm} /> : null}
        {vm.step === 5 ? (
          <CostBreakdownStep
            systems={vm.systems}
            updateSystem={vm.updateSystem}
            systemResults={vm.systemResults}
            totals={vm.totals}
            objectData={vm.objectData}
            effectiveObjectData={vm.effectiveObjectData}
            travelEstimate={vm.travelEstimate}
            updateTravelField={vm.updateTravelField}
            setTravelEstimateEnabled={vm.setTravelEstimateEnabled}
            runTravelEstimate={vm.runTravelEstimate}
            resetTravelEstimate={vm.resetTravelEstimate}
          />
        ) : null}
        {vm.step === 6 ? <CalculationLogicStep {...vm} /> : null}
        {vm.step === 7 ? <ProjectRisksStep projectRisks={vm.projectRisks} /> : null}

        {!hideSummary ? <Summary totals={vm.totals} systemResults={vm.systemResults} objectData={vm.objectData} /> : null}
      </div>

      {!authorized ? <AuthGate onAuthorized={handleAuthorized} /> : null}
      <ProjectPlanModal open={authorized && planModalOpen} onClose={() => setPlanModalOpen(false)} onSelectFormat={handlePlanExport} />
    </div>
  );
}
