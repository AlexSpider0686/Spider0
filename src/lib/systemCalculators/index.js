import { getSystemResourceModel, getSystemRules } from "../../config/systemsConfig";
import { getZoneCalcProfile, getZoneRateProfile } from "../../config/zonesConfig";
import { calculateSystem, toNumber } from "../estimate";

const DESIGN_RATE_PER_HOUR = 2100;

const SYSTEM_MARKERS = {
  sots: { resourceKey: "sensor", label: "Монтаж+ПНР 1 охранного датчика" },
  sot: { resourceKey: "camera", label: "Монтаж+ПНР 1 камеры" },
  skud: { resourceKey: "reader", label: "Монтаж+ПНР 1 точки прохода" },
  ssoi: { resourceKey: "gateway", label: "Интеграция 1 элемента" },
  aps: { resourceKey: "detector", label: "Монтаж+ПНР 1 извещателя" },
  soue: { resourceKey: "speaker", label: "Монтаж+ПНР 1 оповещателя" },
};

function pickOptimalCoefficient({ key, value, objectData, zones }) {
  const maxFloors = Math.max(...zones.map((zone) => toNumber(zone.floors, 1)), 1);
  const parkingShare =
    zones.filter((zone) => zone.type === "parking").reduce((sum, zone) => sum + toNumber(zone.area), 0) /
    Math.max(zones.reduce((sum, zone) => sum + toNumber(zone.area), 0), 1);

  const recommendations = {
    vendorFactor:
      value > 1.15
        ? "Повышенный индекс вендора оправдан для объектов с высокой надежностью и сложной интеграцией."
        : "Для типового объекта обычно достаточно диапазона 0.95–1.10.",
    marketSnapshotFactor:
      value > 1.08
        ? "Рынок выше базового уровня, лучше закладывать дополнительный резерв по оборудованию."
        : "Индекс рынка близок к базе, можно работать в стандартном ценовом коридоре.",
    regionCoef:
      value > 1.1
        ? "Для удаленных и северных регионов коэффициент выше 1.1 обычно обоснован."
        : "Для центральной части РФ обычно достаточно диапазона 0.98–1.08.",
    cableCoef:
      parkingShare > 0.25
        ? "При большой доле паркинга и сложной трассировке рекомендуется 1.05–1.20."
        : "Для стандартного объекта обычно достаточно 0.95–1.05.",
    laborCoef:
      maxFloors > 8
        ? "Для высотных объектов чаще применяется коэффициент трудозатрат 1.05–1.20."
        : "Для типовых объектов обычно достаточно 0.95–1.05.",
    complexityCoef:
      objectData.objectType === "transport" || objectData.objectType === "energy"
        ? "Для транспортных и энергетических объектов обычно применяют 1.10–1.30."
        : "Для стандартных объектов обычно 1.00–1.10.",
    conditionLaborFactor:
      value > 1.2
        ? "Сложные условия подтверждают повышенный совокупный коэффициент."
        : "Совокупный коэффициент условий в районе 1.00–1.15 обычно достаточен.",
    designComplexityFactor:
      value > 1.2
        ? "Проектирование заметно усложнено (этажность, тип объекта, интеграция)."
        : "Сложность проектирования близка к базовой.",
  };

  return recommendations[key] || "Оптимальное значение зависит от сложности объекта и условий выполнения работ.";
}

function calcDesignComplexityFactor(system, objectData, zones) {
  const maxFloors = Math.max(...zones.map((zone) => toNumber(zone.floors, 1)), 1);
  const objectTypeBoost =
    objectData.objectType === "transport" || objectData.objectType === "energy"
      ? 0.16
      : objectData.objectType === "production"
        ? 0.1
        : 0.05;

  const systemBoost = system.type === "ssoi" ? 0.14 : system.type === "aps" || system.type === "soue" ? 0.1 : 0.07;
  const floorsBoost = Math.max(0, maxFloors - 3) * 0.018;

  return 1 + objectTypeBoost + systemBoost + floorsBoost;
}

