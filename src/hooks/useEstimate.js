import { useMemo, useState } from "react";
import { DEFAULT_BUDGET, DEFAULT_SYSTEM, DEFAULT_ZONE, OBJECT_TYPES, VENDORS } from "../config/estimateConfig";
import { buildEstimateRows, downloadCsv, toNumber } from "../lib/estimate";
import { calculateEstimateEngine } from "../lib/estimateEngine";
import { buildZonesFromPreset, rebalanceZoneAreasWithLocks, validateZoneDistribution } from "../lib/zoneEngine";
import { fetchVendorPrices } from "../lib/priceCollector";
import { VENDOR_EQUIPMENT } from "../config/vendorConfig";
import { DEFAULT_REGION_NAME, getRegionCoef } from "../config/regionsConfig";
import { exportEstimatePptx } from "../lib/pptxExport";

export default function useEstimate() {
  const [step, setStep] = useState(0);
  const [objectData, setObjectData] = useState({
    projectName: "Объект 1",
    objectType: "public",
    totalArea: 15000,
    floors: 5,
    basementFloors: 1,
    ceilingHeight: 3.2,
    regionName: DEFAULT_REGION_NAME,
    regionCoef: getRegionCoef(DEFAULT_REGION_NAME),
    notes: "",
  });

  const [zones, setZones] = useState([
    DEFAULT_ZONE(1, "Офисные зоны", "office", 7500, 5),
    DEFAULT_ZONE(2, "Паркинг", "parking", 4500, 2),
    DEFAULT_ZONE(3, "Общественные зоны", "lobby", 3000, 2),
  ]);
  const [systems, setSystems] = useState([DEFAULT_SYSTEM(1, "sot"), DEFAULT_SYSTEM(2, "sots"), DEFAULT_SYSTEM(3, "skud")]);
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [zonePreset, setZonePreset] = useState("business_center");
  const [lockedZoneIds, setLockedZoneIds] = useState([]);
  const [vendorPriceSnapshots, setVendorPriceSnapshots] = useState({});

  const recalculatedArea = useMemo(() => zones.reduce((sum, zone) => sum + toNumber(zone.area), 0), [zones]);
  const { systemsDetailed: systemResults, totals } = useMemo(
    () => calculateEstimateEngine(systems, zones, budget, objectData),
    [systems, zones, budget, objectData]
  );
  const zoneDistribution = useMemo(() => validateZoneDistribution(zones, objectData.totalArea), [zones, objectData.totalArea]);

  const updateObject = (key, value) => {
    if (key === "regionName") {
      setObjectData((prev) => ({ ...prev, regionName: value, regionCoef: getRegionCoef(value) }));
      return;
    }
    setObjectData((prev) => ({ ...prev, [key]: value }));
  };

  const updateZone = (id, key, value) => setZones((prev) => prev.map((zone) => (zone.id === id ? { ...zone, [key]: value } : zone)));
  const addZone = () => setZones((prev) => [...prev, DEFAULT_ZONE(Date.now(), `Зона ${prev.length + 1}`, "office", 1000, 1)]);
  const removeZone = (id) => setZones((prev) => (prev.length <= 1 ? prev : prev.filter((zone) => zone.id !== id)));
  const updateZoneShare = (zoneId, nextPercent) =>
    setZones((prev) => rebalanceZoneAreasWithLocks(prev, zoneId, nextPercent, objectData.totalArea, lockedZoneIds));
  const toggleZoneLock = (zoneId) =>
    setLockedZoneIds((prev) => (prev.includes(zoneId) ? prev.filter((item) => item !== zoneId) : [...prev, zoneId]));

  const applyZonePreset = (presetKey) => {
    const next = buildZonesFromPreset(presetKey, objectData.totalArea);
    if (next.length) {
      setZones(next);
      setLockedZoneIds([]);
    }
  };

  const updateSystem = (id, key, value) =>
    setSystems((prev) =>
      prev.map((system) => {
        if (system.id !== id) return system;
        if (key !== "type") return { ...system, [key]: value };
        const nextType = value;
        const nextVendors = VENDORS[nextType] || ["Базовый"];
        return {
          ...system,
          type: nextType,
          vendor: nextVendors[0],
          baseVendor: nextVendors[0],
          customVendorIndex: 1,
          selectedEquipmentParams: {},
        };
      })
    );

  const addSystem = () => setSystems((prev) => [...prev, DEFAULT_SYSTEM(Date.now(), "sot")]);
  const removeSystem = (id) => setSystems((prev) => (prev.length <= 1 ? prev : prev.filter((system) => system.id !== id)));

  const updateSystemEquipmentProfile = (systemId, equipmentKey, profileKey) =>
    setSystems((prev) =>
      prev.map((system) =>
        system.id === systemId
          ? { ...system, equipmentProfiles: { ...(system.equipmentProfiles || {}), [equipmentKey]: profileKey } }
          : system
      )
    );

  const updateBudget = (key, value) => setBudget((prev) => ({ ...prev, [key]: value }));

  const refreshVendorPricing = async (system) => {
    const snapshot = await fetchVendorPrices(system.type, system.vendor);
    setVendorPriceSnapshots((prev) => ({ ...prev, [system.id]: snapshot }));
  };

  const exportEstimate = async () => {
    const objectTypeLabel = OBJECT_TYPES.find((item) => item.value === objectData.objectType)?.label || objectData.objectType;
    const payload = { objectData: { ...objectData, objectTypeLabel }, recalculatedArea, systemResults, totals };
    await exportEstimatePptx(payload);
  };

  const exportEstimateCsv = () => {
    const objectTypeLabel = OBJECT_TYPES.find((item) => item.value === objectData.objectType)?.label || objectData.objectType;
    const rows = buildEstimateRows({ objectData: { ...objectData, objectTypeLabel }, recalculatedArea, systemResults, totals });
    downloadCsv(`${objectData.projectName || "estimate"}.csv`, rows);
  };

  return {
    step,
    setStep,
    objectData,
    zones,
    systems,
    budget,
    zonePreset,
    setZonePreset,
    lockedZoneIds,
    vendorPriceSnapshots,
    recalculatedArea,
    systemResults,
    totals,
    zoneDistribution,
    VENDOR_EQUIPMENT,
    updateObject,
    updateZone,
    addZone,
    removeZone,
    updateZoneShare,
    toggleZoneLock,
    applyZonePreset,
    updateSystem,
    addSystem,
    removeSystem,
    updateSystemEquipmentProfile,
    updateBudget,
    refreshVendorPricing,
    exportEstimate,
    exportEstimateCsv,
    setZones,
  };
}
