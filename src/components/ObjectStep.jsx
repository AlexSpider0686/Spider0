import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Lock, Unlock, Search, ClipboardList, Camera, CheckCircle2, X } from "lucide-react";
import { OBJECT_TYPES, SYSTEM_TYPES } from "../config/estimateConfig";
import { BUILDING_STATUS_OPTIONS } from "../config/costModelConfig";
import { searchRegions } from "../config/regionsConfig";
import { ZONE_PRESET_DETAILS, ZONE_PRESETS, ZONE_TYPES } from "../config/zonesConfig";
import { getZonePercentSum, normalizeZoneAreas } from "../lib/zoneEngine";
import { num, toNumber } from "../lib/estimate";

function makeFallbackImage(topColor, bottomColor, accentColor) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${topColor}" />
          <stop offset="100%" stop-color="${bottomColor}" />
        </linearGradient>
        <radialGradient id="glow" cx="0.2" cy="0.15" r="0.7">
          <stop offset="0%" stop-color="rgba(255,255,255,0.45)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <rect width="1200" height="700" fill="url(#bg)" />
      <rect width="1200" height="700" fill="url(#glow)" />
      <circle cx="1010" cy="120" r="120" fill="${accentColor}" opacity="0.35" />
      <path d="M0 490 C 230 420, 500 600, 770 520 C 950 470, 1080 420, 1200 460 L1200 700 L0 700 Z" fill="rgba(255,255,255,0.28)" />
      <path d="M0 560 C 210 500, 430 660, 690 610 C 930 560, 1070 520, 1200 560 L1200 700 L0 700 Z" fill="rgba(9,24,44,0.24)" />
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const OBJECT_TYPE_IMAGES = {
  production: "/assets/object-types/production.jpg",
  warehouse: "/assets/object-types/warehouse.jpg",
  public: "/assets/object-types/public.jpg",
  residential: "/assets/object-types/residential.jpg",
  transport: "/assets/object-types/transport.jpg",
  energy: "/assets/object-types/energy.jpg",
};

const OBJECT_TYPE_IMAGE_FALLBACKS = {
  production: makeFallbackImage("#58748f", "#253c59", "#3bd0d5"),
  warehouse: makeFallbackImage("#5e6f8f", "#293650", "#59a2f3"),
  public: makeFallbackImage("#647ea2", "#2d4669", "#58c9f1"),
  residential: makeFallbackImage("#7387a8", "#384f74", "#63b4ff"),
  transport: makeFallbackImage("#607895", "#243a5e", "#5de2be"),
  energy: makeFallbackImage("#5d7b8a", "#24445e", "#7adf72"),
};

function renderChecklistInput(question, value, onChange) {
  if (question.type === "boolean") {
    return (
      <div className="ai-checklist-bool">
        <button type="button" className={`chip-btn ${value === true ? "active" : ""}`} onClick={() => onChange(true)}>
          Р”Р°
        </button>
        <button type="button" className={`chip-btn ${value === false ? "active" : ""}`} onClick={() => onChange(false)}>
          РќРµС‚
        </button>
      </div>
    );
  }

  if (question.type === "number") {
    return (
      <input
        type="number"
        min={question.min ?? 0}
        max={question.max ?? undefined}
        value={value ?? ""}
        placeholder={question.placeholder || "Р’РІРµРґРёС‚Рµ Р·РЅР°С‡РµРЅРёРµ"}
        onChange={(event) => onChange(toNumber(event.target.value))}
      />
    );
  }

  if (question.type === "multiselect") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="ai-checklist-chips">
        {(question.options || []).map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              className={`chip-btn ${active ? "active" : ""}`}
              onClick={() => onChange(active ? selected.filter((item) => item !== option) : [...selected, option])}
            >
              {option}
            </button>
          );
        })}
      </div>
    );
  }

  return <input value={value ?? ""} onChange={(event) => onChange(event.target.value)} />;
}