function calcDesignDurationMonths(designHours, totalUnits) {
  const teamSize = Math.max(1, Math.min(5, Math.ceil(totalUnits / 120)));
  const monthlyCapacity = teamSize * 150;
  const months = Math.max(1, Math.ceil(designHours / Math.max(monthlyCapacity, 1)));
  return { months, teamSize };
}

function calcExecutionDuration(executionHours, totalUnits, suggestedCrewSize = null, suggestedMonths = null) {
  const crewSize = Math.max(1, Math.round(suggestedCrewSize || Math.max(2, Math.min(18, Math.ceil(totalUnits / 160)))));
  const executionDays = Math.max(1, Math.ceil(executionHours / Math.max(crewSize * 8, 1)));
  const executionMonths = Math.max(1, Math.ceil(executionDays / 22));
  return {
    crewSize,
    executionDays,
    executionMonths: Math.max(executionMonths, toNumber(suggestedMonths, executionMonths)),
  };
}

function calcCharges(baseRaw, budget, regionCoef) {
  const overheadRaw = baseRaw * (toNumber(budget.overheadPercent) / 100);
  const ppeRaw = baseRaw * (toNumber(budget.ppePercent) / 100);
  const payrollTaxesRaw = baseRaw * (toNumber(budget.payrollTaxesPercent) / 100);
  const utilizationRaw = baseRaw * (toNumber(budget.utilizationPercent) / 100);
  const adminRaw = (baseRaw + overheadRaw + ppeRaw + payrollTaxesRaw + utilizationRaw) * (toNumber(budget.adminPercent) / 100);

  const base = baseRaw * regionCoef;
  const overhead = overheadRaw * regionCoef;
  const ppe = ppeRaw * regionCoef;
  const payrollTaxes = payrollTaxesRaw * regionCoef;
  const utilization = utilizationRaw * regionCoef;
  const admin = adminRaw * regionCoef;
  const charges = overhead + ppe + payrollTaxes + utilization + admin;

  return {
    base,
    overhead,
    ppe,
    payrollTaxes,
    utilization,
    admin,
    charges,
    total: base + charges,
  };
}

function buildSystemMarker(systemType, resourceRows, workTotal, totalUnits) {
  const markerMeta = SYSTEM_MARKERS[systemType] || { resourceKey: "", label: "Стоимость 1 единицы" };
  const markerRow = resourceRows.find((row) => row.key === markerMeta.resourceKey);
  const markerQty = Math.max(toNumber(markerRow?.qty, 0) || toNumber(totalUnits, 0) || 1, 1);
  const costPerUnit = toNumber(workTotal, 0) / markerQty;

  return {
    key: markerMeta.resourceKey || "generic",
    label: markerMeta.label,
    qty: markerQty,
    costPerUnit,
  };
}

function buildModelResourceRows(resourceModel, zones) {
  return resourceModel.elements.map((element) =>
    zones.reduce(
      (acc, zone) => {
        const zoneArea = Math.max(toNumber(zone.area), 0);
        const floors = Math.max(toNumber(zone.floors, 1), 1);
        const zoneProfileKey = getZoneRateProfile(zone.type || "office");
        const zoneCalc = getZoneCalcProfile(zone.type || "office");
        const density = element.densityPer1000[zoneProfileKey] || element.densityPer1000.office || 0;
        const floorReserve = 1 + (floors - 1) * 0.012;
        const qty = (zoneArea / 1000) * density * zoneCalc.densityCoef;

        acc.qty += qty;
        acc.cable += qty * element.cablePerUnit * zoneCalc.cableCoef * floorReserve;
        acc.materials += qty * element.materialPerUnit;
        acc.mountHours += qty * element.mountHours * zoneCalc.laborCoef;
        acc.connectHours += qty * element.connectHours * zoneCalc.laborCoef;
        acc.setupHours += qty * element.setupHours * zoneCalc.laborCoef;
        acc.pnrHours += qty * element.pnrHours * zoneCalc.laborCoef;
        acc.designHours += qty * element.designHours * zoneCalc.laborCoef;
        return acc;
      },
      {
        key: element.key,
        label: element.label,
        qty: 0,
        cable: 0,
        materials: 0,
        mountHours: 0,
        connectHours: 0,
        setupHours: 0,
        pnrHours: 0,
        designHours: 0,
        priceShare: element.priceShare || 0,
      }
    )
  );
}

