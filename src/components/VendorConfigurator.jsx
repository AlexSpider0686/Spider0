import React from "react";
import { getVendorEquipment } from "../config/vendorConfig";

function BoolSelect({ value, onChange, trueLabel = "Да", falseLabel = "Нет" }) {
  return (
    <select value={String(Boolean(value))} onChange={(e) => onChange(e.target.value === "true")}>
      <option value="false">{falseLabel}</option>
      <option value="true">{trueLabel}</option>
    </select>
  );
}

export default function VendorConfigurator({ system, onChange }) {
  const equipment = getVendorEquipment(system.type, system.vendor);
  if (!equipment) return null;

  const camera = equipment.camera;
  const sw = equipment.switch;
  const recorderChannels = Number(system.selectedEquipmentParams?.recorderChannels ?? camera?.recorderChannels?.[0] ?? 16);
  const hddTb = Number(system.selectedEquipmentParams?.hddTb ?? camera?.hddTb?.[0] ?? 8);
  const estimatedUnits = Math.max(Number(system.estimatedUnits || 0), 1);
  const bitrateByResolution = {
    2: 2,
    4: 4,
    8: 8,
  };
  const selectedResolution = Number(system.selectedEquipmentParams?.resolution ?? camera?.resolution?.[0] ?? 4);
  const targetBitrate = bitrateByResolution[selectedResolution] || 4;
  const minArchiveTb = Math.ceil(estimatedUnits * targetBitrate * 0.309);
  const recordersNeeded = Math.max(Math.ceil(estimatedUnits / Math.max(recorderChannels, 1)), 1);
  const availableArchiveTb = recordersNeeded * hddTb;

  return (
    <div className="equipment-config full">
      <div className="equipment-header">
        <strong>Параметрический конфигуратор оборудования</strong>
      </div>
      {equipment.note ? <p className="vendor-hint">{equipment.note}</p> : null}

      {camera && (
        <div className="grid-three">
          <div className="input-card">
            <label title="Разрешение камеры влияет на требуемую пропускную способность и объём архива.">Разрешение, Мп</label>
            <select value={system.selectedEquipmentParams?.resolution ?? camera.resolution[0]} onChange={(e) => onChange("resolution", Number(e.target.value))}>
              {camera.resolution.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="input-card">
            <label>Матрица</label>
            <select value={system.selectedEquipmentParams?.matrix ?? camera.matrix[0]} onChange={(e) => onChange("matrix", e.target.value)}>
              {camera.matrix.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="input-card">
            <label>Тип камеры</label>
            <select value={system.selectedEquipmentParams?.type ?? camera.type[0]} onChange={(e) => onChange("type", e.target.value)}>
              {camera.type.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="input-card">
            <label title="Уличные камеры обычно дороже и требуют более защищённого исполнения.">Размещение камеры</label>
            <BoolSelect
              value={system.selectedEquipmentParams?.outdoor ?? false}
              onChange={(v) => onChange("outdoor", v)}
              trueLabel="Уличные"
              falseLabel="Внутренние"
            />
          </div>
          <div className="input-card">
            <label>PTZ</label>
            <BoolSelect value={system.selectedEquipmentParams?.ptz ?? false} onChange={(v) => onChange("ptz", v)} />
          </div>
          <div className="input-card">
            <label title="Максимальное число камер на один регистратор.">Регистратор, каналов</label>
            <select
              value={recorderChannels}
              onChange={(e) => onChange("recorderChannels", Number(e.target.value))}
            >
              {(camera.recorderChannels || [8, 16, 32, 64]).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="input-card">
            <label title="Доступный объём дисков на один регистратор для хранения архива.">Объём HDD, ТБ</label>
            <select value={hddTb} onChange={(e) => onChange("hddTb", Number(e.target.value))}>
              {(camera.hddTb || [4, 8, 12, 16]).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="vendor-hint full" title="Оценка минимального архива для 30 дней по числу камер и выбранному разрешению.">
            Минимум для архива 30 дней: <strong>{minArchiveTb} ТБ</strong> (расчётно для {Math.round(estimatedUnits)} камер).
            {availableArchiveTb < minArchiveTb ? ` Текущее хранилище (${availableArchiveTb} ТБ) ниже минимума.` : " Хранилище покрывает 30 дней."}
          </div>
        </div>
      )}

      {sw && (
        <div className="grid-two">
          <div className="input-card">
            <label>Порты коммутатора</label>
            <select value={system.selectedEquipmentParams?.ports ?? sw.ports[0]} onChange={(e) => onChange("ports", Number(e.target.value))}>
              {sw.ports.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="input-card">
            <label>PoE</label>
            <BoolSelect value={system.selectedEquipmentParams?.poe ?? false} onChange={(v) => onChange("poe", v)} />
          </div>
        </div>
      )}
    </div>
  );
}
