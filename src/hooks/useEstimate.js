import { useMemo, useState } from "react";
import { DEFAULT_BUDGET, DEFAULT_SYSTEM, DEFAULT_ZONE, OBJECT_TYPES } from "../config/estimateConfig";
import { buildEstimateRows, downloadCsv, toNumber } from "../lib/estimate";
import { buildHowCalculated, calculateEstimateEngine } from "../lib/estimateEngine";
import { buildZonesFromPreset, rebalanceZoneAreasWithLocks, validateZoneDistribution } from "../lib/zoneEngine";
import { fetchVendorPrices } from "../lib/priceCollector";
import { VENDOR_EQUIPMENT } from "../config/vendorConfig";
import { getRegionCoef } from "../config/regionsConfig";

export default function useEstimate() {
  const [step, setStep] = useState(0);
  const [objectData, setObjectData] = useState({
    projectName: "Объект 1",
    objectType: "tower",
    totalArea: 15000,
    floors: 5,
    basementFloors: 0,
    ceilingHeight: 3.2,
    region: "Москва",
    notes: "",
  });

  const [zones, setZones] = useState([
    DEFAULT_ZONE(1, "Офисные этажи", "office", 9000, 5),
    DEFAULT_ZONE(2, "Паркинг", "parking", 3000, 2),
    DEFAULT_ZONE(3, "Общие зоны", "public", 3000, 2),
  ]);
  const [systems, setSystems] = useState([DEFAULT_SYSTEM(1, "sot"), DEFAULT_SYSTEM(2, "sots"), DEFAULT_SYSTEM(3, "skud")]);
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [zonePreset, setZonePreset] = useState("business_center");
  const [lockedZoneIds, setLockedZoneIds] = useState([]);
  const [vendorPriceSnapshots, setVendorPriceSnapshots] = useState({});

  const recalculatedArea = useMemo(() => zones.reduce((sum, z) => sum + toNumber(z.area), 0), [zones]);
  const { systemsDetailed: systemResults, totals } = useMemo(
    () => calculateEstimateEngine(systems, zones, { ...budget, regionCoef: getRegionCoef(objectData.region) }, vendorPriceSnapshots),
    [systems, zones, budget, vendorPriceSnapshots, objectData.region]
  );
  const zoneDistribution = useMemo(() => validateZoneDistribution(zones, objectData.totalArea), [zones, objectData.totalArea]);

  const updateObject = (key, value) => setObjectData((prev) => ({ ...prev, [key]: value }));
  const updateZone = (id, key, value) => setZones((prev) => prev.map((z) => (z.id === id ? { ...z, [key]: value } : z)));
  const addZone = () => setZones((prev) => [...prev, DEFAULT_ZONE(Date.now(), `Зона ${prev.length + 1}`, "office", 1000, 1)]);
  const removeZone = (id) => setZones((prev) => (prev.length <= 1 ? prev : prev.filter((z) => z.id !== id)));
  const updateZoneShare = (zoneId, nextPercent) => setZones((prev) => rebalanceZoneAreasWithLocks(prev, zoneId, nextPercent, objectData.totalArea, lockedZoneIds));
  const toggleZoneLock = (zoneId) => setLockedZoneIds((prev) => (prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId]));
  const applyZonePreset = (presetKey) => {
    const next = buildZonesFromPreset(presetKey, objectData.totalArea);
    if (next.length) {
      setZones(next);
      setLockedZoneIds([]);
    }
  };

  const updateSystem = (id, key, value) => setSystems((prev) => prev.map((s) => (s.id === id ? { ...s, [key]: value } : s)));
  const addSystem = () => setSystems((prev) => [...prev, DEFAULT_SYSTEM(Date.now(), "sot")]);
  const removeSystem = (id) => setSystems((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.id !== id)));

  const updateSystemEquipmentProfile = (systemId, equipmentKey, profileKey) => setSystems((prev) =>
    prev.map((system) =>
      system.id === systemId
        ? { ...system, equipmentProfiles: { ...(system.equipmentProfiles || {}), [equipmentKey]: profileKey } }
        : system
    )
  );

  const updateBudget = (key, value) => setBudget((prev) => ({ ...prev, [key]: value }));

  const refreshVendorPricing = async (system) => {
    try {
      const snapshot = await fetchVendorPrices(system.type, system.vendor);
      setVendorPriceSnapshots((prev) => ({ ...prev, [system.id]: { ...snapshot, status: "ok" } }));
    } catch (error) {
      setVendorPriceSnapshots((prev) => ({
        ...prev,
        [system.id]: {
          fetchedAt: new Date().toISOString(),
          entries: [],
          status: "error",
          message: error.message,
        },
      }));
    }
  };

  const exportEstimate = () => {
    const objectTypeLabel = OBJECT_TYPES.find((x) => x.value === objectData.objectType)?.label || objectData.objectType;
    const rows = buildEstimateRows({ objectData: { ...objectData, objectTypeLabel }, recalculatedArea, systemResults, totals });
    downloadCsv(`${objectData.projectName || "smeta"}.csv`, rows);
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
    setZones,
  };
}
