import { SYSTEM_TYPES } from "../config/estimateConfig";
import { toNumber } from "./estimate";
import { repairTextTree } from "./textEncoding";

export const NORMATIVE_REQUIREMENTS_AS_OF = "2026-04-07";

const SYSTEM_NAME_BY_CODE = Object.fromEntries((SYSTEM_TYPES || []).map((item) => [item.code, item.name]));

const NORMATIVE_SOURCES = repairTextTree({
  fireLaw: {
    act: "Федеральный закон от 22.07.2008 № 123-ФЗ",
    title: "Технический регламент о требованиях пожарной безопасности",
    url: "https://www.consultant.ru/document/cons_doc_LAW_78699/",
  },
  sp484: {
    act: "СП 484.1311500.2020",
    title: "Системы пожарной сигнализации и автоматизация систем противопожарной защиты",
    url: "https://armo-training.ru/assets/files/lawspage/sp-484.pdf",
  },
  sp486: {
    act: "СП 486.1311500.2020",
    title: "Перечень зданий, сооружений, помещений и оборудования, подлежащих защите АУП и СПС",
    url: "https://gktgs.ru/assets/files/sp/sp-486-1311500-2020-sistemy-protivopozharnoj-zashchity-perechen-zdanij-sooruzhenij-pomeshchenij-i-oborudovaniya-podlezhashchih-zashchite-avtomaticheskimi-ustanovkami-pozharotusheniya.pdf",
  },
  sp3: {
    act: "СП 3.13130.2009",
    title: "Система оповещения и управления эвакуацией людей при пожаре",
    url: "https://www.norm-load.ru/SNiP/Data1/56/56088/",
    note: "На 7 апреля 2026 года действует редакция СП 3.13130.2009; новая редакция СП 3.13130.2024 вступает в силу с 1 июня 2026 года.",
  },
  sp132: {
    act: "СП 132.13330.2011",
    title: "Обеспечение антитеррористической защищенности зданий и сооружений",
    url: "https://ruza.informcad.ru/templates/doc/sp-132-13330-2011-obespechenie-antiterroristicheskoj-zashchishchennosti-zdanij-i-sooruzhenij.pdf",
  },
  gostCctv: {
    act: "ГОСТ Р 51558-2014",
    title: "Средства и системы охранные телевизионные. Классификация. Общие технические требования. Методы испытаний",
    url: "https://www.standards.ru/document/5979510.aspx",
  },
  gostSkud: {
    act: "ГОСТ Р 51241-2008",
    title: "Средства и системы контроля и управления доступом. Классификация. Общие технические требования. Методы испытаний",
    url: "https://allgosts.ru/13/320/gost_r_51241-2008",
  },
  ssoiGuide: {
    act: "СП 132.13330.2011 и профильные ТЗ/СТО заказчика",
    title: "Основание для централизованного мониторинга, видеонаблюдения, контроля доступа и инженерной интеграции",
    url: "https://ruza.informcad.ru/templates/doc/sp-132-13330-2011-obespechenie-antiterroristicheskoj-zashchishchennosti-zdanij-i-sooruzhenij.pdf",
  },
});

function getSystemName(systemType) {
  return SYSTEM_NAME_BY_CODE[systemType] || systemType;
}

function inferFireFunctionalClass(objectType) {
  switch (objectType) {
    case "public":
      return "ориентировочно Ф4/Ф3";
    case "residential":
      return "ориентировочно Ф1.3";
    case "warehouse":
      return "ориентировочно Ф5.2";
    case "production":
      return "ориентировочно Ф5.1";
    case "transport":
      return "специальный объект; требуется уточнение категории и ведомственных норм";
    case "energy":
      return "специальный объект; требуется уточнение категории и ведомственных норм";
    default:
      return "требует уточнения";
  }
}

function buildContext(objectData = {}, zones = [], systems = []) {
  const totalArea = Math.max(toNumber(objectData.totalArea, 0), 0);
  const floors = Math.max(toNumber(objectData.floors, 0), 0);
  const basementFloors = Math.max(toNumber(objectData.basementFloors, 0), 0);
  const ceilingHeight = Math.max(
    toNumber(objectData.ceilingHeight, 0),
    ...zones.map((zone) => toNumber(zone?.ceilingHeight, 0)),
    0
  );
  const activeSystemTypes = (systems || []).map((item) => item?.type).filter(Boolean);
  return {
    objectType: objectData.objectType || "public",
    totalArea,
    floors,
    basementFloors,
    totalFloors: floors + basementFloors,
    ceilingHeight,
    activeSystemTypes,
    hasLargeLobby: zones.some((zone) => zone?.type === "lobby" && toNumber(zone?.area, 0) >= 900),
    hasParking: zones.some((zone) => zone?.type === "parking" && toNumber(zone?.area, 0) > 0),
    fireClassHint: inferFireFunctionalClass(objectData.objectType),
  };
}

