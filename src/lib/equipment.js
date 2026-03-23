import { toNumber } from "./estimate";
import { getVendorEquipment } from "../config/vendorConfig";

function getAreaUnits(zones) {
  const safeArea = zones.reduce((sum, zone) => sum + Math.max(toNumber(zone.area), 0), 0);
  return Math.max(safeArea / 1000, 1);
}

function getValue(input, fallback) {
  return input === undefined || input === null || input === "" ? fallback : input;
}

export function calculateEquipment(system, zones, selectedParams = {}, fallbackUnitPrice = 0) {
  const areaUnits = getAreaUnits(zones);
  const vendorMeta = getVendorEquipment(system.type, system.vendor);

  if (!vendorMeta) {
    return {
      units: areaUnits,
      unitPrice: fallbackUnitPrice,
      totalEquipmentCost: fallbackUnitPrice * areaUnits,
      selectionKey: "fallback",
      mode: "fallback",
      details: [],
    };
  }

  const details = [];
  let totalEquipmentCost = 0;
  let normalizedUnits = areaUnits;

  if (vendorMeta.camera) {
    const placement = getValue(selectedParams.cameraPlacement, vendorMeta.camera.placement[0]);
    const resolution = Number(getValue(selectedParams.cameraResolution, vendorMeta.camera.resolution[1] || vendorMeta.camera.resolution[0]));
    const cameraKey = `${placement}_${resolution}`;
    const cameraUnitPrice = vendorMeta.camera.basePrices[cameraKey] || fallbackUnitPrice;
    const cameraQty = Math.max(Math.round(areaUnits * 6.5), 1);
    totalEquipmentCost += cameraQty * cameraUnitPrice;
    normalizedUnits = cameraQty;
    details.push({
      code: "CAM",
      name: `Камеры (${placement}, ${resolution} Мп)`,
      qty: cameraQty,
      unitPrice: cameraUnitPrice,
      total: cameraQty * cameraUnitPrice,
      basis: "Количество камер рассчитывается по плотности на 1000 м² с учётом типа системы.",
    });
  }

  if (vendorMeta.recorder) {
    const recorderChannels = Number(getValue(selectedParams.recorderChannels, vendorMeta.recorder.channels[2] || vendorMeta.recorder.channels[0]));
    const recorderUnitPrice = vendorMeta.recorder.basePrices[recorderChannels] || fallbackUnitPrice;
    const cameraQty = details.find((item) => item.code === "CAM")?.qty || Math.max(Math.round(areaUnits * 6), 1);
    const recorderQty = Math.max(Math.ceil(cameraQty / Math.max(recorderChannels, 1)), 1);
    totalEquipmentCost += recorderQty * recorderUnitPrice;
    details.push({
      code: "NVR",
      name: `Регистратор (${recorderChannels} каналов)`,
      qty: recorderQty,
      unitPrice: recorderUnitPrice,
      total: recorderQty * recorderUnitPrice,
      basis: "Количество регистраторов = число камер / ёмкость регистратора с округлением вверх.",
    });
  }

  if (vendorMeta.hdd) {
    const hddTb = Number(getValue(selectedParams.hddTb, vendorMeta.hdd.tb[1] || vendorMeta.hdd.tb[0]));
    const hddUnitPrice = vendorMeta.hdd.basePrices[hddTb] || fallbackUnitPrice;
    const recorderQty = details.find((item) => item.code === "NVR")?.qty || 1;
    const hddQty = recorderQty * 2;
    totalEquipmentCost += hddQty * hddUnitPrice;
    details.push({
      code: "HDD",
      name: `HDD ${hddTb} ТБ (архив 30 дней)`,
      qty: hddQty,
      unitPrice: hddUnitPrice,
      total: hddQty * hddUnitPrice,
      basis: "Для архива 30 дней закладывается минимум 2 диска на каждый регистратор.",
    });
  }

  if (vendorMeta.switch) {
    const switchPorts = Number(getValue(selectedParams.switchPorts, vendorMeta.switch.ports[2] || vendorMeta.switch.ports[0]));
    const switchPoe = Boolean(getValue(selectedParams.switchPoe, true));
    const switchKey = `${switchPorts}_${switchPoe}`;
    const switchUnitPrice = vendorMeta.switch.basePrices[switchKey] || fallbackUnitPrice;
    const cameraQty = details.find((item) => item.code === "CAM")?.qty || Math.max(Math.round(areaUnits * 6), 1);
    const switchQty = Math.max(Math.ceil(cameraQty / Math.max(switchPorts, 1)), 1);
    totalEquipmentCost += switchQty * switchUnitPrice;
    details.push({
      code: "SW",
      name: `Коммутатор ${switchPorts} портов (${switchPoe ? "PoE" : "без PoE"})`,
      qty: switchQty,
      unitPrice: switchUnitPrice,
      total: switchQty * switchUnitPrice,
      basis: "Количество коммутаторов зависит от числа камер и выбранной портовой ёмкости.",
    });
  }

  if (vendorMeta.controller) {
    const channels = Number(getValue(selectedParams.controllerChannels, vendorMeta.controller.channels[1] || vendorMeta.controller.channels[0]));
    const unitPrice = vendorMeta.controller.basePrices[channels] || fallbackUnitPrice;
    const qty = Math.max(Math.round(areaUnits), 1);
    totalEquipmentCost += qty * unitPrice;
    normalizedUnits = qty;
    details.push({
      code: "CTRL",
      name: `Контроллер доступа (${channels} точки)`,
      qty,
      unitPrice,
      total: qty * unitPrice,
      basis: "Количество контроллеров рассчитывается от укрупнённого числа точек доступа по площади.",
    });
  }

  if (vendorMeta.detector) {
    const kind = getValue(selectedParams.detectorKind, vendorMeta.detector.kind[0]);
    const unitPrice = vendorMeta.detector.basePrices[kind] || fallbackUnitPrice;
    const qty = Math.max(Math.round(areaUnits * 24), 1);
    totalEquipmentCost += qty * unitPrice;
    normalizedUnits = qty;
    details.push({
      code: "DET",
      name: `Извещатель (${kind})`,
      qty,
      unitPrice,
      total: qty * unitPrice,
      basis: "Количество извещателей берётся по нормативной плотности на 1000 м².",
    });
  }

  if (vendorMeta.panel) {
    const loops = Number(getValue(selectedParams.panelLoops, vendorMeta.panel.loops[1] || vendorMeta.panel.loops[0]));
    const unitPrice = vendorMeta.panel.basePrices[loops] || fallbackUnitPrice;
    const detectorQty = details.find((item) => item.code === "DET")?.qty || Math.max(Math.round(areaUnits * 20), 1);
    const panelQty = Math.max(Math.ceil(detectorQty / (loops * 127)), 1);
    totalEquipmentCost += panelQty * unitPrice;
    details.push({
      code: "PANEL",
      name: `Приёмно-контрольный прибор (${loops} шлейфа)`,
      qty: panelQty,
      unitPrice,
      total: panelQty * unitPrice,
      basis: "Число приборов зависит от числа извещателей и ёмкости шлейфов.",
    });
  }

  if (!details.length) {
    return {
      units: areaUnits,
      unitPrice: fallbackUnitPrice,
      totalEquipmentCost: fallbackUnitPrice * areaUnits,
      selectionKey: "fallback",
      mode: "fallback",
      details: [],
    };
  }

  return {
    units: normalizedUnits,
    unitPrice: totalEquipmentCost / Math.max(normalizedUnits, 1),
    totalEquipmentCost,
    selectionKey: details.map((item) => item.code).join("+"),
    mode: "vendor-parametric",
    details,
  };
}
