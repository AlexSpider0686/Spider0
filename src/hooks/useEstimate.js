import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_BUDGET, DEFAULT_SYSTEM, DEFAULT_ZONE, OBJECT_TYPES, SYSTEM_TYPES, VENDORS } from "../config/estimateConfig";
import { buildEstimateRows, downloadCsv, toNumber } from "../lib/estimate";
import { calculateEstimateEngine } from "../lib/estimateEngine";
import { buildZonesFromPreset, rebalanceZoneAreasWithLocks, validateZoneDistribution } from "../lib/zoneEngine";
import { fetchPricesByRequests, fetchVendorPrices } from "../lib/priceCollector";
import { VENDOR_EQUIPMENT } from "../config/vendorConfig";
import { DEFAULT_REGION_NAME, getRegionCoef } from "../config/regionsConfig";
import { validateEstimateInput } from "../lib/input-normalization";

function removeById(mapObject, id) {
  if (!(id in mapObject)) return mapObject;
  const next = { ...mapObject };
  delete next[id];
  return next;
}

export default function useEstimate() {
  const [step, setStep] = useState(0);
  const [objectData, setObjectData] = useState({
    projectName: "Объект 1",
    objectType: "public",
    totalArea: 15000,
    floors: 5,
    basementFloors: 1,
    buildingStatus: "operational",
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
  const [apsProjectSnapshots, setApsProjectSnapshots] = useState({});
  const [apsImportStatuses, setApsImportStatuses] = useState({});

  const pricingSignaturesRef = useRef(new Map());
  const recalculatedArea = useMemo(() => zones.reduce((sum, zone) => sum + toNumber(zone.area), 0), [zones]);
  const { systemsDetailed: systemResults, totals } = useMemo(
    () => calculateEstimateEngine(systems, zones, budget, objectData, vendorPriceSnapshots, apsProjectSnapshots),
    [systems, zones, budget, objectData, vendorPriceSnapshots, apsProjectSnapshots]
  );
  const zoneDistribution = useMemo(() => validateZoneDistribution(zones, objectData.totalArea), [zones, objectData.totalArea]);
  const inputValidation = useMemo(
    () =>
      validateEstimateInput({
        system: systems[0],
        zones,
        budget,
        objectData: { ...objectData, protectedAreaM2: recalculatedArea },
        allSystems: systems,
      }),
    [systems, zones, budget, objectData, recalculatedArea]
  );

  const updateObject = (key, value) => {
    if (key === "regionName") {
      setObjectData((prev) => ({ ...prev, regionName: value, regionCoef: getRegionCoef(value) }));
      return;
    }
    setObjectData((prev) => ({ ...prev, [key]: value }));
  };

  const updateZone = (id, key, value) => {
    setZones((prev) => prev.map((zone) => (zone.id === id ? { ...zone, [key]: value } : zone)));
  };

  const addZone = () => setZones((prev) => [...prev, DEFAULT_ZONE(Date.now(), `Зона ${prev.length + 1}`, "office", 1000, 1)]);
  const removeZone = (id) => setZones((prev) => (prev.length <= 1 ? prev : prev.filter((zone) => zone.id !== id)));

  const updateZoneShare = (zoneId, nextPercent) =>
    setZones((prev) => rebalanceZoneAreasWithLocks(prev, zoneId, nextPercent, objectData.totalArea, lockedZoneIds));

  const toggleZoneLock = (zoneId) =>
    setLockedZoneIds((prev) => (prev.includes(zoneId) ? prev.filter((item) => item !== zoneId) : [...prev, zoneId]));

  const applyZonePreset = (presetKey) => {
    const next = buildZonesFromPreset(presetKey, objectData.totalArea);
    if (!next.length) return;
    setZones(next);
    setLockedZoneIds([]);
  };

  const updateSystem = (id, key, value) => {
    if (key === "type" && value !== "aps") {
      setApsProjectSnapshots((prev) => removeById(prev, id));
      setApsImportStatuses((prev) => removeById(prev, id));
    }

    setSystems((prev) => {
      if (key === "type" && prev.some((system) => system.id !== id && system.type === value)) {
        return prev;
      }

      return prev.map((system) => {
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
      });
    });
  };

  const addSystem = () =>
    setSystems((prev) => {
      const used = new Set(prev.map((item) => item.type));
      const nextType = SYSTEM_TYPES.find((item) => !used.has(item.code))?.code;
      if (!nextType) return prev;
      return [...prev, DEFAULT_SYSTEM(Date.now(), nextType)];
    });

  const removeSystem = (id) => {
    setSystems((prev) => (prev.length <= 1 ? prev : prev.filter((system) => system.id !== id)));
    setApsProjectSnapshots((prev) => removeById(prev, id));
    setApsImportStatuses((prev) => removeById(prev, id));
  };

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
    try {
      const snapshot = await fetchVendorPrices(system.type, system.vendor);
      setVendorPriceSnapshots((prev) => ({ ...prev, [system.id]: snapshot }));
    } catch (error) {
      setVendorPriceSnapshots((prev) => ({
        ...prev,
        [system.id]: {
          fetchedAt: new Date().toISOString(),
          entries: [],
          error: error.message,
        },
      }));
    }
  };

  const importApsProjectPdf = async (systemId, file) => {
    const system = systems.find((item) => item.id === systemId);
    if (!system || system.type !== "aps") {
      throw new Error("Импорт PDF доступен только для системы АПС.");
    }
    if (!file) return;

    setApsImportStatuses((prev) => ({
      ...prev,
      [systemId]: {
        state: "loading",
        message: "Идет анализ PDF и сбор цен...",
      },
    }));

    try {
      const [{ parseApsProjectPdf }, { buildApsProjectPriceRequests, buildApsProjectSnapshot }] = await Promise.all([
        import("../lib/apsProjectParser"),
        import("../lib/apsProjectEstimate"),
      ]);

      const parsedProject = await parseApsProjectPdf(file);
      const requests = buildApsProjectPriceRequests(parsedProject.items, system.vendor);
      const priceSnapshot = await fetchPricesByRequests(requests);
      const snapshot = buildApsProjectSnapshot({
        fileName: file.name,
        parsedProject,
        requests,
        priceSnapshot,
        objectData,
        vendorName: system.vendor,
      });

      setApsProjectSnapshots((prev) => ({ ...prev, [systemId]: snapshot }));
      setApsImportStatuses((prev) => ({
        ...prev,
        [systemId]: {
          state: "success",
          message: `Распознано позиций: ${snapshot.items.length}. Источников с ценой: ${snapshot.sourceStats.sourceWithPrice}.`,
        },
      }));
    } catch (error) {
      setApsImportStatuses((prev) => ({
        ...prev,
        [systemId]: {
          state: "error",
          message: error?.message || "Не удалось обработать PDF-проект.",
        },
      }));
      throw error;
    }
  };

  const clearApsProjectPdf = (systemId) => {
    setApsProjectSnapshots((prev) => removeById(prev, systemId));
    setApsImportStatuses((prev) => removeById(prev, systemId));
  };

  useEffect(() => {
    const systemIds = new Set(systems.map((item) => String(item.id)));
    setApsProjectSnapshots((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => systemIds.has(String(id)))));
    setApsImportStatuses((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => systemIds.has(String(id)))));
  }, [systems]);

  useEffect(() => {
    let cancelled = false;
    const systemIds = new Set(systems.map((item) => item.id));

    for (const key of pricingSignaturesRef.current.keys()) {
      if (!systemIds.has(key)) pricingSignaturesRef.current.delete(key);
    }

    const timeout = setTimeout(async () => {
      const changed = systems.filter((system) => {
        const signature = [
          system.type,
          system.vendor,
          system.customVendorIndex,
          JSON.stringify(system.selectedEquipmentParams || {}),
          JSON.stringify(system.equipmentProfiles || {}),
        ].join("|");
        const isNew = pricingSignaturesRef.current.get(system.id) !== signature;
        if (isNew) pricingSignaturesRef.current.set(system.id, signature);
        return isNew;
      });

      if (!changed.length) return;

      await Promise.all(
        changed.map(async (system) => {
          try {
            const snapshot = await fetchVendorPrices(system.type, system.vendor);
            if (cancelled) return;
            setVendorPriceSnapshots((prev) => ({ ...prev, [system.id]: snapshot }));
          } catch (error) {
            if (cancelled) return;
            setVendorPriceSnapshots((prev) => ({
              ...prev,
              [system.id]: {
                fetchedAt: new Date().toISOString(),
                entries: [],
                error: error.message,
              },
            }));
          }
        })
      );
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [systems]);

  const exportEstimate = async () => {
    try {
      const objectTypeLabel = OBJECT_TYPES.find((item) => item.value === objectData.objectType)?.label || objectData.objectType;
      const payload = { objectData: { ...objectData, objectTypeLabel }, budget, zones, recalculatedArea, systemResults, totals };
      const { exportEstimatePptx } = await import("../lib/pptxExport");
      await exportEstimatePptx(payload);
    } catch (error) {
      window.alert(`Ошибка экспорта PPTX: ${error?.message || "неизвестная ошибка"}`);
      throw error;
    }
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
    apsProjectSnapshots,
    apsImportStatuses,
    recalculatedArea,
    systemResults,
    totals,
    zoneDistribution,
    inputValidation,
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
    importApsProjectPdf,
    clearApsProjectPdf,
    exportEstimate,
    exportEstimateCsv,
    setZones,
    canAddMoreSystems: systems.length < SYSTEM_TYPES.length,
  };
}
