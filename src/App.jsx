import React, { useMemo, useState } from "react";
import { Download, Calculator, Shield, Camera, Lock, AlertTriangle } from "lucide-react";

function cn(...items) {
  return items.filter(Boolean).join(" ");
}

function Card({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

function CardHeader({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

function CardContent({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

function CardTitle({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

function Button({ children, className = "", variant = "default", type = "button", ...props }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm transition-colors",
        variant === "outline"
          ? "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
          : "border-slate-900 bg-slate-900 text-white hover:bg-slate-800",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function Input({ className = "", ...props }) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm",
        className,
      )}
      {...props}
    />
  );
}

function Label({ children, className = "" }) {
  return <label className={cn("text-sm text-slate-700", className)}>{children}</label>;
}

function Tabs({ children, defaultValue }) {
  const [tabValue, setTabValue] = useState(defaultValue);
  return React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    return React.cloneElement(child, { tabValue, setTabValue });
  });
}

function TabsList({ children, className = "", setTabValue, tabValue }) {
  return (
    <div className={className}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child, { setTabValue, tabValue });
      })}
    </div>
  );
}

function TabsTrigger({ children, value, setTabValue, tabValue }) {
  const active = value === tabValue;
  return (
    <button
      type="button"
      onClick={() => setTabValue?.(value)}
      className={cn(
        "rounded-xl border px-3 py-2 text-sm",
        active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-900",
      )}
    >
      {children}
    </button>
  );
}

function TabsContent({ children, value, tabValue, className = "" }) {
  if (value !== tabValue) return null;
  return <div className={className}>{children}</div>;
}

