import React from "react";
import { getVendorEquipment } from "../config/vendorConfig";

function renderOptions(items) {
  return items.map((item) => (
    <option key={String(item)} value={item}>
      {String(item)}
    </option>
  ));
}

export default function VendorConfigurator({ system, onChange }) {
  const equipment = getVendorEquipment(system.type, system.vendor);
  if (!equipment) return null;

  return (
    <div className="equipment-config">
      <div className="equipment-header">
        <strong>Параметры ключевого оборудования</strong>
      </div>
      {equipment.note ? <p className="hint-inline">{equipment.note}</p> : null}

      <div className="equipment-config-grid">
        {equipment.camera ? (
          <>
            <div className="input-card">
              <label>Камеры (уличные / внутренние)</label>
              <select
                value={system.selectedEquipmentParams?.cameraPlacement ?? equipment.camera.placement[0]}
                onChange={(event) => onChange("cameraPlacement", event.target.value)}
              >
                {renderOptions(equipment.camera.placement)}
              </select>
            </div>
            <div className="input-card">
              <label>Разрешение камер, Мп</label>
              <select
                value={system.selectedEquipmentParams?.cameraResolution ?? equipment.camera.resolution[1] ?? equipment.camera.resolution[0]}
                onChange={(event) => onChange("cameraResolution", Number(event.target.value))}
              >
                {renderOptions(equipment.camera.resolution)}
              </select>
            </div>
          </>
        ) : null}

        {equipment.recorder ? (
          <div className="input-card">
            <label>Регистратор (на сколько каналов)</label>
            <select
              value={system.selectedEquipmentParams?.recorderChannels ?? equipment.recorder.channels[2] ?? equipment.recorder.channels[0]}
              onChange={(event) => onChange("recorderChannels", Number(event.target.value))}
            >
              {renderOptions(equipment.recorder.channels)}
            </select>
          </div>
        ) : null}

        {equipment.hdd ? (
          <div className="input-card">
            <label>Объём HDD (минимум для архива 30 дней), ТБ</label>
            <select
              value={system.selectedEquipmentParams?.hddTb ?? equipment.hdd.tb[1] ?? equipment.hdd.tb[0]}
              onChange={(event) => onChange("hddTb", Number(event.target.value))}
            >
              {renderOptions(equipment.hdd.tb)}
            </select>
          </div>
        ) : null}

        {equipment.switch ? (
          <>
            <div className="input-card">
              <label>Коммутаторы (порты)</label>
              <select
                value={system.selectedEquipmentParams?.switchPorts ?? equipment.switch.ports[2] ?? equipment.switch.ports[0]}
                onChange={(event) => onChange("switchPorts", Number(event.target.value))}
              >
                {renderOptions(equipment.switch.ports)}
              </select>
            </div>
            <div className="input-card">
              <label>Коммутаторы (с PoE или без)</label>
              <select
                value={String(system.selectedEquipmentParams?.switchPoe ?? true)}
                onChange={(event) => onChange("switchPoe", event.target.value === "true")}
              >
                <option value="true">PoE</option>
                <option value="false">Без PoE</option>
              </select>
            </div>
          </>
        ) : null}

        {equipment.controller ? (
          <div className="input-card">
            <label>Контроллер (точек доступа)</label>
            <select
              value={system.selectedEquipmentParams?.controllerChannels ?? equipment.controller.channels[0]}
              onChange={(event) => onChange("controllerChannels", Number(event.target.value))}
            >
              {renderOptions(equipment.controller.channels)}
            </select>
          </div>
        ) : null}

        {equipment.sensor ? (
          <div className="input-card">
            <label>Тип охранного датчика</label>
            <select
              value={system.selectedEquipmentParams?.sensorKind ?? equipment.sensor.kind[0]}
              onChange={(event) => onChange("sensorKind", event.target.value)}
            >
              {renderOptions(equipment.sensor.kind)}
            </select>
          </div>
        ) : null}

        {equipment.detector ? (
          <div className="input-card">
            <label>Тип пожарного извещателя</label>
            <select
              value={system.selectedEquipmentParams?.detectorKind ?? equipment.detector.kind[0]}
              onChange={(event) => onChange("detectorKind", event.target.value)}
            >
              {renderOptions(equipment.detector.kind)}
            </select>
          </div>
        ) : null}

        {equipment.panel ? (
          <div className="input-card">
            <label>Панель / ППКП (шлейфы)</label>
            <select
              value={system.selectedEquipmentParams?.panelLoops ?? equipment.panel.loops[1] ?? equipment.panel.loops[0]}
              onChange={(event) => onChange("panelLoops", Number(event.target.value))}
            >
              {renderOptions(equipment.panel.loops)}
            </select>
          </div>
        ) : null}

        {equipment.speaker ? (
          <div className="input-card">
            <label>Оповещатели СОУЭ (тип)</label>
            <select
              value={system.selectedEquipmentParams?.speakerKind ?? equipment.speaker.kind[0]}
              onChange={(event) => onChange("speakerKind", event.target.value)}
            >
              {renderOptions(equipment.speaker.kind)}
            </select>
          </div>
        ) : null}

        {equipment.amplifier ? (
          <div className="input-card">
            <label>Усилитель СОУЭ (каналы)</label>
            <select
              value={system.selectedEquipmentParams?.amplifierChannels ?? equipment.amplifier.channels[1] ?? equipment.amplifier.channels[0]}
              onChange={(event) => onChange("amplifierChannels", Number(event.target.value))}
            >
              {renderOptions(equipment.amplifier.channels)}
            </select>
          </div>
        ) : null}
      </div>
    </div>
  );
}