function createRequirement({
  systemType,
  title,
  status = "info",
  mandatory = false,
  source,
  reference,
  summary,
  rationale,
  appliedImpact = null,
}) {
  return repairTextTree({
    systemType,
    systemName: getSystemName(systemType),
    title,
    status,
    mandatory,
    sourceAct: source.act,
    sourceTitle: source.title,
    sourceUrl: source.url,
    sourceNote: source.note || "",
    reference,
    summary,
    rationale,
    appliedImpact,
  });
}

function buildFireRequirements(context) {
  const rows = [];
  const adjustments = {};
  const publicOrMass = ["public", "transport", "residential"].includes(context.objectType);
  const largeObject = context.totalArea >= 5000 || context.totalFloors >= 4;
  const needsDedicatedFireWorkstation = largeObject || context.objectType === "transport" || context.objectType === "energy";

  rows.push(
    createRequirement({
      systemType: "aps",
      title: "Автоматическая пожарная сигнализация должна быть предусмотрена для объекта, если он подпадает под перечни СП 486.1311500.2020.",
      status: "mandatory",
      mandatory: true,
      source: NORMATIVE_SOURCES.sp486,
      reference: "табл. А.1–А.4, далее применяется по виду здания/помещения",
      summary: `Для объекта типа «${context.objectType}» платформа считает АПС обязательной и удерживает объём извещателей, приборов и резервов не ниже нормативного инженерного минимума.`,
      rationale: `Функциональный класс по данным анкеты: ${context.fireClassHint}. При точном классе/категории перечень должен быть перепроверен по СП 486.`,
      appliedImpact: {
        minPrimaryReserveFactor: publicOrMass ? 1.06 : 1.03,
        minControllerReserve: 1,
        minManagementMode: needsDedicatedFireWorkstation ? "server" : "arm",
      },
    })
  );

  rows.push(
    createRequirement({
      systemType: "aps",
      title: "СПС должна обеспечивать автоматическое обнаружение пожара, формирование сигналов и управление связанными противопожарными системами.",
      status: "mandatory",
      mandatory: true,
      source: NORMATIVE_SOURCES.fireLaw,
      reference: "ст. 83",
      summary: "В расчёте сохраняется резерв по приёмно-контрольным приборам, шлейфам/линиям и серверу/АРМ управления, чтобы система не была собрана на предельной загрузке.",
      rationale: "Для действующего расчёта это выражается в дополнительной ёмкости контроллеров и в обязательном управленческом контуре для крупных объектов.",
      appliedImpact: {
        controllerCapacityHeadroom: 0.18,
        designFactor: 1.04,
      },
    })
  );

  rows.push(
    createRequirement({
      systemType: "soue",
      title: "СОУЭ должна обеспечивать своевременное оповещение и управление эвакуацией людей при пожаре.",
      status: "mandatory",
      mandatory: true,
      source: NORMATIVE_SOURCES.fireLaw,
      reference: "ст. 84",
      summary: "Платформа удерживает число оповещателей, усилителей и линий управления выше минимального инженерного порога для выбранного объекта.",
      rationale: "Тип СОУЭ определяется по СП 3.13130.2009 после уточнения функционального класса и сценария эвакуации.",
      appliedImpact: {
        minPrimaryReserveFactor: publicOrMass ? 1.08 : 1.04,
        minControllerReserve: 1,
        minManagementMode: needsDedicatedFireWorkstation ? "server" : "arm",
      },
    })
  );

  rows.push(
    createRequirement({
      systemType: "soue",
      title: "Тип СОУЭ и состав оповещения определяются по СП 3.13130.2009.",
      status: "info",
      mandatory: true,
      source: NORMATIVE_SOURCES.sp3,
      reference: "табл. 2, п. 4.1–4.8",
      summary: publicOrMass
        ? "Для общественного/транспортного профиля платформа закладывает повышенный запас по зонам оповещения и аппаратуре управления."
        : "Для объекта без признаков массового пребывания людей платформа не форсирует завышенный тип СОУЭ, но сохраняет минимальную зоновую управляемость.",
      rationale: NORMATIVE_SOURCES.sp3.note,
      appliedImpact: {
        zoneBroadcastReserve: publicOrMass ? 1.12 : 1.04,
        designFactor: 1.03,
      },
    })
  );

  adjustments.aps = {
    required: true,
    minPrimaryReserveFactor: publicOrMass ? 1.06 : 1.03,
    minControllerReserve: 1,
    controllerCapacityHeadroom: 0.18,
    minManagementMode: needsDedicatedFireWorkstation ? "server" : "arm",
    designFactor: 1.04,
  };
  adjustments.soue = {
    required: true,
    minPrimaryReserveFactor: publicOrMass ? 1.08 : 1.04,
    minControllerReserve: 1,
    zoneBroadcastReserve: publicOrMass ? 1.12 : 1.04,
    minManagementMode: needsDedicatedFireWorkstation ? "server" : "arm",
    designFactor: 1.03,
  };

  return { rows, adjustments };
}

