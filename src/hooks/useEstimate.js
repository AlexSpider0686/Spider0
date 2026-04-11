import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_BUDGET, DEFAULT_SYSTEM, DEFAULT_ZONE, OBJECT_TYPES, SYSTEM_TYPES, VENDORS } from "../config/estimateConfig";
import { buildEstimateRows, downloadCsv, num, toNumber } from "../lib/estimate";
import { calculateEstimateEngine } from "../lib/estimateEngine";
import { buildZonesFromPreset, normalizeZoneAreas, rebalanceZoneAreasWithLocks, validateZoneDistribution } from "../lib/zoneEngine";
import { fetchPricesByRequests, fetchVendorPrices, summarizePriceSnapshot } from "../lib/priceCollector";
import { VENDOR_EQUIPMENT } from "../config/vendorConfig";
import { DEFAULT_REGION_NAME, getRegionCoef } from "../config/regionsConfig";
import { validateEstimateInput } from "../lib/input-normalization";
import {
  appendManualApsProjectItem,
  buildApsProjectPriceRequests,
  buildApsProjectSnapshot,
  recalculateApsProjectSnapshot,
  removeApsProjectItem,
} from "../lib/apsProjectEstimate";
import { calculateProtectedArea } from "../lib/protectedArea";
import { verifyObjectAddress as verifyObjectAddressOnline } from "../lib/addressVerification";
import { createProjectIdentity } from "../lib/projectIdentity";
import { analyzeInspectionPhoto } from "../lib/aiPhotoInspectionStrict";
import { buildAiSurveyPlan, calculateAiSurveyCompletion } from "../lib/aiTechnicalChecklist";
import { buildAiTechnicalRecommendations } from "../lib/aiTechnicalConfigurator";
import { buildAiProjectRisks } from "../lib/aiProjectRiskEngine";
import { aggregatePlanRecognitions } from "../lib/evacuationPlanRecognition";
import { downloadAllSystemsSpecificationExcel, downloadSystemSpecificationExcel } from "../lib/specExport";
import { buildNormativeRequirements } from "../lib/normativeRequirements";
import { repairUtf8Cp1251Mojibake } from "../lib/textEncoding";
import { applyTravelToResults, buildInitialTravelEstimate, createEmptyTravelEstimate, recalculateTravelEstimateDraft } from "../lib/travelEstimate";
import { downloadProjectPassport, readProjectPassport } from "../lib/projectPassport";
import { exportAiSurveyChecklist as exportAiSurveyChecklistDoc } from "../lib/aiSurveyChecklistExport";

function removeById(mapObject, id) {
  if (!(id in mapObject)) return mapObject;
  const next = { ...mapObject };
  delete next[id];
  return next;
}

function removeManyByIds(mapObject, ids = []) {
  if (!mapObject || !ids.length) return mapObject || {};
  const next = { ...mapObject };
  let changed = false;
  ids.forEach((id) => {
    if (id in next) {
      delete next[id];
      changed = true;
    }
  });
  return changed ? next : mapObject;
}

function hasKeys(value) {
  return Boolean(value && Object.keys(value).length);
}

function buildFallbackPriceSnapshot() {
  return {
    fetchedAt: new Date().toISOString(),
    entries: [],
    warning: "price_collection_unavailable_fallback_mode",
  };
}

function buildVendorPricingFallbackSnapshot(previousSnapshot = null, error = null) {
  return {
    ...(previousSnapshot || {}),
    fetchedAt: new Date().toISOString(),
    entries: Array.isArray(previousSnapshot?.entries) ? previousSnapshot.entries : [],
    warning:
      error?.message ||
      "Сервис сбора цен временно недоступен. Использован резервный режим с сохранением текущих данных и fallback-логики.",
    error: "",
    stale: true,
  };
}

function buildApsImportStatus(state, message, extra = {}) {
  return {
    state,
    message,
    startedAt: extra.startedAt || new Date().toISOString(),
    stage: extra.stage || "",
    ...extra,
  };
}

function isAbortLikeError(error) {
  return error?.name === "AbortError" || error?.code === 20;
}

function deriveSurveyAreaRefinement(photoAnalyses = {}, fallbackTotalArea = 0) {
  const byZone = new Map();

  Object.values(photoAnalyses || {}).forEach((analysis) => {
    if (analysis?.accepted === false) return;
    const comparison = analysis?.planRecognition?.areaComparison;
    if (!comparison) return;
    const zoneKey = String(analysis?.zoneId || analysis?.planRecognition?.zoneId || `zone-${byZone.size + 1}`);
    byZone.set(zoneKey, comparison);
  });

  if (!byZone.size) return null;

  const aggregate = Array.from(byZone.values()).reduce(
    (sum, item) => {
      sum.userTotalArea += toNumber(item?.userTotalArea, 0);
      sum.predictedTotalArea += toNumber(item?.predictedTotalArea, 0);
      sum.recognizedAverageFloorArea += toNumber(item?.recognizedAverageFloorArea, 0);
      return sum;
    },
    {
      userTotalArea: 0,
      predictedTotalArea: 0,
      recognizedAverageFloorArea: 0,
    }
  );

  const userTotalArea = aggregate.userTotalArea || toNumber(fallbackTotalArea, 0);
  const predictedTotalArea = aggregate.predictedTotalArea || userTotalArea;
  const adjustedTotalArea = Number(((predictedTotalArea * 0.75 + userTotalArea * 0.25) || userTotalArea).toFixed(1));
  const deviationPercent = userTotalArea > 0 ? Number((((adjustedTotalArea - userTotalArea) / userTotalArea) * 100).toFixed(1)) : 0;

  return {
    sourceZones: byZone.size,
    userTotalArea: Number(userTotalArea.toFixed(1)),
    predictedTotalArea: Number(predictedTotalArea.toFixed(1)),
    adjustedTotalArea,
    recognizedAverageFloorArea: Number((aggregate.recognizedAverageFloorArea / Math.max(byZone.size, 1)).toFixed(1)),
    deviationPercent,
  };
}

