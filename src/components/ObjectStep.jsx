import React, { useMemo, useState } from "react";
import { Plus, Trash2, Lock, Unlock, Search } from "lucide-react";
import { OBJECT_TYPES } from "../config/estimateConfig";
import { searchRegions } from "../config/regionsConfig";
import { ZONE_PRESETS, ZONE_TYPES } from "../config/zonesConfig";
import { getZonePercentSum, normalizeZoneAreas } from "../lib/zoneEngine";
import { num, toNumber } from "../lib/estimate";

const OBJECT_TYPE_IMAGES = {
  production: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1600&q=80",
  warehouse: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1600&q=80",
  public: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80",
  residential: "https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1600&q=80",
  transport: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1600&q=80",
  energy: "https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1600&q=80",
};

export default function ObjectStep({
  objectData,
  zones,
  recalculatedArea,
  zonePreset,
  setZonePreset,
  lockedZoneIds,
  zoneDistribution,
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
                <img src={OBJECT_TYPE_IMAGES[item.value]} alt={item.label} loading="lazy" />
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
          <label>Площадь по зонам, м²</label>
          <input type="number" value={recalculatedArea} readOnly />
        </div>
        <div className="input-card">
          <label>Надземные этажи</label>
          <input type="number" value={objectData.floors} onChange={(event) => updateObject("floors", toNumber(event.target.value))} />
        </div>
        <div className="input-card">
          <label>Подземные этажи</label>
          <input type="number" value={objectData.basementFloors} onChange={(event) => updateObject("basementFloors", toNumber(event.target.value))} />
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
          <select value={zonePreset} onChange={(event) => setZonePreset(event.target.value)}>
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
      </div>
    </section>
  );
}