function buildSecurityRequirements(context) {
  const rows = [];
  const adjustments = {};
  const antiterrorFocus = ["public", "transport", "energy", "production"].includes(context.objectType);
  const largeOrDistributed = context.totalArea >= 8000 || context.totalFloors >= 4 || context.hasParking;

  rows.push(
    createRequirement({
      systemType: "sot",
      title: antiterrorFocus
        ? "Для объекта антитеррористического профиля должно быть предусмотрено видеонаблюдение по СП 132.13330.2011."
        : "Видеонаблюдение проверяется как профильная инженерная подсистема и может быть обязательным по специальным ТЗ/категорированию.",
      status: antiterrorFocus ? "mandatory" : "info",
      mandatory: antiterrorFocus,
      source: antiterrorFocus ? NORMATIVE_SOURCES.sp132 : NORMATIVE_SOURCES.gostCctv,
      reference: antiterrorFocus ? "п. 7.1, п. 7.3, табл. 1; для производственных объектов также п. 8.1, табл. 2" : "общие технические требования",
      summary: "При включении норм расчёт удерживает минимальную насыщенность камер, серверов/регистраторов и рабочих мест наблюдения по масштабу объекта.",
      rationale: antiterrorFocus
        ? "СП 132 задаёт состав инженерно-технических средств защиты для объектов антитеррористической защищённости."
        : "Для объекта без явных признаков антитеррористического профиля прямую федеральную обязательность нужно уточнять отдельным категорированием.",
      appliedImpact: {
        minPrimaryReserveFactor: largeOrDistributed ? 1.08 : 1.03,
        minManagementMode: largeOrDistributed ? "server" : "arm",
        minControllerReserve: 1,
      },
    })
  );

  rows.push(
    createRequirement({
      systemType: "skud",
      title: antiterrorFocus
        ? "Контроль и управление доступом должны рассматриваться как обязательная мера для объекта защищённого профиля."
        : "СКУД применяется по режиму объекта, ТЗ заказчика и ведомственным требованиям.",
      status: antiterrorFocus ? "mandatory" : "info",
      mandatory: antiterrorFocus,
      source: antiterrorFocus ? NORMATIVE_SOURCES.sp132 : NORMATIVE_SOURCES.gostSkud,
      reference: antiterrorFocus ? "п. 7.1, п. 7.3, табл. 1; для производственных объектов также п. 8.1, табл. 2" : "общие технические требования",
      summary: "При применении норм расчёт поднимает число точек прохода, контроллеров, шкафов и серверного/АРМ контура до минимально безопасного уровня.",
      rationale: "СКУД дополнительно усиливается на объектах с крупным вестибюлем, парковкой, несколькими этажами и распределённой схемой проходов.",
      appliedImpact: {
        minPrimaryReserveFactor: largeOrDistributed ? 1.1 : 1.04,
        minManagementMode: largeOrDistributed ? "server" : "arm",
        minControllerReserve: 1,
        minAccessPoints: antiterrorFocus ? Math.max(Math.ceil(context.totalArea / 2400), context.totalFloors) : 0,
      },
    })
  );

  rows.push(
    createRequirement({
      systemType: "sots",
      title: antiterrorFocus
        ? "Охранно-тревожная сигнализация должна быть предусмотрена в составе инженерно-технических средств защиты."
        : "СОТС уточняется по ТЗ и категории объекта; прямую обязательность нужно подтверждать категорированием.",
      status: antiterrorFocus ? "mandatory" : "info",
      mandatory: antiterrorFocus,
      source: antiterrorFocus ? NORMATIVE_SOURCES.sp132 : NORMATIVE_SOURCES.ssoiGuide,
      reference: antiterrorFocus ? "п. 7.1, табл. 1; п. 8.1, табл. 2" : "комплексный инженерный контур объекта",
      summary: "В расчёте усиливается количество рубежей, панелей/контроллеров и диспетчерского контура на крупных и распределённых объектах.",
      rationale: "Для СОТС платформа дополнительно удерживает резерв по рубежам охраны и по панели управления.",
      appliedImpact: {
        minPrimaryReserveFactor: largeOrDistributed ? 1.09 : 1.04,
        minControllerReserve: 1,
        minManagementMode: largeOrDistributed ? "server" : "arm",
      },
    })
  );

  rows.push(
    createRequirement({
      systemType: "ssoi",
      title: "Централизованный сбор и обработка информации требуется, если объект использует интегрированный контур безопасности и мониторинга.",
      status: antiterrorFocus ? "recommended" : "info",
      mandatory: false,
      source: NORMATIVE_SOURCES.ssoiGuide,
      reference: "СП 132.13330.2011, состав ИТСОТБ; далее конкретизируется ТЗ/СТО заказчика",
      summary: "При применении норм платформа переводит интеграционный контур на серверную архитектуру для крупных/распределённых объектов и удерживает минимум по шлюзам и операторским рабочим местам.",
      rationale: "Прямой федеральной нормы на конкретную модель сервера нет; сервер/АРМ выбирается как инженерное следствие масштаба, резервирования и количества интеграций.",
      appliedImpact: {
        minPrimaryReserveFactor: 1.06,
        minManagementMode: largeOrDistributed ? "server" : "arm",
        minControllerReserve: antiterrorFocus ? 1 : 0,
      },
    })
  );

  adjustments.sot = {
    required: antiterrorFocus,
    minPrimaryReserveFactor: largeOrDistributed ? 1.08 : 1.03,
    minManagementMode: largeOrDistributed ? "server" : "arm",
    minControllerReserve: 1,
  };
  adjustments.skud = {
    required: antiterrorFocus,
    minPrimaryReserveFactor: largeOrDistributed ? 1.1 : 1.04,
    minManagementMode: largeOrDistributed ? "server" : "arm",
    minControllerReserve: 1,
    minAccessPoints: antiterrorFocus ? Math.max(Math.ceil(context.totalArea / 2400), context.totalFloors) : 0,
  };
  adjustments.sots = {
    required: antiterrorFocus,
    minPrimaryReserveFactor: largeOrDistributed ? 1.09 : 1.04,
    minManagementMode: largeOrDistributed ? "server" : "arm",
    minControllerReserve: 1,
  };
  adjustments.ssoi = {
    required: false,
    minPrimaryReserveFactor: 1.06,
    minManagementMode: largeOrDistributed ? "server" : "arm",
    minControllerReserve: antiterrorFocus ? 1 : 0,
  };

  return { rows, adjustments };
}

