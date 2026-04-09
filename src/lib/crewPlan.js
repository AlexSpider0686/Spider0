import { toNumber } from "./estimate.js";

function n(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function round1(value) {
  return Number(n(value, 0).toFixed(1));
}

function sum(items, mapper) {
  return (Array.isArray(items) ? items : []).reduce((total, item, index) => total + n(mapper(item, index), 0), 0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toShareRoles(roles = []) {
  const total = sum(roles, (role) => role.count);
  return roles.map((role) => ({
    ...role,
    sharePercent: total > 0 ? Math.round((n(role.count, 0) / total) * 100) : 0,
  }));
}

function aggregateExecutionRoles(systemResults = []) {
  const roleMap = new Map();

  (Array.isArray(systemResults) ? systemResults : []).forEach((result) => {
    (Array.isArray(result?.executionRoles) ? result.executionRoles : []).forEach((role) => {
      const key = String(role?.role || role?.label || "");
      if (!key) return;
      const current = roleMap.get(key) || {
        role: key,
        label: role?.label || key,
        count: 0,
      };
      current.count += Math.max(Math.round(n(role?.count, 0)), 0);
      roleMap.set(key, current);
    });
  });

  return toShareRoles(Array.from(roleMap.values()).sort((left, right) => right.count - left.count));
}

function splitHeadcount(roleDefinitions, targetHeadcount) {
  const activeRoles = roleDefinitions.filter((item) => item.enabled !== false);
  if (!activeRoles.length) return [];

  const safeTarget = Math.max(Math.round(n(targetHeadcount, 0)), 0);
  const minRequired = sum(activeRoles, (role) => Math.max(Math.round(n(role.minCount, 0)), 0));
  let remaining = Math.max(safeTarget, minRequired) - minRequired;

  const normalized = activeRoles.map((role) => ({
    ...role,
    count: Math.max(Math.round(n(role.minCount, 0)), 0),
    weight: Math.max(n(role.weight, 0), 0),
  }));

  const weightTotal = sum(normalized, (role) => role.weight) || 1;

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

  return normalized
    .filter((role) => role.count > 0)
    .map((role) => ({ role: role.role, label: role.label, count: role.count }));
}

function buildDesignRolesForTeam(teamSize) {
  const safeTeam = Math.max(Math.round(n(teamSize, 0)), 0);
  if (safeTeam <= 0) return [];

  return toShareRoles(
    splitHeadcount(
      [
        { role: "chiefEngineer", label: "ГИП/ведущий инженер", minCount: 1, maxCount: 1, weight: 1.1 },
        { role: "leadDesigner", label: "Ведущий проектировщик", minCount: safeTeam >= 2 ? 1 : 0, maxCount: 2, weight: 1.05 },
        { role: "designer", label: "Инженер-проектировщик", minCount: 0, maxCount: Math.max(safeTeam, 1), weight: 2.2 },
        { role: "bim", label: "BIM/CAD специалист", minCount: safeTeam >= 4 ? 1 : 0, maxCount: 2, weight: 0.9 },
        { role: "estimator", label: "Сметчик", minCount: safeTeam >= 5 ? 1 : 0, maxCount: 1, weight: 0.65 },
      ],
      safeTeam
    )
  );
}

function buildLeadRolesLabel(roles = []) {
  return (roles || [])
    .filter((role) => n(role.count, 0) > 0)
    .slice(0, 4)
    .map((role) => `${role.label} ${role.count}`)
    .join(", ");
}

function buildComplexityNote(result) {
  const integrationPoints = n(result?.integrationPoints, 0);
  const cableLength = n(result?.cable, 0);
  const routeComplexity = n(result?.routeComplexityAverage, 1);
  const noteParts = [];

  if (integrationPoints > 0) noteParts.push(`интеграционных точек: ${Math.round(integrationPoints)}`);
  if (cableLength > 0) noteParts.push(`кабель: ${Math.round(cableLength)} м`);
  noteParts.push(`сложность трасс: x${routeComplexity.toFixed(2)}`);

  return noteParts.join(", ");
}

function buildSystemCrewRows(systemResults = []) {
  return (Array.isArray(systemResults) ? systemResults : [])
    .filter((result) => n(result?.executionHours, 0) > 0 || n(result?.designHours, 0) > 0)
    .map((result) => {
      const executionRoles = Array.isArray(result?.executionRoles) ? result.executionRoles : [];
      const peakCrew = sum(executionRoles, (role) => role.count) || n(result?.executionTeamSize, 0);
      const durationDays = Math.max(1, Math.ceil(n(result?.executionDaysExact, result?.executionDurationDays)));

      return {
        systemId: result?.systemId || result?.id || result?.systemName,
        systemName: result?.systemName || "Система",
        peakCrew,
        durationDays,
        leadRoles: buildLeadRolesLabel(executionRoles) || "состав уточняется",
        complexityNote: buildComplexityNote(result),
      };
    })
    .sort((left, right) => right.peakCrew - left.peakCrew || right.durationDays - left.durationDays);
}

export function buildProjectCrewPlan(systemResults = [], objectData = {}, totals = {}, timelineOverride = null) {
  const activeResults = (Array.isArray(systemResults) ? systemResults : []).filter(
    (result) => n(result?.executionHours, 0) > 0 || n(result?.designHours, 0) > 0
  );

  const totalExecutionHours = sum(activeResults, (result) => result?.executionHours);
  const totalDesignHours = sum(activeResults, (result) => result?.designHours);
  const fieldPeakHeadcount = Math.max(...activeResults.map((result) => n(result?.executionTeamSize, 0)), 0);
  const designPeakHeadcount = Math.max(...activeResults.map((result) => n(result?.designTeamSize, 0)), 0);
  const fieldDurationDays = Math.max(...activeResults.map((result) => n(result?.executionDaysExact, result?.executionDurationDays)), 0);
  const designDurationDays = Math.max(...activeResults.map((result) => n(result?.designMonthsExact, 0) * 22), 0);
  const fieldRoles = aggregateExecutionRoles(activeResults);
  const designRoles = buildDesignRolesForTeam(designPeakHeadcount);
  const systemCrewRows = buildSystemCrewRows(activeResults);
  const integrationPoints = sum(activeResults, (result) => result?.integrationPoints);
  const cableLength = sum(activeResults, (result) => result?.cable);
  const systemCount = activeResults.length;
  const objectArea = n(objectData?.area, 0);
  const totalWorkCost = n(totals?.totalWork, 0);
  const totalDesignCost = n(totals?.totalDesign, 0);
  const averageFieldLoad = fieldPeakHeadcount > 0 && fieldDurationDays > 0 ? totalExecutionHours / fieldPeakHeadcount / fieldDurationDays : 0;
  const averageDesignLoad = designPeakHeadcount > 0 && designDurationDays > 0 ? totalDesignHours / designPeakHeadcount / designDurationDays : 0;

  const summaryLines = [
    `Пиковая монтажная бригада: ${fieldPeakHeadcount || 0} чел. при среднем ресурсе ${round1(
      activeResults.length ? sum(activeResults, (result) => result?.executionTeamSize) / activeResults.length : 0
    )} чел. на фазе СМР.`,
    `Состав монтажного ресурса: ${buildLeadRolesLabel(fieldRoles) || "монтажный состав уточняется"}.`,
    `Контур ПНР: ${buildLeadRolesLabel(fieldRoles.filter((role) => role.role === "commissioning")) || "инженер ПНР назначается по системам"}.`,
    `Проектный контур: ${buildLeadRolesLabel(designRoles) || "проектная группа не требуется"}.`,
    `Драйверы расчета: ${systemCount} систем, ${Math.round(objectArea)} м2, ${Math.round(cableLength)} м кабеля, ${Math.round(
      integrationPoints
    )} точек интеграции.`,
  ];

  return {
    methodology:
      "Состав бригад рассчитывается по трудоемкости СМР и проектирования, календарной длительности фаз, кабельной насыщенности, интеграционным точкам и требуемому инженерному ресурсу. Изменение численности по ролям сразу влияет на срок и стоимость работ.",
    drivers: [
      `Систем в расчете: ${systemCount}.`,
      `Кабельный объем: ${Math.round(cableLength)} м.`,
      `Интеграционные точки: ${Math.round(integrationPoints)}.`,
      `Работы СМР+ПНР: ${Math.round(totalExecutionHours)} ч.`,
      `Проектирование: ${Math.round(totalDesignHours)} ч.`,
    ],
    summaryLines,
    field: {
      peakHeadcount: fieldPeakHeadcount || 0,
      durationDays: round1(fieldDurationDays),
      loadPerPersonDay: round1(averageFieldLoad),
      totalHours: round1(totalExecutionHours),
      totalCost: totalWorkCost,
      roles: fieldRoles,
    },
    design: {
      peakHeadcount: designPeakHeadcount || 0,
      durationDays: round1(designDurationDays),
      loadPerPersonDay: round1(averageDesignLoad),
      totalHours: round1(totalDesignHours),
      totalCost: totalDesignCost,
      roles: designRoles,
    },
    systemCrewRows,
    objectContext: {
      area: objectArea,
      systemsCount: systemCount,
      timelineOverride: timelineOverride || null,
    },
  };
}
