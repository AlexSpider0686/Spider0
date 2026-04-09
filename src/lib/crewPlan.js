import { buildProjectTimeline } from "./projectTimeline.js";

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round1(value) {
  return Number(n(value).toFixed(1));
}

function sum(systemResults = [], getter) {
  return (Array.isArray(systemResults) ? systemResults : []).reduce((total, row) => total + n(getter(row), 0), 0);
}

function splitHeadcount(roles, targetHeadcount) {
  const activeRoles = roles.filter((item) => item.enabled !== false);
  if (!activeRoles.length) return [];

  const safeTarget = Math.max(Math.round(n(targetHeadcount, 0)), 0);
  const minRequired = activeRoles.reduce((total, role) => total + Math.max(Math.round(n(role.minCount, 0)), 0), 0);
  let remaining = Math.max(safeTarget, minRequired) - minRequired;

  const normalized = activeRoles.map((role) => ({
    ...role,
    count: Math.max(Math.round(n(role.minCount, 0)), 0),
    weight: Math.max(n(role.weight, 0), 0),
  }));

  const weightTotal = normalized.reduce((total, role) => total + role.weight, 0) || 1;

  normalized.forEach((role, index) => {
    if (remaining <= 0) return;
    const hardCap = Math.max(Math.round(n(role.maxCount, safeTarget || 1)), role.count);
    const suggested =
      index === normalized.length - 1 ? remaining : Math.max(0, Math.round((remaining * role.weight) / weightTotal));
    const extra = clamp(suggested, 0, Math.max(hardCap - role.count, 0));
    role.count += extra;
    remaining -= extra;
  });

  while (remaining > 0) {
    const nextRole =
      normalized
        .filter((role) => role.count < Math.max(Math.round(n(role.maxCount, safeTarget || 1)), role.count))
        .sort((left, right) => right.weight - left.weight)[0] || null;
    if (!nextRole) break;
    nextRole.count += 1;
    remaining -= 1;
  }

  const totalAssigned = normalized.reduce((total, role) => total + role.count, 0);
  const denominator = Math.max(totalAssigned, 1);

  return normalized
    .filter((role) => role.count > 0)
    .map((role) => ({
      role: role.role,
      label: role.label,
      count: role.count,
      sharePercent: round1((role.count / denominator) * 100),
    }));
}

function buildFieldRolesFromResults(systemResults = []) {
  const aggregated = new Map();

  (Array.isArray(systemResults) ? systemResults : []).forEach((row) => {
    (row?.executionRoles || []).forEach((role) => {
      const current = aggregated.get(role.role) || { role: role.role, label: role.label, count: 0 };
      current.count += Math.max(Math.round(n(role.count, 0)), 0);
      aggregated.set(role.role, current);
    });
  });

  const totalCount = Array.from(aggregated.values()).reduce((total, role) => total + role.count, 0);
  if (!totalCount) return [];

  return Array.from(aggregated.values())
    .filter((role) => role.count > 0)
    .sort((left, right) => right.count - left.count)
    .map((role) => ({
      ...role,
      sharePercent: round1((role.count / Math.max(totalCount, 1)) * 100),
    }));
}