export function buildNormativeRequirements({ objectData = {}, zones = [], systems = [] }) {
  const context = buildContext(objectData, zones, systems);
  const fire = buildFireRequirements(context);
  const security = buildSecurityRequirements(context);
  const rows = [...fire.rows, ...security.rows];
  const adjustments = { ...fire.adjustments, ...security.adjustments };
  const systemRows = Object.fromEntries(
    (systems || []).map((system) => [
      system.type,
      rows
        .filter((item) => item.systemType === system.type)
        .sort((a, b) => Number(b.mandatory) - Number(a.mandatory)),
    ])
  );

  const missingMandatorySystems = rows
    .filter((item) => item.mandatory)
    .map((item) => item.systemType)
    .filter((systemType, index, list) => list.indexOf(systemType) === index)
    .filter((systemType) => !context.activeSystemTypes.includes(systemType))
    .map((systemType) => ({
      systemType,
      systemName: getSystemName(systemType),
      reason: rows.find((item) => item.systemType === systemType && item.mandatory)?.title || "Система обязательна по нормативным требованиям.",
    }));

  return repairTextTree({
    asOfDate: NORMATIVE_REQUIREMENTS_AS_OF,
    context,
    sources: NORMATIVE_SOURCES,
    rows,
    systemRows,
    adjustments,
    missingMandatorySystems,
  });
}
