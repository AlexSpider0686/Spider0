function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasSystem(systems, type) {
  return (systems || []).some((item) => item.type === type);
}

function createQuestion({
  id,
  sectionId,
  group = "global",
  systemType = null,
  zoneId = null,
  type,
  label,
  required = true,
  options = [],
  placeholder = "",
  aiAutofill = false,
  min = 0,
  max = null,
}) {
  return {
    id,
    sectionId,
    group,
    systemType,
    zoneId,
    type,
    label,
    required,
    options,
    placeholder,
    aiAutofill,
    min,
    max,
  };
}

export function validateAiSurveyReadiness({ objectData, zones, protectedArea }) {
  const issues = [];

  if (!objectData?.objectType) issues.push("Не выбран тип объекта.");
  if (num(objectData?.totalArea) <= 0) issues.push("Не заполнена общая площадь.");
  if (num(protectedArea) <= 0) issues.push("Не рассчитана защищаемая площадь.");
  if (num(objectData?.floors) <= 0) issues.push("Не заполнена этажность.");
  if (!objectData?.buildingStatus) issues.push("Не выбран статус объекта.");

  if (!Array.isArray(zones) || !zones.length) {
    issues.push("Не заполнено зонирование.");
  } else {
    const invalidZones = zones.filter((zone) => !zone?.type || num(zone?.area) <= 0 || num(zone?.floors) <= 0);
    if (invalidZones.length) issues.push("Для каждой зоны нужно указать тип, площадь и этажность.");
  }

  return {
    isReady: issues.length === 0,
    issues,
  };
}

