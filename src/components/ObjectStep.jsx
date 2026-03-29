import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Lock, Unlock, Search, ClipboardList, Camera, CheckCircle2, RefreshCcw, X } from "lucide-react";
import { OBJECT_TYPES, SYSTEM_TYPES } from "../config/estimateConfig";
import { BUILDING_STATUS_OPTIONS } from "../config/costModelConfig";
import { searchRegions } from "../config/regionsConfig";
import { ZONE_PRESET_DETAILS, ZONE_PRESETS, ZONE_TYPES } from "../config/zonesConfig";
import { hasProjectForSystem } from "../lib/designSurveyEngine";
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

function renderChecklistInput(question, value, onChange, options = {}) {
  const disabled = options.disabled === true;
  if (question.type === "boolean") {
    return (
      <div className="ai-checklist-bool">
        <button type="button" className={`chip-btn ${value === true ? "active" : ""}`} onClick={() => onChange(true)} disabled={disabled}>
          Да
        </button>
        <button type="button" className={`chip-btn ${value === false ? "active" : ""}`} onClick={() => onChange(false)} disabled={disabled}>
          Нет
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
        placeholder={question.placeholder || "Введите значение"}
        disabled={disabled}
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
              disabled={disabled}
              onClick={() => onChange(active ? selected.filter((item) => item !== option) : [...selected, option])}
            >
              {option}
            </button>
          );
        })}
      </div>
    );
  }

  return <input value={value ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} />;
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
  apsProjectSnapshots,
  technicalSolution,
  aiSurveyPlan,
  aiSurveyCompletion,
  appliedAiSurveyCompletion,
  startAiSurvey,
  updateAiSurveyAnswer,
  analyzeAiSurveyPhoto,
  refreshAiSurveyPhoto,
  applyAiSurveyData,
  resetAiSurveySection,
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
  const photoPromptIdsBySection = useMemo(() => {
    const promptMap = {};

    (aiSurveyPlan?.sections || []).forEach((section) => {
      const zoneIds = new Set(section.questions.map((question) => question.zoneId).filter(Boolean));
      const systemTypes = new Set(section.questions.map((question) => question.systemType).filter(Boolean));

      promptMap[section.id] = (aiSurveyPlan?.photoPrompts || [])
        .filter((prompt) => {
          if (prompt.sectionId && prompt.sectionId === section.id) return true;
          if (prompt.zoneId && zoneIds.has(prompt.zoneId)) return true;
          if (prompt.systemType && systemTypes.has(prompt.systemType)) return true;
          return false;
        })
        .map((prompt) => prompt.id);
    });

    return promptMap;
  }, [aiSurveyPlan]);

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

  const handleResetSurveySection = (section) => {
    const questionIds = (section?.questions || []).map((question) => question.id);
    const photoPromptIds = photoPromptIdsBySection[section.id] || [];
    const didReset = resetAiSurveySection?.(section.id, questionIds, photoPromptIds);
    if (didReset) {
      window.requestAnimationFrame(() => {
        setSurveyRefreshTick((prev) => prev + 1);
      });
    }
  };

  const isQuestionEnabled = (question) => {
    if (!question?.enabledByQuestionId) return true;
    return technicalSolution?.answers?.[question.enabledByQuestionId] === true;
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Объект</h2>
          <p>Тип, площадь, этажность, регион и зональная структура.</p>
        </div>
      </div>

      <div className="object-top-grid">
        <div className="input-card address-card">
          <label>Адрес объекта</label>
          <div className="region-search-row">
            <Search size={14} />
            <input
              type="text"
              value={objectData.address || ""}
              placeholder="Город, улица, дом"
              onChange={(event) => updateObject("address", event.target.value)}
            />
          </div>
          <div className="address-actions">
            <button className="primary-btn" type="button" onClick={verifyObjectAddress} disabled={addressVerification?.state === "loading"}>
              {addressVerification?.state === "loading" ? "Проверка адреса..." : "Проверить адрес"}
            </button>
            <small className="hint-inline">
              Можно вводить адрес в свободной форме. Алгоритм найдёт его онлайн и приведёт к корректной записи.
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
                  Район: {addressVerification.result.district || "не определён"} | Регион:{" "}
                  {addressVerification.result.regionName || objectData.regionName}
                </span>
                <span>Нормализованный адрес подставлен в поле выше и используется в дальнейших расчётах.</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="object-side-stack">
          <div className="input-card">
            <label>Название проекта</label>
            <input value={objectData.projectName} onChange={(event) => updateObject("projectName", event.target.value)} />
          </div>

          <div className="input-card">
            <label>Тип объекта</label>
            <input value={selectedObjectType?.label || "Не выбран"} readOnly className="readonly-field" />
            {selectedObjectType ? <small className="hint-inline">{selectedObjectType.description}</small> : null}
            <small className="hint-inline">Тип выбирается кнопками-карточками ниже.</small>
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
          <label>Площадь по объекту, м²</label>
          <input type="number" value={objectData.totalArea} onChange={(event) => updateObject("totalArea", toNumber(event.target.value))} />
        </div>

        <div className="input-card">
          <div className="label-with-tooltip">
            <label htmlFor="protected-zone-area">Защищаемая площадь, м²</label>
            <span
              className="label-tooltip-help"
              tabIndex={0}
              role="button"
              title="Логика расчета защищаемой площади"
              aria-label="Логика расчета защищаемой площади"
            >
              ?
            </span>
            <div className="label-tooltip-popover" role="tooltip">
              <p>
                <strong>Итог:</strong> защищаемая площадь = площадь объекта x {num((protectedAreaMeta?.protectionShare || 0) * 100, 1)}%.
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
          <small className="hint-inline">Поле рассчитывается автоматически по параметрам объекта.</small>
        </div>

        <div className="input-card">
          <label>Надземные этажи</label>
          <input type="number" value={objectData.floors} onChange={(event) => updateObject("floors", toNumber(event.target.value))} />
        </div>

        <div className="input-card">
          <label>Подземные этажи</label>
          <input
            type="number"
            value={objectData.basementFloors}
            onChange={(event) => updateObject("basementFloors", toNumber(event.target.value))}
          />
        </div>

        <div className="input-card">
          <label>Статус здания</label>
          <select value={objectData.buildingStatus || "operational"} onChange={(event) => updateObject("buildingStatus", event.target.value)}>
            {BUILDING_STATUS_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <small className="hint-inline">
            Коэффициент работ в эксплуатируемых зданиях:{" "}
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
          <label>Субъект РФ</label>
          <div className="region-search-row">
            <Search size={14} />
            <input
              type="text"
              value={regionQuery}
              placeholder="Начните вводить субъект РФ"
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
            Региональный коэффициент: <strong>x{num(objectData.regionCoef, 2)}</strong>
          </small>
        </div>
      </div>

      <div className="subpanel">
        <div className="subpanel-header">
          <div>
            <h3>Распределение зон</h3>
            <p>Сумма долей зон всегда должна быть 100%.</p>
          </div>
          <button className="primary-btn" onClick={addZone} type="button">
            <Plus size={16} />
            Добавить зону
          </button>
        </div>

        <div className="preset-row">
          <div className="label-with-tooltip">
            <label htmlFor="zone-preset-select">Шаблон распределения зон</label>
            <span
              className="label-tooltip-help"
              tabIndex={0}
              role="button"
              title="Пояснение к шаблонам распределения зон"
              aria-label="Пояснение к шаблонам распределения зон"
            >
              ?
            </span>
            <div className="label-tooltip-popover" role="tooltip">
              <p>
                <strong>Это меню</strong> подставляет типовое распределение зон для быстрого старта расчета.
              </p>
              <p>
                <strong>Влияние на смету:</strong> пресет меняет плотность оборудования, длину трасс и трудоемкость монтажа.
              </p>
              {Object.entries(ZONE_PRESETS).map(([key, preset]) => (
                <p key={key}>
                  <strong>{preset.label}</strong> - {ZONE_PRESET_DETAILS[key]?.summary || "Типовой сценарий распределения зон для укрупненного расчета."}
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
            Применить пресет
          </button>
          <button className="ghost-btn" type="button" onClick={() => setZones((prev) => normalizeZoneAreas(prev, recalculatedArea))}>
            Нормализовать
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
                      {isLocked ? "Зафиксирована" : "Свободна"}
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
                    <label>Название зоны</label>
                    <input value={zone.name} onChange={(event) => updateZone(zone.id, "name", event.target.value)} />
                  </div>
                  <div className="input-card">
                    <label>Тип зоны</label>
                    <select value={zone.type} onChange={(event) => updateZone(zone.id, "type", event.target.value)}>
                      {ZONE_TYPES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="input-card">
                    <label>Площадь, м²</label>
                    <input type="number" value={zone.area} onChange={(event) => updateZone(zone.id, "area", toNumber(event.target.value))} />
                  </div>
                  <div className="input-card">
                    <label>Этажей</label>
                    <input type="number" value={zone.floors} onChange={(event) => updateZone(zone.id, "floors", toNumber(event.target.value))} />
                  </div>
                  <div className="action-cell">
                    <button className="danger-btn" type="button" onClick={() => removeZone(zone.id)} disabled={zones.length <= 1}>
                      <Trash2 size={16} />
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="slider-total">
            Сумма процентов: <strong>{num(getZonePercentSum(zones, recalculatedArea), 1)}%</strong>
            {!zoneDistribution.isValid ? <span className="warn-inline"> Проверь распределение (должно быть 100%).</span> : null}
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
            <h3>AI-Техническое решение: обследование объекта</h3>
            <p>Модуль запускается как отдельное внутреннее окно после заполнения обязательных данных по объекту. Собранная внутри него информация используется и для AI-технического решения, и для более точного расчета стоимости проектирования по системам без проекта.</p>
          </div>
          <button className="primary-btn" type="button" onClick={handleOpenSurvey} disabled={!aiSurveyPlan?.readiness?.isReady}>
            <ClipboardList size={16} />
            Начать AI-обследование
          </button>
        </div>

        <div className="ai-survey-summary-grid">
          <div className="metric-card">
            <span>Расчетное время обследования</span>
            <strong>{num(aiSurveyPlan?.estimatedHours || 0, 1)} ч</strong>
          </div>
          <div className="metric-card">
            <span>Заполнение чек-листа</span>
            <strong>{aiSurveyCompletion?.percent || 0}%</strong>
          </div>
          <div className="metric-card">
            <span>Загружено в платформу</span>
            <strong>{appliedAiSurveyCompletion?.percent || 0}%</strong>
          </div>
          <div className="metric-card">
            <span>Систем в обследовании</span>
            <strong>{num(aiSurveyPlan?.activeSystems?.length || 0, 0)}</strong>
          </div>
          <div className="metric-card">
            <span>Статус модуля</span>
            <strong>{technicalSolution?.appliedAt ? "Данные загружены" : technicalSolution?.surveyStartedAt ? "Черновик заполнения" : "Не запускалось"}</strong>
          </div>
        </div>

        <div className="ai-system-registry">
          <div className="calc-explain">
            <h4>Реестр инженерных систем</h4>
            <p className="hint-inline">
              Выберите, какие системы входят в объект. Если по системе уже есть РД или загружен проект, полный чек-лист по ней не формируется, а стоимость проектирования по такой системе далее не рассчитывается.
            </p>
          </div>

          <div className="ai-system-registry__grid">
            {SYSTEM_TYPES.map((systemType) => {
              const enabled = activeSystemTypes.has(systemType.code);
              const currentSystem = (systems || []).find((item) => item.type === systemType.code);
              const projectSnapshot = currentSystem?.id ? apsProjectSnapshots?.[currentSystem.id] : null;
              const projectInPlace = hasProjectForSystem(currentSystem, projectSnapshot);
              const uploadedProjectInPlace = Boolean(projectSnapshot?.active);
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
                      <small>{enabled ? "Система включена в проект" : "Система пока не выбрана"}</small>
                    </span>
                  </label>

                  <label className={`ai-working-docs ${enabled ? "" : "disabled"}`}>
                    <input
                      type="checkbox"
                      checked={projectInPlace}
                      onChange={(event) => updateSystemWorkingDocs(currentSystem?.id, event.target.checked)}
                      disabled={!enabled || !currentSystem?.id || uploadedProjectInPlace}
                    />
                    <span>Наличие РД (проекта)</span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`address-status ${aiSurveyPlan?.readiness?.isReady ? "success" : "error"}`}>
          {aiSurveyPlan?.readiness?.isReady
            ? "Обязательные данные заполнены. Можно запускать AI-обследование."
            : "AI-Обследование будет активировано после 100% заполнения обязательных полей."}
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
            <h4>Статус этапа</h4>
            <div className="ai-summary-list">
              <div>
                <CheckCircle2 size={16} />
                <span>
                  Опросник уже создан. Если закрыть внутреннее окно и открыть его снова, все ответы и результаты фотоанализа останутся внутри текущей сессии платформы.
                </span>
              </div>
              <div>
                <CheckCircle2 size={16} />
                <span>
                  Охват: объект, {zones.length} зон и системы: {(aiSurveyPlan?.activeSystems || []).map((code) => systemNames[code] || code).join(", ") || "не выбраны"}.
                </span>
              </div>
              {(aiSurveyPlan?.skippedSystems || []).length ? (
                <div>
                  <CheckCircle2 size={16} />
                  <span>
                    С чек-листа исключены системы с проектом: {aiSurveyPlan.skippedSystems.map((code) => systemNames[code] || code).join(", ")}. Для них на вкладке проектирования будет показано, что стоимость не рассчитывается.
                  </span>
                </div>
              ) : null}
              {technicalSolution?.appliedAt ? (
                <div>
                  <CheckCircle2 size={16} />
                  <span>Последняя загрузка данных из окна обследования уже выполнена, и эти данные участвуют в дальнейшем подборе решений и в расчете стоимости проектирования.</span>
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
          aria-label="AI-обследование объекта"
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
                <h3>AI-Обследование объекта</h3>
                <p>
                  Отдельное внутреннее окно обследования. Данные внутри него сохраняются в течение текущей сессии платформы, даже если вы закроете окно и откроете его снова, а после загрузки влияют и на техническое решение, и на стоимость проектирования.
                </p>
              </div>
              <button className="ghost-btn ai-survey-modal__close" type="button" onClick={handleSurveyModalClose}>
                <X size={16} /> Закрыть
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
                      <span className="pricing-source-chip muted">{section.questions.length} вопросов</span>
                      <button className="ghost-btn ai-checklist-reset-btn" type="button" onClick={() => handleResetSurveySection(section)}>
                        <Trash2 size={14} />
                        Сброс
                      </button>
                    </div>

                    <div className="ai-checklist-grid">
                      {section.questions.map((question) => {
                        const enabled = isQuestionEnabled(question);
                        return (
                          <div className={`input-card ai-checklist-question ${enabled ? "" : "disabled"}`} key={question.id}>
                            <label>
                              {question.label}
                              {question.aiAutofill ? <span className="ai-inline-mark">AI</span> : null}
                            </label>
                            {renderChecklistInput(
                              question,
                              technicalSolution?.answers?.[question.id],
                              (value) => updateAiSurveyAnswer(question.id, value),
                              { disabled: !enabled }
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {(aiSurveyPlan?.photoPrompts || []).length ? (
                <div className="calc-explain ai-photo-prompt-block">
                  <h4>Интеллектуальная фотофиксация</h4>
                  <p className="hint-inline">
                    AI-подсказки формируются по зонам. Для СОТС, СОУЭ и АПС можно загружать сразу группу планов эвакуации по этажам: модуль распознает их вместе, считает охранные зоны, зоны оповещения и ЗКСПС, сверяет количество планов с этажностью, а недостающие этажи достраивает прогнозом по данным объекта. Фото плана с пригодностью ниже 50% автоматически отклоняются с пояснением, что нужно исправить.
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
                              <Camera size={14} /> Загрузить фото
                            </label>
                            <button
                              className="ghost-btn ai-photo-refresh-btn"
                              type="button"
                              onClick={async () => {
                                try {
                                  await refreshAiSurveyPhoto(prompt);
                                } catch {
                                } finally {
                                  window.requestAnimationFrame(() => {
                                    setSurveyRefreshTick((prev) => prev + 1);
                                  });
                                }
                              }}
                              disabled={!analysis?.sourceFiles?.length}
                            >
                              <RefreshCcw size={14} /> Обновить
                            </button>
                            <input
                              id={`ai-photo-${prompt.id}`}
                              className="file-upload-input"
                              type="file"
                              accept="image/*"
                              multiple={prompt.type === "evacuation_plan"}
                              onChange={async (event) => {
                                const files = Array.from(event.target.files || []);
                                if (!files.length) return;
                                try {
                                  await analyzeAiSurveyPhoto(prompt, files);
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
                            {analysis?.summary || "Пока фото не загружено. Используйте подсказку справа, чтобы заполнить AI-поля быстрее."}
                          </div>

                          {analysis?.state === "loading" ? (
                            <div className="hint-inline ai-photo-card__loading">
                              Идет AI-анализ фото. Окно обследования остается открытым, а уже введенные ответы не теряются.
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

                          {analysis?.planRecognition?.warnings?.length ? (
                            <div className="ai-summary-list" style={{ marginTop: 10 }}>
                              {analysis.planRecognition.warnings.map((warning) => (
                                <div key={`${prompt.id}-${warning.message}`}>
                                  <X size={16} />
                                  <span>{warning.message}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {analysis?.planRecognition?.areaComparison ? (
                            <div className="ai-summary-list" style={{ marginTop: 10 }}>
                              <div>
                                <CheckCircle2 size={16} />
                                <span>
                                  Площадь пользователя: {analysis.planRecognition.areaComparison.userTotalArea} м². По планировкам/фото:
                                  {" "}{analysis.planRecognition.areaComparison.predictedTotalArea} м².
                                </span>
                              </div>
                              <div>
                                <CheckCircle2 size={16} />
                                <span>
                                  Средняя расчетная площадь этажа: {analysis.planRecognition.areaComparison.recognizedAverageFloorArea} м².
                                  Отклонение: {analysis.planRecognition.areaComparison.deviationPercent}%.
                                </span>
                              </div>
                            </div>
                          ) : null}

                          {analysis?.planRecognition?.deepVision ? (
                            <div className="ai-summary-list" style={{ marginTop: 10 }}>
                              <div>
                                <CheckCircle2 size={16} />
                                <span>
                                  Deep OCR/segmentation: текстовых блоков {analysis.planRecognition.deepVision.textBlocks?.length || 0}, помещений{" "}
                                  {analysis.planRecognition.deepVision.segmentation?.roomCount || 0}, коридоров{" "}
                                  {analysis.planRecognition.deepVision.segmentation?.corridorCount || 0}, лестничных клеток{" "}
                                  {analysis.planRecognition.deepVision.segmentation?.stairCount || 0}.
                                </span>
                              </div>
                              <div>
                                <CheckCircle2 size={16} />
                                <span>
                                  Масштаб плана:{" "}
                                  {analysis.planRecognition.deepVision.scaleHint?.drawingScale
                                    ? `1:${analysis.planRecognition.deepVision.scaleHint.drawingScale}`
                                    : "не найден автоматически"}
                                  . OCR-уверенность: {analysis.planRecognition.deepVision.quality?.ocrConfidence || 0}.
                                </span>
                              </div>
                            </div>
                          ) : null}

                          {analysis?.planRecognition?.systems?.length ? (
                            <div className="ai-summary-list" style={{ marginTop: 10 }}>
                              <div>
                                <CheckCircle2 size={16} />
                                <span>
                                  Принято планов: {analysis.planRecognition.uploadedPlans || analysis.planRecognition.floorPlansAccepted || 0} из{" "}
                                  {analysis.planRecognition.expectedFloorCount || 0}. Прогноз недостающих этажей:{" "}
                                  {analysis.planRecognition.forecastedFloors || 0}.
                                </span>
                              </div>
                              {analysis.planRecognition.systems.flatMap((systemPlan) => {
                                const headline = (
                                  <div key={`${prompt.id}-${systemPlan.systemType}-headline`}>
                                    <CheckCircle2 size={16} />
                                    <span>
                                      {systemPlan.systemLabel}: в среднем {systemPlan.averageZonesPerFloor || systemPlan.zoneCount} {systemPlan.zoneTerm} на этаж
                                      {systemPlan.forecastZoneCount ? `, прогноз по недостающим этажам ${systemPlan.forecastZoneCount}` : ""}.
                                    </span>
                                  </div>
                                );
                                const preview = (systemPlan.zones || []).slice(0, 3).map((zoneItem) => (
                                  <div key={`${prompt.id}-${systemPlan.systemType}-${zoneItem.code}`}>
                                    <CheckCircle2 size={16} />
                                    <span>
                                      {systemPlan.systemLabel}: {zoneItem.name}
                                    </span>
                                  </div>
                                ));
                                return [headline, ...preview];
                              })}
                            </div>
                          ) : null}

                          {analysis?.fileResults?.length ? (
                            <div className="ai-summary-list" style={{ marginTop: 10 }}>
                              {analysis.fileResults.map((fileResult) => (
                                <div key={`${prompt.id}-${fileResult.floorIndex}-${fileResult.fileName}`}>
                                  <CheckCircle2 size={16} />
                                  <span>
                                    {fileResult.floorLabel || `Этаж/план ${fileResult.floorIndex}`}: {fileResult.fileName} -{" "}
                                    {fileResult.accepted ? "принят" : "отклонен"}.
                                  </span>
                                </div>
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
                Дальнейшие алгоритмы платформы используют только загруженные данные обследования. После загрузки они участвуют в AI-техническом решении и в расчете проектирования, а пока кнопка не нажата, информация остается черновиком внутри окна.
              </div>
              <button
                className="primary-btn"
                type="button"
                onClick={handleApplySurvey}
                disabled={(aiSurveyCompletion?.percent || 0) < 100}
              >
                <CheckCircle2 size={16} />
                Загрузить данные
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