export default function ObjectStep({
  objectData,
  addressVerification,
  zones,
  systems,
  recalculatedArea,
  protectedAreaMeta,
  zonePreset,
  setZonePreset,
  lockedZoneIds,
  zoneDistribution,
  inputValidation,
  updateObject,
  verifyObjectAddress,
  addZone,
  updateZone,
  removeZone,
  toggleZoneLock,
  updateZoneShare,
  applyZonePreset,
  setZones,
  toggleSystemRegistry,
  updateSystemWorkingDocs,
  technicalSolution,
  aiSurveyPlan,
  aiSurveyCompletion,
  appliedAiSurveyCompletion,
  startAiSurvey,
  updateAiSurveyAnswer,
  analyzeAiSurveyPhoto,
  applyAiSurveyData,
}) {
  const [regionQuery, setRegionQuery] = useState(objectData.regionName || "");
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [surveyRefreshTick, setSurveyRefreshTick] = useState(0);
  const regionItems = useMemo(() => searchRegions(regionQuery).slice(0, 20), [regionQuery]);
  const selectedObjectType = OBJECT_TYPES.find((item) => item.value === objectData.objectType);
  const activeSystemTypes = new Set((systems || []).map((item) => item.type));
  const systemNames = useMemo(
    () =>
      Object.fromEntries(
        SYSTEM_TYPES.map((item) => [item.code, item.shortName || item.name])
      ),
    []
  );

  useEffect(() => {
    setRegionQuery(objectData.regionName || "");
  }, [objectData.regionName]);

  useEffect(() => {
    if (!surveyModalOpen || typeof document === "undefined" || typeof window === "undefined") return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("ai-survey-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [surveyModalOpen]);

  const handleOpenSurvey = () => {
    const started = technicalSolution?.surveyStartedAt ? true : startAiSurvey();
    if (started) setSurveyModalOpen(true);
  };

  const handleApplySurvey = () => {
    const applied = applyAiSurveyData();
    if (applied) setSurveyModalOpen(false);
  };

  const handleSurveyModalClose = () => {
    setSurveyModalOpen(false);
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>РћР±СЉРµРєС‚</h2>
          <p>РўРёРї, РїР»РѕС‰Р°РґСЊ, СЌС‚Р°Р¶РЅРѕСЃС‚СЊ, СЂРµРіРёРѕРЅ Рё Р·РѕРЅР°Р»СЊРЅР°СЏ СЃС‚СЂСѓРєС‚СѓСЂР°.</p>
        </div>
      </div>

      <div className="object-top-grid">
        <div className="input-card address-card">
          <label>РђРґСЂРµСЃ РѕР±СЉРµРєС‚Р°</label>
          <div className="region-search-row">
            <Search size={14} />
            <input
              type="text"
              value={objectData.address || ""}
              placeholder="Р“РѕСЂРѕРґ, СѓР»РёС†Р°, РґРѕРј"
              onChange={(event) => updateObject("address", event.target.value)}
            />
          </div>
          <div className="address-actions">
            <button className="primary-btn" type="button" onClick={verifyObjectAddress} disabled={addressVerification?.state === "loading"}>
              {addressVerification?.state === "loading" ? "РџСЂРѕРІРµСЂРєР° Р°РґСЂРµСЃР°..." : "РџСЂРѕРІРµСЂРёС‚СЊ Р°РґСЂРµСЃ"}
            </button>
            <small className="hint-inline">
              РњРѕР¶РЅРѕ РІРІРѕРґРёС‚СЊ Р°РґСЂРµСЃ РІ СЃРІРѕР±РѕРґРЅРѕР№ С„РѕСЂРјРµ. РђР»РіРѕСЂРёС‚Рј РЅР°Р№РґС‘С‚ РµРіРѕ РѕРЅР»Р°Р№РЅ Рё РїСЂРёРІРµРґС‘С‚ Рє РєРѕСЂСЂРµРєС‚РЅРѕР№ Р·Р°РїРёСЃРё.
            </small>
          </div>
          <div
            className={`address-status ${
              addressVerification?.state === "error" ? "error" : addressVerification?.state === "success" ? "success" : ""
            }`}
          >
            {addressVerification?.message}
          </div>
          {addressVerification?.result ? (
            <div className="verified-address-card">
              <div className="verified-address-card__body">
                <strong>{addressVerification.result.verifiedLabel}</strong>
                <span>
                  Р Р°Р№РѕРЅ: {addressVerification.result.district || "РЅРµ РѕРїСЂРµРґРµР»С‘РЅ"} | Р РµРіРёРѕРЅ:{" "}
                  {addressVerification.result.regionName || objectData.regionName}
                </span>
                <span>РќРѕСЂРјР°Р»РёР·РѕРІР°РЅРЅС‹Р№ Р°РґСЂРµСЃ РїРѕРґСЃС‚Р°РІР»РµРЅ РІ РїРѕР»Рµ РІС‹С€Рµ Рё РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РІ РґР°Р»СЊРЅРµР№С€РёС… СЂР°СЃС‡С‘С‚Р°С….</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="object-side-stack">
          <div className="input-card">
            <label>РќР°Р·РІР°РЅРёРµ РїСЂРѕРµРєС‚Р°</label>
            <input value={objectData.projectName} onChange={(event) => updateObject("projectName", event.target.value)} />
          </div>

          <div className="input-card">
            <label>РўРёРї РѕР±СЉРµРєС‚Р°</label>
            <input value={selectedObjectType?.label || "РќРµ РІС‹Р±СЂР°РЅ"} readOnly className="readonly-field" />
            {selectedObjectType ? <small className="hint-inline">{selectedObjectType.description}</small> : null}
            <small className="hint-inline">РўРёРї РІС‹Р±РёСЂР°РµС‚СЃСЏ РєРЅРѕРїРєР°РјРё-РєР°СЂС‚РѕС‡РєР°РјРё РЅРёР¶Рµ.</small>
          </div>
        </div>
      </div>

      <div className="object-photo-gallery">
        {OBJECT_TYPES.map((item) => {
          const isActive = objectData.objectType === item.value;
          return (
            <button
              key={item.value}
              type="button"
              className={`object-photo-card ${isActive ? "active" : ""}`}
              onClick={() => updateObject("objectType", item.value)}
              title={item.description}
            >
              <img
                src={OBJECT_TYPE_IMAGES[item.value]}
                alt={item.label}
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = OBJECT_TYPE_IMAGE_FALLBACKS[item.value];
                }}
              />
              <div className="object-photo-overlay">
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid-two">
        <div className="input-card">
          <label>РџР»РѕС‰Р°РґСЊ РїРѕ РѕР±СЉРµРєС‚Сѓ, РјВІ</label>
          <input type="number" value={objectData.totalArea} onChange={(event) => updateObject("totalArea", toNumber(event.target.value))} />
        </div>

        <div className="input-card">
          <div className="label-with-tooltip">
            <label htmlFor="protected-zone-area">Р—Р°С‰РёС‰Р°РµРјР°СЏ РїР»РѕС‰Р°РґСЊ, РјВІ</label>
            <span
              className="label-tooltip-help"
              tabIndex={0}
              role="button"
              title="Р›РѕРіРёРєР° СЂР°СЃС‡РµС‚Р° Р·Р°С‰РёС‰Р°РµРјРѕР№ РїР»РѕС‰Р°РґРё"
              aria-label="Р›РѕРіРёРєР° СЂР°СЃС‡РµС‚Р° Р·Р°С‰РёС‰Р°РµРјРѕР№ РїР»РѕС‰Р°РґРё"
            >
              ?
            </span>
            <div className="label-tooltip-popover" role="tooltip">
              <p>
                <strong>РС‚РѕРі:</strong> Р·Р°С‰РёС‰Р°РµРјР°СЏ РїР»РѕС‰Р°РґСЊ = РїР»РѕС‰Р°РґСЊ РѕР±СЉРµРєС‚Р° x {num((protectedAreaMeta?.protectionShare || 0) * 100, 1)}%.
              </p>
              {(protectedAreaMeta?.breakdown || []).map((item) => (
                <p key={item.key}>
                  <strong>{item.label}:</strong> {item.value >= 0 ? "+" : ""}
                  {num(item.value * 100, 1)}%. {item.reason}
                </p>
              ))}
            </div>
          </div>
          <input id="protected-zone-area" type="number" value={recalculatedArea} readOnly />
          <small className="hint-inline">РџРѕР»Рµ СЂР°СЃСЃС‡РёС‚С‹РІР°РµС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РїРѕ РїР°СЂР°РјРµС‚СЂР°Рј РѕР±СЉРµРєС‚Р°.</small>
        </div>

        <div className="input-card">
          <label>РќР°РґР·РµРјРЅС‹Рµ СЌС‚Р°Р¶Рё</label>
          <input type="number" value={objectData.floors} onChange={(event) => updateObject("floors", toNumber(event.target.value))} />
        </div>

        <div className="input-card">
          <label>РџРѕРґР·РµРјРЅС‹Рµ СЌС‚Р°Р¶Рё</label>
          <input
            type="number"
            value={objectData.basementFloors}
            onChange={(event) => updateObject("basementFloors", toNumber(event.target.value))}
          />
        </div>

        <div className="input-card">
          <label>РЎС‚Р°С‚СѓСЃ Р·РґР°РЅРёСЏ</label>
          <select value={objectData.buildingStatus || "operational"} onChange={(event) => updateObject("buildingStatus", event.target.value)}>
            {BUILDING_STATUS_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <small className="hint-inline">
            РљРѕСЌС„С„РёС†РёРµРЅС‚ СЂР°Р±РѕС‚ РІ СЌРєСЃРїР»СѓР°С‚РёСЂСѓРµРјС‹С… Р·РґР°РЅРёСЏС…:{" "}
            <strong>
              x
              {num(
                BUILDING_STATUS_OPTIONS.find((item) => item.value === (objectData.buildingStatus || "operational"))
                  ?.exploitedBuildingCoefficient || 1,
                2
              )}
            </strong>
          </small>
        </div>

        <div className="input-card full">
          <label>РЎСѓР±СЉРµРєС‚ Р Р¤</label>
          <div className="region-search-row">
            <Search size={14} />
            <input
              type="text"
              value={regionQuery}
              placeholder="РќР°С‡РЅРёС‚Рµ РІРІРѕРґРёС‚СЊ СЃСѓР±СЉРµРєС‚ Р Р¤"
              onChange={(event) => setRegionQuery(event.target.value)}
            />
          </div>
          <div className="region-select-grid">
            {regionItems.map((region) => (
              <button
                key={region.name}
                type="button"
                className={`region-option ${objectData.regionName === region.name ? "active" : ""}`}
                onClick={() => {
                  setRegionQuery(region.name);
                  updateObject("regionName", region.name);
                }}
              >
                <span>{region.name}</span>
                <strong>x{num(region.coef, 2)}</strong>
              </button>
            ))}
          </div>
          <small className="hint-inline">
            Р РµРіРёРѕРЅР°Р»СЊРЅС‹Р№ РєРѕСЌС„С„РёС†РёРµРЅС‚: <strong>x{num(objectData.regionCoef, 2)}</strong>
          </small>
        </div>
      </div>

      <div className="subpanel">
        <div className="subpanel-header">
          <div>
            <h3>Р Р°СЃРїСЂРµРґРµР»РµРЅРёРµ Р·РѕРЅ</h3>
            <p>РЎСѓРјРјР° РґРѕР»РµР№ Р·РѕРЅ РІСЃРµРіРґР° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ 100%.</p>
          </div>
          <button className="primary-btn" onClick={addZone} type="button">
            <Plus size={16} />
            Р”РѕР±Р°РІРёС‚СЊ Р·РѕРЅСѓ
          </button>
        </div>

        <div className="preset-row">
          <div className="label-with-tooltip">
            <label htmlFor="zone-preset-select">РЁР°Р±Р»РѕРЅ СЂР°СЃРїСЂРµРґРµР»РµРЅРёСЏ Р·РѕРЅ</label>
            <span
              className="label-tooltip-help"
              tabIndex={0}
              role="button"
              title="РџРѕСЏСЃРЅРµРЅРёРµ Рє С€Р°Р±Р»РѕРЅР°Рј СЂР°СЃРїСЂРµРґРµР»РµРЅРёСЏ Р·РѕРЅ"
              aria-label="РџРѕСЏСЃРЅРµРЅРёРµ Рє С€Р°Р±Р»РѕРЅР°Рј СЂР°СЃРїСЂРµРґРµР»РµРЅРёСЏ Р·РѕРЅ"
            >
              ?
            </span>
            <div className="label-tooltip-popover" role="tooltip">
              <p>
                <strong>Р­С‚Рѕ РјРµРЅСЋ</strong> РїРѕРґСЃС‚Р°РІР»СЏРµС‚ С‚РёРїРѕРІРѕРµ СЂР°СЃРїСЂРµРґРµР»РµРЅРёРµ Р·РѕРЅ РґР»СЏ Р±С‹СЃС‚СЂРѕРіРѕ СЃС‚Р°СЂС‚Р° СЂР°СЃС‡РµС‚Р°.
              </p>
              <p>
                <strong>Р’Р»РёСЏРЅРёРµ РЅР° СЃРјРµС‚Сѓ:</strong> РїСЂРµСЃРµС‚ РјРµРЅСЏРµС‚ РїР»РѕС‚РЅРѕСЃС‚СЊ РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ, РґР»РёРЅСѓ С‚СЂР°СЃСЃ Рё С‚СЂСѓРґРѕРµРјРєРѕСЃС‚СЊ РјРѕРЅС‚Р°Р¶Р°.
              </p>
              {Object.entries(ZONE_PRESETS).map(([key, preset]) => (
                <p key={key}>
                  <strong>{preset.label}</strong> - {ZONE_PRESET_DETAILS[key]?.summary || "РўРёРїРѕРІРѕР№ СЃС†РµРЅР°СЂРёР№ СЂР°СЃРїСЂРµРґРµР»РµРЅРёСЏ Р·РѕРЅ РґР»СЏ СѓРєСЂСѓРїРЅРµРЅРЅРѕРіРѕ СЂР°СЃС‡РµС‚Р°."}
                </p>
              ))}
            </div>
          </div>
          <select id="zone-preset-select" value={zonePreset} onChange={(event) => setZonePreset(event.target.value)}>
            {Object.entries(ZONE_PRESETS).map(([key, preset]) => (
              <option key={key} value={key}>
                {preset.label}
              </option>
            ))}
          </select>
          <button className="ghost-btn" type="button" onClick={() => applyZonePreset(zonePreset)}>
            РџСЂРёРјРµРЅРёС‚СЊ РїСЂРµСЃРµС‚
          </button>
          <button className="ghost-btn" type="button" onClick={() => setZones((prev) => normalizeZoneAreas(prev, recalculatedArea))}>
            РќРѕСЂРјР°Р»РёР·РѕРІР°С‚СЊ
          </button>
        </div>

        <div className="slider-stack">
          {zones.map((zone) => {
            const zonePercent = recalculatedArea > 0 ? (toNumber(zone.area) / toNumber(recalculatedArea, 1)) * 100 : 0;
            const isLocked = lockedZoneIds.includes(zone.id);
            return (
              <div className="slider-card" key={`share-${zone.id}`}>
                <div className="slider-header">
                  <div className="slider-title">
                    <strong>{zone.name}</strong>
                    <button className={`lock-btn ${isLocked ? "locked" : ""}`} type="button" onClick={() => toggleZoneLock(zone.id)}>
                      {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                      {isLocked ? "Р—Р°С„РёРєСЃРёСЂРѕРІР°РЅР°" : "РЎРІРѕР±РѕРґРЅР°"}
                    </button>
                  </div>
                  <span>{num(zonePercent, 1)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={Math.max(0, Math.min(100, zonePercent))}
                  onChange={(event) => updateZoneShare(zone.id, toNumber(event.target.value))}
                  className="zone-slider"
                  disabled={isLocked}
                />
                <div className="zone-grid compact-zone-grid">
                  <div className="input-card">
                    <label>РќР°Р·РІР°РЅРёРµ Р·РѕРЅС‹</label>
                    <input value={zone.name} onChange={(event) => updateZone(zone.id, "name", event.target.value)} />
                  </div>
                  <div className="input-card">
                    <label>РўРёРї Р·РѕРЅС‹</label>
                    <select value={zone.type} onChange={(event) => updateZone(zone.id, "type", event.target.value)}>
                      {ZONE_TYPES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="input-card">
                    <label>РџР»РѕС‰Р°РґСЊ, РјВІ</label>
                    <input type="number" value={zone.area} onChange={(event) => updateZone(zone.id, "area", toNumber(event.target.value))} />
                  </div>
                  <div className="input-card">
                    <label>Р­С‚Р°Р¶РµР№</label>
                    <input type="number" value={zone.floors} onChange={(event) => updateZone(zone.id, "floors", toNumber(event.target.value))} />
                  </div>
                  <div className="action-cell">
                    <button className="danger-btn" type="button" onClick={() => removeZone(zone.id)} disabled={zones.length <= 1}>
                      <Trash2 size={16} />
                      РЈРґР°Р»РёС‚СЊ
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="slider-total">
            РЎСѓРјРјР° РїСЂРѕС†РµРЅС‚РѕРІ: <strong>{num(getZonePercentSum(zones, recalculatedArea), 1)}%</strong>
            {!zoneDistribution.isValid ? <span className="warn-inline"> РџСЂРѕРІРµСЂСЊ СЂР°СЃРїСЂРµРґРµР»РµРЅРёРµ (РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ 100%).</span> : null}
          </div>
        </div>

        {inputValidation?.errors?.length ? (
          <div className="warn-inline" style={{ display: "block", marginTop: 12 }}>
            {inputValidation.errors.join(" ")}
          </div>
        ) : null}
        {inputValidation?.warnings?.length ? (
          <div className="hint-inline" style={{ display: "block", marginTop: 6 }}>
            {inputValidation.warnings.join(" ")}
          </div>
        ) : null}
      </div>

      <div className="subpanel ai-survey-panel">
        <div className="subpanel-header">
          <div>
            <h3>AI-РўРµС…РЅРёС‡РµСЃРєРѕРµ СЂРµС€РµРЅРёРµ: РѕР±СЃР»РµРґРѕРІР°РЅРёРµ РѕР±СЉРµРєС‚Р°</h3>
            <p>РњРѕРґСѓР»СЊ Р·Р°РїСѓСЃРєР°РµС‚СЃСЏ РєР°Рє РѕС‚РґРµР»СЊРЅРѕРµ РІРЅСѓС‚СЂРµРЅРЅРµРµ РѕРєРЅРѕ РїРѕСЃР»Рµ Р·Р°РїРѕР»РЅРµРЅРёСЏ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹С… РґР°РЅРЅС‹С… РїРѕ РѕР±СЉРµРєС‚Сѓ. РЎРѕР±СЂР°РЅРЅР°СЏ РІРЅСѓС‚СЂРё РЅРµРіРѕ РёРЅС„РѕСЂРјР°С†РёСЏ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ Рё РґР»СЏ AI-С‚РµС…РЅРёС‡РµСЃРєРѕРіРѕ СЂРµС€РµРЅРёСЏ, Рё РґР»СЏ Р±РѕР»РµРµ С‚РѕС‡РЅРѕРіРѕ СЂР°СЃС‡РµС‚Р° СЃС‚РѕРёРјРѕСЃС‚Рё РїСЂРѕРµРєС‚РёСЂРѕРІР°РЅРёСЏ РїРѕ СЃРёСЃС‚РµРјР°Рј Р±РµР· РїСЂРѕРµРєС‚Р°. Р”Р»СЏ РЎРћРўРЎ, РЎРћРЈР­ Рё РђРџРЎ РІРЅСѓС‚СЂРё РѕР±СЃР»РµРґРѕРІР°РЅРёСЏ РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ СЃРѕР±РёСЂР°СЋС‚СЃСЏ РїР»Р°РЅРёСЂРѕРІРєРё РїРѕ РїР»Р°РЅР°Рј СЌРІР°РєСѓР°С†РёРё.</p>
          </div>
          <button className="primary-btn" type="button" onClick={handleOpenSurvey} disabled={!aiSurveyPlan?.readiness?.isReady}>
            <ClipboardList size={16} />
            Начать AI-обследование
          </button>
        </div>

        <div className="ai-survey-summary-grid">
          <div className="metric-card">
            <span>Р Р°СЃС‡РµС‚РЅРѕРµ РІСЂРµРјСЏ РѕР±СЃР»РµРґРѕРІР°РЅРёСЏ</span>
            <strong>{num(aiSurveyPlan?.estimatedHours || 0, 1)} С‡</strong>
          </div>
          <div className="metric-card">
            <span>Р—Р°РїРѕР»РЅРµРЅРёРµ С‡РµРє-Р»РёСЃС‚Р°</span>
            <strong>{aiSurveyCompletion?.percent || 0}%</strong>
          </div>
          <div className="metric-card">
            <span>Р—Р°РіСЂСѓР¶РµРЅРѕ РІ РїР»Р°С‚С„РѕСЂРјСѓ</span>
            <strong>{appliedAiSurveyCompletion?.percent || 0}%</strong>
          </div>
          <div className="metric-card">
            <span>РЎРёСЃС‚РµРј РІ РѕР±СЃР»РµРґРѕРІР°РЅРёРё</span>
            <strong>{num(aiSurveyPlan?.activeSystems?.length || 0, 0)}</strong>
          </div>
          <div className="metric-card">
            <span>РЎС‚Р°С‚СѓСЃ РјРѕРґСѓР»СЏ</span>
            <strong>{technicalSolution?.appliedAt ? "Р”Р°РЅРЅС‹Рµ Р·Р°РіСЂСѓР¶РµРЅС‹" : technicalSolution?.surveyStartedAt ? "Р§РµСЂРЅРѕРІРёРє Р·Р°РїРѕР»РЅРµРЅРёСЏ" : "РќРµ Р·Р°РїСѓСЃРєР°Р»РѕСЃСЊ"}</strong>
          </div>
        </div>

        <div className="ai-system-registry">
          <div className="calc-explain">
            <h4>Р РµРµСЃС‚СЂ РёРЅР¶РµРЅРµСЂРЅС‹С… СЃРёСЃС‚РµРј</h4>
            <p className="hint-inline">
              Р’С‹Р±РµСЂРёС‚Рµ, РєР°РєРёРµ СЃРёСЃС‚РµРјС‹ РІС…РѕРґСЏС‚ РІ РѕР±СЉРµРєС‚. Р•СЃР»Рё РїРѕ СЃРёСЃС‚РµРјРµ СѓР¶Рµ РµСЃС‚СЊ Р Р” РёР»Рё Р·Р°РіСЂСѓР¶РµРЅ РїСЂРѕРµРєС‚, РїРѕР»РЅС‹Р№ С‡РµРє-Р»РёСЃС‚ РїРѕ РЅРµР№ РЅРµ С„РѕСЂРјРёСЂСѓРµС‚СЃСЏ, Р° СЃС‚РѕРёРјРѕСЃС‚СЊ РїСЂРѕРµРєС‚РёСЂРѕРІР°РЅРёСЏ РїРѕ С‚Р°РєРѕР№ СЃРёСЃС‚РµРјРµ РґР°Р»РµРµ РЅРµ СЂР°СЃСЃС‡РёС‚С‹РІР°РµС‚СЃСЏ.
            </p>
          </div>

          <div className="ai-system-registry__grid">
            {SYSTEM_TYPES.map((systemType) => {
              const enabled = activeSystemTypes.has(systemType.code);
              const currentSystem = (systems || []).find((item) => item.type === systemType.code);
              return (
                <div key={systemType.code} className={`ai-system-registry__item ${enabled ? "active" : ""}`}>
                  <label className="ai-system-toggle">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(event) => toggleSystemRegistry(systemType.code, event.target.checked)}
                    />
                    <span>
                      <strong>{systemType.name}</strong>
                      <small>{enabled ? "РЎРёСЃС‚РµРјР° РІРєР»СЋС‡РµРЅР° РІ РїСЂРѕРµРєС‚" : "РЎРёСЃС‚РµРјР° РїРѕРєР° РЅРµ РІС‹Р±СЂР°РЅР°"}</small>
                    </span>
                  </label>

                  <label className={`ai-working-docs ${enabled ? "" : "disabled"}`}>
                    <input
                      type="checkbox"
                      checked={Boolean(currentSystem?.hasWorkingDocs)}
                      onChange={(event) => updateSystemWorkingDocs(currentSystem?.id, event.target.checked)}
                      disabled={!enabled || !currentSystem?.id}
                    />
                    <span>РќР°Р»РёС‡РёРµ Р Р” (РїСЂРѕРµРєС‚Р°)</span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`address-status ${aiSurveyPlan?.readiness?.isReady ? "success" : "error"}`}>
          {aiSurveyPlan?.readiness?.isReady
            ? "РћР±СЏР·Р°С‚РµР»СЊРЅС‹Рµ РґР°РЅРЅС‹Рµ Р·Р°РїРѕР»РЅРµРЅС‹. РњРѕР¶РЅРѕ Р·Р°РїСѓСЃРєР°С‚СЊ AI-РѕР±СЃР»РµРґРѕРІР°РЅРёРµ."
            : "AI-РћР±СЃР»РµРґРѕРІР°РЅРёРµ Р±СѓРґРµС‚ Р°РєС‚РёРІРёСЂРѕРІР°РЅРѕ РїРѕСЃР»Рµ 100% Р·Р°РїРѕР»РЅРµРЅРёСЏ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹С… РїРѕР»РµР№."}
        </div>
        {!aiSurveyPlan?.readiness?.isReady ? (
          <div className="ai-readiness-list">
            {(aiSurveyPlan?.readiness?.issues || []).map((issue) => (
              <div key={issue} className="warn-inline ai-readiness-item">
                {issue}
              </div>
            ))}
          </div>
        ) : null}

        {technicalSolution?.surveyStartedAt ? (
          <div className="calc-explain ai-checklist-footer">
            <h4>РЎС‚Р°С‚СѓСЃ СЌС‚Р°РїР°</h4>
            <div className="ai-summary-list">
              <div>
                <CheckCircle2 size={16} />
                <span>
                  РћРїСЂРѕСЃРЅРёРє СѓР¶Рµ СЃРѕР·РґР°РЅ. Р•СЃР»Рё Р·Р°РєСЂС‹С‚СЊ РІРЅСѓС‚СЂРµРЅРЅРµРµ РѕРєРЅРѕ Рё РѕС‚РєСЂС‹С‚СЊ РµРіРѕ СЃРЅРѕРІР°, РІСЃРµ РѕС‚РІРµС‚С‹ Рё СЂРµР·СѓР»СЊС‚Р°С‚С‹ С„РѕС‚РѕР°РЅР°Р»РёР·Р° РѕСЃС‚Р°РЅСѓС‚СЃСЏ РІРЅСѓС‚СЂРё С‚РµРєСѓС‰РµР№ СЃРµСЃСЃРёРё РїР»Р°С‚С„РѕСЂРјС‹.
                </span>
              </div>
              <div>
                <CheckCircle2 size={16} />
                <span>
                  РћС…РІР°С‚: РѕР±СЉРµРєС‚, {zones.length} Р·РѕРЅ Рё СЃРёСЃС‚РµРјС‹: {(aiSurveyPlan?.activeSystems || []).map((code) => systemNames[code] || code).join(", ") || "РЅРµ РІС‹Р±СЂР°РЅС‹"}.
                </span>
              </div>
              {(aiSurveyPlan?.skippedSystems || []).length ? (
                <div>
                  <CheckCircle2 size={16} />
                  <span>
                    РЎ С‡РµРє-Р»РёСЃС‚Р° РёСЃРєР»СЋС‡РµРЅС‹ СЃРёСЃС‚РµРјС‹ СЃ РїСЂРѕРµРєС‚РѕРј: {aiSurveyPlan.skippedSystems.map((code) => systemNames[code] || code).join(", ")}. Р”Р»СЏ РЅРёС… РЅР° РІРєР»Р°РґРєРµ РїСЂРѕРµРєС‚РёСЂРѕРІР°РЅРёСЏ Р±СѓРґРµС‚ РїРѕРєР°Р·Р°РЅРѕ, С‡С‚Рѕ СЃС‚РѕРёРјРѕСЃС‚СЊ РЅРµ СЂР°СЃСЃС‡РёС‚С‹РІР°РµС‚СЃСЏ.
                  </span>
                </div>
              ) : null}
              {technicalSolution?.appliedAt ? (
                <div>
                  <CheckCircle2 size={16} />
                  <span>РџРѕСЃР»РµРґРЅСЏСЏ Р·Р°РіСЂСѓР·РєР° РґР°РЅРЅС‹С… РёР· РѕРєРЅР° РѕР±СЃР»РµРґРѕРІР°РЅРёСЏ СѓР¶Рµ РІС‹РїРѕР»РЅРµРЅР°, Рё СЌС‚Рё РґР°РЅРЅС‹Рµ СѓС‡Р°СЃС‚РІСѓСЋС‚ РІ РґР°Р»СЊРЅРµР№С€РµРј РїРѕРґР±РѕСЂРµ СЂРµС€РµРЅРёР№, РІ СЂР°СЃРїРѕР·РЅР°РІР°РЅРёРё Р·РѕРЅ РїРѕ РїР»Р°РЅРёСЂРѕРІРєР°Рј Рё РІ СЂР°СЃС‡РµС‚Рµ СЃС‚РѕРёРјРѕСЃС‚Рё РїСЂРѕРµРєС‚РёСЂРѕРІР°РЅРёСЏ.</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {surveyModalOpen ? (
        <div
          id="ai-survey-workspace"
          className="ai-survey-modal ai-survey-modal--inline"
          role="dialog"
          aria-modal="false"
          aria-label="AI-РѕР±СЃР»РµРґРѕРІР°РЅРёРµ РѕР±СЉРµРєС‚Р°"
        >
          <div className="ai-survey-modal__backdrop" />
          <div
            className="ai-survey-modal__card"
            data-refresh-tick={surveyRefreshTick % 2}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="ai-survey-modal__header">
              <div>
                <h3>AI-РћР±СЃР»РµРґРѕРІР°РЅРёРµ РѕР±СЉРµРєС‚Р°</h3>
                <p>
                  РћС‚РґРµР»СЊРЅРѕРµ РІРЅСѓС‚СЂРµРЅРЅРµРµ РѕРєРЅРѕ РѕР±СЃР»РµРґРѕРІР°РЅРёСЏ. Р”Р°РЅРЅС‹Рµ РІРЅСѓС‚СЂРё РЅРµРіРѕ СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ РІ С‚РµС‡РµРЅРёРµ С‚РµРєСѓС‰РµР№ СЃРµСЃСЃРёРё РїР»Р°С‚С„РѕСЂРјС‹, РґР°Р¶Рµ РµСЃР»Рё РІС‹ Р·Р°РєСЂРѕРµС‚Рµ РѕРєРЅРѕ Рё РѕС‚РєСЂРѕРµС‚Рµ РµРіРѕ СЃРЅРѕРІР°, Р° РїРѕСЃР»Рµ Р·Р°РіСЂСѓР·РєРё РІР»РёСЏСЋС‚ Рё РЅР° С‚РµС…РЅРёС‡РµСЃРєРѕРµ СЂРµС€РµРЅРёРµ, Рё РЅР° СЃС‚РѕРёРјРѕСЃС‚СЊ РїСЂРѕРµРєС‚РёСЂРѕРІР°РЅРёСЏ. Р”Р»СЏ РЎРћРўРЎ, РЎРћРЈР­ Рё РђРџРЎ Р·РґРµСЃСЊ С‚Р°РєР¶Рµ СЃРѕР±РёСЂР°СЋС‚СЃСЏ РїР»Р°РЅС‹ СЌРІР°РєСѓР°С†РёРё РґР»СЏ СЂР°СЃРїРѕР·РЅР°РІР°РЅРёСЏ РїР»Р°РЅРёСЂРѕРІРѕРє Рё Р·РѕРЅ.
                </p>
              </div>
              <button className="ghost-btn ai-survey-modal__close" type="button" onClick={handleSurveyModalClose}>
                <X size={16} /> Р—Р°РєСЂС‹С‚СЊ
              </button>
            </div>

            <div className="ai-survey-modal__body" data-refresh-tick={surveyRefreshTick % 2}>
              <div className="ai-checklist-sections">
                {(aiSurveyPlan?.sections || []).map((section) => (
                  <div className="calc-explain ai-checklist-section" key={section.id}>
                    <div className="ai-checklist-section__head">
                      <div>
                        <h4>{section.title}</h4>
                        <p className="hint-inline">{section.description}</p>
                      </div>
                      <span className="pricing-source-chip muted">{section.questions.length} РІРѕРїСЂРѕСЃРѕРІ</span>
                    </div>

                    <div className="ai-checklist-grid">
                      {section.questions.map((question) => (
                        <div className="input-card ai-checklist-question" key={question.id}>
                          <label>
                            {question.label}
                            {question.aiAutofill ? <span className="ai-inline-mark">AI</span> : null}
                          </label>
                          {renderChecklistInput(question, technicalSolution?.answers?.[question.id], (value) =>
                            updateAiSurveyAnswer(question.id, value)
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {(aiSurveyPlan?.photoPrompts || []).length ? (
                <div className="calc-explain ai-photo-prompt-block">
                  <h4>РРЅС‚РµР»Р»РµРєС‚СѓР°Р»СЊРЅР°СЏ С„РѕС‚РѕС„РёРєСЃР°С†РёСЏ</h4>
                  <p className="hint-inline">
                    AI-РїРѕРґСЃРєР°Р·РєРё С„РѕСЂРјРёСЂСѓСЋС‚СЃСЏ РїРѕ Р·РѕРЅР°Рј. Р§РµРє-Р»РёСЃС‚ СѓС‡РёС‚С‹РІР°РµС‚ РЅРµ С‚РѕР»СЊРєРѕ РїРѕРґР±РѕСЂ СЂРµС€РµРЅРёСЏ, РЅРѕ Рё РІРѕРїСЂРѕСЃС‹, РєРѕС‚РѕСЂС‹Рµ РЅСѓР¶РЅС‹ РґР»СЏ С‚РѕС‡РЅРѕРіРѕ СЂР°СЃС‡РµС‚Р° РїСЂРѕРµРєС‚РёСЂРѕРІР°РЅРёСЏ. Р”Р»СЏ РЎРћРўРЎ, РЎРћРЈР­ Рё РђРџРЎ РјРѕРґСѓР»СЊ РѕС‚РґРµР»СЊРЅРѕ СЃРѕР±РёСЂР°РµС‚ С„РѕС‚Рѕ РїР»Р°РЅРѕРІ СЌРІР°РєСѓР°С†РёРё, РїРѕРґСЃРєР°Р·С‹РІР°РµС‚ РЅСѓР¶РЅРѕРµ СЂР°СЃСЃС‚РѕСЏРЅРёРµ Рё СЂР°РєСѓСЂСЃ СЃСЉРµРјРєРё, Р° Р·Р°С‚РµРј СЂР°СЃРїРѕР·РЅР°РµС‚ РїР»Р°РЅРёСЂРѕРІРєСѓ Рё РІС‹РґРµР»СЏРµС‚ РѕС…СЂР°РЅРЅС‹Рµ Р·РѕРЅС‹ РёР»Рё Р·РѕРЅС‹ РѕРїРѕРІРµС‰РµРЅРёСЏ РґР»СЏ С‚РµС…РЅРёС‡РµСЃРєРѕРіРѕ СЂРµС€РµРЅРёСЏ. Р•СЃР»Рё Р·Р°РіСЂСѓР¶РµРЅРЅРѕРµ С„РѕС‚Рѕ РЅРµ СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓРµС‚ С‚СЂРµР±СѓРµРјРѕРјСѓ С‚РёРїСѓ СЃРЅРёРјРєР°, РјРѕРґСѓР»СЊ РѕС‚РєР»РѕРЅСЏРµС‚ РµРіРѕ Рё РЅРµ РІРЅРѕСЃРёС‚ Р»РѕР¶РЅС‹Рµ РґР°РЅРЅС‹Рµ РІ С‡РµРє-Р»РёСЃС‚. РџРѕ РєРѕСЂСЂРµРєС‚РЅРѕРјСѓ С„РѕС‚Рѕ СЃРёСЃС‚РµРјР° РјРѕР¶РµС‚ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РѕРїСЂРµРґРµР»РёС‚СЊ РјР°С‚РµСЂРёР°Р» СЃС‚РµРЅ, С‚РёРї РїРѕС‚РѕР»РєР° Рё, РїСЂРё РґРѕСЃС‚Р°С‚РѕС‡РЅРѕР№ СѓРІРµСЂРµРЅРЅРѕСЃС‚Рё, РІС‹СЃРѕС‚Сѓ РїРѕРјРµС‰РµРЅРёСЏ.
                  </p>
                  <div className="ai-photo-prompt-grid">
                    {aiSurveyPlan.photoPrompts.map((prompt) => {
                      const analysis = technicalSolution?.photoAnalyses?.[prompt.id];
                      return (
                        <div className="ai-photo-card" key={prompt.id}>
                          <div className="ai-photo-card__head">
                            <div>
                              <strong>{prompt.title}</strong>
                              <span>{prompt.hint}</span>
                            </div>
                            <label className="ghost-btn file-upload-btn" htmlFor={`ai-photo-${prompt.id}`}>
                              <Camera size={14} /> Р—Р°РіСЂСѓР·РёС‚СЊ С„РѕС‚Рѕ
                            </label>
                            <input
                              id={`ai-photo-${prompt.id}`}
                              className="file-upload-input"
                              type="file"
                              accept="image/*"
                              onChange={async (event) => {
                                const file = event.target.files?.[0];
                                if (!file) return;
                                try {
                                  await analyzeAiSurveyPhoto(prompt, file);
                                } catch {
                                } finally {
                                  event.target.value = "";
                                  window.requestAnimationFrame(() => {
                                    setSurveyRefreshTick((prev) => prev + 1);
                                  });
                                }
                              }}
                            />
                          </div>

                          <div className={`address-status ${analysis?.state === "success" ? "success" : analysis?.state === "error" ? "error" : ""}`}>
                            {analysis?.summary || "РџРѕРєР° С„РѕС‚Рѕ РЅРµ Р·Р°РіСЂСѓР¶РµРЅРѕ. РСЃРїРѕР»СЊР·СѓР№С‚Рµ РїРѕРґСЃРєР°Р·РєСѓ СЃРїСЂР°РІР°, С‡С‚РѕР±С‹ Р·Р°РїРѕР»РЅРёС‚СЊ AI-РїРѕР»СЏ Р±С‹СЃС‚СЂРµРµ."}
                          </div>

                          {analysis?.state === "loading" ? (
                            <div className="hint-inline ai-photo-card__loading">
                              РРґРµС‚ AI-Р°РЅР°Р»РёР· С„РѕС‚Рѕ. РћРєРЅРѕ РѕР±СЃР»РµРґРѕРІР°РЅРёСЏ РѕСЃС‚Р°РµС‚СЃСЏ РѕС‚РєСЂС‹С‚С‹Рј, Р° СѓР¶Рµ РІРІРµРґРµРЅРЅС‹Рµ РѕС‚РІРµС‚С‹ РЅРµ С‚РµСЂСЏСЋС‚СЃСЏ.
                            </div>
                          ) : null}

                          {analysis?.detections?.length ? (
                            <div className="ai-detection-list">
                              {analysis.detections.map((item) => (
                                <span className={`pricing-source-chip ${analysis?.accepted === false ? "warn" : "ok"}`} key={`${prompt.id}-${item}`}>
                                  {item}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="ai-survey-modal__footer">
              <div className="hint-inline">
                Р”Р°Р»СЊРЅРµР№С€РёРµ Р°Р»РіРѕСЂРёС‚РјС‹ РїР»Р°С‚С„РѕСЂРјС‹ РёСЃРїРѕР»СЊР·СѓСЋС‚ С‚РѕР»СЊРєРѕ Р·Р°РіСЂСѓР¶РµРЅРЅС‹Рµ РґР°РЅРЅС‹Рµ РѕР±СЃР»РµРґРѕРІР°РЅРёСЏ. РџРѕСЃР»Рµ Р·Р°РіСЂСѓР·РєРё РѕРЅРё СѓС‡Р°СЃС‚РІСѓСЋС‚ РІ AI-С‚РµС…РЅРёС‡РµСЃРєРѕРј СЂРµС€РµРЅРёРё, РІ СЂР°СЃРїРѕР·РЅР°РІР°РЅРёРё Р·РѕРЅ РїРѕ РїР»Р°РЅРёСЂРѕРІРєР°Рј Рё РІ СЂР°СЃС‡РµС‚Рµ РїСЂРѕРµРєС‚РёСЂРѕРІР°РЅРёСЏ, Р° РїРѕРєР° РєРЅРѕРїРєР° РЅРµ РЅР°Р¶Р°С‚Р°, РёРЅС„РѕСЂРјР°С†РёСЏ РѕСЃС‚Р°РµС‚СЃСЏ С‡РµСЂРЅРѕРІРёРєРѕРј РІРЅСѓС‚СЂРё РѕРєРЅР°.
              </div>
              <button
                className="primary-btn"
                type="button"
                onClick={handleApplySurvey}
                disabled={(aiSurveyCompletion?.percent || 0) < 100}
              >
                <CheckCircle2 size={16} />
                Р—Р°РіСЂСѓР·РёС‚СЊ РґР°РЅРЅС‹Рµ
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
