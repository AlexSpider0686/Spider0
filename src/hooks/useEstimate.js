import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_BUDGET, DEFAULT_SYSTEM, DEFAULT_ZONE, OBJECT_TYPES, SYSTEM_TYPES, VENDORS } from "../config/estimateConfig";
import { buildEstimateRows, downloadCsv, toNumber } from "../lib/estimate";
import { calculateEstimateEngine } from "../lib/estimateEngine";
import { buildZonesFromPreset, normalizeZoneAreas, rebalanceZoneAreasWithLocks, validateZoneDistribution } from "../lib/zoneEngine";
import { fetchPricesByRequests, fetchVendorPrices } from "../lib/priceCollector";
import { VENDOR_EQUIPMENT } from "../config/vendorConfig";
import { DEFAULT_REGION_NAME, getRegionCoef } from "../config/regionsConfig";
import { validateEstimateInput } from "../lib/input-normalization";
import { appendManualApsProjectItem, recalculateApsProjectSnapshot, removeApsProjectItem } from "../lib/apsProjectEstimate";
import { calculateProtectedArea } from "../lib/protectedArea";
import { verifyObjectAddress as verifyObjectAddressOnline } from "../lib/addressVerification";
import { createProjectIdentity } from "../lib/projectIdentity";
import { analyzeInspectionPhoto } from "../lib/aiPhotoInspection";
import { buildAiSurveyPlan, calculateAiSurveyCompletion } from "../lib/aiTechnicalChecklist";
import { buildAiTechnicalRecommendations } from "../lib/aiTechnicalConfigurator";

function removeById(mapObject, id) {
  if (!(id in mapObject)) return mapObject;
  const next = { ...mapObject };
  delete next[id];
  return next;
}

