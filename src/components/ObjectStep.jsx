import React from "react";
import { Plus, Trash2, Lock, Unlock } from "lucide-react";
import { ZONE_PRESETS, ZONE_TYPES } from "../config/zonesConfig";
import { RF_SUBJECTS, getRegionCoef } from "../config/regionsConfig";
import { getZonePercentSum, normalizeZoneAreas } from "../lib/zoneEngine";
import { num, toNumber } from "../lib/estimate";

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
  return (
    <section className="panel">
      <div className="panel-header"><div><h2>Объект</h2><p>Тип, площадь, характеристики объекта и зональная структура.</p></div></div>

      <div className="grid-two">
        <div className="input-card"><label>Название проекта</label><input value={objectData.projectName} onChange={(e) => updateObject("projectName", e.target.value)} /></div>
        <div className="input-card"><label>Тип объекта</label><input value={objectData.objectType} onChange={(e) => updateObject("objectType", e.target.value)} /></div>
        <div className="input-card">
          <label title="Субъект РФ используется для регионального коэффициента в расчёте трудозатрат и итоговой стоимости.">Субъект РФ</label>
          <input
            list="rf-subjects"
            value={objectData.region || ""}
            onChange={(e) => updateObject("region", e.target.value)}
            placeholder="Начните вводить регион..."
          />
          <datalist id="rf-subjects">
            {RF_SUBJECTS.map((item) => <option key={item.name} value={item.name} />)}
          </datalist>
          <small className="warn-inline">Коэффициент региона: x{num(getRegionCoef(objectData.region), 2)}</small>
        </div>
        <div className="input-card"><label title="Целевая общая площадь объекта, от которой считаются доли зон.">Площадь по объекту, м²</label><input type="number" value={objectData.totalArea} onChange={(e) => updateObject("totalArea", toNumber(e.target.value))} /></div>
        <div className="input-card"><label title="Фактическая сумма площадей всех зон. Может отличаться от площади по объекту до нормализации.">Площадь по зонам, м²</label><input type="number" value={recalculatedArea} readOnly /></div>
        <div className="input-card"><label>Надземные этажи</label><input type="number" value={objectData.floors} onChange={(e) => updateObject("floors", toNumber(e.target.value))} /></div>
        <div className="input-card"><label>Подземные этажи</label><input type="number" value={objectData.basementFloors} onChange={(e) => updateObject("basementFloors", toNumber(e.target.value))} /></div>
      </div>

      <div className="subpanel">
        <div className="subpanel-header">
          <div><h3>Распределение зон</h3><p>Сумма зон всегда 100%.</p></div>
          <button className="primary-btn" onClick={addZone} type="button"><Plus size={16} />Добавить зону</button>
        </div>

        <div className="preset-row">
          <select value={zonePreset} onChange={(e) => setZonePreset(e.target.value)}>
            {Object.entries(ZONE_PRESETS).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}
          </select>
          <button className="ghost-btn" type="button" title="Заполнить зоны типовым распределением для выбранного типа объекта." onClick={() => applyZonePreset(zonePreset)}>Применить пресет</button>
          <button className="ghost-btn" type="button" title="Пропорционально пересчитать площади зон, чтобы их сумма стала равна площади по объекту." onClick={() => setZones((prev) => normalizeZoneAreas(prev, objectData.totalArea))}>Нормализовать</button>
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
                      {isLocked ? <Lock size={14} /> : <Unlock size={14} />} {isLocked ? "Зафиксирована" : "Свободна"}
                    </button>
                  </div>
                  <span>{num(zonePercent, 1)}%</span>
                </div>
                <input type="range" min={0} max={100} step={0.5} value={Math.max(0, Math.min(100, zonePercent))} onChange={(e) => updateZoneShare(zone.id, toNumber(e.target.value))} className="zone-slider" disabled={isLocked} />
                <div className="zone-grid" style={{ marginTop: 8 }}>
                  <div className="input-card"><label>Название зоны</label><input value={zone.name} onChange={(e) => updateZone(zone.id, "name", e.target.value)} /></div>
                  <div className="input-card"><label>Тип зоны</label><select value={zone.type} onChange={(e) => updateZone(zone.id, "type", e.target.value)}>{ZONE_TYPES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></div>
                  <div className="input-card"><label>Площадь, м²</label><input type="number" value={zone.area} onChange={(e) => updateZone(zone.id, "area", toNumber(e.target.value))} /></div>
                  <div className="input-card"><label>Этажей</label><input type="number" value={zone.floors} onChange={(e) => updateZone(zone.id, "floors", toNumber(e.target.value))} /></div>
                  <div className="action-cell"><button className="danger-btn" type="button" onClick={() => removeZone(zone.id)} disabled={zones.length <= 1}><Trash2 size={16} />Удалить</button></div>
                </div>
              </div>
            );
          })}
          <div className="slider-total">
            Сумма процентов: <strong>{num(getZonePercentSum(zones, objectData.totalArea), 1)}%</strong>
            {!zoneDistribution.isValid && <span className="warn-inline"> Проверь распределение (должно быть 100%).</span>}
          </div>
        </div>
      </div>
    </section>
  );
}
