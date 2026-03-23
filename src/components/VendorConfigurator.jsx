import React from "react";
import { getVendorEquipment } from "../config/vendorConfig";

function BoolSelect({ value, onChange }) {
  return (
    <select value={String(Boolean(value))} onChange={(e) => onChange(e.target.value === "true")}>
      <option value="false">Нет</option>
      <option value="true">Да</option>
    </select>
  );
}

export default function VendorConfigurator({ system, onChange }) {
  const equipment = getVendorEquipment(system.type, system.vendor);
  if (!equipment) return null;

  const camera = equipment.camera;
  const sw = equipment.switch;

  return (
    <div className="equipment-config full">
      <div className="equipment-header">
        <strong>Параметрический конфигуратор оборудования</strong>
      </div>
      {equipment.note ? <p className="vendor-hint">{equipment.note}</p> : null}

      {camera && (
        <div className="grid-three">
          <div className="input-card">
            <label>Разрешение, Мп</label>
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
            <label>Уличная</label>
            <BoolSelect value={system.selectedEquipmentParams?.outdoor ?? false} onChange={(v) => onChange("outdoor", v)} />
          </div>
          <div className="input-card">
            <label>PTZ</label>
            <BoolSelect value={system.selectedEquipmentParams?.ptz ?? false} onChange={(v) => onChange("ptz", v)} />
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