export function buildAiSurveyPlan({ objectData, zones, systems, protectedArea }) {
  const activeSystems = (systems || []).filter(Boolean);
  const surveySystems = activeSystems.filter((system) => !system.hasWorkingDocs);
  const skippedSystems = activeSystems.filter((system) => system.hasWorkingDocs);
  const sections = [];
  const photoPrompts = [];

  const objectArea = num(objectData?.totalArea);
  const areaFactor = objectArea >= 50000 ? 2.2 : objectArea >= 20000 ? 1.5 : objectArea >= 10000 ? 1.15 : 0.8;
  const estimatedHours = Number(
    (
      1.4 +
      (zones?.length || 0) * 0.45 +
      surveySystems.length * 0.55 +
      areaFactor +
      (objectData?.buildingStatus === "operational" ? 0.6 : 0.3)
    ).toFixed(1)
  );

  const objectSectionId = "object-baseline";
  const objectQuestions = [];

  if (objectData?.buildingStatus === "construction") {
    objectQuestions.push(
      createQuestion({
        id: "construction-contour-ready",
        sectionId: objectSectionId,
        type: "boolean",
        label: "Готов ли строительный контур для монтажа инженерных систем?",
      }),
      createQuestion({
        id: "construction-embedded-ready",
        sectionId: objectSectionId,
        type: "boolean",
        label: "Подготовлены ли закладные, проходки и точки ввода трасс?",
      })
    );
  } else {
    objectQuestions.push(
      createQuestion({
        id: "operational-finish-sensitive",
        sectionId: objectSectionId,
        type: "boolean",
        label: "Требуется ли монтаж без повреждения чистовой отделки?",
      }),
      createQuestion({
        id: "operational-work-window",
        sectionId: objectSectionId,
        type: "multiselect",
        label: "В каких окнах допускается производство работ?",
        options: ["Рабочее время", "Ночные смены", "Выходные", "Поэтапно по зонам"],
      })
    );
  }

  objectQuestions.push(
    createQuestion({
      id: "object-low-current-rooms",
      sectionId: objectSectionId,
      type: "number",
      label: "Сколько предусмотрено слаботочных помещений или узлов связи?",
      placeholder: "0",
    }),
    createQuestion({
      id: "object-riser-access",
      sectionId: objectSectionId,
      type: "boolean",
      label: "Есть ли беспрепятственный доступ к стоякам и вертикальным трассам?",
    }),
    createQuestion({
      id: "object-cable-reserve",
      sectionId: objectSectionId,
      type: "number",
      label: "Какой процент дополнительного запаса кабеля требуется закладывать?",
      placeholder: "10",
      min: 0,
      max: 100,
    })
  );

  sections.push({
    id: objectSectionId,
    title: "Общие условия обследования",
    description: "Блок уточняет строительную готовность, доступность трасс и общие ограничения монтажа.",
    questions: objectQuestions,
  });

  (zones || []).forEach((zone, index) => {
    const zoneSectionId = `zone-${zone.id}`;
    const zoneTitle = zone?.name || `Зона ${index + 1}`;
    const zoneQuestions = [
      createQuestion({
        id: `zone-${zone.id}-wall-material`,
        sectionId: zoneSectionId,
        group: "zone",
        zoneId: zone.id,
        type: "multiselect",
        label: `Материал стен в зоне "${zoneTitle}"`,
        options: ["Бетон", "Кирпич", "ГКЛ", "Стекло", "Сэндвич-панели", "Смешанный"],
        aiAutofill: true,
      }),
      createQuestion({
        id: `zone-${zone.id}-ceiling-type`,
        sectionId: zoneSectionId,
        group: "zone",
        zoneId: zone.id,
        type: "multiselect",
        label: `Тип потолка в зоне "${zoneTitle}"`,
        options: ["Открытый", "Армстронг", "ГКЛ", "Грильято", "Монолит", "Смешанный"],
        aiAutofill: true,
      }),
      createQuestion({
        id: `zone-${zone.id}-ceiling-height`,
        sectionId: zoneSectionId,
        group: "zone",
        zoneId: zone.id,
        type: "number",
        label: `Высота помещения в зоне "${zoneTitle}", м`,
        placeholder: "3.2",
        aiAutofill: true,
        min: 2,
        max: 18,
      }),
      createQuestion({
        id: `zone-${zone.id}-mount-height-limit`,
        sectionId: zoneSectionId,
        group: "zone",
        zoneId: zone.id,
        type: "number",
        label: `Максимальная высота сложного монтажа в зоне "${zoneTitle}", м`,
        placeholder: "0",
      }),
      createQuestion({
        id: `zone-${zone.id}-finish-limitations`,
        sectionId: zoneSectionId,
        group: "zone",
        zoneId: zone.id,
        type: "multiselect",
        label: `Какие ограничения есть в зоне "${zoneTitle}"`,
        options: ["Чистовая отделка", "Работа рядом с людьми", "Ночной график", "Ограниченный доступ", "Нет ограничений"],
      }),
    ];

    if (hasSystem(surveySystems, "aps") || hasSystem(surveySystems, "soue") || hasSystem(surveySystems, "sots")) {
      zoneQuestions.push(
        createQuestion({
          id: `zone-${zone.id}-evacuation-plan`,
          sectionId: zoneSectionId,
          group: "zone",
          zoneId: zone.id,
          type: "boolean",
          label: `Удалось ли получить читаемый план эвакуации или планировку для зоны "${zoneTitle}"?`,
          aiAutofill: true,
        })
      );
      photoPrompts.push({
        id: `photo-zone-${zone.id}-evacuation`,
        zoneId: zone.id,
        zoneName: zoneTitle,
        type: "evacuation_plan",
        title: `Фото плана эвакуации / планировки: ${zoneTitle}`,
        hint:
          "Снимите план эвакуации или схему планировки с расстояния примерно 0.7-1.5 м, держите камеру почти параллельно плоскости плана без сильного наклона, захватите лист целиком, избегайте бликов и размытия.",
        targetQuestionIds: [`zone-${zone.id}-evacuation-plan`],
      });
    }

    photoPrompts.push({
      id: `photo-zone-${zone.id}-surface`,
      zoneId: zone.id,
      zoneName: zoneTitle,
      type: "surface_scan",
      title: `Фото поверхностей и потолка: ${zoneTitle}`,
      hint: "Снимите участок стены и потолка так, чтобы были видны материал и тип крепления будущих трасс.",
      targetQuestionIds: [`zone-${zone.id}-wall-material`, `zone-${zone.id}-ceiling-type`, `zone-${zone.id}-ceiling-height`],
    });

    sections.push({
      id: zoneSectionId,
      title: `Зона: ${zoneTitle}`,
      description: `Вопросы по назначению зоны, этажности (${num(zone?.floors, 1)}), площади (${num(zone?.area, 0)} м²) и условиям монтажа.`,
      questions: zoneQuestions,
    });
  });

  surveySystems.forEach((system) => {
    const systemSectionId = `system-${system.id}`;
    const systemQuestions = [
      createQuestion({
        id: `system-${system.id}-route-complexity`,
        sectionId: systemSectionId,
        group: "system",
        systemType: system.type,
        type: "multiselect",
        label: `Какие ограничения трасс характерны для системы ${system.type.toUpperCase()}?`,
        options: ["Длинные вертикали", "Скрытая прокладка", "Пересечение действующих сетей", "Сложные узлы прохода", "Типовые условия"],
      }),
      createQuestion({
        id: `system-${system.id}-integration-count`,
        sectionId: systemSectionId,
        group: "system",
        systemType: system.type,
        type: "number",
        label: `Сколько точек интеграции или обмена требуется по системе ${system.type.toUpperCase()}?`,
        placeholder: "0",
      }),
      createQuestion({
        id: `system-${system.id}-coordination-zones`,
        sectionId: systemSectionId,
        group: "system",
        systemType: system.type,
        type: "number",
        label: `По скольким зонам нужна координация и привязка решений для ${system.type.toUpperCase()}?`,
        placeholder: "0",
      }),
      createQuestion({
        id: `system-${system.id}-reuse-existing-infra`,
        sectionId: systemSectionId,
        group: "system",
        systemType: system.type,
        type: "boolean",
        label: `Есть ли по ${system.type.toUpperCase()} существующие линии, шкафы или узлы, которые нужно учесть в проекте?`,
      }),
    ];

    if (system.type === "aps" || system.type === "soue") {
      systemQuestions.push(
        createQuestion({
          id: `system-${system.id}-voice-zones`,
          sectionId: systemSectionId,
          group: "system",
          systemType: system.type,
          type: "number",
          label: `Сколько самостоятельных зон оповещения/контроля нужно по ${system.type.toUpperCase()}?`,
          placeholder: "1",
        })
      );
    }

    if (system.type === "sot") {
      systemQuestions.push(
        createQuestion({
          id: `system-${system.id}-coverage-demand`,
          sectionId: systemSectionId,
          group: "system",
          systemType: system.type,
          type: "multiselect",
          label: "Какие сценарии видеоконтроля требуются?",
          options: ["Общий обзор", "Лица/проходы", "Номера авто", "Периметр", "Складские ячейки"],
        })
      );
    }

    if (system.type === "skud") {
      systemQuestions.push(
        createQuestion({
          id: `system-${system.id}-access-points`,
          sectionId: systemSectionId,
          group: "system",
          systemType: system.type,
          type: "number",
          label: "Сколько точек прохода или контролируемых дверей нужно предусмотреть?",
          placeholder: "0",
        })
      );
    }

    sections.push({
      id: systemSectionId,
      title: `Система: ${system.type.toUpperCase()}`,
      description: "Чек-лист уточняет условия, которые влияют на точность расчета проектирования именно по этой системе.",
      questions: systemQuestions,
    });
  });

  const allQuestions = sections.flatMap((section) => section.questions);

  return {
    estimatedHours,
    sections,
    photoPrompts,
    allQuestions,
    activeSystems: activeSystems.map((item) => item.type),
    skippedSystems: skippedSystems.map((item) => item.type),
    readiness: validateAiSurveyReadiness({ objectData, zones, protectedArea }),
  };
}

export function calculateAiSurveyCompletion(plan, answers = {}) {
  const questions = plan?.allQuestions || [];
  if (!questions.length) {
    return { total: 0, completed: 0, percent: 100 };
  }

  const completed = questions.filter((question) => {
    const value = answers?.[question.id];
    if (question.type === "number") return value !== "" && value !== null && value !== undefined;
    if (question.type === "boolean") return typeof value === "boolean";
    if (question.type === "multiselect") return Array.isArray(value) && value.length > 0;
    return Boolean(value);
  }).length;

  return {
    total: questions.length,
    completed,
    percent: Math.round((completed / questions.length) * 100),
  };
}