function buildApsRowsFromProject(modelRows, projectSnapshot) {
  if (!projectSnapshot?.active || !Array.isArray(projectSnapshot.items) || !projectSnapshot.items.length) {
    return null;
  }

  const rows = modelRows.map((row) => ({ ...row, qty: 0, cable: 0, materials: 0, mountHours: 0, connectHours: 0, setupHours: 0, pnrHours: 0, designHours: 0 }));
  const rowByKey = new Map(rows.map((row) => [row.key, row]));
  const modelByKey = new Map(modelRows.map((row) => [row.key, row]));

  const metrics = projectSnapshot.metrics || {};
  const detectorQty = Math.max(toNumber(metrics.detectorsQty, 0), 0);
  const panelQty = Math.max(toNumber(metrics.panelQty, 0) + toNumber(metrics.powerQty, 0), 0);
  const notificationQty = Math.max(toNumber(metrics.notificationQty, 0), 0);
  const cableLengthM = Math.max(toNumber(metrics.cableLengthM, 0), 0);

  if (rowByKey.has("detector")) rowByKey.get("detector").qty = detectorQty;
  if (rowByKey.has("module")) rowByKey.get("module").qty = panelQty;
  if (rowByKey.has("notification")) rowByKey.get("notification").qty = notificationQty;

  rows.forEach((row) => {
    const model = modelByKey.get(row.key);
    if (!model) return;
    row.cable += row.qty * toNumber(model.cable, 0) / Math.max(toNumber(model.qty, 0), 1);
    row.materials += row.qty * toNumber(model.materials, 0) / Math.max(toNumber(model.qty, 0), 1);
    row.mountHours += row.qty * toNumber(model.mountHours, 0) / Math.max(toNumber(model.qty, 0), 1);
    row.connectHours += row.qty * toNumber(model.connectHours, 0) / Math.max(toNumber(model.qty, 0), 1);
    row.setupHours += row.qty * toNumber(model.setupHours, 0) / Math.max(toNumber(model.qty, 0), 1);
    row.pnrHours += row.qty * toNumber(model.pnrHours, 0) / Math.max(toNumber(model.qty, 0), 1);
    row.designHours += row.qty * toNumber(model.designHours, 0) / Math.max(toNumber(model.qty, 0), 1);
  });

  if (cableLengthM > 0) {
    if (rowByKey.has("detector")) rowByKey.get("detector").cable += cableLengthM * 0.62;
    if (rowByKey.has("notification")) rowByKey.get("notification").cable += cableLengthM * 0.24;
    if (rowByKey.has("module")) rowByKey.get("module").cable += cableLengthM * 0.14;
  }

  const totalMaterialsFromRows = rows.reduce((sum, row) => sum + row.materials, 0);
  const projectedMaterials = Math.max(toNumber(projectSnapshot.totals?.materials, 0), 0);
  if (projectedMaterials > totalMaterialsFromRows && rowByKey.has("module")) {
    rowByKey.get("module").materials += projectedMaterials - totalMaterialsFromRows;
  }

  const totalUnits = rows.reduce((sum, row) => sum + row.qty, 0);
  const totalCable = rows.reduce((sum, row) => sum + row.cable, 0);
  const totalMaterials = rows.reduce((sum, row) => sum + row.materials, 0);
  const computedExecutionHours = rows.reduce((sum, row) => sum + row.mountHours + row.connectHours + row.setupHours + row.pnrHours, 0);
  const computedDesignHours = rows.reduce((sum, row) => sum + row.designHours, 0);

  const labor = projectSnapshot.labor || {};
  return {
    mode: "project_pdf",
    fileName: projectSnapshot.fileName,
    resourceRows: rows,
    totalUnits,
    totalCable,
    totalMaterials,
    executionHours: Math.max(toNumber(labor.executionHoursBase, computedExecutionHours), computedExecutionHours),
    designHours: Math.max(toNumber(labor.designHoursBase, computedDesignHours), computedDesignHours),
    equipmentCost: Math.max(toNumber(projectSnapshot.totals?.equipment, 0), 0),
    materialCost: projectedMaterials,
    keyEquipment: projectSnapshot.keyEquipment || [],
    marketEntries: projectSnapshot.priceEntries || [],
    bomItems: projectSnapshot.items || [],
    timeline: {
      crewSize: toNumber(labor.crewSize, null),
      executionMonths: toNumber(labor.executionMonths, null),
      designTeamSize: toNumber(labor.designTeamSize, null),
      designMonths: toNumber(labor.designMonths, null),
      executionDays: toNumber(labor.executionDays, null),
    },
  };
}