function rub(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function num(value, digits = 0) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function materialLinesFromResults(results) {
  if (!results?.systems) return [];
  const lines = [];

  results.systems.forEach((item) => {
    if (item.cableMeters > 0) {
      lines.push({ system: item.name, item: "Кабель", qty: item.cableMeters, unit: "м", sum: item.cableMaterialCost || 0 });
    }
    if ((item.trayCost || 0) > 0) {
      lines.push({ system: item.name, item: "Лоток", qty: item.cableMeters, unit: "м", sum: item.trayCost || 0 });
    }
    if ((item.fasteningCost || 0) > 0) {
      lines.push({ system: item.name, item: "Крепеж", qty: item.cableMeters, unit: "м", sum: item.fasteningCost || 0 });
    }
    if ((item.cabinetUnits || 0) > 0) {
      lines.push({
        system: item.name,
        item: item.name === "АПС" ? "Панели/модули" : "Шкафы/узлы",
        qty: item.cabinetUnits || 0,
        unit: "шт",
        sum: item.cabinetCost || 0,
      });
    }

    if (item.name === "АПС") {
      if ((item.smokeDetectors || 0) > 0) {
        lines.push({ system: item.name, item: "Извещатели дымовые", qty: item.smokeDetectors || 0, unit: "шт", sum: (item.smokeDetectors || 0) * 1850 });
      }
      if ((item.heatDetectors || 0) > 0) {
        lines.push({ system: item.name, item: "Извещатели тепловые", qty: item.heatDetectors || 0, unit: "шт", sum: (item.heatDetectors || 0) * 1650 });
      }
      if ((item.manualCallPoints || 0) > 0) {
        lines.push({ system: item.name, item: "Извещатели ручные", qty: item.manualCallPoints || 0, unit: "шт", sum: (item.manualCallPoints || 0) * 1450 });
      }
    } else if (item.name === "СОУЭ") {
      if ((item.speakers || 0) > 0) {
        lines.push({ system: item.name, item: "Громкоговорители", qty: item.speakers || 0, unit: "шт", sum: (item.speakers || 0) * 5400 });
      }
      if ((item.horns || 0) > 0) {
        lines.push({ system: item.name, item: "Оповещатели звуковые", qty: item.horns || 0, unit: "шт", sum: (item.horns || 0) * 3800 });
      }
      if ((item.lightSigns || 0) > 0) {
        lines.push({ system: item.name, item: "Оповещатели световые", qty: item.lightSigns || 0, unit: "шт", sum: (item.lightSigns || 0) * 2100 });
      }
      if ((item.amplifiers || 0) > 0) {
        lines.push({ system: item.name, item: "Усилители", qty: item.amplifiers || 0, unit: "шт", sum: (item.amplifiers || 0) * 96000 });
      }
      if ((item.controllers || 0) > 0) {
        lines.push({ system: item.name, item: "Контроллеры", qty: item.controllers || 0, unit: "шт", sum: (item.controllers || 0) * 148000 });
      }
    } else {
      if ((item.units || 0) > 0) {
        lines.push({ system: item.name, item: "Оборудование основное", qty: item.units || 0, unit: "шт", sum: item.equipCost || 0 });
      }
    }
  });

  return lines;
}

const defaultRates = {
  officeCctvCablePerM2: 0.95,
  officeAlarmCablePerM2: 0.52,
  officeAcsCablePerM2: 0.38,
  officeSsoiCablePerM2: 0.16,
  parkingCctvCablePerM2: 0.62,
  parkingAlarmCablePerM2: 0.34,
  parkingAcsCablePerM2: 0.18,
  parkingSsoiCablePerM2: 0.1,
  publicCctvCablePerM2: 1.15,
  publicAlarmCablePerM2: 0.74,
  publicAcsCablePerM2: 0.58,
  publicSsoiCablePerM2: 0.22,
  cameraPer1000m2Office: 6.5,
  cameraPer1000m2Parking: 4.2,
  cameraPer1000m2Public: 10,
  alarmSensorPer1000m2Office: 8,
  alarmSensorPer1000m2Parking: 5,
  alarmSensorPer1000m2Public: 12,
  acsDoorPer1000m2Office: 1.6,
  acsDoorPer1000m2Parking: 0.6,
  acsDoorPer1000m2Public: 2.8,
  ssoiPointPer1000m2Office: 1.1,
  ssoiPointPer1000m2Parking: 0.5,
  ssoiPointPer1000m2Public: 1.7,
  apsSystemType: "addressable",
  apsOfficeRoomArea: 35,
  apsParkingZoneArea: 180,
  apsPublicRoomArea: 28,
  apsOfficeDetectorMaxArea: 85,
  apsParkingDetectorMaxArea: 50,
  apsPublicDetectorMaxArea: 70,
  apsLoopsMaxDevices: 127,
  apsPanelLoopCapacity: 2,
  apsOfficeSmokePer1000m2: 24,
  apsParkingHeatPer1000m2: 12,
  apsPublicSmokePer1000m2: 28,
  apsManualPer1000m2Office: 1.2,
  apsManualPer1000m2Parking: 0.8,
  apsManualPer1000m2Public: 1.6,
  apsCablePerDetector: 7.5,
  apsCablePerManual: 9,
  apsCablePerLoop: 65,
  apsSmrPerM: 195,
  apsSmokeDetectorUnit: 1850,
  apsHeatDetectorUnit: 1650,
  apsManualUnit: 1450,
  apsPanelUnit: 128000,
  apsLoopControllerUnit: 39000,
  soueType: 3,
  soueZones: 6,
  soueOfficeZoneArea: 2200,
  soueParkingZoneArea: 3200,
  souePublicZoneArea: 1400,
  soueVoiceReserve: 0.15,
  soueSpeakerWattOfficePerM2: 0.045,
  soueSpeakerWattParkingPerM2: 0.03,
  soueSpeakerWattPublicPerM2: 0.07,
  soueHornPer1000m2Parking: 6,
  soueHornPer1000m2Public: 8,
  soueLightPer1000m2Office: 2.2,
  soueLightPer1000m2Parking: 2.8,
  soueLightPer1000m2Public: 3.2,
  soueControllerUnit: 148000,
  soueAmpUnit: 96000,
  soueSpeakerUnit: 5400,
  soueHornUnit: 3800,
  soueLightUnit: 2100,
  soueCablePerSpeaker: 11,
  soueCablePerHorn: 10,
  soueCablePerLight: 12,
  soueCablePerAmp: 45,
  soueSmrPerM: 180,
  cctvSmrPerM: 210,
  alarmSmrPerM: 185,
  acsSmrPerM: 185,
  ssoiSmrPerM: 155,
  cctvEquipUnit: 24000,
  alarmEquipUnit: 6500,
  acsEquipUnit: 28000,
  ssoiEquipUnit: 52000,
  ownResourceShare: 0.26,
  marginShare: 0.22,
  verticalRiserReserve: 0.12,
  floorReserve: 0.08,
};

const presets = {
  office: { projectName: "Офисный объект", objectType: "office", floors: 12, basementFloors: 2 },
  mixed: { projectName: "Смешанный объект", objectType: "mixed", floors: 18, basementFloors: 5 },
  tower: { projectName: "Высотная башня", objectType: "tower", floors: 18, basementFloors: 5 },
};

const zoneProfiles = {
  office_open_space: { label: "Офис open space", type: "office", apsRoomArea: 45, soueZoneArea: 2500 },
  office_cabinet: { label: "Кабинетная офисная зона", type: "office", apsRoomArea: 25, soueZoneArea: 1600 },
  parking: { label: "Паркинг", type: "parking", apsRoomArea: 180, soueZoneArea: 3200 },
  lobby: { label: "Холл / входная группа", type: "public", apsRoomArea: 28, soueZoneArea: 1200 },
  restaurant: { label: "Ресторан / столовая", type: "public", apsRoomArea: 30, soueZoneArea: 1000 },
  technical: { label: "Технические помещения", type: "public", apsRoomArea: 22, soueZoneArea: 900 },
  pool: { label: "Бассейн / фитнес", type: "public", apsRoomArea: 40, soueZoneArea: 1400 },
  medical: { label: "Медцентр", type: "public", apsRoomArea: 18, soueZoneArea: 800 },
};

function zoneTypeLabel(type) {
  if (type === "office") return "Офис";
  if (type === "parking") return "Паркинг";
  return "Общие зоны";
}

function zoneCable(area, baseRate, floors, basementFloors, verticalRiserReserve, floorReserve) {
  const floorFactor = 1 + (Math.max(Number(floors) - 1, 0) * floorReserve) / 10;
  const riserFactor = 1 + (Number(floors) + Number(basementFloors)) * verticalRiserReserve;
  return area * baseRate * floorFactor * riserFactor;
}

function zoneUnits(area, per1000) {
  return (area / 1000) * per1000;
}

function systemResult(name, cableMeters, units, smrPerM, equipUnit, ownResourceShare, marginShare) {
  const cableMaterialRate = name === "СОТ" ? 95 : name === "СОТС" ? 62 : name === "СКУД" ? 78 : 54;
  const trayRate = name === "СОТ" ? 48 : name === "СОТС" ? 34 : name === "СКУД" ? 40 : 28;
  const fasteningRate = name === "СОТ" ? 16 : name === "СОТС" ? 12 : name === "СКУД" ? 13 : 10;
  const cabinetUnits = Math.max(1, Math.ceil(units / (name === "СКУД" ? 12 : name === "СОТ" ? 24 : 18)));
  const cabinetUnitRate = name === "ССОИ" ? 145000 : 82000;
  const pnrRate = name === "СОТ" ? 0.08 : name === "СОТС" ? 0.07 : name === "СКУД" ? 0.09 : 0.12;
  const cableMaterialCost = cableMeters * cableMaterialRate;
  const trayCost = cableMeters * trayRate;
  const fasteningCost = cableMeters * fasteningRate;
  const cabinetCost = cabinetUnits * cabinetUnitRate;
  const equipCost = units * equipUnit;
  const materialCost = cableMaterialCost + trayCost + fasteningCost + cabinetCost + equipCost;
  const cableWorkCost = cableMeters * smrPerM;
  const installUnitWorkCost = units * (name === "СОТ" ? 2200 : name === "СОТС" ? 950 : name === "СКУД" ? 4800 : 6500);
  const pnrCost = (materialCost + cableWorkCost + installUnitWorkCost) * pnrRate;
  const smrCost = cableWorkCost + installUnitWorkCost + pnrCost;
  const directCost = smrCost + materialCost;
  const ownResourceCost = directCost * ownResourceShare;
  const contractorBudget = directCost * (1 + marginShare);
  return {
    name,
    cableMeters,
    units,
    cabinetUnits,
    cableMaterialCost,
    trayCost,
    fasteningCost,
    cabinetCost,
    equipCost,
    materialCost,
    cableWorkCost,
    installUnitWorkCost,
    pnrCost,
    smrCost,
    directCost,
    ownResourceCost,
    contractorBudget,
  };
}

function fireSystemResult(params) {
  const {
    smokeDetectors,
    heatDetectors,
    manualCallPoints,
    loops,
    panels,
    loopControllers,
    cableMeters,
    smrPerM,
    smokeDetectorUnit,
    heatDetectorUnit,
    manualUnit,
    panelUnit,
    loopControllerUnit,
    ownResourceShare,
    marginShare,
  } = params;

  const detectorInstallWork = smokeDetectors * 780 + heatDetectors * 720 + manualCallPoints * 950;
  const panelInstallWork = panels * 14500 + loopControllers * 6200;
  const cableWorkCost = cableMeters * smrPerM;
  const smokeCost = smokeDetectors * smokeDetectorUnit;
  const heatCost = heatDetectors * heatDetectorUnit;
  const manualCost = manualCallPoints * manualUnit;
  const panelCost = panels * panelUnit;
  const loopControllerCost = loopControllers * loopControllerUnit;
  const cableMaterialCost = cableMeters * 58;
  const fasteningCost = cableMeters * 11;
  const materialCost = smokeCost + heatCost + manualCost + panelCost + loopControllerCost + cableMaterialCost + fasteningCost;
  const pnrCost = (materialCost + cableWorkCost + detectorInstallWork + panelInstallWork) * 0.11;
  const smrCost = cableWorkCost + detectorInstallWork + panelInstallWork + pnrCost;
  const directCost = materialCost + smrCost;
  const ownResourceCost = directCost * ownResourceShare;
  const contractorBudget = directCost * (1 + marginShare);

  return {
    name: "АПС",
    cableMeters,
    units: smokeDetectors + heatDetectors + manualCallPoints + panels + loopControllers,
    smokeDetectors,
    heatDetectors,
    manualCallPoints,
    loops,
    panels,
    loopControllers,
    cableMaterialCost,
    fasteningCost,
    equipCost: smokeCost + heatCost + manualCost + panelCost + loopControllerCost,
    materialCost,
    cableWorkCost,
    installUnitWorkCost: detectorInstallWork + panelInstallWork,
    pnrCost,
    smrCost,
    directCost,
    ownResourceCost,
    contractorBudget,
    cabinetUnits: panels + loopControllers,
    cabinetCost: panelCost + loopControllerCost,
  };
}

function soueSystemResult(params) {
  const {
    speakers,
    horns,
    lightSigns,
    amplifiers,
    controllers,
    zones,
    cableMeters,
    smrPerM,
    speakerUnit,
    hornUnit,
    lightUnit,
    ampUnit,
    controllerUnit,
    ownResourceShare,
    marginShare,
  } = params;

  const cableMaterialCost = cableMeters * 52;
  const fasteningCost = cableMeters * 10;
  const speakerCost = speakers * speakerUnit;
  const hornCost = horns * hornUnit;
  const lightCost = lightSigns * lightUnit;
  const ampCost = amplifiers * ampUnit;
  const controllerCost = controllers * controllerUnit;
  const materialCost = cableMaterialCost + fasteningCost + speakerCost + hornCost + lightCost + ampCost + controllerCost;
  const cableWorkCost = cableMeters * smrPerM;
  const installUnitWorkCost = speakers * 850 + horns * 620 + lightSigns * 540 + amplifiers * 9800 + controllers * 13600;
  const pnrCost = (materialCost + cableWorkCost + installUnitWorkCost) * 0.1;
  const smrCost = cableWorkCost + installUnitWorkCost + pnrCost;
  const directCost = materialCost + smrCost;
  const ownResourceCost = directCost * ownResourceShare;
  const contractorBudget = directCost * (1 + marginShare);

  return {
    name: "СОУЭ",
    cableMeters,
    units: speakers + horns + lightSigns + amplifiers + controllers,
    speakers,
    horns,
    lightSigns,
    amplifiers,
    controllers,
    zones,
    cableMaterialCost,
    fasteningCost,
    equipCost: speakerCost + hornCost + lightCost + ampCost + controllerCost,
    materialCost,
    cableWorkCost,
    installUnitWorkCost,
    pnrCost,
    smrCost,
    directCost,
    ownResourceCost,
    contractorBudget,
    cabinetUnits: amplifiers + controllers,
    cabinetCost: ampCost + controllerCost,
  };
}

export default function SmetaSecurityServiceMvp() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState({
    projectName: "Объект 1",
    objectType: "tower",
    floors: 18,
    basementFloors: 5,
    complexity: 1,
    ...defaultRates,
  });

  const [savedProjects, setSavedProjects] = useState([]);
  const [zones, setZones] = useState([
    { id: 1, name: "Офисные этажи", area: 82147, type: "office", floors: 17, apsRoomArea: 35, soueZoneArea: 2200, profile: "office_open_space" },
    { id: 2, name: "Паркинг", area: 24161, type: "parking", floors: 5, apsRoomArea: 180, soueZoneArea: 3200, profile: "parking" },
    { id: 3, name: "Общие зоны", area: 14496, type: "public", floors: 6, apsRoomArea: 28, soueZoneArea: 1400, profile: "lobby" },
  ]);

  const objectTypeFactors = {
    office: { cable: 1, equipment: 1, labor: 1 },
    mixed: { cable: 1.08, equipment: 1.06, labor: 1.1 },
    tower: { cable: 1.16, equipment: 1.12, labor: 1.18 },
  };

  const currentFactors = objectTypeFactors[form.objectType] || objectTypeFactors.office;
  const effectiveArea = useMemo(() => zones.reduce((s, z) => s + Number(z.area || 0), 0), [zones]);

  const zoneFactors = useMemo(() => {
    const totalArea = Math.max(effectiveArea, 1);
    const officeArea = zones.filter((z) => z.type === "office").reduce((s, z) => s + Number(z.area || 0), 0);
    const parkingArea = zones.filter((z) => z.type === "parking").reduce((s, z) => s + Number(z.area || 0), 0);
    const publicArea = zones.filter((z) => z.type === "public").reduce((s, z) => s + Number(z.area || 0), 0);
    return {
      officeShare: officeArea / totalArea,
      parkingShare: parkingArea / totalArea,
      publicShare: publicArea / totalArea,
    };
  }, [effectiveArea, zones]);

  const results = useMemo(() => {
    const complexity = Number(form.complexity);
    const officeArea = zones.filter((z) => z.type === "office").reduce((s, z) => s + Number(z.area || 0), 0) * complexity;
    const parkingArea = zones.filter((z) => z.type === "parking").reduce((s, z) => s + Number(z.area || 0), 0) * complexity;
    const publicArea = zones.filter((z) => z.type === "public").reduce((s, z) => s + Number(z.area || 0), 0) * complexity;

    const zoneCalc = zones.map((zone) => {
      const zoneArea = Number(zone.area || 0) * complexity;
      const zoneFloors = Number(zone.floors || 1);
      const isOffice = zone.type === "office";
      const isParking = zone.type === "parking";

      const cctvCableZone = zoneCable(zoneArea, isOffice ? Number(form.officeCctvCablePerM2) : isParking ? Number(form.parkingCctvCablePerM2) : Number(form.publicCctvCablePerM2), zoneFloors, 0, Number(form.verticalRiserReserve), Number(form.floorReserve));
      const alarmCableZone = zoneCable(zoneArea, isOffice ? Number(form.officeAlarmCablePerM2) : isParking ? Number(form.parkingAlarmCablePerM2) : Number(form.publicAlarmCablePerM2), zoneFloors, 0, Number(form.verticalRiserReserve), Number(form.floorReserve));
      const acsCableZone = zoneCable(zoneArea, isOffice ? Number(form.officeAcsCablePerM2) : isParking ? Number(form.parkingAcsCablePerM2) : Number(form.publicAcsCablePerM2), zoneFloors, 0, Number(form.verticalRiserReserve), Number(form.floorReserve));
      const ssoiCableZone = zoneCable(zoneArea, isOffice ? Number(form.officeSsoiCablePerM2) : isParking ? Number(form.parkingSsoiCablePerM2) : Number(form.publicSsoiCablePerM2), zoneFloors, 0, Number(form.verticalRiserReserve), Number(form.floorReserve));

      const apsSmokeZone = isParking
        ? 0
        : Math.max(
            Math.ceil(zoneArea / Math.max(1, Number(zone.apsRoomArea || (isOffice ? form.apsOfficeRoomArea : form.apsPublicRoomArea)))),
            Math.ceil(zoneArea / Math.max(1, Number(isOffice ? form.apsOfficeDetectorMaxArea : form.apsPublicDetectorMaxArea))),
            Math.ceil((zoneArea / 1000) * Number(isOffice ? form.apsOfficeSmokePer1000m2 : form.apsPublicSmokePer1000m2)),
          );

      const apsHeatZone = isParking
        ? Math.max(
            Math.ceil(zoneArea / Math.max(1, Number(zone.apsRoomArea || form.apsParkingZoneArea))),
            Math.ceil(zoneArea / Math.max(1, Number(form.apsParkingDetectorMaxArea))),
            Math.ceil((zoneArea / 1000) * Number(form.apsParkingHeatPer1000m2)),
          )
        : 0;

      const apsManualZone = Math.max(
        Math.ceil((zoneArea / 1000) * Number(isOffice ? form.apsManualPer1000m2Office : isParking ? form.apsManualPer1000m2Parking : form.apsManualPer1000m2Public)),
        Math.max(1, Math.ceil(zoneFloors * (isParking ? 2 : 3))),
      );

      const apsLoopsZone = Math.max(1, Math.ceil((apsSmokeZone + apsHeatZone + apsManualZone) / Number(form.apsLoopsMaxDevices)));

      const apsCableZone =
        (apsSmokeZone * Number(form.apsCablePerDetector) +
          apsHeatZone * Number(form.apsCablePerDetector) +
          apsManualZone * Number(form.apsCablePerManual) +
          apsLoopsZone * Number(form.apsCablePerLoop) +
          zoneFloors * 22) *
        (form.apsSystemType === "addressable" ? 1 : 1.18);

      const soueZonesZone = Math.max(
        1,
        Math.ceil(
          zoneArea /
            Math.max(1, Number(zone.soueZoneArea || (isOffice ? form.soueOfficeZoneArea : isParking ? form.soueParkingZoneArea : form.souePublicZoneArea))),
        ),
      );

      const speakerPowerPerM2 = isOffice ? Number(form.soueSpeakerWattOfficePerM2) : isParking ? Number(form.soueSpeakerWattParkingPerM2) : Number(form.soueSpeakerWattPublicPerM2);
      const souePowerZone = zoneArea * speakerPowerPerM2 * (1 + Number(form.soueVoiceReserve));
      const soueSpeakersZone = Number(form.soueType) >= 3 ? Math.ceil(souePowerZone / 6) : 0;
      const soueHornsZone =
        Number(form.soueType) <= 2
          ? Math.ceil((zoneArea / 1000) * Number(isParking ? form.soueHornPer1000m2Parking : form.soueHornPer1000m2Public))
          : Math.ceil((zoneArea / 1000) * Number(isParking ? form.soueHornPer1000m2Parking : form.soueHornPer1000m2Public) * 0.35);
      const soueLightsZone = Math.ceil((zoneArea / 1000) * Number(isOffice ? form.soueLightPer1000m2Office : isParking ? form.soueLightPer1000m2Parking : form.soueLightPer1000m2Public));
      const soueAmpsZone = Math.max(1, Math.ceil(souePowerZone / 240));
      const soueControllersZone = Math.max(1, Math.ceil(soueZonesZone / (Number(form.soueType) >= 4 ? 4 : 6)));
      const soueCableZone =
        soueSpeakersZone * Number(form.soueCablePerSpeaker) +
        soueHornsZone * Number(form.soueCablePerHorn) +
        soueLightsZone * Number(form.soueCablePerLight) +
        soueAmpsZone * Number(form.soueCablePerAmp) +
        soueZonesZone * 35 +
        zoneFloors * 18;

      return {
        id: zone.id,
        name: zone.name,
        type: zone.type,
        cctvCableZone,
        alarmCableZone,
        acsCableZone,
        ssoiCableZone,
        apsSmokeZone,
        apsHeatZone,
        apsManualZone,
        apsLoopsZone,
        apsCableZone,
        soueZonesZone,
        soueSpeakersZone,
        soueHornsZone,
        soueLightsZone,
        soueAmpsZone,
        soueControllersZone,
        soueCableZone,
      };
    });

    const cctvCable = zoneCalc.reduce((s, z) => s + z.cctvCableZone, 0) * currentFactors.cable;
    const alarmCable = zoneCalc.reduce((s, z) => s + z.alarmCableZone, 0) * currentFactors.cable;
    const acsCable = zoneCalc.reduce((s, z) => s + z.acsCableZone, 0) * currentFactors.cable;
    const ssoiCable = zoneCalc.reduce((s, z) => s + z.ssoiCableZone, 0) * currentFactors.cable;

    const cctvUnits =
      (zoneUnits(officeArea, Number(form.cameraPer1000m2Office)) +
        zoneUnits(parkingArea, Number(form.cameraPer1000m2Parking)) +
        zoneUnits(publicArea, Number(form.cameraPer1000m2Public))) *
      currentFactors.equipment;

    const alarmUnits =
      (zoneUnits(officeArea, Number(form.alarmSensorPer1000m2Office)) +
        zoneUnits(parkingArea, Number(form.alarmSensorPer1000m2Parking)) +
        zoneUnits(publicArea, Number(form.alarmSensorPer1000m2Public))) *
      currentFactors.equipment;

    const acsUnits =
      (zoneUnits(officeArea, Number(form.acsDoorPer1000m2Office)) +
        zoneUnits(parkingArea, Number(form.acsDoorPer1000m2Parking)) +
        zoneUnits(publicArea, Number(form.acsDoorPer1000m2Public))) *
      currentFactors.equipment;

    const ssoiUnits =
      (zoneUnits(officeArea, Number(form.ssoiPointPer1000m2Office)) +
        zoneUnits(parkingArea, Number(form.ssoiPointPer1000m2Parking)) +
        zoneUnits(publicArea, Number(form.ssoiPointPer1000m2Public))) *
      currentFactors.equipment;

    const cctv = systemResult("СОТ", cctvCable, cctvUnits, Number(form.cctvSmrPerM) * currentFactors.labor, Number(form.cctvEquipUnit) * currentFactors.equipment, Number(form.ownResourceShare), Number(form.marginShare));
    const alarm = systemResult("СОТС", alarmCable, alarmUnits, Number(form.alarmSmrPerM) * currentFactors.labor, Number(form.alarmEquipUnit) * currentFactors.equipment, Number(form.ownResourceShare), Number(form.marginShare));
    const acs = systemResult("СКУД", acsCable, acsUnits, Number(form.acsSmrPerM) * currentFactors.labor, Number(form.acsEquipUnit) * currentFactors.equipment, Number(form.ownResourceShare), Number(form.marginShare));
    const ssoi = systemResult("ССОИ", ssoiCable, ssoiUnits, Number(form.ssoiSmrPerM) * currentFactors.labor, Number(form.ssoiEquipUnit) * currentFactors.equipment, Number(form.ownResourceShare), Number(form.marginShare));

    const smokeDetectors = zoneCalc.reduce((s, z) => s + z.apsSmokeZone, 0);
    const heatDetectors = zoneCalc.reduce((s, z) => s + z.apsHeatZone, 0);
    const manualCallPoints = zoneCalc.reduce((s, z) => s + z.apsManualZone, 0);
    const apsLoops = Math.max(1, zoneCalc.reduce((s, z) => s + z.apsLoopsZone, 0));
    const apsPanels = Math.max(1, Math.ceil(apsLoops / Number(form.apsPanelLoopCapacity)));
    const apsLoopControllers = Math.max(0, apsLoops - apsPanels * Number(form.apsPanelLoopCapacity));
    const apsCableMeters = zoneCalc.reduce((s, z) => s + z.apsCableZone, 0) * currentFactors.cable;

    const aps = fireSystemResult({
      smokeDetectors: form.apsSystemType === "addressable" ? smokeDetectors : Math.ceil(smokeDetectors * 1.08),
      heatDetectors,
      manualCallPoints,
      loops: form.apsSystemType === "addressable" ? apsLoops : Math.ceil(apsLoops * 1.25),
      panels: apsPanels,
      loopControllers: form.apsSystemType === "addressable" ? apsLoopControllers : Math.ceil(apsLoopControllers * 1.2 + 1),
      cableMeters: apsCableMeters,
      smrPerM: Number(form.apsSmrPerM) * currentFactors.labor,
      smokeDetectorUnit: Number(form.apsSmokeDetectorUnit),
      heatDetectorUnit: Number(form.apsHeatDetectorUnit),
      manualUnit: Number(form.apsManualUnit),
      panelUnit: Number(form.apsPanelUnit),
      loopControllerUnit: Number(form.apsLoopControllerUnit),
      ownResourceShare: Number(form.ownResourceShare),
      marginShare: Number(form.marginShare),
    });

    const totalZones = Math.max(Number(form.soueZones), zoneCalc.reduce((s, z) => s + z.soueZonesZone, 0));
    const speakers = zoneCalc.reduce((s, z) => s + z.soueSpeakersZone, 0);
    const horns = zoneCalc.reduce((s, z) => s + z.soueHornsZone, 0);
    const lightSigns = zoneCalc.reduce((s, z) => s + z.soueLightsZone, 0);
    const amplifiers = Math.max(1, zoneCalc.reduce((s, z) => s + z.soueAmpsZone, 0));
    const controllers = Math.max(1, zoneCalc.reduce((s, z) => s + z.soueControllersZone, 0));
    const soueCableMeters = zoneCalc.reduce((s, z) => s + z.soueCableZone, 0) * currentFactors.cable;

    const soue = soueSystemResult({
      speakers: Number(form.soueType) >= 3 ? speakers : 0,
      horns: Number(form.soueType) <= 2 ? horns : Math.ceil(horns * 0.35),
      lightSigns,
      amplifiers,
      controllers,
      zones: totalZones,
      cableMeters: soueCableMeters,
      smrPerM: Number(form.soueSmrPerM) * currentFactors.labor,
      speakerUnit: Number(form.soueSpeakerUnit),
      hornUnit: Number(form.soueHornUnit),
      lightUnit: Number(form.soueLightUnit),
      ampUnit: Number(form.soueAmpUnit),
      controllerUnit: Number(form.soueControllerUnit),
      ownResourceShare: Number(form.ownResourceShare),
      marginShare: Number(form.marginShare),
    });

    const systems = [cctv, alarm, acs, ssoi, aps, soue];

    return {
      zoneCalc,
      systems,
      weightedArea: officeArea + parkingArea + publicArea,
      totalCable: systems.reduce((s, x) => s + x.cableMeters, 0),
      totalEquip: systems.reduce((s, x) => s + x.equipCost, 0),
      totalMaterials: systems.reduce((s, x) => s + x.materialCost, 0),
      totalSmr: systems.reduce((s, x) => s + x.smrCost, 0),
      totalDirect: systems.reduce((s, x) => s + x.directCost, 0),
      ownResources: systems.reduce((s, x) => s + x.ownResourceCost, 0),
      contractorBudget: systems.reduce((s, x) => s + x.contractorBudget, 0),
    };
  }, [form, zones, currentFactors]);

  const setValue = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const addZone = () =>
    setZones((prev) => [
      ...prev,
      { id: Date.now(), name: `Зона ${prev.length + 1}`, area: 1000, type: "office", floors: 1, apsRoomArea: 35, soueZoneArea: 1200, profile: "office_open_space" },
    ]);

  const updateZone = (id, key, value) => setZones((prev) => prev.map((z) => (z.id === id ? { ...z, [key]: value } : z)));
  const removeZone = (id) => setZones((prev) => prev.filter((z) => z.id !== id));

  const applyZoneProfile = (id, profileKey) => {
    const profile = zoneProfiles[profileKey];
    if (!profile) return;
    setZones((prev) =>
      prev.map((z) =>
        z.id === id ? { ...z, profile: profileKey, type: profile.type, apsRoomArea: profile.apsRoomArea, soueZoneArea: profile.soueZoneArea } : z,
      ),
    );
  };

  const saveProject = () =>
    setSavedProjects((prev) => [{ id: Date.now(), projectName: form.projectName, objectType: form.objectType, area: effectiveArea, contractorBudget: results.contractorBudget }, ...prev].slice(0, 8));

  const loadProject = (project) => setForm((prev) => ({ ...prev, ...project }));
  const loadPreset = (key) => setForm((prev) => ({ ...prev, ...presets[key] }));

  const exportCommercialCsv = () => {
    const rows = [
      ["Коммерческое предложение"],
      [],
      ["Объект", form.projectName],
      ["Тип объекта", form.objectType],
      ["Площадь, м2", effectiveArea],
      ["Этажность", `${form.floors} / ${form.basementFloors}`],
      ["Стоимость предложения, ₽", num(results.contractorBudget, 0)],
      ["Собственный ресурс, ₽", num(results.ownResources, 0)],
      [],
      ["Система", "Материалы, ₽", "СМР, ₽", "Подрядный бюджет, ₽"],
      ...results.systems.map((x) => [x.name, num(x.materialCost, 0), num(x.smrCost, 0), num(x.contractorBudget, 0)]),
    ];
    downloadCsv(`${form.projectName || "commercial-offer"}-kp.csv`, rows);
  };

  const exportMaterialsCsv = () => {
    const lines = materialLinesFromResults(results);
    const rows = [
      ["Ведомость материалов"],
      [],
      ["Проект", form.projectName],
      ["Площадь, м2", effectiveArea],
      [],
      ["Система", "Позиция", "Кол-во", "Ед.", "Сумма, ₽"],
      ...lines.map((x) => [x.system, x.item, num(x.qty, 0), x.unit, num(x.sum, 0)]),
      [],
      ["ИТОГО", "", "", "", num(lines.reduce((s, x) => s + (x.sum || 0), 0), 0)],
    ];
    downloadCsv(`${form.projectName || "materials"}-materials.csv`, rows);
  };

  const exportEstimate = () => {
    const rows = [
      ["Проект", form.projectName],
      ["Площадь, м2", effectiveArea],
      ["Надземные этажи", form.floors],
      ["Подземные этажи", form.basementFloors],
      ["Приведенная площадь, м2", num(results.weightedArea, 0)],
      [],
      ["Система", "Кабель, м", "Единицы", "Шкафы, шт", "Материалы, ₽", "СМР, ₽", "Прямые затраты, ₽", "Собственный ресурс, ₽", "Подрядный бюджет, ₽"],
      ...results.systems.map((x) => [
        x.name,
        num(x.cableMeters, 0),
        num(x.units, 0),
        num(x.cabinetUnits, 0),
        num(x.materialCost, 0),
        num(x.smrCost, 0),
        num(x.directCost, 0),
        num(x.ownResourceCost, 0),
        num(x.contractorBudget, 0),
      ]),
      [],
      ["ИТОГО", num(results.totalCable, 0), "", "", num(results.totalMaterials, 0), num(results.totalSmr, 0), num(results.totalDirect, 0), num(results.ownResources, 0), num(results.contractorBudget, 0)],
    ];
    downloadCsv(`${form.projectName || "estimate"}.csv`, rows);
  };

  const shareWarning = Math.abs(zoneFactors.officeShare + zoneFactors.parkingShare + zoneFactors.publicShare - 1) > 0.001;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Сервис расчета сметы систем безопасности</h1>
            <p className="mt-2 text-sm text-slate-600">Запускаемая версия под обычный Vite + React.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => loadPreset("office")}>Офис</Button>
            <Button variant="outline" onClick={() => loadPreset("mixed")}>Смешанный</Button>
            <Button variant="outline" onClick={() => loadPreset("tower")}>Башня</Button>
            <Button variant="outline" onClick={saveProject}>Сохранить проект</Button>
            <Button variant="outline" onClick={exportCommercialCsv}>Экспорт КП</Button>
            <Button variant="outline" onClick={exportMaterialsCsv}>Ведомость материалов</Button>
            <Button variant="outline" onClick={() => setShowAdvanced((v) => !v)}>{showAdvanced ? "Скрыть детали" : "Показать детали"}</Button>
            <Button onClick={exportEstimate} className="gap-2">
              <Download className="mr-2 h-4 w-4" /> Экспорт CSV
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-3xl border-0 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Calculator className="h-5 w-5" /> Параметры объекта
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="object">
                <TabsList className={cn("grid w-full rounded-2xl gap-2", showAdvanced ? "grid-cols-4" : "grid-cols-2")}>
                  <TabsTrigger value="object">Объект</TabsTrigger>
                  {showAdvanced && <TabsTrigger value="rates">Нормативы</TabsTrigger>}
                  {showAdvanced && <TabsTrigger value="costs">Стоимость</TabsTrigger>}
                  <TabsTrigger value="zones">Зоны</TabsTrigger>
                </TabsList>

                <TabsContent value="object" className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Название проекта</Label>
                    <Input value={form.projectName} onChange={(e) => setValue("projectName", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Тип объекта</Label>
                    <select value={form.objectType} onChange={(e) => setValue("objectType", e.target.value)} className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                      <option value="office">Офисный</option>
                      <option value="mixed">Смешанный</option>
                      <option value="tower">Высотный / башня</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Общая площадь, м²</Label>
                    <Input type="number" value={effectiveArea} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Коэффициент сложности</Label>
                    <Input type="number" step="0.01" value={form.complexity} onChange={(e) => setValue("complexity", Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Надземные этажи</Label>
                    <Input type="number" value={form.floors} onChange={(e) => setValue("floors", Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Подземные этажи</Label>
                    <Input type="number" value={form.basementFloors} onChange={(e) => setValue("basementFloors", Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Резерв на стояки</Label>
                    <Input type="number" step="0.01" value={form.verticalRiserReserve} onChange={(e) => setValue("verticalRiserReserve", Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Резерв на этажность</Label>
                    <Input type="number" step="0.01" value={form.floorReserve} onChange={(e) => setValue("floorReserve", Number(e.target.value))} />
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                    <div className="text-sm text-slate-600">Структура площадей по зонам</div>
                    <div className="mt-2 text-sm text-slate-700">Офисы: {num(zoneFactors.officeShare * 100, 1)}% · Паркинг: {num(zoneFactors.parkingShare * 100, 1)}% · Общие зоны: {num(zoneFactors.publicShare * 100, 1)}%</div>
                    {shareWarning && (
                      <div className="mt-3 flex items-start gap-2 text-sm text-amber-700">
                        <AlertTriangle className="mt-0.5 h-4 w-4" /> Проверь зоны: сумма долей должна давать 100% площади объекта.
                      </div>
                    )}
                  </div>
                </TabsContent>

                {showAdvanced && (
                  <TabsContent value="rates" className="mt-6 grid gap-4 md:grid-cols-3">
                    {[
                      ["officeCctvCablePerM2", "Офис / СОТ"],
                      ["officeAlarmCablePerM2", "Офис / СОТС"],
                      ["officeAcsCablePerM2", "Офис / СКУД"],
                      ["officeSsoiCablePerM2", "Офис / ССОИ"],
                      ["parkingCctvCablePerM2", "Паркинг / СОТ"],
                      ["parkingAlarmCablePerM2", "Паркинг / СОТС"],
                      ["parkingAcsCablePerM2", "Паркинг / СКУД"],
                      ["parkingSsoiCablePerM2", "Паркинг / ССОИ"],
                      ["publicCctvCablePerM2", "Общие зоны / СОТ"],
                      ["publicAlarmCablePerM2", "Общие зоны / СОТС"],
                      ["publicAcsCablePerM2", "Общие зоны / СКУД"],
                      ["publicSsoiCablePerM2", "Общие зоны / ССОИ"],
                    ].map(([key, label]) => (
                      <div className="space-y-2" key={key}>
                        <Label>{label}</Label>
                        <Input type="number" step="0.01" value={form[key]} onChange={(e) => setValue(key, Number(e.target.value))} />
                      </div>
                    ))}
                  </TabsContent>
                )}

                {showAdvanced && (
                  <TabsContent value="costs" className="mt-6 grid gap-4 md:grid-cols-2">
                    {[
                      ["cctvSmrPerM", "СОТ: СМР за 1 м, ₽"],
                      ["alarmSmrPerM", "СОТС: СМР за 1 м, ₽"],
                      ["acsSmrPerM", "СКУД: СМР за 1 м, ₽"],
                      ["ssoiSmrPerM", "ССОИ: СМР за 1 м, ₽"],
                      ["apsSmrPerM", "АПС: СМР за 1 м, ₽"],
                      ["soueSmrPerM", "СОУЭ: СМР за 1 м, ₽"],
                      ["cctvEquipUnit", "СОТ: оборудование за 1 ед., ₽"],
                      ["alarmEquipUnit", "СОТС: оборудование за 1 ед., ₽"],
                      ["acsEquipUnit", "СКУД: оборудование за 1 ед., ₽"],
                      ["ssoiEquipUnit", "ССОИ: оборудование за 1 ед., ₽"],
                      ["apsSmokeDetectorUnit", "АПС: дымовой извещатель, ₽"],
                      ["apsHeatDetectorUnit", "АПС: тепловой извещатель, ₽"],
                      ["apsManualUnit", "АПС: ручной извещатель, ₽"],
                      ["apsPanelUnit", "АПС: ППКП, ₽"],
                      ["apsLoopControllerUnit", "АПС: модуль кольца, ₽"],
                      ["soueControllerUnit", "СОУЭ: контроллер, ₽"],
                      ["soueAmpUnit", "СОУЭ: усилитель, ₽"],
                      ["soueSpeakerUnit", "СОУЭ: громкоговоритель, ₽"],
                      ["soueHornUnit", "СОУЭ: звуковой, ₽"],
                      ["soueLightUnit", "СОУЭ: световой, ₽"],
                      ["ownResourceShare", "Доля собственного ресурса"],
                      ["marginShare", "Маржа подрядчика"],
                    ].map(([key, label]) => (
                      <div className="space-y-2" key={key}>
                        <Label>{label}</Label>
                        <Input type="number" step="0.01" value={form[key]} onChange={(e) => setValue(key, Number(e.target.value))} />
                      </div>
                    ))}
                  </TabsContent>
                )}

                <TabsContent value="zones" className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-600">Детализация по функциональным зонам и этажным группам</div>
                    <Button variant="outline" onClick={addZone}>Добавить зону</Button>
                  </div>

                  <div className="space-y-3">
                    {zones.map((zone) => {
                      const calc = results.zoneCalc.find((x) => x.id === zone.id);
                      return (
                        <div key={zone.id} className="space-y-3 rounded-2xl border border-slate-200 p-4">
                          <div className="grid gap-3 md:grid-cols-6">
                            <div className="space-y-2 md:col-span-2">
                              <Label>Название</Label>
                              <Input value={zone.name} onChange={(e) => updateZone(zone.id, "name", e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label>Профиль</Label>
                              <select value={zone.profile || "office_open_space"} onChange={(e) => applyZoneProfile(zone.id, e.target.value)} className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                                {Object.entries(zoneProfiles).map(([key, profile]) => (
                                  <option key={key} value={key}>{profile.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-2">
                              <Label>Тип</Label>
                              <select value={zone.type} onChange={(e) => updateZone(zone.id, "type", e.target.value)} className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                                <option value="office">Офис</option>
                                <option value="parking">Паркинг</option>
                                <option value="public">Общие зоны</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <Label>Площадь, м²</Label>
                              <Input type="number" value={zone.area} onChange={(e) => updateZone(zone.id, "area", Number(e.target.value))} />
                            </div>
                            <div className="space-y-2">
                              <Label>Этажей</Label>
                              <Input type="number" value={zone.floors} onChange={(e) => updateZone(zone.id, "floors", Number(e.target.value))} />
                            </div>
                            <div className="space-y-2">
                              <Label>Удалить</Label>
                              <Button variant="outline" onClick={() => removeZone(zone.id)} className="w-full">Удалить</Button>
                            </div>
                            <div className="space-y-2">
                              <Label>АПС: помещение/зона, м²</Label>
                              <Input type="number" value={zone.apsRoomArea} onChange={(e) => updateZone(zone.id, "apsRoomArea", Number(e.target.value))} />
                            </div>
                            <div className="space-y-2">
                              <Label>СОУЭ: зона, м²</Label>
                              <Input type="number" value={zone.soueZoneArea} onChange={(e) => updateZone(zone.id, "soueZoneArea", Number(e.target.value))} />
                            </div>
                            <div className="md:col-span-3 flex items-end text-sm text-slate-500">
                              {zoneProfiles[zone.profile || "office_open_space"]?.label || zoneTypeLabel(zone.type)} · {num(zone.area, 0)} м² · {num(zone.floors, 0)} эт.
                            </div>
                          </div>

                          {calc && (
                            <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-4 text-sm">
                              <div><div className="text-slate-500">АПС: дымовые</div><div className="font-semibold">{num(calc.apsSmokeZone, 0)}</div></div>
                              <div><div className="text-slate-500">АПС: тепловые</div><div className="font-semibold">{num(calc.apsHeatZone, 0)}</div></div>
                              <div><div className="text-slate-500">АПС: ИПР</div><div className="font-semibold">{num(calc.apsManualZone, 0)}</div></div>
                              <div><div className="text-slate-500">АПС: кабель</div><div className="font-semibold">{num(calc.apsCableZone, 0)} м</div></div>
                              <div><div className="text-slate-500">СОУЭ: зоны</div><div className="font-semibold">{num(calc.soueZonesZone, 0)}</div></div>
                              <div><div className="text-slate-500">СОУЭ: громкоговорители</div><div className="font-semibold">{num(calc.soueSpeakersZone, 0)}</div></div>
                              <div><div className="text-slate-500">СОУЭ: оповещатели</div><div className="font-semibold">{num(calc.soueHornsZone + calc.soueLightsZone, 0)}</div></div>
                              <div><div className="text-slate-500">СОУЭ: кабель</div><div className="font-semibold">{num(calc.soueCableZone, 0)} м</div></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-3xl border-0 bg-white shadow-sm">
              <CardHeader><CardTitle>Итоги по объекту</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-sm text-slate-500">Приведенная площадь</div><div className="mt-2 text-2xl font-semibold">{num(results.weightedArea, 0)} м²</div></div>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-sm text-slate-500">Общий кабельный объем</div><div className="mt-2 text-2xl font-semibold">{num(results.totalCable, 0)} м</div></div>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-sm text-slate-500">Материалы</div><div className="mt-2 text-2xl font-semibold">{rub(results.totalMaterials)}</div></div>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-sm text-slate-500">СМР</div><div className="mt-2 text-2xl font-semibold">{rub(results.totalSmr)}</div></div>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-sm text-slate-500">Оборудование</div><div className="mt-2 text-2xl font-semibold">{rub(results.totalEquip)}</div></div>
                <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2"><div className="text-sm text-slate-500">Подрядный бюджет</div><div className="mt-2 text-3xl font-semibold">{rub(results.contractorBudget)}</div></div>
                <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2"><div className="text-sm text-slate-500">Собственный ресурс</div><div className="mt-2 text-3xl font-semibold">{rub(results.ownResources)}</div></div>
              </CardContent>
            </Card>

            {showAdvanced && (
              <Card className="rounded-3xl border-0 bg-white shadow-sm">
                <CardHeader><CardTitle>Ведомость материалов</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-slate-500">
                          <th className="py-2 pr-4">Система</th>
                          <th className="py-2 pr-4">Позиция</th>
                          <th className="py-2 pr-4">Кол-во</th>
                          <th className="py-2 pr-4">Ед.</th>
                          <th className="py-2">Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materialLinesFromResults(results).slice(0, 14).map((line, idx) => (
                          <tr key={`${line.system}-${line.item}-${idx}`} className="border-b last:border-0">
                            <td className="py-2 pr-4">{line.system}</td>
                            <td className="py-2 pr-4">{line.item}</td>
                            <td className="py-2 pr-4">{num(line.qty, 0)}</td>
                            <td className="py-2 pr-4">{line.unit}</td>
                            <td className="py-2">{rub(line.sum)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-3xl border-0 bg-white shadow-sm">
              <CardHeader><CardTitle>Сохраненные проекты</CardTitle></CardHeader>
              <CardContent>
                {savedProjects.length === 0 ? (
                  <div className="text-sm text-slate-500">Проекты пока не сохранены.</div>
                ) : (
                  <div className="space-y-3">
                    {savedProjects.map((project) => (
                      <div key={project.id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                        <div>
                          <div className="font-medium">{project.projectName}</div>
                          <div className="text-sm text-slate-500">{project.objectType} · {num(project.area, 0)} м² · {rub(project.contractorBudget)}</div>
                        </div>
                        <Button variant="outline" onClick={() => loadProject(project)}>Загрузить</Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-0 bg-white shadow-sm">
              <CardHeader><CardTitle>Коммерческое предложение</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                <p><span className="font-semibold">Объект:</span> {form.projectName}</p>
                <p><span className="font-semibold">Предмет предложения:</span> выполнение комплекса работ по системам СОТ, СОТС, СКУД, ССОИ, АПС и СОУЭ с поставкой материалов и оборудования.</p>
                <p><span className="font-semibold">Исходные данные:</span> площадь {num(effectiveArea, 0)} м², {num(form.floors, 0)} надземных и {num(form.basementFloors, 0)} подземных этажей.</p>
                <p><span className="font-semibold">Стоимость предложения:</span> {rub(results.contractorBudget)}.</p>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {results.systems.map((item, index) => {
                const Icon = [Camera, Shield, Lock, AlertTriangle, Shield, AlertTriangle][index] || Shield;
                return (
                  <Card key={item.name} className="rounded-3xl border-0 bg-white shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-slate-100 p-3"><Icon className="h-5 w-5" /></div>
                        <div>
                          <div className="text-lg font-semibold">{item.name}</div>
                          <div className="text-sm text-slate-500">Предварительный расчет</div>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-slate-500">Кабель</span><span className="font-medium">{num(item.cableMeters, 0)} м</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Единицы оборудования</span><span className="font-medium">{num(item.units, 0)}</span></div>

                        {item.name === "АПС" && (
                          <>
                            <div className="flex justify-between"><span className="text-slate-500">Дымовые</span><span className="font-medium">{num(item.smokeDetectors, 0)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Тепловые</span><span className="font-medium">{num(item.heatDetectors, 0)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">ИПР</span><span className="font-medium">{num(item.manualCallPoints, 0)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Кольца / шлейфы</span><span className="font-medium">{num(item.loops, 0)}</span></div>
                          </>
                        )}

                        {item.name === "СОУЭ" && (
                          <>
                            <div className="flex justify-between"><span className="text-slate-500">Громкоговорители</span><span className="font-medium">{num(item.speakers, 0)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Звуковые</span><span className="font-medium">{num(item.horns, 0)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Световые</span><span className="font-medium">{num(item.lightSigns, 0)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Усилители</span><span className="font-medium">{num(item.amplifiers, 0)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Зоны</span><span className="font-medium">{num(item.zones, 0)}</span></div>
                          </>
                        )}

                        <div className="flex justify-between"><span className="text-slate-500">Шкафы / панели</span><span className="font-medium">{num(item.cabinetUnits, 0)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Материалы</span><span className="font-medium">{rub(item.materialCost)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">СМР</span><span className="font-medium">{rub(item.smrCost)}</span></div>
                        <div className="flex justify-between border-t pt-2"><span className="text-slate-700">Подрядный бюджет</span><span className="font-semibold">{rub(item.contractorBudget)}</span></div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