export default function useEstimate() {
  const initialIdentityRef = useRef(createProjectIdentity());
  const [step, setStep] = useState(0);
  const [objectData, setObjectData] = useState({
    ...initialIdentityRef.current,
    projectName: "Объект 1",
    address: "",
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
  const [technicalSolution, setTechnicalSolution] = useState({
    surveyStartedAt: null,
    answers: {},
    photoAnalyses: {},
    appliedAnswers: {},
    appliedPhotoAnalyses: {},
    appliedAt: null,
    specOverrides: {},
  });
  const [addressVerification, setAddressVerification] = useState({
    state: "idle",
    message: "Введите адрес объекта и запустите онлайн-проверку.",
    result: null,
  });

  const pricingSignaturesRef = useRef(new Map());
  const protectedAreaMeta = useMemo(() => calculateProtectedArea(objectData), [objectData]);
  const recalculatedArea = protectedAreaMeta.protectedAreaM2;
  const { systemsDetailed: systemResults, totals } = useMemo(
    () => calculateEstimateEngine(systems, zones, budget, objectData, vendorPriceSnapshots, apsProjectSnapshots),
    [systems, zones, budget, objectData, vendorPriceSnapshots, apsProjectSnapshots]
  );
  const zoneDistribution = useMemo(() => validateZoneDistribution(zones, recalculatedArea), [zones, recalculatedArea]);
  const aiSurveyPlan = useMemo(
    () =>
      buildAiSurveyPlan({
        objectData,
        zones,
        systems,
        protectedArea: recalculatedArea,
      }),
    [objectData, zones, systems, recalculatedArea]
  );
  const aiSurveyCompletion = useMemo(
    () => calculateAiSurveyCompletion(aiSurveyPlan, technicalSolution.answers),
    [aiSurveyPlan, technicalSolution.answers]
  );
  const appliedAiSurveyCompletion = useMemo(
    () => calculateAiSurveyCompletion(aiSurveyPlan, technicalSolution.appliedAnswers),
    [aiSurveyPlan, technicalSolution.appliedAnswers]
  );
  const technicalRecommendations = useMemo(
    () =>
      buildAiTechnicalRecommendations({
        systems,
        systemResults,
        objectData,
        zones,
        surveyAnswers: technicalSolution.appliedAnswers,
        apsProjectSnapshots,
        specOverrides: technicalSolution.specOverrides,
      }),
    [systems, systemResults, objectData, zones, technicalSolution.appliedAnswers, technicalSolution.specOverrides, apsProjectSnapshots]
  );
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
    if (key === "address") {
      setObjectData((prev) => ({ ...prev, address: value }));
      setAddressVerification((prev) =>
        prev.state === "idle" && !prev.result
          ? { ...prev, message: "Введите адрес объекта и запустите онлайн-проверку." }
          : { state: "idle", message: "Адрес изменён. Выполните проверку заново.", result: null }
      );
      return;
    }
    setObjectData((prev) => ({ ...prev, [key]: value }));
  };

  const verifyObjectAddress = async () => {
    const currentAddress = String(objectData.address || "").trim();
    if (!currentAddress) {
      setAddressVerification({
        state: "error",
        message: "Укажите адрес объекта перед проверкой.",
        result: null,
      });
      return;
    }

    setAddressVerification({
      state: "loading",
      message: "Идёт онлайн-поиск и уточнение адреса...",
      result: null,
    });

    try {
      const result = await verifyObjectAddressOnline(currentAddress);
      setObjectData((prev) => ({
        ...prev,
        address: result.verifiedLabel || prev.address,
        regionName: result.regionName || prev.regionName,
        regionCoef: result.regionName ? getRegionCoef(result.regionName) : prev.regionCoef,
      }));
      setAddressVerification({
        state: "success",
        message: "Адрес подтверждён и приведён к корректному формату.",
        result,
      });
    } catch (error) {
      setAddressVerification({
        state: "error",
        message: error?.message || "Не удалось подтвердить адрес объекта.",
        result: null,
      });
    }
  };

  const updateZone = (id, key, value) => {
    setZones((prev) => prev.map((zone) => (zone.id === id ? { ...zone, [key]: value } : zone)));
  };

  useEffect(() => {
    setZones((prev) => normalizeZoneAreas(prev, recalculatedArea));
  }, [recalculatedArea]);

  const addZone = () => setZones((prev) => [...prev, DEFAULT_ZONE(Date.now(), `Зона ${prev.length + 1}`, "office", 1000, 1)]);
  const removeZone = (id) => setZones((prev) => (prev.length <= 1 ? prev : prev.filter((zone) => zone.id !== id)));

  const updateZoneShare = (zoneId, nextPercent) =>
    setZones((prev) => rebalanceZoneAreasWithLocks(prev, zoneId, nextPercent, recalculatedArea, lockedZoneIds));

  const toggleZoneLock = (zoneId) =>
    setLockedZoneIds((prev) => (prev.includes(zoneId) ? prev.filter((item) => item !== zoneId) : [...prev, zoneId]));

  const applyZonePreset = (presetKey) => {
    const next = buildZonesFromPreset(presetKey, recalculatedArea);
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

  const toggleSystemRegistry = (type, enabled) => {
    if (enabled) {
      setSystems((prev) => {
        if (prev.some((system) => system.type === type)) return prev;
        return [...prev, DEFAULT_SYSTEM(Date.now(), type)];
      });
      return;
    }

    const targetSystem = systems.find((system) => system.type === type);
    if (!targetSystem || systems.length <= 1) return;
    removeSystem(targetSystem.id);
  };

  const updateSystemWorkingDocs = (systemId, hasWorkingDocs) => {
    setSystems((prev) => prev.map((system) => (system.id === systemId ? { ...system, hasWorkingDocs: Boolean(hasWorkingDocs) } : system)));
  };

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
    const apsSnapshot = apsProjectSnapshots?.[system?.id];
    if (system?.type === "aps" && apsSnapshot?.active) {
      setApsImportStatuses((prev) => ({
        ...prev,
        [system.id]: {
          state: "loading",
          message: "Идет повторный опрос источников цен по позициям проекта...",
        },
      }));

      try {
        const { buildApsProjectPriceRequests, buildApsProjectSnapshot } = await import("../lib/apsProjectEstimate");
        const originalItems =
          Array.isArray(apsSnapshot.originalItems) && apsSnapshot.originalItems.length ? apsSnapshot.originalItems : apsSnapshot.items || [];
        const parsedProject = {
          parsedAt: apsSnapshot.parsedAt || new Date().toISOString(),
          gostStandard: apsSnapshot.gostStandard || "ГОСТ 21.110-2013",
          linesScanned: apsSnapshot.linesScanned || 0,
          pages: apsSnapshot.pages || 0,
          items: originalItems,
          metrics: apsSnapshot.metrics || {},
          unrecognizedRows: apsSnapshot.unrecognizedRows || [],
          parseQuality: apsSnapshot.parseQuality || {},
          aiQuality: apsSnapshot.aiQuality || null,
        };

        const requests = buildApsProjectPriceRequests(originalItems, system.vendor);
        const priceSnapshot = await fetchPricesByRequests(requests);
        let refreshedSnapshot = buildApsProjectSnapshot({
          fileName: apsSnapshot.fileName || "aps-project.pdf",
          parsedProject,
          requests,
          priceSnapshot,
          objectData,
          vendorName: system.vendor,
        });

        if (apsSnapshot.itemOverrides && Object.keys(apsSnapshot.itemOverrides).length) {
          refreshedSnapshot = recalculateApsProjectSnapshot(refreshedSnapshot, apsSnapshot.itemOverrides, objectData);
        }

        setApsProjectSnapshots((prev) => ({ ...prev, [system.id]: refreshedSnapshot }));
        setVendorPriceSnapshots((prev) => ({ ...prev, [system.id]: priceSnapshot }));
        setApsImportStatuses((prev) => ({
          ...prev,
          [system.id]: {
            state: "success",
            message: `Обновлено: позиций с ценой поставщика ${refreshedSnapshot.sourceStats.itemsWithSupplierPrice}, без цены ${refreshedSnapshot.sourceStats.itemsWithoutPrice}.`,
          },
        }));
      } catch (error) {
        setApsImportStatuses((prev) => ({
          ...prev,
          [system.id]: {
            state: "error",
            message: error?.message || "Не удалось обновить цены по позициям проекта.",
          },
        }));
      }
      return;
    }

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
          message: `Позиции в спецификации: ${snapshot.items.length}. С ценой от поставщиков: ${snapshot.sourceStats.itemsWithSupplierPrice}. Без цены: ${snapshot.sourceStats.itemsWithoutPrice}.`,
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

  const updateApsProjectItem = (systemId, itemId, patch = {}) => {
    const normalizedPatch = {};
    if (Object.prototype.hasOwnProperty.call(patch, "qty")) {
      normalizedPatch.qty = Math.max(toNumber(patch.qty, 0), 0);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "unitPrice")) {
      normalizedPatch.unitPrice = Math.max(toNumber(patch.unitPrice, 0), 0);
    }

    setApsProjectSnapshots((prev) => {
      const current = prev?.[systemId];
      if (!current) return prev;
      const next = recalculateApsProjectSnapshot(current, { [itemId]: normalizedPatch }, objectData);
      return { ...prev, [systemId]: next };
    });

    setApsImportStatuses((prev) => {
      const currentStatus = prev?.[systemId];
      if (!currentStatus || currentStatus.state === "loading") return prev;
      return {
        ...prev,
        [systemId]: {
          ...currentStatus,
          state: "success",
          message: "Позиции отредактированы вручную. Пересчет выполнен.",
        },
      };
    });
  };

  const addApsProjectItem = (systemId, draft = {}) => {
    setApsProjectSnapshots((prev) => {
      const current = prev?.[systemId];
      if (!current) return prev;
      const next = appendManualApsProjectItem(current, draft, objectData);
      return { ...prev, [systemId]: next };
    });

    setApsImportStatuses((prev) => {
      const currentStatus = prev?.[systemId];
      if (!currentStatus || currentStatus.state === "loading") return prev;
      return {
        ...prev,
        [systemId]: {
          ...currentStatus,
          state: "success",
          message: "Добавлена ручная позиция. Пересчет выполнен.",
        },
      };
    });
  };

  const removeApsProjectItemById = (systemId, itemId) => {
    setApsProjectSnapshots((prev) => {
      const current = prev?.[systemId];
      if (!current) return prev;
      const next = removeApsProjectItem(current, itemId, objectData);
      return { ...prev, [systemId]: next };
    });

    setApsImportStatuses((prev) => {
      const currentStatus = prev?.[systemId];
      if (!currentStatus || currentStatus.state === "loading") return prev;
      return {
        ...prev,
        [systemId]: {
          ...currentStatus,
          state: "success",
          message: "Позиция удалена. Пересчет выполнен.",
        },
      };
    });
  };

  useEffect(() => {
    const systemIds = new Set(systems.map((item) => String(item.id)));
    setApsProjectSnapshots((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => systemIds.has(String(id)))));
    setApsImportStatuses((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => systemIds.has(String(id)))));
  }, [systems]);

  useEffect(() => {
    setApsProjectSnapshots((prev) => {
      const entries = Object.entries(prev || {});
      if (!entries.length) return prev;
      const next = {};
      for (const [systemId, snapshot] of entries) {
        next[systemId] = recalculateApsProjectSnapshot(snapshot, {}, objectData);
      }
      return next;
    });
  }, [objectData.totalArea, objectData.floors, objectData.basementFloors, objectData.regionCoef, objectData.buildingStatus]);

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
      const apsProjectExports = systems
        .map((system) => {
          const snapshot = apsProjectSnapshots?.[system.id];
          if (!snapshot?.active) return null;
          return {
            systemId: system.id,
            systemType: system.type,
            systemName: SYSTEM_TYPES.find((item) => item.code === system.type)?.name || system.type,
            vendor: system.vendor,
            fileName: snapshot.fileName || "",
            gostStandard: snapshot.gostStandard || "",
            recognitionRate: snapshot.sourceStats?.recognitionRate || 0,
            items: Array.isArray(snapshot.items) ? snapshot.items : [],
          };
        })
        .filter(Boolean);
      const payload = {
        objectData: { ...objectData, objectTypeLabel },
        budget,
        zones,
        recalculatedArea,
        systemResults,
        totals,
        apsProjectExports,
      };
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

  const startAiSurvey = () => {
    if (!aiSurveyPlan.readiness.isReady) return false;
    setTechnicalSolution((prev) => ({
      ...prev,
      surveyStartedAt: prev.surveyStartedAt || new Date().toISOString(),
    }));
    return true;
  };

  const updateAiSurveyAnswer = (questionId, value) => {
    setTechnicalSolution((prev) => ({
      ...prev,
      answers: {
        ...prev.answers,
        [questionId]: value,
      },
    }));
  };

  const analyzeAiSurveyPhoto = async (prompt, file) => {
    if (!prompt || !file) return null;

    setTechnicalSolution((prev) => ({
      ...prev,
      photoAnalyses: {
        ...prev.photoAnalyses,
        [prompt.id]: {
          state: "loading",
          fileName: file.name,
          summary: "Идет AI-анализ фото...",
        },
      },
    }));

    try {
      const result = await analyzeInspectionPhoto({
        file,
        prompt,
        objectData,
        zones,
      });

      setTechnicalSolution((prev) => {
        const nextAnswers = { ...prev.answers };
        if (result?.accepted !== false) {
          for (const suggestion of result?.suggestedAnswers || []) {
            nextAnswers[suggestion.questionId] = suggestion.value;
          }
        }

        return {
          ...prev,
          answers: nextAnswers,
          photoAnalyses: {
            ...prev.photoAnalyses,
            [prompt.id]: {
              state: result?.accepted === false ? "error" : "success",
              fileName: file.name,
              summary: result.summary,
              confidence: result.confidence,
              detections: result.detections || [],
              suggestedAnswers: result.suggestedAnswers || [],
              accepted: result?.accepted !== false,
            },
          },
        };
      });

      return result;
    } catch (error) {
      setTechnicalSolution((prev) => ({
        ...prev,
        photoAnalyses: {
          ...prev.photoAnalyses,
          [prompt.id]: {
            state: "error",
            fileName: file.name,
            summary: error?.message || "Не удалось обработать фото.",
            detections: [],
          },
        },
      }));
      throw error;
    }
  };

  const updateTechnicalSpecOverride = (systemId, rowKey, patch = {}) => {
    setTechnicalSolution((prev) => ({
      ...prev,
      specOverrides: {
        ...prev.specOverrides,
        [systemId]: {
          ...(prev.specOverrides?.[systemId] || {}),
          [rowKey]: {
            ...(prev.specOverrides?.[systemId]?.[rowKey] || {}),
            ...patch,
          },
        },
      },
    }));
  };

  const applyAiSurveyData = () => {
    if ((aiSurveyCompletion?.percent || 0) < 100) return false;

    setTechnicalSolution((prev) => ({
      ...prev,
      appliedAnswers: { ...prev.answers },
      appliedPhotoAnalyses: { ...prev.photoAnalyses },
      appliedAt: new Date().toISOString(),
    }));

    return true;
  };

  return {
    step,
    setStep,
    objectData,
    addressVerification,
    zones,
    systems,
    budget,
    zonePreset,
    setZonePreset,
    lockedZoneIds,
    vendorPriceSnapshots,
    apsProjectSnapshots,
    apsImportStatuses,
    protectedAreaMeta,
    recalculatedArea,
    systemResults,
    totals,
    zoneDistribution,
    inputValidation,
    technicalSolution,
    aiSurveyPlan,
    aiSurveyCompletion,
    appliedAiSurveyCompletion,
    technicalRecommendations,
    VENDOR_EQUIPMENT,
    updateObject,
    verifyObjectAddress,
    updateZone,
    addZone,
    removeZone,
    updateZoneShare,
    toggleZoneLock,
    applyZonePreset,
    updateSystem,
    toggleSystemRegistry,
    updateSystemWorkingDocs,
    addSystem,
    removeSystem,
    updateSystemEquipmentProfile,
    updateBudget,
    refreshVendorPricing,
    importApsProjectPdf,
    clearApsProjectPdf,
    updateApsProjectItem,
    addApsProjectItem,
    removeApsProjectItemById,
    startAiSurvey,
    updateAiSurveyAnswer,
    analyzeAiSurveyPhoto,
    applyAiSurveyData,
    updateTechnicalSpecOverride,
    exportEstimate,
    exportEstimateCsv,
    setZones,
    canAddMoreSystems: systems.length < SYSTEM_TYPES.length,
  };
}