export function calculateSystemWithBreakdown(system, zones, budget, objectData = {}, marketSnapshot = null, projectSnapshot = null) {
  const base = calculateSystem(system, zones, budget, objectData, marketSnapshot);
  const rules = getSystemRules(system.type);
  const resourceModel = getSystemResourceModel(system.type);
  const budgetComplexity = toNumber(budget.complexityCoef, 1);
  const budgetLabor = toNumber(budget.laborCoef, 1);

  const modelRows = buildModelResourceRows(resourceModel, zones);
  const apsProjectData = system.type === "aps" ? buildApsRowsFromProject(modelRows, projectSnapshot) : null;
  const resourceRows = apsProjectData?.resourceRows || modelRows;

  let totalUnits = resourceRows.reduce((sum, row) => sum + row.qty, 0);
  let totalCable = resourceRows.reduce((sum, row) => sum + row.cable, 0);
  let totalMaterialsByRows = resourceRows.reduce((sum, row) => sum + row.materials, 0);
  let totalExecutionHours = resourceRows.reduce((sum, row) => sum + row.mountHours + row.connectHours + row.setupHours + row.pnrHours, 0);
  let totalDesignHours = resourceRows.reduce((sum, row) => sum + row.designHours, 0);

  if (apsProjectData) {
    totalUnits = apsProjectData.totalUnits;
    totalCable = apsProjectData.totalCable;
    totalMaterialsByRows = apsProjectData.totalMaterials;
    totalExecutionHours = apsProjectData.executionHours;
    totalDesignHours = apsProjectData.designHours;
  }

  const executionRate = totalExecutionHours > 0 ? base.workBase / totalExecutionHours : DESIGN_RATE_PER_HOUR;
  const executionBaseRaw = totalExecutionHours * executionRate * budgetLabor * budgetComplexity;
  const designComplexityFactor = calcDesignComplexityFactor(system, objectData, zones);
  const designBaseRaw = totalDesignHours * DESIGN_RATE_PER_HOUR * budgetComplexity * designComplexityFactor;

  let cableMaterials = totalCable * 92;
  let trayAndFasteners = totalCable * 51;
  const equipmentFromRows = resourceRows.reduce((sum, row) => sum + base.equipmentCost * row.priceShare, 0);
  let equipmentCost = equipmentFromRows > 0 ? equipmentFromRows : base.equipmentCost;
  let materialCost = cableMaterials + trayAndFasteners + totalMaterialsByRows;

  if (apsProjectData) {
    if (apsProjectData.equipmentCost > 0) equipmentCost = apsProjectData.equipmentCost;
    if (apsProjectData.materialCost > 0) {
      materialCost = apsProjectData.materialCost;
      cableMaterials = materialCost * 0.55;
      trayAndFasteners = materialCost * 0.2;
      totalMaterialsByRows = Math.max(materialCost - cableMaterials - trayAndFasteners, 0);
    }
  }

  const materialsBase = equipmentCost + materialCost;
  const regionCoef = toNumber(base.trace?.regionCoef, 1);
  const execution = calcCharges(executionBaseRaw, budget, regionCoef);
  const design = calcCharges(designBaseRaw, budget, regionCoef);

  const workTotal = execution.total;
  const designTotal = design.total;
  const directCost = materialsBase + workTotal + designTotal;
  const profit = directCost * (toNumber(budget.profitabilityPercent) / 100);
  const subtotal = directCost + profit;
  const vat = budget.taxMode === "osno" ? subtotal * (toNumber(budget.vatPercent) / 100) : 0;
  const total = subtotal + vat;

  const equipment = rules.equipmentMix.map((item) => {
    const matchingRow = resourceRows.find((row) => row.key === item.key);
    return {
      key: item.key,
      label: item.label,
      cost: matchingRow ? (matchingRow.priceShare || item.share) * equipmentCost : equipmentCost * item.share,
    };
  });

  const smrWeight = toNumber(rules.laborSplit.smr, 0.6);
  const pnrWeight = toNumber(rules.laborSplit.pnr, 0.25);
  const splitSum = Math.max(smrWeight + pnrWeight, 0.001);
  const works = {
    smr: execution.base * (smrWeight / splitSum),
    pnr: execution.base * (pnrWeight / splitSum),
    design: design.base,
  };

  const unitWorkMarker = buildSystemMarker(system.type, resourceRows, workTotal, totalUnits);
  const defaultDesignTimeline = calcDesignDurationMonths(totalDesignHours, totalUnits);
  const designTimeline = {
    months: Math.max(defaultDesignTimeline.months, toNumber(apsProjectData?.timeline?.designMonths, 0)),
    teamSize: Math.max(defaultDesignTimeline.teamSize, toNumber(apsProjectData?.timeline?.designTeamSize, 0)),
  };
  const executionTimeline = calcExecutionDuration(
    totalExecutionHours,
    totalUnits,
    apsProjectData?.timeline?.crewSize,
    apsProjectData?.timeline?.executionMonths
  );

  const explanation = [
    apsProjectData
      ? `Система АПС рассчитана по загруженному проекту PDF (${apsProjectData.fileName}).`
      : `Система рассчитана по внутренней модели по зонам и плотностям ресурсов.`,
    `Объем: ${Math.round(totalUnits)} единиц и ${Math.round(totalCable)} м кабеля.`,
    `Проектирование: ${totalDesignHours.toFixed(1)} ч, команда ~${designTimeline.teamSize} чел., срок ${designTimeline.months} мес.`,
    `Выполнение работ: ${totalExecutionHours.toFixed(1)} ч, бригада ~${executionTimeline.crewSize} чел., срок ${executionTimeline.executionDays} дн.`,
    `${unitWorkMarker.label}: ${unitWorkMarker.costPerUnit.toFixed(0)} ₽/ед.`,
    `Формула работ: база × коэффициенты условий + ФОТ + утилизация + СИЗ + АХР, далее применяется региональный коэффициент.`,
  ];

  const formulaRows = [
    {
      key: "vendorFactor",
      label: "Коэфф. вендора",
      value: base.trace?.vendorFactor ?? 1,
      useCase: "Учитывает ценовой и технологический профиль выбранного производителя.",
    },
    {
      key: "marketSnapshotFactor",
      label: "Коэфф. рынка (производитель + Tinko)",
      value: base.trace?.marketSnapshotFactor ?? 1,
      useCase: "Показывает влияние средней рыночной цены по результатам опроса источников.",
    },
    {
      key: "regionCoef",
      label: "Региональный коэфф.",
      value: base.trace?.regionCoef ?? 1,
      useCase: "Учитывает географию выполнения работ: логистику, климат и доступность ресурсов.",
    },
    {
      key: "cableCoef",
      label: "Коэфф. кабельных работ",
      value: base.trace?.cableCoef ?? 1,
      useCase: "Применяется при усложненной трассировке и повышенном резерве линий.",
    },
    {
      key: "laborCoef",
      label: "Коэфф. трудозатрат",
      value: base.trace?.laborCoef ?? 1,
      useCase: "Корректирует трудоемкость монтажа, ПНР и интеграции.",
    },
    {
      key: "complexityCoef",
      label: "Коэфф. сложности",
      value: base.trace?.complexityCoef ?? 1,
      useCase: "Учитывает интеграционную сложность и специальные требования проекта.",
    },
    {
      key: "conditionLaborFactor",
      label: "Сводный коэфф. условий",
      value: base.trace?.conditionLaborFactor ?? 1,
      useCase: "Высота, стесненность, ночные смены и работы на действующем объекте.",
    },
    {
      key: "designComplexityFactor",
      label: "Коэфф. сложности проектирования",
      value: designComplexityFactor,
      useCase: "Учитывает этажность, тип объекта и сложность выбранной системы.",
    },
  ];

  if (apsProjectData) {
    formulaRows.push({
      key: "projectPdfMode",
      label: "Режим: расчет по проекту PDF",
      value: 1,
      useCase: "Стоимость и объемы оборудования взяты из распознанной спецификации проекта.",
    });
  }

  const coefficientInsights = formulaRows.map((row) => ({
    ...row,
    recommended: pickOptimalCoefficient({ key: row.key, value: toNumber(row.value, 1), objectData, zones }),
  }));

  const bom = apsProjectData
    ? (apsProjectData.bomItems || []).map((item, index) => ({
        code: `APS-PDF-${index + 1}`,
        name: item.model ? `${item.name} (${item.model})` : item.name,
        qty: Math.max(toNumber(item.qty, 0), 0),
        unitPrice: toNumber(item.unitPrice, 0),
        total: toNumber(item.total, 0),
      }))
    : equipment.map((item) => ({
        code: `${system.type.toUpperCase()}-${item.key}`,
        name: item.label,
        qty: Math.max(Math.round(totalUnits * (item.cost / (equipmentCost || 1))), 1),
        unitPrice: item.cost / Math.max(Math.round(totalUnits * (item.cost / (equipmentCost || 1))), 1),
        total: item.cost,
      }));

  const equipmentData = apsProjectData
    ? {
        ...base.equipmentData,
        selectionKey: "aps_pdf_project",
        sourceMode: "project_pdf",
        unitPrice: equipmentCost / Math.max(totalUnits, 1),
        keyEquipment: apsProjectData.keyEquipment,
        details: apsProjectData.bomItems,
        marketEntries: apsProjectData.marketEntries,
      }
    : {
        ...base.equipmentData,
        sourceMode: "model",
      };

  return {
    ...base,
    estimateMode: apsProjectData ? "project_pdf" : "model",
    projectSpecFileName: apsProjectData?.fileName || "",
    cable: totalCable,
    units: totalUnits,
    equipmentCost,
    equipCost: equipmentCost,
    cableMaterials,
    trayAndFasteners,
    materialCost,
    materialsBase,
    laborBase: execution.base,
    workBase: executionBaseRaw,
    workCharges: execution.charges,
    workTotal,
    executionHours: totalExecutionHours,
    executionTeamSize: executionTimeline.crewSize,
    executionDurationDays: apsProjectData?.timeline?.executionDays || executionTimeline.executionDays,
    executionDurationMonths: executionTimeline.executionMonths,
    designHours: totalDesignHours,
    designBase: design.base,
    designCharges: design.charges,
    designTotal,
    designDurationMonths: designTimeline.months,
    designTeamSize: designTimeline.teamSize,
    unitWorkMarker,
    overhead: execution.overhead,
    ppe: execution.ppe,
    payrollTaxes: execution.payrollTaxes,
    utilization: execution.utilization,
    admin: execution.admin,
    designOverhead: design.overhead,
    designPpe: design.ppe,
    designPayrollTaxes: design.payrollTaxes,
    designUtilization: design.utilization,
    designAdmin: design.admin,
    profit,
    vat,
    total,
    equipmentData,
    bom,
    formulaRows,
    coefficientInsights,
    breakdown: {
      equipment,
      works,
      materials: {
        cable: cableMaterials,
        trayAndFasteners,
        resourceMaterials: totalMaterialsByRows,
      },
      resources: resourceRows,
    },
    explanation,
  };
}