export default function useEstimate() {
  const t = repairUtf8Cp1251Mojibake;
  const initialIdentityRef = useRef(createProjectIdentity());
  const apsImportTasksRef = useRef(new Map());
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
  const [normativeRequirementsApplied, setNormativeRequirementsApplied] = useState(true);
  const [zonePreset, setZonePreset] = useState("business_center");
  const [lockedZoneIds, setLockedZoneIds] = useState([]);
  const [vendorPriceSnapshots, setVendorPriceSnapshots] = useState({});
  const [vendorPricingProgressBySystem, setVendorPricingProgressBySystem] = useState({});
  const [vendorComparisonsBySystem, setVendorComparisonsBySystem] = useState({});
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
  const [travelEstimate, setTravelEstimate] = useState(() => createEmptyTravelEstimate());
  const appliedSurveyAreaRefinement = useMemo(
    () => deriveSurveyAreaRefinement(technicalSolution.appliedPhotoAnalyses, objectData.totalArea),
    [technicalSolution.appliedPhotoAnalyses, objectData.totalArea]
  );
  const draftSurveyAreaRefinement = useMemo(
    () => deriveSurveyAreaRefinement(technicalSolution.photoAnalyses, objectData.totalArea),
    [technicalSolution.photoAnalyses, objectData.totalArea]
  );
  const effectiveObjectData = useMemo(
    () =>
      appliedSurveyAreaRefinement
        ? {
            ...objectData,
            totalArea: appliedSurveyAreaRefinement.adjustedTotalArea,
            userDeclaredTotalArea: objectData.totalArea,
            surveyAdjustedTotalArea: appliedSurveyAreaRefinement.adjustedTotalArea,
          }
        : objectData,
    [objectData, appliedSurveyAreaRefinement]
  );
  const surveyPlanObjectData = useMemo(
    () =>
      draftSurveyAreaRefinement
        ? {
            ...objectData,
            totalArea: draftSurveyAreaRefinement.adjustedTotalArea,
            userDeclaredTotalArea: objectData.totalArea,
            surveyAdjustedTotalArea: draftSurveyAreaRefinement.adjustedTotalArea,
          }
        : objectData,
    [objectData, draftSurveyAreaRefinement]
  );
  const protectedAreaMeta = useMemo(() => calculateProtectedArea(effectiveObjectData), [effectiveObjectData]);
  const recalculatedArea = protectedAreaMeta.protectedAreaM2;
  const normativeProfile = useMemo(
    () =>
      buildNormativeRequirements({
        objectData: effectiveObjectData,
        zones,
        systems,
      }),
    [effectiveObjectData, zones, systems]
  );
  const normativeContext = useMemo(
    () => ({
      applied: normativeRequirementsApplied,
      profile: normativeProfile,
    }),
    [normativeProfile, normativeRequirementsApplied]
  );
  const { systemsDetailed: baseSystemResults, totals: baseTotals } = useMemo(
    () =>
      calculateEstimateEngine(
        systems,
        zones,
        budget,
        effectiveObjectData,
        vendorPriceSnapshots,
        apsProjectSnapshots,
        technicalSolution.appliedAnswers,
        technicalSolution.appliedPhotoAnalyses,
        normativeContext
      ),
    [
      systems,
      zones,
      budget,
      effectiveObjectData,
      vendorPriceSnapshots,
      apsProjectSnapshots,
      technicalSolution.appliedAnswers,
      technicalSolution.appliedPhotoAnalyses,
      normativeContext,
    ]
  );
  const zoneDistribution = useMemo(() => validateZoneDistribution(zones, recalculatedArea), [zones, recalculatedArea]);
  const initializedTravelEstimate = useMemo(() => buildInitialTravelEstimate(baseSystemResults, systems.length), [baseSystemResults, systems.length]);
  const { systemResults, totals, travelEstimate: normalizedTravelEstimate } = useMemo(
    () => applyTravelToResults(baseSystemResults, baseTotals, travelEstimate),
    [baseSystemResults, baseTotals, travelEstimate]
  );
  const aiSurveyPlan = useMemo(
    () =>
      buildAiSurveyPlan({
        objectData: surveyPlanObjectData,
        zones,
        systems,
        protectedArea: recalculatedArea,
      }),
    [surveyPlanObjectData, zones, systems, recalculatedArea]
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
        systemResults: baseSystemResults,
        objectData: effectiveObjectData,
        zones,
        surveyAnswers: technicalSolution.appliedAnswers,
        photoAnalyses: technicalSolution.appliedPhotoAnalyses,
        apsProjectSnapshots,
        specOverrides: technicalSolution.specOverrides,
      }),
    [
      systems,
      baseSystemResults,
      effectiveObjectData,
      zones,
      technicalSolution.appliedAnswers,
      technicalSolution.appliedPhotoAnalyses,
      technicalSolution.specOverrides,
      apsProjectSnapshots,
    ]
  );
  const projectRisks = useMemo(
    () =>
      buildAiProjectRisks({
        objectData: { ...effectiveObjectData, protectedAreaM2: recalculatedArea },
        zones,
        systems,
        systemResults: baseSystemResults,
        technicalSolution,
        aiSurveyCompletion: appliedAiSurveyCompletion,
        apsProjectSnapshots,
      }),
    [effectiveObjectData, recalculatedArea, zones, systems, baseSystemResults, technicalSolution, appliedAiSurveyCompletion, apsProjectSnapshots]
  );
  const inputValidation = useMemo(
    () =>
      validateEstimateInput({
        system: systems[0],
        zones,
        budget,
        objectData: { ...effectiveObjectData, protectedAreaM2: recalculatedArea },
        allSystems: systems,
      }),
    [systems, zones, budget, effectiveObjectData, recalculatedArea]
  );

  useEffect(() => {
    setTravelEstimate((prev) => {
      const next = recalculateTravelEstimateDraft(
        {
          ...initializedTravelEstimate,
          ...prev,
          crewSize: prev?.crewSize || initializedTravelEstimate.crewSize,
          workDurationDays: prev?.workDurationDays || initializedTravelEstimate.workDurationDays,
        },
        systems.length
      );
      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
  }, [initializedTravelEstimate, systems.length]);

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

  const updateTravelField = (key, value) => {
    setTravelEstimate((prev) => recalculateTravelEstimateDraft({ ...prev, enabled: true, [key]: value }, systems.length));
  };

  const setTravelEstimateEnabled = (enabled) => {
    setTravelEstimate((prev) =>
      recalculateTravelEstimateDraft(
        {
          ...prev,
          enabled: enabled === true,
          alerts: enabled ? prev?.alerts || [] : [],
          notes: enabled ? prev?.notes || "" : "",
        },
        systems.length
      )
    );
  };

  const resetTravelEstimate = () => {
    setTravelEstimate(recalculateTravelEstimateDraft({ ...initializedTravelEstimate, enabled: false }, systems.length));
  };

  const runTravelEstimate = async () => {
    const payload = {
      originAddress: travelEstimate.originAddress || "",
      destinationAddress: travelEstimate.destinationAddress || objectData.address || "",
      crewSize: travelEstimate.crewSize || initializedTravelEstimate.crewSize,
      workDurationDays: travelEstimate.workDurationDays || initializedTravelEstimate.workDurationDays,
      perDiemPerPersonDay: travelEstimate.perDiemPerPersonDay || initializedTravelEstimate.perDiemPerPersonDay,
      systemsCount: systems.length,
    };

    if (!payload.originAddress.trim() || !payload.destinationAddress.trim()) {
      setTravelEstimate((prev) =>
        recalculateTravelEstimateDraft(
          {
            ...prev,
            enabled: true,
            alerts: ["Для интеллектуального расчета заполните начальную и конечную точки маршрута."],
          },
          systems.length
        )
      );
      return false;
    }

    setTravelEstimate((prev) =>
      recalculateTravelEstimateDraft(
        {
          ...prev,
          enabled: true,
          calculationMethod: "smart",
          notes: "Идет интеллектуальный расчет маршрута и командировочных расходов...",
          alerts: [],
        },
        systems.length
      )
    );

    try {
      const response = await fetch("/api/travel-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = await response.json().catch(() => null);
      if (!response.ok || !raw?.result) {
        throw new Error(raw?.error || "Не удалось рассчитать командировку.");
      }
      setTravelEstimate(recalculateTravelEstimateDraft(raw.result, systems.length));
      return true;
    } catch (error) {
      setTravelEstimate((prev) =>
        recalculateTravelEstimateDraft(
          {
            ...prev,
            enabled: true,
            alerts: [error?.message || "Не удалось рассчитать командировку."],
            notes: "Автоматический расчет не завершен. Вы можете скорректировать параметры вручную.",
          },
          systems.length
        )
      );
      return false;
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
    setVendorComparisonsBySystem((prev) => removeById(prev, id));
    if (key === "type") {
      const task = apsImportTasksRef.current.get(id);
      if (task?.controller) {
        task.controller.abort();
      }
      apsImportTasksRef.current.delete(id);
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
    const task = apsImportTasksRef.current.get(id);
    if (task?.controller) {
      task.controller.abort();
    }
    apsImportTasksRef.current.delete(id);
    setSystems((prev) => (prev.length <= 1 ? prev : prev.filter((system) => system.id !== id)));
    setVendorComparisonsBySystem((prev) => removeById(prev, id));
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

  const loadApsProjectPrices = async (requests, options = {}) => {
    const normalizedOptions = {
      batchSize: options?.batchSize || (requests.length > 12 ? 4 : requests.length > 6 ? 5 : undefined),
      ...options,
    };
    try {
      const priceSnapshot = await fetchPricesByRequests(requests, normalizedOptions);
      return {
        priceSnapshot,
        fallbackNotice: "",
      };
    } catch (error) {
      if (normalizedOptions?.signal?.aborted || isAbortLikeError(error)) {
        throw error;
      }
      return {
        priceSnapshot: buildFallbackPriceSnapshot(),
        fallbackNotice: error?.message || "Сервис сбора цен временно недоступен, использованы fallback-цены.",
      };
    }
  };

  const resolveApsProjectPricing = async ({
    parsedProject,
    fileName,
    systemType,
    vendorName,
    signal,
    onProgress,
    buildApsProjectPriceRequests,
    buildApsProjectSnapshot,
  }) => {
    const normalizedSystemType = String(systemType || parsedProject?.systemType || "aps").toLowerCase();
    const runForVendor = async (currentVendorName, progressPrefix = "") => {
      const requests = buildApsProjectPriceRequests(parsedProject.items, currentVendorName, normalizedSystemType);
      const { priceSnapshot, fallbackNotice } = await loadApsProjectPrices(requests, {
        signal,
        onProgress: onProgress
          ? (progress) =>
              onProgress({
                ...progress,
                progressPrefix,
              })
          : undefined,
      });
      const snapshot = buildApsProjectSnapshot({
        fileName,
        parsedProject,
        requests,
        priceSnapshot,
        objectData,
        vendorName: currentVendorName,
        systemType: normalizedSystemType,
      });
      return { requests, priceSnapshot, fallbackNotice, snapshot };
    };

    const initialResult = await runForVendor(vendorName);
    const detectedVendor = initialResult.snapshot?.detectedVendor || initialResult.snapshot?.vendorName || vendorName;
    if (normalizedSystemType !== "aps" || !detectedVendor || detectedVendor === vendorName) {
      return initialResult;
    }

    const refinedResult = await runForVendor(detectedVendor, `Уточнен вендор: ${detectedVendor}. `);
    return {
      ...refinedResult,
      fallbackNotice: refinedResult.fallbackNotice || initialResult.fallbackNotice,
    };
  };

  const startApsImportTask = (systemId) => {
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const controller = new AbortController();
    apsImportTasksRef.current.set(systemId, { token, cancelled: false, controller });
    return token;
  };

  const isApsImportTaskCancelled = (systemId, token) => {
    const task = apsImportTasksRef.current.get(systemId);
    if (!task) return true;
    return task.cancelled || task.token !== token;
  };

  const finishApsImportTask = (systemId, token) => {
    const task = apsImportTasksRef.current.get(systemId);
    if (task?.token === token) {
      apsImportTasksRef.current.delete(systemId);
    }
  };

  const cancelApsProjectPdfImport = (systemId) => {
    const task = apsImportTasksRef.current.get(systemId);
    if (!task) return false;
    task.cancelled = true;
    if (task.controller) {
      task.controller.abort();
    }
    apsImportTasksRef.current.set(systemId, task);
    setApsImportStatuses((prev) => ({
      ...prev,
      [systemId]: buildApsImportStatus("warning", "Обработка PDF отменена пользователем.", {
        stage: prev?.[systemId]?.stage || "parsing",
        startedAt: prev?.[systemId]?.startedAt || new Date().toISOString(),
        cancelled: true,
      }),
    }));
    return true;
  };

  const refreshVendorPricing = async (system) => {
    const apsSnapshot = apsProjectSnapshots?.[system?.id];
    setVendorComparisonsBySystem((prev) => removeById(prev, system?.id));
    setVendorPricingProgressBySystem((prev) => ({
      ...prev,
      [system.id]: {
        state: "loading",
        processed: 0,
        total: 0,
        percent: 0,
        message: "Идет обновление цен по поставщикам и сайту производителя...",
        startedAt: new Date().toISOString(),
      },
    }));
      if (apsSnapshot?.active) {
        setApsImportStatuses((prev) => ({
          ...prev,
          [system.id]: buildApsImportStatus("loading", "Идет повторный опрос источников цен по позициям проекта...", {
            stage: "pricing",
          }),
        }));

      try {
        const { buildApsProjectPriceRequests, buildApsProjectSnapshot, inferApsProjectVendor } = await import("../lib/apsProjectEstimate");
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
          systemType: apsSnapshot.systemType || system.type,
        };
        const preferredVendor =
          (parsedProject.systemType || system.type) === "aps"
            ? inferApsProjectVendor(parsedProject.items, system.vendor) || system.vendor
            : system.vendor;

        const { priceSnapshot, fallbackNotice, snapshot: resolvedSnapshot } = await resolveApsProjectPricing({
          parsedProject,
          fileName: apsSnapshot.fileName || "aps-project.pdf",
          systemType: parsedProject.systemType || system.type,
          vendorName: preferredVendor,
          buildApsProjectPriceRequests,
          buildApsProjectSnapshot,
        });
        let refreshedSnapshot = resolvedSnapshot;

        if (apsSnapshot.itemOverrides && Object.keys(apsSnapshot.itemOverrides).length) {
          refreshedSnapshot = recalculateApsProjectSnapshot(refreshedSnapshot, apsSnapshot.itemOverrides, objectData);
        }

        setApsProjectSnapshots((prev) => ({ ...prev, [system.id]: refreshedSnapshot }));
        setSystems((prev) =>
          prev.map((item) =>
            item.id === system.id
              ? {
                ...item,
                vendor: refreshedSnapshot.detectedVendor || refreshedSnapshot.vendorName || item.vendor,
                baseVendor: refreshedSnapshot.detectedVendor || refreshedSnapshot.vendorName || item.baseVendor || item.vendor,
              }
            : item
        )
        );
        setVendorPriceSnapshots((prev) => ({ ...prev, [system.id]: priceSnapshot }));
        setVendorPricingProgressBySystem((prev) => ({
          ...prev,
          [system.id]: {
            state: fallbackNotice ? "warning" : "success",
            processed: priceSnapshot?.entries?.length || 0,
            total: priceSnapshot?.entries?.length || 0,
            percent: 100,
            message: fallbackNotice
              ? "Цены обновлены в резервном режиме."
              : "Цены по проектной спецификации обновлены.",
            finishedAt: new Date().toISOString(),
          },
        }));
        setApsImportStatuses((prev) => ({
          ...prev,
          [system.id]: buildApsImportStatus(
            fallbackNotice ? "warning" : "success",
            fallbackNotice
              ? `PDF обновлен, но сбор цен завершился в fallback-режиме. ${fallbackNotice}`
              : `Обновлено: позиций с ценой поставщика ${refreshedSnapshot.sourceStats.itemsWithSupplierPrice}, без цены ${refreshedSnapshot.sourceStats.itemsWithoutPrice}.`,
            {
              stage: "done",
            }
          ),
        }));
      } catch (error) {
        setVendorPricingProgressBySystem((prev) => ({
          ...prev,
          [system.id]: {
            state: "error",
            processed: 0,
            total: 0,
            percent: 100,
            message: error?.message || "Не удалось обновить цены по проектной спецификации.",
            finishedAt: new Date().toISOString(),
          },
        }));
        setApsImportStatuses((prev) => ({
          ...prev,
          [system.id]: buildApsImportStatus("error", error?.message || "Не удалось обновить цены по позициям проекта.", {
            stage: "pricing",
          }),
        }));
      }
      return;
    }

    try {
      const snapshot = await fetchVendorPrices(system.type, system.vendor, {
        timeoutMs: 180000,
        onProgress: (progress) => {
          const processed = Number(progress?.processed || 0);
          const total = Number(progress?.total || 0);
          const ratio = total > 0 ? processed / total : 0;
          setVendorPricingProgressBySystem((prev) => ({
            ...prev,
            [system.id]: {
              state: "loading",
              processed,
              total,
              percent: Math.max(5, Math.min(Math.round(ratio * 100), 95)),
              message:
                progress?.message ||
                (total > 0
                  ? `Проверено ${processed} из ${total} ключевых позиций.`
                  : "Подготовка запросов к источникам цен..."),
              startedAt: prev?.[system.id]?.startedAt || new Date().toISOString(),
            },
          }));
        },
      });
      setVendorPriceSnapshots((prev) => ({ ...prev, [system.id]: snapshot }));
      setVendorPricingProgressBySystem((prev) => ({
        ...prev,
        [system.id]: {
          state: snapshot?.warning ? "warning" : "success",
          processed: snapshot?.entries?.length || prev?.[system.id]?.processed || 0,
          total: snapshot?.entries?.length || prev?.[system.id]?.total || 0,
          percent: 100,
          message: snapshot?.warning
            ? "Обновление завершено в резервном режиме."
            : "Цены успешно обновлены.",
          finishedAt: new Date().toISOString(),
        },
      }));
    } catch (error) {
      setVendorPriceSnapshots((prev) => ({
        ...prev,
        [system.id]: buildVendorPricingFallbackSnapshot(prev?.[system.id], error),
      }));
      setVendorPricingProgressBySystem((prev) => ({
        ...prev,
        [system.id]: {
          state: "error",
          processed: prev?.[system.id]?.processed || 0,
          total: prev?.[system.id]?.total || 0,
          percent: 100,
          message: error?.message || "Не удалось обновить цены.",
          finishedAt: new Date().toISOString(),
        },
      }));
    }
  };

  const refreshAllVendorPricing = async () => {
    for (const system of systems) {
      await refreshVendorPricing(system);
    }
    return true;
  };

  const importApsProjectPdf = async (systemId, file) => {
    const system = systems.find((item) => item.id === systemId);
    if (!system) {
      throw new Error("Система для импорта PDF не найдена.");
    }
    if (!file) return;
    const taskToken = startApsImportTask(systemId);
    const activeTask = apsImportTasksRef.current.get(systemId);
    const taskSignal = activeTask?.controller?.signal;

    setApsImportStatuses((prev) => ({
      ...prev,
      [systemId]: buildApsImportStatus("loading", "Идет анализ PDF...", {
        stage: "parsing",
      }),
    }));

    try {
      const [{ parseProjectSpecificationPdf }, { buildApsProjectPriceRequests, buildApsProjectSnapshot, inferApsProjectVendor }] =
        await Promise.all([
        import("../lib/apsProjectParser"),
        import("../lib/apsProjectEstimate"),
      ]);

      const parsedProject = await parseProjectSpecificationPdf(file, {
        systemType: system.type,
        applyAiRefinement: system.type === "aps",
      });
      if (isApsImportTaskCancelled(systemId, taskToken)) return;
      setApsImportStatuses((prev) => ({
        ...prev,
        [systemId]: buildApsImportStatus("loading", "PDF распознан. Идет сбор цен по позициям...", {
          stage: "pricing",
          parsedItems: parsedProject.items?.length || 0,
          startedAt: prev?.[systemId]?.startedAt || new Date().toISOString(),
        }),
      }));
      const preferredVendor =
        parsedProject.systemType === "aps" ? inferApsProjectVendor(parsedProject.items, system.vendor) || system.vendor : system.vendor;
      const initialRequests = buildApsProjectPriceRequests(
        parsedProject.items,
        preferredVendor,
        parsedProject.systemType || system.type
      );
      const { priceSnapshot, fallbackNotice } = await loadApsProjectPrices(initialRequests, {
        signal: taskSignal,
        onProgress: (progress) => {
          if (isApsImportTaskCancelled(systemId, taskToken)) return;
          setApsImportStatuses((prev) => ({
            ...prev,
            [systemId]: buildApsImportStatus(
              "loading",
              `PDF \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u043d. \u0418\u0434\u0435\u0442 \u0441\u0431\u043e\u0440 \u0446\u0435\u043d \u043f\u043e \u043f\u043e\u0437\u0438\u0446\u0438\u044f\u043c... \u0411\u0430\u0442\u0447 ${progress.completedBatches}/${progress.totalBatches}, \u043f\u043e\u0437\u0438\u0446\u0438\u0439 ${progress.completedRequests}/${progress.totalRequests}.`,
              {
                stage: "pricing",
                parsedItems: parsedProject.items?.length || 0,
                completedBatches: progress.completedBatches,
                totalBatches: progress.totalBatches,
                completedRequests: progress.completedRequests,
                totalRequests: progress.totalRequests,
                startedAt: prev?.[systemId]?.startedAt || new Date().toISOString(),
              }
            ),
          }));
        },
      });
      if (isApsImportTaskCancelled(systemId, taskToken)) return;
      const initialSnapshot = buildApsProjectSnapshot({
        fileName: file.name,
        parsedProject,
        requests: initialRequests,
        priceSnapshot,
        objectData,
        vendorName: preferredVendor,
        systemType: parsedProject.systemType || system.type,
      });

      let resolvedSnapshot = initialSnapshot;
      let resolvedFallbackNotice = fallbackNotice;
      const resolvedVendor = initialSnapshot.detectedVendor || initialSnapshot.vendorName || preferredVendor;

      if ((parsedProject.systemType || system.type) === "aps" && resolvedVendor && resolvedVendor !== preferredVendor) {
        const vendorRequests = buildApsProjectPriceRequests(
          parsedProject.items,
          resolvedVendor,
          parsedProject.systemType || system.type
        );
        const vendorPricing = await loadApsProjectPrices(vendorRequests, {
          signal: taskSignal,
          onProgress: (progress) => {
            if (isApsImportTaskCancelled(systemId, taskToken)) return;
            setApsImportStatuses((prev) => ({
              ...prev,
              [systemId]: buildApsImportStatus(
                "loading",
                `\u0423\u0442\u043e\u0447\u043d\u0435\u043d \u0432\u0435\u043d\u0434\u043e\u0440: ${resolvedVendor}. \u0418\u0434\u0435\u0442 \u0441\u0431\u043e\u0440 \u0446\u0435\u043d \u043f\u043e \u043f\u043e\u0437\u0438\u0446\u0438\u044f\u043c... \u0411\u0430\u0442\u0447 ${progress.completedBatches}/${progress.totalBatches}, \u043f\u043e\u0437\u0438\u0446\u0438\u0439 ${progress.completedRequests}/${progress.totalRequests}.`,
                {
                  stage: "pricing",
                  parsedItems: parsedProject.items?.length || 0,
                  completedBatches: progress.completedBatches,
                  totalBatches: progress.totalBatches,
                  completedRequests: progress.completedRequests,
                  totalRequests: progress.totalRequests,
                  startedAt: prev?.[systemId]?.startedAt || new Date().toISOString(),
                }
              ),
            }));
          },
        });
        if (isApsImportTaskCancelled(systemId, taskToken)) return;
        resolvedFallbackNotice = vendorPricing.fallbackNotice || fallbackNotice;
        resolvedSnapshot = buildApsProjectSnapshot({
          fileName: file.name,
          parsedProject,
          requests: vendorRequests,
          priceSnapshot: vendorPricing.priceSnapshot,
          objectData,
          vendorName: resolvedVendor,
          systemType: parsedProject.systemType || system.type,
        });
      }

      setApsProjectSnapshots((prev) => ({ ...prev, [systemId]: resolvedSnapshot }));
      setSystems((prev) =>
        prev.map((item) =>
          item.id === systemId
            ? {
                ...item,
                vendor: resolvedSnapshot.detectedVendor || resolvedSnapshot.vendorName || item.vendor,
                baseVendor: resolvedSnapshot.detectedVendor || resolvedSnapshot.vendorName || item.baseVendor || item.vendor,
              }
            : item
        )
      );
      if (isApsImportTaskCancelled(systemId, taskToken)) return;
      setApsImportStatuses((prev) => ({
        ...prev,
        [systemId]: buildApsImportStatus(
          resolvedFallbackNotice ? "warning" : "success",
          resolvedFallbackNotice
            ? `PDF \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u043d, \u043d\u043e \u0441\u0431\u043e\u0440 \u0446\u0435\u043d \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043b\u0441\u044f \u0432 fallback-\u0440\u0435\u0436\u0438\u043c\u0435. ${resolvedFallbackNotice}`
            : `\u041f\u043e\u0437\u0438\u0446\u0438\u0439 \u0432 \u0441\u043f\u0435\u0446\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u0438: ${resolvedSnapshot.items.length}. \u0421 \u0446\u0435\u043d\u043e\u0439 \u043e\u0442 \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u043e\u0432: ${resolvedSnapshot.sourceStats.itemsWithSupplierPrice}. \u0411\u0435\u0437 \u0446\u0435\u043d\u044b: ${resolvedSnapshot.sourceStats.itemsWithoutPrice}.`,
          {
            stage: "done",
            parsedItems: resolvedSnapshot.items.length,
          }
        ),
        }));
      } catch (error) {
      if (isApsImportTaskCancelled(systemId, taskToken) || isAbortLikeError(error)) return;
        setApsImportStatuses((prev) => ({
          ...prev,
          [systemId]: buildApsImportStatus("error", error?.message || "Не удалось обработать PDF-проект.", {
          stage: prev?.[systemId]?.stage || "parsing",
          startedAt: prev?.[systemId]?.startedAt || new Date().toISOString(),
        }),
        }));
        throw error;
      } finally {
        finishApsImportTask(systemId, taskToken);
      }
    };

  const clearApsProjectPdf = (systemId) => {
    const task = apsImportTasksRef.current.get(systemId);
    if (task?.controller) {
      task.controller.abort();
    }
    apsImportTasksRef.current.delete(systemId);
    setVendorComparisonsBySystem((prev) => removeById(prev, systemId));
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
    setVendorComparisonsBySystem((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => systemIds.has(String(id)))));
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
        if (apsProjectSnapshots?.[system.id]?.active) {
          return false;
        }
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
              [system.id]: buildVendorPricingFallbackSnapshot(prev?.[system.id], error),
            }));
          }
        })
      );
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [systems, apsProjectSnapshots]);

  const compareVendorPrices = async (systemId) => {
    const system = systems.find((item) => item.id === systemId);
    if (!system) {
      throw new Error("Система для сравнения цен не найдена.");
    }

    const apsSnapshot = apsProjectSnapshots?.[systemId];
    const rawCurrentVendor = apsSnapshot?.detectedVendor || apsSnapshot?.vendorName || system.vendor;
    const vendorPool = (VENDORS[system.type] || []).filter((vendor) => vendor !== "Базовый");
    const currentVendor = rawCurrentVendor === "Базовый" ? vendorPool[0] || rawCurrentVendor : rawCurrentVendor;
    const candidateVendors = [currentVendor, ...vendorPool.filter((vendor) => vendor !== currentVendor)].slice(0, 3);

    if (candidateVendors.length < 2) {
      setVendorComparisonsBySystem((prev) => ({
        ...prev,
        [systemId]: {
          state: "error",
          message: "Для этой системы пока недостаточно альтернативных вендоров для сравнения.",
          currentVendor,
          rows: [],
        },
      }));
      return null;
    }

    setVendorComparisonsBySystem((prev) => ({
      ...prev,
      [systemId]: {
        ...(prev?.[systemId] || {}),
        state: "loading",
        message: "Идет сбор цен и пересчет системы по текущему вендору и двум альтернативам...",
        currentVendor,
        rows: [],
      },
    }));

    try {
      const snapshots = await Promise.all(
        candidateVendors.map(async (vendor) => {
          if (apsSnapshot?.active) {
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
              systemType: apsSnapshot.systemType || system.type,
            };
            const requests = buildApsProjectPriceRequests(originalItems, vendor, parsedProject.systemType || system.type);
            const priceSnapshot = await fetchPricesByRequests(requests);
            let vendorSpecificApsSnapshot = buildApsProjectSnapshot({
              fileName: apsSnapshot.fileName || "aps-project.pdf",
              parsedProject,
              requests,
              priceSnapshot,
              objectData,
              vendorName: vendor,
              systemType: parsedProject.systemType || system.type,
            });

            if (apsSnapshot.itemOverrides && Object.keys(apsSnapshot.itemOverrides).length) {
              vendorSpecificApsSnapshot = recalculateApsProjectSnapshot(vendorSpecificApsSnapshot, apsSnapshot.itemOverrides, objectData);
            }

            return [
              vendor,
              {
                priceSnapshot,
                apsSnapshot: vendorSpecificApsSnapshot,
              },
            ];
          }

          const canReuseCurrentSnapshot =
            vendor === currentVendor &&
            vendorPriceSnapshots?.[systemId]?.entries?.length &&
            String(vendorPriceSnapshots?.[systemId]?.vendorName || system.vendor || currentVendor) === String(vendor);

          if (canReuseCurrentSnapshot) {
            return [
              vendor,
              {
                priceSnapshot: vendorPriceSnapshots[systemId],
                apsSnapshot: null,
              },
            ];
          }

          const snapshot = await fetchVendorPrices(system.type, vendor);
          return [
            vendor,
            {
              priceSnapshot: snapshot,
              apsSnapshot: null,
            },
          ];
        })
      );

      const snapshotMap = Object.fromEntries(snapshots);
      if (snapshotMap[currentVendor]?.priceSnapshot) {
        setVendorPriceSnapshots((prev) => ({
          ...prev,
          [systemId]: snapshotMap[currentVendor].priceSnapshot,
        }));
      }

      const rows = candidateVendors.map((vendor) => {
        const systemIndex = systems.findIndex((item) => item.id === systemId);
        const comparisonSystems = systems.map((item) =>
          item.id === systemId
            ? {
                ...item,
                vendor,
                baseVendor: vendor,
                customVendorIndex: item.customVendorIndex || 1,
              }
            : item
        );

        const comparisonSnapshots = {
          ...vendorPriceSnapshots,
          [systemId]: snapshotMap[vendor]?.priceSnapshot || null,
        };
        const comparisonProjectSnapshots = {
          ...apsProjectSnapshots,
          [systemId]: snapshotMap[vendor]?.apsSnapshot || apsProjectSnapshots?.[systemId] || null,
        };

        const { systemsDetailed } = calculateEstimateEngine(
          comparisonSystems,
          zones,
          budget,
          effectiveObjectData,
          comparisonSnapshots,
          comparisonProjectSnapshots,
          technicalSolution.appliedAnswers,
          technicalSolution.appliedPhotoAnalyses
        );

        const comparisonResult = systemsDetailed[systemIndex] || {};
        const snapshot = snapshotMap[vendor]?.priceSnapshot;
        const marketMetrics = summarizePriceSnapshot(snapshot);

        return {
          vendor,
          role: vendor === currentVendor ? "Текущий" : "Альтернатива",
          isCurrent: vendor === currentVendor,
          unitPrice: toNumber(comparisonResult?.equipmentData?.unitPrice, 0),
          equipmentCost: toNumber(comparisonResult?.equipmentCost, 0),
          materialCost: toNumber(comparisonResult?.materialCost, 0),
          workTotal: toNumber(comparisonResult?.workTotal, 0),
          designTotal: toNumber(comparisonResult?.designTotal, 0),
          total: toNumber(comparisonResult?.total, 0),
          checkedSourceCount: marketMetrics.checkedSourceCount,
          pricedSourceCount: marketMetrics.pricedSourceCount,
        };
      });

      const nextComparison = {
        state: "success",
        generatedAt: new Date().toISOString(),
        currentVendor,
        systemId,
        systemType: system.type,
        systemName: SYSTEM_TYPES.find((item) => item.code === system.type)?.name || system.type,
        rows,
      };

      setVendorComparisonsBySystem((prev) => ({
        ...prev,
        [systemId]: nextComparison,
      }));

      return nextComparison;
    } catch (error) {
      setVendorComparisonsBySystem((prev) => ({
        ...prev,
        [systemId]: {
          state: "error",
          message: error?.message || "Не удалось построить сравнение цен по вендорам.",
          currentVendor,
          rows: [],
        },
      }));
      throw error;
    }
  };

  const clearVendorComparison = (systemId) => {
    setVendorComparisonsBySystem((prev) => removeById(prev, systemId));
  };

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
            vendor: snapshot?.detectedVendor || snapshot?.vendorName || system.vendor,
            fileName: snapshot.fileName || "",
            gostStandard: snapshot.gostStandard || "",
            recognitionRate: snapshot.sourceStats?.recognitionRate || 0,
            items: Array.isArray(snapshot.items) ? snapshot.items : [],
          };
        })
        .filter(Boolean);
      const payload = {
        objectData: { ...effectiveObjectData, objectTypeLabel },
        budget,
        zones,
        recalculatedArea,
        systemResults,
        totals,
        travelEstimate: normalizedTravelEstimate,
        projectRisks,
        apsProjectExports,
        vendorComparisons: Object.values(vendorComparisonsBySystem || {}).filter((item) => item?.state === "success" && item?.rows?.length),
      };
      const { exportEstimatePptx } = await import("../lib/pptxExport");
      await exportEstimatePptx(payload);
    } catch (error) {
      window.alert(`Ошибка экспорта PPTX: ${error?.message || "неизвестная ошибка"}`);
      throw error;
    }
  };

  const generateProjectPlan = async (format = "pptx") => {
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
            vendor: snapshot?.detectedVendor || snapshot?.vendorName || system.vendor,
            fileName: snapshot.fileName || "",
            gostStandard: snapshot.gostStandard || "",
            recognitionRate: snapshot.sourceStats?.recognitionRate || 0,
            items: Array.isArray(snapshot.items) ? snapshot.items : [],
          };
        })
        .filter(Boolean);

      const payload = {
        objectData: { ...effectiveObjectData, objectTypeLabel },
        budget,
        zones,
        recalculatedArea,
        systemResults,
        totals,
        travelEstimate: normalizedTravelEstimate,
        projectRisks,
        apsProjectExports,
        technicalRecommendations,
        vendorComparisons: Object.values(vendorComparisonsBySystem || {}).filter((item) => item?.state === "success" && item?.rows?.length),
      };

      const { exportProjectPlan } = await import("../lib/projectPlanExport");
      await exportProjectPlan(payload, format);
    } catch (error) {
      window.alert(`Ошибка генерации плана проекта: ${error?.message || "неизвестная ошибка"}`);
      throw error;
    }
  };

  const exportEstimateCsv = () => {
    const objectTypeLabel = OBJECT_TYPES.find((item) => item.value === objectData.objectType)?.label || objectData.objectType;
    const rows = buildEstimateRows({ objectData: { ...effectiveObjectData, objectTypeLabel }, recalculatedArea, systemResults, totals });
    downloadCsv(`${objectData.projectName || "estimate"}.csv`, rows);
  };

  const exportSystemSpecification = (systemId) => {
    const systemIndex = systems.findIndex((item) => item.id === systemId);
    if (systemIndex < 0) return false;

    const system = systems[systemIndex];
    const systemResult = systemResults[systemIndex];
    const recommendation = technicalRecommendations.find((item) => item.systemId === systemId);
    if (!system || !systemResult || !recommendation) return false;

    downloadSystemSpecificationExcel({
      objectData: effectiveObjectData,
      system,
      systemResult,
      recommendation,
      zones,
    });

    return true;
  };

  const exportAllSystemsSpecification = () => {
    return downloadAllSystemsSpecificationExcel({
      objectData: effectiveObjectData,
      systems,
      systemResults,
      technicalRecommendations,
      zones,
    });
  };

  const exportProjectPassport = async () => {
    try {
      await downloadProjectPassport({
        objectData,
        zones,
        systems,
        budget,
        normativeRequirementsApplied,
        zonePreset,
        lockedZoneIds,
        addressVerification,
        travelEstimate,
        technicalSolution,
        apsProjectSnapshots,
        vendorPriceSnapshots,
        vendorComparisonsBySystem,
      });
      return true;
    } catch (error) {
      window.alert(`Ошибка выгрузки паспорта проекта: ${error?.message || "неизвестная ошибка"}`);
      return false;
    }
  };

  const exportAiSurveyChecklist = async () => {
    try {
      await exportAiSurveyChecklistDoc({
        objectData: effectiveObjectData,
        aiSurveyPlan,
        systems,
      });
      return true;
    } catch (error) {
      window.alert(`Ошибка выгрузки чеклиста: ${error?.message || "неизвестная ошибка"}`);
      return false;
    }
  };

  const importProjectPassport = async (file) => {
    if (!file) return false;

    try {
      const imported = await readProjectPassport(file);
      const nextObjectData = {
        ...createProjectIdentity(),
        ...(imported?.objectData || {}),
      };
      const nextSystems = Array.isArray(imported?.systems) && imported.systems.length ? imported.systems : systems;
      const nextZones = Array.isArray(imported?.zones) && imported.zones.length ? imported.zones : zones;
      const nextBudget = imported?.budget && typeof imported.budget === "object" ? imported.budget : budget;
      const nextTechnicalSolution =
        imported?.technicalSolution && typeof imported.technicalSolution === "object"
          ? imported.technicalSolution
          : {
              surveyStartedAt: null,
              answers: {},
              photoAnalyses: {},
              appliedAnswers: {},
              appliedPhotoAnalyses: {},
              appliedAt: null,
              specOverrides: {},
            };
      const nextAddressVerification =
        imported?.addressVerification && typeof imported.addressVerification === "object"
          ? imported.addressVerification
          : {
              state: "idle",
              message: "Адрес загружен из паспорта проекта.",
              result: null,
            };
      const nextTravelEstimate = imported?.travelEstimate
        ? recalculateTravelEstimateDraft(imported.travelEstimate, nextSystems.length)
        : buildInitialTravelEstimate([], nextSystems.length);

      setObjectData({
        ...nextObjectData,
        regionCoef: getRegionCoef(nextObjectData.regionName || DEFAULT_REGION_NAME),
      });
      setZones(nextZones);
      setSystems(nextSystems);
      setBudget(nextBudget);
      setNormativeRequirementsApplied(imported?.normativeRequirementsApplied !== false);
      setZonePreset(imported?.zonePreset || "business_center");
      setLockedZoneIds(Array.isArray(imported?.lockedZoneIds) ? imported.lockedZoneIds : []);
      setAddressVerification(nextAddressVerification);
      setTravelEstimate(nextTravelEstimate);
      setTechnicalSolution(nextTechnicalSolution);
      setVendorPriceSnapshots(imported?.vendorPriceSnapshots && typeof imported.vendorPriceSnapshots === "object" ? imported.vendorPriceSnapshots : {});
      setVendorComparisonsBySystem(
        imported?.vendorComparisonsBySystem && typeof imported.vendorComparisonsBySystem === "object" ? imported.vendorComparisonsBySystem : {}
      );
      setVendorPricingProgressBySystem({});
      setApsProjectSnapshots(imported?.apsProjectSnapshots && typeof imported.apsProjectSnapshots === "object" ? imported.apsProjectSnapshots : {});
      setApsImportStatuses({});
      setStep(0);
      return true;
    } catch (error) {
      window.alert(`Ошибка загрузки паспорта проекта: ${error?.message || "неизвестная ошибка"}`);
      return false;
    }
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
    setTechnicalSolution((prev) => {
      const nextAnswers = {
        ...prev.answers,
        [questionId]: value,
      };

      if (questionId.endsWith("-mount-height-limit-enabled") && value !== true) {
        delete nextAnswers[questionId.replace("-mount-height-limit-enabled", "-mount-height-limit")];
      }

      return {
        ...prev,
        answers: nextAnswers,
      };
    });
  };

  const analyzeAiSurveyPhoto = async (prompt, fileInput) => {
    const files = Array.isArray(fileInput) ? fileInput : Array.from(fileInput || []).filter(Boolean);
    if (!prompt || !files.length) return null;

    setTechnicalSolution((prev) => ({
      ...prev,
      photoAnalyses: {
        ...prev.photoAnalyses,
        [prompt.id]: {
          state: "loading",
          fileName: files.map((file) => file.name).join(", "),
          summary:
            prompt.type === "evacuation_plan" && files.length > 1
              ? "Идет AI-анализ группы планов по этажам..."
              : "Идет AI-анализ фото...",
        },
      },
    }));

    try {
      const perFileResults = await Promise.all(
        files.map((file, index) =>
          analyzeInspectionPhoto({
            file,
            prompt,
            objectData,
            zones,
            systems,
            photoAnalyses: technicalSolution.photoAnalyses,
            floorIndex: index + 1,
          })
        )
      );

      let result = perFileResults[0];
      if (prompt.type === "evacuation_plan") {
        const aggregatedPlanRecognition = aggregatePlanRecognitions({
          recognitions: perFileResults
            .map((item, index) =>
              item?.planRecognition
                ? {
                    ...item.planRecognition,
                    floorIndex: item.planRecognition.floorIndex || index + 1,
                    accepted: item.accepted !== false,
                  }
                : null
            )
            .filter(Boolean),
          prompt,
          zones,
          systems,
          objectData,
        });
        const recognizedSystems = Array.isArray(aggregatedPlanRecognition?.systems) ? aggregatedPlanRecognition.systems : [];

        const acceptedFiles = perFileResults.filter((item) => item?.accepted !== false);
        result = {
          accepted: acceptedFiles.length > 0,
          confidence:
            acceptedFiles.length > 0
              ? Number(
                  (
                    acceptedFiles.reduce((sum, item) => sum + toNumber(item?.confidence, 0), 0) /
                    acceptedFiles.length
                  ).toFixed(2)
                )
              : Number((perFileResults[0]?.confidence || 0.3).toFixed(2)),
          summary:
            acceptedFiles.length > 0
              ? `Распознано ${aggregatedPlanRecognition.uploadedPlans} план(ов) из ${aggregatedPlanRecognition.expectedFloorCount}. ${recognizedSystems
                  .map((item) => `${item.systemLabel}: ${item.zoneCount} ${item.zoneTerm}`)
                  .join(", ")}.`
              : perFileResults[0]?.summary || "Не удалось принять ни один план эвакуации.",
          detections: [
            `Загружено планов: ${files.length}`,
            `Принято планов: ${aggregatedPlanRecognition.uploadedPlans}`,
            `Этажей по объекту/зоне: ${aggregatedPlanRecognition.expectedFloorCount}`,
            ...recognizedSystems.map(
              (item) =>
                `${item.systemLabel}: ${item.zoneCount} ${item.zoneTerm} (${item.detectedZoneCount || 0} по планам, ${
                  item.forecastZoneCount || 0
                } прогноз)`
            ),
            ...(aggregatedPlanRecognition.warnings || []).map((warning) => warning.message),
            `Площадь пользователя: ${aggregatedPlanRecognition.areaComparison?.userTotalArea || 0} м²`,
            `Площадь по планировкам/фото: ${aggregatedPlanRecognition.areaComparison?.predictedTotalArea || 0} м²`,
          ],
          suggestedAnswers:
            acceptedFiles.length > 0 ? prompt.targetQuestionIds.map((questionId) => ({ questionId, value: true })) : [],
          planRecognition: aggregatedPlanRecognition,
          fileResults: perFileResults.map((item, index) => ({
            floorIndex: item?.planRecognition?.floorIndex || index + 1,
            floorLabel: item?.planRecognition?.floorLabel || null,
            fileName: files[index]?.name,
            accepted: item?.accepted !== false,
            summary: item?.summary,
            detections: item?.detections || [],
            planRecognition: item?.planRecognition || null,
          })),
        };
      }

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
              fileName: files.map((file) => file.name).join(", "),
              summary: result.summary,
              confidence: result.confidence,
              detections: result.detections || [],
              suggestedAnswers: result.suggestedAnswers || [],
              accepted: result?.accepted !== false,
              planRecognition: result?.planRecognition || null,
              fileResults: result?.fileResults || [],
              promptType: prompt.type,
              zoneId: prompt.zoneId,
              sourceFiles: files,
              estimatedCeilingHeight: result?.estimatedCeilingHeight ?? null,
              estimatedCeilingHeightConfidence: result?.estimatedCeilingHeightConfidence ?? null,
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
            fileName: files.map((file) => file.name).join(", "),
            summary: error?.message || "Не удалось обработать фото.",
            detections: [],
            promptType: prompt?.type,
            zoneId: prompt?.zoneId,
            sourceFiles: files,
          },
        },
      }));
      throw error;
    }
  };

  const refreshAiSurveyPhoto = async (prompt) => {
    const cachedFiles = technicalSolution?.photoAnalyses?.[prompt?.id]?.sourceFiles || [];
    if (!prompt || !cachedFiles.length) return null;
    return analyzeAiSurveyPhoto(prompt, cachedFiles);
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

  const resetAiSurveySection = (sectionId, questionIds = [], photoPromptIds = []) => {
    if (!sectionId) return false;

    setTechnicalSolution((prev) => {
      const nextAnswers = removeManyByIds(prev.answers, questionIds);
      const nextPhotoAnalyses = removeManyByIds(prev.photoAnalyses, photoPromptIds);
      const nextAppliedAnswers = removeManyByIds(prev.appliedAnswers, questionIds);
      const nextAppliedPhotoAnalyses = removeManyByIds(prev.appliedPhotoAnalyses, photoPromptIds);
      const hasAppliedData = hasKeys(nextAppliedAnswers) || hasKeys(nextAppliedPhotoAnalyses);

      return {
        ...prev,
        answers: nextAnswers,
        photoAnalyses: nextPhotoAnalyses,
        appliedAnswers: nextAppliedAnswers,
        appliedPhotoAnalyses: nextAppliedPhotoAnalyses,
        appliedAt: hasAppliedData ? new Date().toISOString() : null,
      };
    });

    return true;
  };

  const applyNormativeRequirements = () => setNormativeRequirementsApplied(true);
  const excludeNormativeRequirements = () => setNormativeRequirementsApplied(false);

  return {
    step,
    setStep,
    objectData,
    effectiveObjectData,
    appliedSurveyAreaRefinement,
    draftSurveyAreaRefinement,
    addressVerification,
    travelEstimate: normalizedTravelEstimate,
    zones,
    systems,
    budget,
    zonePreset,
    setZonePreset,
    lockedZoneIds,
    vendorPriceSnapshots,
    vendorPricingProgressBySystem,
    vendorComparisonsBySystem,
    normativeProfile,
    normativeRequirementsApplied,
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
    projectRisks,
    VENDOR_EQUIPMENT,
    updateObject,
    verifyObjectAddress,
    updateTravelField,
    setTravelEstimateEnabled,
    runTravelEstimate,
    resetTravelEstimate,
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
    applyNormativeRequirements,
    excludeNormativeRequirements,
    refreshVendorPricing,
    refreshAllVendorPricing,
    compareVendorPrices,
    clearVendorComparison,
    importApsProjectPdf,
    cancelApsProjectPdfImport,
    clearApsProjectPdf,
    updateApsProjectItem,
    addApsProjectItem,
    removeApsProjectItemById,
    startAiSurvey,
    updateAiSurveyAnswer,
    analyzeAiSurveyPhoto,
    refreshAiSurveyPhoto,
    applyAiSurveyData,
    resetAiSurveySection,
    updateTechnicalSpecOverride,
    exportEstimate,
    generateProjectPlan,
    exportEstimateCsv,
    exportSystemSpecification,
    exportAllSystemsSpecification,
    exportProjectPassport,
    importProjectPassport,
    exportAiSurveyChecklist,
    setZones,
    canAddMoreSystems: systems.length < SYSTEM_TYPES.length,
  };
}
