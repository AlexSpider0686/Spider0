function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasSystem(systems, type) {
  return (systems || []).some((item) => item.type === type);
}

function getAreaTimeFactor(area) {
  if (area >= 100000) return 18;
  if (area >= 50000) return 14;
  if (area >= 20000) return 10;
  if (area >= 10000) return 7;
  if (area >= 5000) return 5;
  return 3;
}

function estimateSurveyHours({ objectData, zones, surveySystems, sections, photoPrompts, objectArea }) {
  const zoneCount = zones?.length || 0;
  const floors = Math.max(num(objectData?.floors, 1), 1);
  const operational = objectData?.buildingStatus === "operational";
  const systemsWithPlans = surveySystems.filter((system) => ["aps", "soue", "sots"].includes(system.type)).length;

  const totalQuestions = sections.reduce(
    (sum, section) =>
      sum +
      (section.questions || []).reduce((sectionSum, question) => {
        if (question.required === false) return sectionSum;
        if (question.type === "multiselect") return sectionSum + 0.9;
        if (question.type === "number") return sectionSum + 0.65;
        if (question.type === "boolean") return sectionSum + 0.45;
        return sectionSum + 0.6;
      }, 0),
    0
  );

  const averageZoneArea = zoneCount ? objectArea / Math.max(zoneCount, 1) : objectArea;
  const zoneComplexityFactor = averageZoneArea > 3500 ? 0.9 : averageZoneArea < 700 ? 1.08 : 1;
  const uniqueFloorLevels = new Set((zones || []).map((zone) => `${num(zone?.floors, 1)}`)).size;

  const systemMinutes = surveySystems.reduce((sum, system) => {
    if (system.type === "aps") return sum + 10;
    if (system.type === "soue") return sum + 9;
    if (system.type === "sots") return sum + 8;
    if (system.type === "sot") return sum + 7;
    if (system.type === "skud") return sum + 7;
    return sum + 6;
  }, 0);

  const photoMinutes =
    photoPrompts.filter((prompt) => prompt.type === "surface_scan").length * 1.6 +
    photoPrompts.filter((prompt) => prompt.type === "corridor_scan").length * 1.8 +
    photoPrompts.filter((prompt) => prompt.type === "evacuation_plan").length * 3.2;

  const floorMinutes = Math.max(0, floors - 1) * 1.2 + Math.max(0, uniqueFloorLevels - 1) * 0.6;
  const planMinutes = systemsWithPlans * 2.5;
  const accessMinutes = operational ? 4 : 3;
  const baselineMinutes = 8;

  const totalMinutes =
    (baselineMinutes + getAreaTimeFactor(objectArea) + zoneCount * 1.6 + floorMinutes + systemMinutes + totalQuestions * 0.7 + photoMinutes + planMinutes + accessMinutes) *
    zoneComplexityFactor;

  return Number((Math.max(totalMinutes, 18) / 60).toFixed(1));
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
  enabledByQuestionId = null,
  defaultValue = undefined,
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
    enabledByQuestionId,
    defaultValue,
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
        required: false,
        defaultValue: ["Рабочее время"],
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
      required: false,
      defaultValue: 0,
    }),
    createQuestion({
      id: "object-riser-access",
      sectionId: objectSectionId,
      type: "boolean",
      label: "Есть ли беспрепятственный доступ к стоякам и вертикальным трассам?",
      required: false,
    }),
    createQuestion({
      id: "object-cable-reserve",
      sectionId: objectSectionId,
      type: "number",
      label: "Какой процент дополнительного запаса кабеля требуется закладывать?",
      placeholder: "10",
      min: 0,
      max: 100,
      required: false,
      defaultValue: 10,
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
        id: `zone-${zone.id}-mount-height-limit-enabled`,
        sectionId: zoneSectionId,
        group: "zone",
        zoneId: zone.id,
        type: "boolean",
        label: `Есть ли в зоне "${zoneTitle}" ограничение по высоте сложного монтажа?`,
        required: false,
      }),
      createQuestion({
        id: `zone-${zone.id}-mount-height-limit`,
        sectionId: zoneSectionId,
        group: "zone",
        zoneId: zone.id,
        type: "number",
        label: `Максимальная высота сложного монтажа в зоне "${zoneTitle}", м`,
        placeholder: "0",
        required: false,
        enabledByQuestionId: `zone-${zone.id}-mount-height-limit-enabled`,
      }),
      createQuestion({
        id: `zone-${zone.id}-finish-limitations`,
        sectionId: zoneSectionId,
        group: "zone",
        zoneId: zone.id,
        type: "multiselect",
        label: `Какие ограничения есть в зоне "${zoneTitle}"`,
        options: ["Чистовая отделка", "Работа рядом с людьми", "Ночной график", "Ограниченный доступ", "Нет ограничений"],
        required: false,
        defaultValue: ["Нет ограничений"],
      }),
      createQuestion({
        id: `zone-${zone.id}-corridor-route-method`,
        sectionId: zoneSectionId,
        group: "zone",
        zoneId: zone.id,
        type: "multiselect",
        label: `Предполагаемый способ прокладки кабеля в зоне "${zoneTitle}"`,
        options: ["В лотке", "В гофре/трубе", "В коробе", "В запотолочном пространстве", "Под фальш-полом", "Открыто по основанию"],
        required: false,
      }),
      createQuestion({
        id: `zone-${zone.id}-raised-floor-present`,
        sectionId: zoneSectionId,
        group: "zone",
        zoneId: zone.id,
        type: "boolean",
        label: `Есть ли в зоне "${zoneTitle}" фальш-пол?`,
        required: false,
      }),
      createQuestion({
        id: `zone-${zone.id}-ceiling-void-present`,
        sectionId: zoneSectionId,
        group: "zone",
        zoneId: zone.id,
        type: "boolean",
        label: `Есть ли в зоне "${zoneTitle}" запотолочное пространство для трасс?`,
        required: false,
      }),
      createQuestion({
        id: `zone-${zone.id}-tray-routing-present`,
        sectionId: zoneSectionId,
        group: "zone",
        zoneId: zone.id,
        type: "boolean",
        label: `Есть ли в зоне "${zoneTitle}" лотки или готовые кабельные трассы?`,
        required: false,
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
          required: false,
        })
      );

      photoPrompts.push({
        id: `photo-zone-${zone.id}-evacuation`,
        zoneId: zone.id,
        zoneName: zoneTitle,
        type: "evacuation_plan",
        title: `Фото плана эвакуации / планировки: ${zoneTitle}`,
        hint:
          "Можно загрузить сразу несколько планов по этажам. Снимайте каждый план целиком, без обрезки углов, с расстояния примерно 0.7-1.5 м, держа камеру почти параллельно плоскости листа. Важно, чтобы были читаемы помещения, выходы, лестницы и условные обозначения; избегайте бликов, сильного наклона и смаза.",
        targetQuestionIds: [`zone-${zone.id}-evacuation-plan`],
      });
    }

    photoPrompts.push({
      id: `photo-zone-${zone.id}-surface`,
      zoneId: zone.id,
      zoneName: zoneTitle,
      type: "surface_scan",
      title: `Фото поверхностей и потолка: ${zoneTitle}`,
      hint:
        "Снимите участок помещения так, чтобы одновременно были видны стена и потолок. По фото должны читаться материал основания, тип потолка и общие условия монтажа: открытый потолок, подвесной потолок, монолит, ГКЛ, бетон, кирпич и т.п. Если в кадре есть существующие лотки, подвесы, короба или другие конструкции, по которым можно понять доступный способ крепления, их тоже лучше захватить.",
      targetQuestionIds: [`zone-${zone.id}-wall-material`, `zone-${zone.id}-ceiling-type`, `zone-${zone.id}-ceiling-height`],
    });

    photoPrompts.push({
      id: `photo-zone-${zone.id}-corridor`,
      zoneId: zone.id,
      zoneName: zoneTitle,
      type: "corridor_scan",
      title: `Фото коридора / трассы: ${zoneTitle}`,
      hint:
        "Снимите коридор или основной маршрут прокладки так, чтобы в кадре были видны стены, потолок, проход по длине коридора и инженерная обстановка. Полезно, если на фото видны существующие лотки, короба, трубы, подвесы, открытый запотолок, люки, фальш-пол или другие признаки того, как здесь реально можно будет вести кабельную трассу. Лучше снимать вдоль маршрута без сильного наклона камеры.",
      targetQuestionIds: [
        `zone-${zone.id}-corridor-route-method`,
        `zone-${zone.id}-raised-floor-present`,
        `zone-${zone.id}-ceiling-void-present`,
        `zone-${zone.id}-tray-routing-present`,
      ],
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
        required: false,
        defaultValue: ["Типовые условия"],
      }),
      createQuestion({
        id: `system-${system.id}-integration-count`,
        sectionId: systemSectionId,
        group: "system",
        systemType: system.type,
        type: "number",
        label: `Сколько точек интеграции или обмена требуется по системе ${system.type.toUpperCase()}?`,
        placeholder: "0",
        required: false,
        defaultValue: 0,
      }),
      createQuestion({
        id: `system-${system.id}-coordination-zones`,
        sectionId: systemSectionId,
        group: "system",
        systemType: system.type,
        type: "number",
        label: `По скольким зонам нужна координация и привязка решений для ${system.type.toUpperCase()}?`,
        placeholder: "0",
        required: false,
        defaultValue: 0,
      }),
      createQuestion({
        id: `system-${system.id}-reuse-existing-infra`,
        sectionId: systemSectionId,
        group: "system",
        systemType: system.type,
        type: "boolean",
        label: `Есть ли по ${system.type.toUpperCase()} существующие линии, шкафы или узлы, которые нужно учесть в проекте?`,
        required: false,
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
          label:
            system.type === "aps"
              ? "Сколько самостоятельных ЗКСПС требуется по АПС?"
              : `Сколько самостоятельных зон оповещения нужно по ${system.type.toUpperCase()}?`,
          placeholder: "1",
          required: false,
          defaultValue: 1,
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
          required: false,
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
          required: false,
          defaultValue: 0,
        })
      );
    }

    sections.push({
      id: systemSectionId,
      title: `Система: ${system.type.toUpperCase()}`,
      description: "Чек-лист уточняет условия, которые влияют на точность расчета проектирования, техрешения и стоимости по системе.",
      questions: systemQuestions,
    });
  });

  const allQuestions = sections.flatMap((section) => section.questions);
  const estimatedHours = estimateSurveyHours({
    objectData,
    zones,
    surveySystems,
    sections,
    photoPrompts,
    objectArea,
  });

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

  const requiredQuestions = questions.filter((question) => {
    if (question.required === false) return false;
    if (question.enabledByQuestionId) return answers?.[question.enabledByQuestionId] === true;
    return true;
  });

  const completed = requiredQuestions.filter((question) => {
    const value = answers?.[question.id];
    if ((value === "" || value === null || value === undefined) && question.defaultValue !== undefined) return true;
    if (question.type === "number") return value !== "" && value !== null && value !== undefined;
    if (question.type === "boolean") return typeof value === "boolean";
    if (question.type === "multiselect") return Array.isArray(value) && value.length > 0;
    return Boolean(value);
  }).length;

  return {
    total: requiredQuestions.length,
    completed,
    percent: requiredQuestions.length ? Math.round((completed / requiredQuestions.length) * 100) : 100,
  };
}
