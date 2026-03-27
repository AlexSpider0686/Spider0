import React, { useMemo, useState } from "react";
import { Plus, Trash2, Lock, Unlock, Search } from "lucide-react";
import { OBJECT_TYPES } from "../config/estimateConfig";
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

export default function ObjectStep({
  objectData,
  zones,
  recalculatedArea,
  zonePreset,
  setZonePreset,
  lockedZoneIds,
  zoneDistribution,
  inputValidation,
  updateObject,
  addZone,
  updateZone,
  removeZone,
  toggleZoneLock,
  updateZoneShare,
  applyZonePreset,
  setZones,
}) {
  const [regionQuery, setRegionQuery] = useState(objectData.regionName || "");
  const regionItems = useMemo(() => searchRegions(regionQuery).slice(0, 20), [regionQuery]);
  const selectedObjectType = OBJECT_TYPES.find((item) => item.value === objectData.objectType);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Объект</h2>
          <p>Тип, площадь, этажность, регион и зональная структура.</p>
        </div>
      </div>

      <div className="grid-two">
        <div className="input-card">
          <label>Название проекта</label>
          <input value={objectData.projectName} onChange={(event) => updateObject("projectName", event.target.value)} />
        </div>
        <div className="input-card">
          <label>Тип объекта</label>
          <div className="object-type-wrap">
            <select value={objectData.objectType} onChange={(event) => updateObject("objectType", event.target.value)}>
              {OBJECT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <div className="object-type-help" aria-hidden>
              ?
            </div>
            <div className="object-type-tooltip">
              {OBJECT_TYPES.map((item) => (
                <p key={item.value}>
                  <strong>{item.label}:</strong> {item.description}
                </p>
              ))}
            </div>
          </div>
          {selectedObjectType ? <small className="hint-inline">{selectedObjectType.description}</small> : null}
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

        <div className="input-card">
          <label>Площадь по объекту, м²</label>
          <input type="number" value={objectData.totalArea} onChange={(event) => updateObject("totalArea", toNumber(event.target.value))} />
        </div>

        <div className="input-card">
          <div className="label-with-tooltip">
            <label htmlFor="protected-zone-area">Защищаемая площадь зон, м²</label>
            <span
              className="label-tooltip-help"
              tabIndex={0}
              role="button"
              title="Пояснение к защищаемой площади зон"
              aria-label="Пояснение к защищаемой площади зон"
            >
              ?
            </span>
            <div className="label-tooltip-popover" role="tooltip">
              <p>
                <strong>Площадь по объекту</strong> - вся площадь здания или комплекса, даже если часть помещений не оснащается
                системами.
              </p>
              <p>
                <strong>Защищаемая площадь зон</strong> - сумма только тех зон, где реально размещаются и рассчитываются средства
                безопасности.
              </p>
            </div>
          </div>
          <input id="protected-zone-area" type="number" value={recalculatedArea} readOnly />
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
          <button className="ghost-btn" type="button" onClick={() => setZones((prev) => normalizeZoneAreas(prev, objectData.totalArea))}>
            Нормализовать
          </button>
        </div>

        <div className="slider-stack">
          {zones.map((zone) => {
            const zonePercent = objectData.totalArea > 0 ? (toNumber(zone.area) / toNumber(objectData.totalArea, 1)) * 100 : 0;
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
            Сумма процентов: <strong>{num(getZonePercentSum(zones, objectData.totalArea), 1)}%</strong>
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
    </section>
  );
}