function buildSystemCrewRows(systemResults = []) {
  return (Array.isArray(systemResults) ? systemResults : [])
    .map((row, index) => {
      const labor = row?.laborDetails?.workBreakdown || {};
      const cableLength = n(labor.cableLengthM, 0);
      const controllers = n(labor.controllerUnits, 0);
      const integrationPoints = n(labor.integrationPoints, 0);
      const primaryUnits = n(labor.primaryUnits, 0);
      const peakCrew = Math.max(Math.round(n(row?.executionTeamSize, 0)), 0);
      const durationDays = Math.max(Math.round(n(row?.executionDurationDays, 0)), 0);
      const roleMap = new Map((row?.executionRoles || []).map((item) => [item.role, Math.max(Math.round(n(item.count, 0)), 0)]));
      const foremen = roleMap.get("foreman") ?? (peakCrew > 0 ? 1 : 0);
      const leadInstaller = roleMap.get("leadInstaller") ?? 0;
      const installers = (roleMap.get("installer") ?? Math.max(peakCrew - foremen, 0)) + leadInstaller;
      const cableInstallers = roleMap.get("cableInstaller") ?? 0;
      const commissioningCount =
        roleMap.get("commissioning") ??
        (peakCrew > 0 ? Math.max(1, Math.min(2, Math.ceil((integrationPoints + controllers) / 18))) : 0);
      const cableShare = cableLength > 0 && primaryUnits > 0 ? Math.min(100, Math.round((cableLength / Math.max(primaryUnits, 1)) * 3.5)) : 0;

      return {
        systemName: String(row?.systemName || row?.systemType || `РЎРёСЃС‚РµРјР° ${index + 1}`),
        peakCrew,
        durationDays,
        commissioningCount,
        leadRoles:
          peakCrew <= 0
            ? "Р РµСЃСѓСЂСЃ РЅРµ С‚СЂРµР±СѓРµС‚СЃСЏ"
            : [
                foremen ? `${foremen} РїСЂРѕСЂР°Р±` : "",
                installers ? `${installers} РјРѕРЅС‚Р°Р¶РЅ.` : "",
                cableInstallers ? `${cableInstallers} РєР°Р±РµР»СЊС‰.` : "",
                commissioningCount ? `${commissioningCount} РёРЅР¶РµРЅРµСЂ РџРќР ` : "",
              ]
                .filter(Boolean)
                .join(", "),
        complexityNote:
          integrationPoints > 0
            ? `РРЅС‚РµРіСЂР°С†РёРѕРЅРЅС‹С… С‚РѕС‡РµРє: ${integrationPoints}, РєР°Р±РµР»СЊРЅР°СЏ РЅР°СЃС‹С‰РµРЅРЅРѕСЃС‚СЊ: ${cableShare}%`
            : `РљРѕРЅС‚СЂРѕР»Р»РµСЂРѕРІ: ${controllers}, РёР·РІРµС‰Р°С‚РµР»РµР№/С‚РѕС‡РµРє: ${primaryUnits}`,
      };
    })
    .sort((left, right) => right.peakCrew - left.peakCrew || right.durationDays - left.durationDays);
}

