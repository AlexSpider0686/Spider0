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
      index === normalized.length - 1
        ? remaining
        : Math.max(0, Math.round((remaining * role.weight) / weightTotal));
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
      const commissioningCount = peakCrew > 0 ? Math.max(1, Math.min(2, Math.ceil((integrationPoints + controllers) / 18))) : 0;
      const foremen = peakCrew > 0 ? 1 : 0;
      const installers = Math.max(peakCrew - foremen - commissioningCount, 0);
      const cableShare = cableLength > 0 && primaryUnits > 0 ? Math.min(100, Math.round((cableLength / Math.max(primaryUnits, 1)) * 3.5)) : 0;
      return {
        systemName: String(row?.systemName || row?.systemType || `Система ${index + 1}`),
        peakCrew,
        durationDays,
        commissioningCount,
        leadRoles:
          peakCrew <= 0
            ? "Ресурс не требуется"
            : [
                foremen ? `${foremen} прораб` : "",
                installers ? `${installers} монтажн.` : "",
                commissioningCount ? `${commissioningCount} инженер ПНР` : "",
              ]
                .filter(Boolean)
                .join(", "),
        complexityNote:
          integrationPoints > 0
            ? `Интеграционных точек: ${integrationPoints}, кабельная насыщенность: ${cableShare}%`
            : `Контроллеров: ${controllers}, извещателей/точек: ${primaryUnits}`,
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

  const fieldTeam = splitHeadcount(
    [
      { role: "foreman", label: "Прораб", minCount: peakFieldTeam > 0 ? 1 : 0, maxCount: 2, weight: fieldRoleWeights.foreman },
      { role: "leadInstaller", label: "Старший монтажник", minCount: peakFieldTeam >= 4 ? 1 : 0, maxCount: 2, weight: fieldRoleWeights.leadInstaller },
      { role: "installer", label: "Монтажник", minCount: peakFieldTeam > 0 ? 1 : 0, maxCount: Math.max(peakFieldTeam, 1), weight: fieldRoleWeights.installer },
      { role: "cableInstaller", label: "Кабельщик/трассировщик", minCount: peakFieldTeam >= 5 || cableLength > 1800 ? 1 : 0, maxCount: Math.max(Math.ceil(peakFieldTeam / 2), 1), weight: fieldRoleWeights.cableInstaller },
      { role: "commissioning", label: "Инженер ПНР", minCount: executionHours > 0 ? 1 : 0, maxCount: 3, weight: fieldRoleWeights.commissioning },
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
      { role: "chief", label: "ГИП/ведущий инженер", minCount: designHours > 0 ? 1 : 0, maxCount: 2, weight: designRoleWeights.chief },
      { role: "lead", label: "Ведущий проектировщик", minCount: designHours > 0 ? 1 : 0, maxCount: 2, weight: designRoleWeights.lead },
      { role: "designer", label: "Инженер-проектировщик", minCount: designHours > 0 ? 1 : 0, maxCount: Math.max(peakDesignTeam, 1), weight: designRoleWeights.designer },
      { role: "bim", label: "BIM/CAD специалист", minCount: peakDesignTeam >= 3 || objectArea > 12000 ? 1 : 0, maxCount: 2, weight: designRoleWeights.bim },
      { role: "estimate", label: "Сметчик", minCount: designHours > 0 ? 1 : 0, maxCount: 1, weight: designRoleWeights.estimate },
    ],
    peakDesignTeam
  );

  const fieldDurationDays = Math.max(n(timeline?.phaseMap?.smr?.duration, 0), 1);
  const commissioningDurationDays = Math.max(n(timeline?.phaseMap?.pnr?.duration, 0), 1);
  const designDurationDays = Math.max(n(timeline?.phaseMap?.design?.duration, 0), 1);
  const productiveHoursPerPersonDay = 6.8;

  return {
    methodology:
      "Состав бригад рассчитан по трудоемкости СМР, ПНР и проектирования, календарной длительности фаз, кабельной насыщенности, интеграционным точкам и требуемому пиковому ресурсу. Принята производительная смена 6,8 ч/чел. в день с разделением ролей по видам работ.",
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
      `Пиковая монтажная бригада: ${peakFieldTeam} чел. при среднем ресурсе ${avgExecutionTeam || peakFieldTeam || 0} чел. на фазе СМР.`,
      `Состав монтажного ресурса: ${fieldTeam.map((item) => `${item.label} ${item.count}`).join(", ") || "не требуется"}.`,
      `Контур ПНР: ${fieldTeam.filter((item) => item.role === "commissioning").map((item) => `${item.label} ${item.count}`).join(", ") || "инженер ПНР не требуется"}.`,
      `Проектный контур: ${designTeam.map((item) => `${item.label} ${item.count}`).join(", ") || "не требуется"}.`,
      `Драйверы расчета: ${systemCount} систем, ${round1(objectArea)} м2, ${round1(cableLength)} м кабеля, ${round1(integrationPoints)} точек интеграции.`,
    ],
  };
}
