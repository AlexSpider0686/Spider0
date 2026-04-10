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
import { repairUtf8Cp1251Mojibake } from "../lib/textEncoding";

const ASSET_BASE = import.meta.env.BASE_URL || "/";

function assetUrl(path) {
  const normalizedBase = ASSET_BASE.endsWith("/") ? ASSET_BASE : `${ASSET_BASE}/`;
  return `${normalizedBase}${String(path).replace(/^\/+/, "")}`;
}

const BACKGROUND_VIDEO_URLS = [assetUrl("assets/background/city-loop.mp4"), assetUrl("assets/background/manhattan-loop-2min.mp4")];

export default function EstimatorApp() {
  const t = repairUtf8Cp1251Mojibake;
  const vm = useEstimate();
  const [videoIndex, setVideoIndex] = useState(0);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [pendingPassportFile, setPendingPassportFile] = useState(null);
  const [passportImportBusy, setPassportImportBusy] = useState(false);
  const [passportHint, setPassportHint] = useState("");
  const passportFolderInputRef = useRef(null);
  const [authorized, setAuthorized] = useState(() => {
    if (typeof window === "undefined") return false;
    const storedToken = window.localStorage.getItem("smetacore_auth_token");
    const siteAuth = window.sessionStorage.getItem("smetacore_site_auth") === "ok";
    return isStoredAuthTokenValid(storedToken) || siteAuth;
  });

  const steps = [
    { key: "object", label: t("Р С›Р В±РЎР‰Р ВµР С”РЎвЂљ"), icon: Building2 },
    { key: "systems", label: t("Р РЋР С‘РЎРѓРЎвЂљР ВµР СРЎвЂ№"), icon: Layers },
    { key: "design", label: t("Р СџРЎР‚Р С•Р ВµР С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ"), icon: Ruler },
    { key: "norms", label: "РќРѕСЂРјР°С‚РёРІРЅС‹Рµ С‚СЂРµР±РѕРІР°РЅРёСЏ", icon: Scale },
    { key: "budget", label: t("Р вЂРЎР‹Р Т‘Р В¶Р ВµРЎвЂљ"), icon: Wallet },
    { key: "breakdown", label: "Р Р°СЃС‡РµС‚ СЂРµСЃСѓСЂСЃР°", icon: PieChart },
    { key: "logic", label: t("Р вЂєР С•Р С–Р С‘Р С”Р В° РЎР‚Р В°РЎРѓРЎвЂЎР ВµРЎвЂљР С•Р Р†"), icon: FileText },
    { key: "risks", label: t("AI-РЎР‚Р С‘РЎРѓР С”Р С‘ Р С—РЎР‚Р С•Р ВµР С”РЎвЂљР В°"), icon: ShieldAlert },
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

  const handlePassportFolderPicked = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    const preferred =
      files.find((file) => /passport.*\.(xls|html?|mht)$/i.test(file.name)) ||
      files.find((file) => /РїР°СЃРїРѕСЂС‚.*\.(xls|html?|mht)$/i.test(file.name)) ||
      files.find((file) => /\.(xls|html?|mht)$/i.test(file.name)) ||
      null;

    if (!preferred) {
      setPendingPassportFile(null);
      setPassportHint("Р’ РІС‹Р±СЂР°РЅРЅРѕР№ РїР°РїРєРµ РЅРµ РЅР°Р№РґРµРЅ С„Р°Р№Р» РїР°СЃРїРѕСЂС‚Р° РїСЂРѕРµРєС‚Р°.");
      return;
    }

    setPendingPassportFile(preferred);
    setPassportHint(`РќР°Р№РґРµРЅ С„Р°Р№Р»: ${preferred.name}. РќР°Р¶РјРёС‚Рµ В«Р—Р°РіСЂСѓР·РёС‚СЊ РїР°СЃРїРѕСЂС‚ РїСЂРѕРµРєС‚Р°В», С‡С‚РѕР±С‹ РїСЂРёРјРµРЅРёС‚СЊ РґР°РЅРЅС‹Рµ.`);
  };

  const handlePassportUpload = async () => {
    if (!pendingPassportFile) {
      passportFolderInputRef.current?.click();
      return;
    }

    setPassportImportBusy(true);
    const ok = await vm.importProjectPassport?.(pendingPassportFile);
    setPassportImportBusy(false);
    if (ok) {
      setPassportHint(`РџР°СЃРїРѕСЂС‚ РїСЂРѕРµРєС‚Р° В«${pendingPassportFile.name}В» Р·Р°РіСЂСѓР¶РµРЅ РІ РїР»Р°С‚С„РѕСЂРјСѓ.`);
      setPendingPassportFile(null);
    }
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

      <div className="build-badge">
        <img src={projectCoreMarkUrl} alt="Project.Core" className="build-badge__logo" />
        <div className="build-badge__text">
          <strong>Project.Core</strong>
          <span>Р’РµСЂСЃРёСЏ {APP_VERSION_LABEL} В· СЃР±РѕСЂРєР° {BUILD_NUMBER}</span>
        </div>
      </div>

      <div className={`app-wrap ${authorized ? "" : "locked"}`} aria-hidden={!authorized}>
        <header className="hero-card">
          <div>
            <div className="hero-kicker">Project.Coreв„ў</div>
            <h1 className="hero-title">
              <img className="hero-title__mark" src={projectCoreMarkUrl} alt="" aria-hidden="true" />
              <span>Project.Coreв„ў вЂ” РїСЂРµРґРІР°СЂРёС‚РµР»СЊРЅС‹Р№ СЂР°СЃС‡РµС‚ Р±СЋРґР¶РµС‚Р° СЃРёСЃС‚РµРј Р±РµР·РѕРїР°СЃРЅРѕСЃС‚Рё</span>
            </h1>
            <p>РЎ AI-Р°СѓРґРёС‚РѕРј С†РµРЅ Рё С‚СЂСѓРґРѕР·Р°С‚СЂР°С‚, СЂС‹РЅРѕС‡РЅРѕР№ РІРµСЂРёС„РёРєР°С†РёРµР№ Рё Risk Guard AI РґР»СЏ РєРѕРЅС‚СЂРѕР»СЏ СЃР±Р°Р»Р°РЅСЃРёСЂРѕРІР°РЅРЅРѕСЃС‚Рё Р±СЋРґР¶РµС‚Р°.</p>
          </div>
          <div className="hero-actions">
            <button className="primary-btn" onClick={vm.exportEstimate} type="button">
              <Download size={16} /> Р­РєСЃРїРѕСЂС‚ РўРљРџ
            </button>
            <button className="ghost-btn" onClick={() => setPlanModalOpen(true)} type="button">
              <CalendarRange size={16} /> РЎРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ РїР»Р°РЅ РїСЂРѕРµРєС‚Р°
            </button>
            <button className="ghost-btn" onClick={handlePassportDownload} type="button">
              <Download size={16} /> Скачать паспорт проекта
            </button>
            <button className="ghost-btn" onClick={handlePassportUpload} type="button" disabled={passportImportBusy}>
              <Upload size={16} /> Загрузить паспорт проекта
            </button>
            <input
              ref={passportFolderInputRef}
              className="file-upload-input"
              type="file"
              accept=".xls,.html,.htm,.mht"
              multiple
              webkitdirectory="true"
              directory=""
              onChange={handlePassportFolderPicked}
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