export function buildProjectCrewPlan(systemResults = [], objectData = {}, totals = {}, timelineOverride = null) {
  const timeline = timelineOverride || buildProjectTimeline(systemResults, objectData, totals);
  const normalizedResults = Array.isArray(systemResults) ? systemResults : [];
  const systemCount = Math.max(normalizedResults.length, 1);
  const objectArea = n(objectData?.totalArea, 0);

  const designHours = sum(normalizedResults, (row) => row?.designHours);
  const executionHours = sum(normalizedResults, (row) => row?.executionHours);
  const peakDesignTeam = Math.max(...normalizedResults.map((row) => Math.round(n(row?.designTeamSize, 0))), designHours > 0 ? 1 : 0);
  const peakFieldTeam = Math.max(...normalizedResults.map((row) => Math.round(n(row?.executionTeamSize, 0))), executionHours > 0 ? 2 : 0);
  const avgExecutionTeam = executionHours > 0
    ? round1(
        normalizedResults.reduce((total, row) => total + n(row?.executionTeamSize, 0) * Math.max(n(row?.executionDurationDays, 0), 1), 0) /
          Math.max(
            normalizedResults.reduce((total, row) => total + Math.max(n(row?.executionDurationDays, 0), 1), 0),
            1
          )
      )
    : 0;

  const integrationPoints = sum(normalizedResults, (row) => row?.laborDetails?.workBreakdown?.integrationPoints);
  const cableLength = sum(normalizedResults, (row) => row?.laborDetails?.workBreakdown?.cableLengthM);
  const controllers = sum(normalizedResults, (row) => row?.laborDetails?.workBreakdown?.controllerUnits);
  const primaryUnits = sum(normalizedResults, (row) => row?.laborDetails?.workBreakdown?.primaryUnits);
  const routeComplexity = normalizedResults.length
    ? normalizedResults.reduce((total, row) => total + n(row?.routeComplexityAverage, 1), 0) / normalizedResults.length
    : 1;

  const fieldRoleWeights = {
    foreman: 1.15,
    leadInstaller: 0.85,
    installer: 2.1 + Math.max(routeComplexity - 1, 0) * 1.8,
    cableInstaller: cableLength > 0 ? 1.15 + Math.min(cableLength / 3000, 1.8) : 0.45,
    commissioning: 0.9 + Math.min((integrationPoints + controllers) / 25, 1.7),
  };

  const fieldRolesFromResults = buildFieldRolesFromResults(normalizedResults);
  const fieldTeam =
    fieldRolesFromResults.length > 0
      ? fieldRolesFromResults
      : splitHeadcount(
      [
        { role: "foreman", label: "РџСЂРѕСЂР°Р±", minCount: peakFieldTeam > 0 ? 1 : 0, maxCount: 2, weight: fieldRoleWeights.foreman },
        { role: "leadInstaller", label: "РЎС‚Р°СЂС€РёР№ РјРѕРЅС‚Р°Р¶РЅРёРє", minCount: peakFieldTeam >= 4 ? 1 : 0, maxCount: 2, weight: fieldRoleWeights.leadInstaller },
        { role: "installer", label: "РњРѕРЅС‚Р°Р¶РЅРёРє", minCount: peakFieldTeam > 0 ? 1 : 0, maxCount: Math.max(peakFieldTeam, 1), weight: fieldRoleWeights.installer },
        { role: "cableInstaller", label: "РљР°Р±РµР»СЊС‰РёРє/С‚СЂР°СЃСЃРёСЂРѕРІС‰РёРє", minCount: peakFieldTeam >= 5 || cableLength > 1800 ? 1 : 0, maxCount: Math.max(Math.ceil(peakFieldTeam / 2), 1), weight: fieldRoleWeights.cableInstaller },
        { role: "commissioning", label: "РРЅР¶РµРЅРµСЂ РџРќР ", minCount: executionHours > 0 ? 1 : 0, maxCount: 3, weight: fieldRoleWeights.commissioning },
      ],
      peakFieldTeam
    );

  const designRoleWeights = {
    chief: 0.9 + Math.min(systemCount / 6, 0.5),
    lead: 1.1,
    designer: 1.8 + Math.min(systemCount / 4, 0.8),
    bim: objectArea > 12000 ? 0.8 : 0.45,
    estimate: 0.55 + Math.min(systemCount / 8, 0.3),
  };

  const designTeam = splitHeadcount(
    [
      { role: "chief", label: "Р“РРџ/РІРµРґСѓС‰РёР№ РёРЅР¶РµРЅРµСЂ", minCount: designHours > 0 ? 1 : 0, maxCount: 2, weight: designRoleWeights.chief },
      { role: "lead", label: "Р’РµРґСѓС‰РёР№ РїСЂРѕРµРєС‚РёСЂРѕРІС‰РёРє", minCount: designHours > 0 ? 1 : 0, maxCount: 2, weight: designRoleWeights.lead },
      { role: "designer", label: "РРЅР¶РµРЅРµСЂ-РїСЂРѕРµРєС‚РёСЂРѕРІС‰РёРє", minCount: designHours > 0 ? 1 : 0, maxCount: Math.max(peakDesignTeam, 1), weight: designRoleWeights.designer },
      { role: "bim", label: "BIM/CAD СЃРїРµС†РёР°Р»РёСЃС‚", minCount: peakDesignTeam >= 3 || objectArea > 12000 ? 1 : 0, maxCount: 2, weight: designRoleWeights.bim },
      { role: "estimate", label: "РЎРјРµС‚С‡РёРє", minCount: designHours > 0 ? 1 : 0, maxCount: 1, weight: designRoleWeights.estimate },
    ],
    peakDesignTeam
  );

  const fieldDurationDays = Math.max(n(timeline?.phaseMap?.smr?.duration, 0), 1);
  const commissioningDurationDays = Math.max(n(timeline?.phaseMap?.pnr?.duration, 0), 1);
  const designDurationDays = Math.max(n(timeline?.phaseMap?.design?.duration, 0), 1);
  const productiveHoursPerPersonDay = 6.8;

  return {
    methodology:
      "РЎРѕСЃС‚Р°РІ Р±СЂРёРіР°Рґ СЂР°СЃСЃС‡РёС‚Р°РЅ РїРѕ С‚СЂСѓРґРѕРµРјРєРѕСЃС‚Рё РЎРњР , РџРќР  Рё РїСЂРѕРµРєС‚РёСЂРѕРІР°РЅРёСЏ, РєР°Р»РµРЅРґР°СЂРЅРѕР№ РґР»РёС‚РµР»СЊРЅРѕСЃС‚Рё С„Р°Р·, РєР°Р±РµР»СЊРЅРѕР№ РЅР°СЃС‹С‰РµРЅРЅРѕСЃС‚Рё, РёРЅС‚РµРіСЂР°С†РёРѕРЅРЅС‹Рј С‚РѕС‡РєР°Рј Рё С‚СЂРµР±СѓРµРјРѕРјСѓ РїРёРєРѕРІРѕРјСѓ СЂРµСЃСѓСЂСЃСѓ. РџСЂРёРЅСЏС‚Р° РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅР°СЏ СЃРјРµРЅР° 6,8 С‡/С‡РµР». РІ РґРµРЅСЊ СЃ СЂР°Р·РґРµР»РµРЅРёРµРј СЂРѕР»РµР№ РїРѕ РІРёРґР°Рј СЂР°Р±РѕС‚.",
    drivers: {
      objectArea,
      systemCount,
      designHours: round1(designHours),
      executionHours: round1(executionHours),
      cableLength: round1(cableLength),
      integrationPoints: round1(integrationPoints),
      controllers: round1(controllers),
      primaryUnits: round1(primaryUnits),
      routeComplexity: round1(routeComplexity),
    },
    field: {
      peakHeadcount: peakFieldTeam,
      averageHeadcount: avgExecutionTeam,
      durationDays: fieldDurationDays,
      commissioningDurationDays,
      productiveHoursPerPersonDay,
      loadPerPersonDay: round1(executionHours / Math.max(avgExecutionTeam || peakFieldTeam || 1, 1) / fieldDurationDays),
      roles: fieldTeam,
    },
    design: {
      peakHeadcount: peakDesignTeam,
      durationDays: designDurationDays,
      productiveHoursPerPersonDay,
      loadPerPersonDay: round1(designHours / Math.max(peakDesignTeam || 1, 1) / designDurationDays),
      roles: designTeam,
    },
    systemCrewRows: buildSystemCrewRows(normalizedResults),
    summaryLines: [
      `РџРёРєРѕРІР°СЏ РјРѕРЅС‚Р°Р¶РЅР°СЏ Р±СЂРёРіР°РґР°: ${peakFieldTeam} С‡РµР». РїСЂРё СЃСЂРµРґРЅРµРј СЂРµСЃСѓСЂСЃРµ ${avgExecutionTeam || peakFieldTeam || 0} С‡РµР». РЅР° С„Р°Р·Рµ РЎРњР .`,
      `РЎРѕСЃС‚Р°РІ РјРѕРЅС‚Р°Р¶РЅРѕРіРѕ СЂРµСЃСѓСЂСЃР°: ${fieldTeam.map((item) => `${item.label} ${item.count}`).join(", ") || "РЅРµ С‚СЂРµР±СѓРµС‚СЃСЏ"}.`,
      `РљРѕРЅС‚СѓСЂ РџРќР : ${fieldTeam.filter((item) => item.role === "commissioning").map((item) => `${item.label} ${item.count}`).join(", ") || "РёРЅР¶РµРЅРµСЂ РџРќР  РЅРµ С‚СЂРµР±СѓРµС‚СЃСЏ"}.`,
      `РџСЂРѕРµРєС‚РЅС‹Р№ РєРѕРЅС‚СѓСЂ: ${designTeam.map((item) => `${item.label} ${item.count}`).join(", ") || "РЅРµ С‚СЂРµР±СѓРµС‚СЃСЏ"}.`,
      `Р”СЂР°Р№РІРµСЂС‹ СЂР°СЃС‡РµС‚Р°: ${systemCount} СЃРёСЃС‚РµРј, ${round1(objectArea)} Рј2, ${round1(cableLength)} Рј РєР°Р±РµР»СЏ, ${round1(integrationPoints)} С‚РѕС‡РµРє РёРЅС‚РµРіСЂР°С†РёРё.`,
    ],
  };
}
