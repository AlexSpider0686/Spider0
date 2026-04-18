import { repairTextTree } from "./textEncoding.js";

const SYSTEM_ARCHITECTURE = repairTextTree({
  aps: {
    default: {
      power: {
        code: "PWR",
        name: "Источник резервированного питания АПС",
        model: "Источник резервированного питания 24 В",
        unitPrice: 14500,
        isKey: false,
        basis: "Резервированное питание АПС учитывается отдельной строкой от ППКП и адресных линий.",
      },
    },
    Болид: {
      power: {
        model: "РИП-24 исп.56",
        unitPrice: 18400,
      },
    },
    Рубеж: {
      power: {
        model: "Источник резервированного питания 24 В R3",
        unitPrice: 16200,
      },
    },
    "Аргус-Спектр": {
      power: {
        model: "Источник резервированного питания Стрелец-ПРО 24 В",
        unitPrice: 16800,
      },
    },
    Simplex: {
      power: {
        model: "Simplex 24V fire power supply",
        unitPrice: 22800,
      },
    },
    Siemens: {
      power: {
        model: "Cerberus PRO PSU 24 В",
        unitPrice: 24500,
      },
    },
  },
  soue: {
    default: {
      controller: {
        code: "CTRL",
        name: "Контроллер / блок запуска СОУЭ",
        model: "Контроллер линий оповещения",
        unitPrice: 32000,
        isKey: true,
        basis: "В СОУЭ контур управления, усилительный контур и оповещатели учитываются раздельно.",
      },
      cabinet: {
        code: "CAB",
        name: "Шкаф / источник питания СОУЭ",
        model: "Шкаф питания и АКБ СОУЭ",
        unitPrice: 21500,
        isKey: false,
        basis: "Шкафы питания, резерв АКБ и коммутация СОУЭ выносятся в отдельную строку спецификации.",
      },
    },
    Болид: {
      controller: {
        model: "С2000-КПБ",
        unitPrice: 14800,
      },
      cabinet: {
        model: "Шкаф питания СОУЭ / АКБ 24 В",
        unitPrice: 19800,
      },
    },
    Рубеж: {
      controller: {
        model: "Адресный блок управления СОУЭ R3",
        unitPrice: 18600,
      },
      cabinet: {
        model: "Шкаф питания СОУЭ / АКБ 24 В",
        unitPrice: 20400,
      },
    },
    Roxton: {
      controller: {
        model: "Системный контроллер трансляции Roxton",
        unitPrice: 48600,
      },
      cabinet: {
        model: "Шкаф речевого оповещения / АКБ",
        unitPrice: 25800,
      },
    },
  },
  sots: {
    default: {
      module: {
        code: "MOD",
        name: "Модуль расширения / зональный узел СОТС",
        model: "Модуль расширения СОТС",
        unitPrice: 11800,
        isKey: true,
        basis: "Полевые расширения СОТС учитываются отдельной строкой от главной панели.",
      },
      power: {
        code: "PWR",
        name: "Блок питания и АКБ СОТС",
        model: "Резервированный источник питания СОТС",
        unitPrice: 9800,
        isKey: false,
        basis: "Контрольные панели СОТС требуют отдельного резервированного питания и шкафного размещения.",
      },
    },
    Болид: {
      module: {
        model: "Модуль расширения СОТС Болид",
        unitPrice: 12800,
      },
      power: {
        model: "РИП-12 исп.56",
        unitPrice: 11200,
      },
    },
    Рубеж: {
      module: {
        model: "Модуль расширения СОТС R3",
        unitPrice: 13400,
      },
      power: {
        model: "Источник резервированного питания 12/24 В R3",
        unitPrice: 11800,
      },
    },
    "Аргус-Спектр": {
      module: {
        model: "Модуль расширения Стрелец-ПРО",
        unitPrice: 13900,
      },
      power: {
        model: "Источник питания Стрелец-ПРО",
        unitPrice: 12400,
      },
    },
  },
  skud: {
    default: {
      reader: {
        code: "RDR",
        name: "Считыватель / терминал СКУД",
        model: "Считыватель СКУД",
        unitPrice: 14200,
        isKey: true,
        basis: "Считыватели и терминалы учитываются отдельной строкой от контроллеров доступа.",
      },
      lock: {
        code: "LOCK",
        name: "Исполнительное устройство / точка прохода",
        model: "Замок / турникет / доводчик",
        unitPrice: 11200,
        isKey: true,
        basis: "Исполнительная часть точки прохода учитывается отдельно от контроллеров и считывателей.",
      },
      cabinet: {
        code: "CAB",
        name: "Шкаф / блок питания СКУД",
        model: "Шкаф питания и АКБ СКУД",
        unitPrice: 16800,
        isKey: false,
        basis: "Контроллеры доступа и исполнительные устройства требуют отдельного питания и шкафного размещения.",
      },
    },
    Sigur: {
      reader: { model: "Считыватель Sigur" },
      lock: { model: "Замок / турникет совместимый с Sigur" },
      cabinet: { model: "Шкаф питания СКУД 12/24 В" },
    },
    Parsec: {
      reader: { model: "Считыватель Parsec" },
      lock: { model: "Замок / турникет совместимый с Parsec" },
      cabinet: { model: "Шкаф питания СКУД 12/24 В" },
    },
    PERCo: {
      reader: { model: "Считыватель / терминал PERCo" },
      lock: { model: "Турникет / замок совместимый с PERCo" },
      cabinet: { model: "Шкаф питания СКУД 12/24 В" },
    },
    Biosmart: {
      reader: { model: "Биометрический терминал / считыватель BioSmart" },
      lock: { model: "Замок / турникет совместимый с BioSmart" },
      cabinet: { model: "Шкаф питания СКУД 12/24 В" },
    },
    RusGuard: {
      reader: { model: "Считыватель RusGuard" },
      lock: { model: "Замок / турникет совместимый с RusGuard" },
      cabinet: { model: "Шкаф питания СКУД 12/24 В" },
    },
    Bastion: {
      reader: { model: "Считыватель SPRUT Access" },
      lock: { model: "Замок / турникет совместимый с SPRUT Access" },
      cabinet: { model: "Шкаф питания СКУД 12/24 В" },
    },
  },
  ssoi: {
    default: {
      gateway: {
        code: "GW",
        name: "Интеграционный шлюз / API-коннектор",
        model: "Шлюз интеграции подсистем",
        unitPrice: 96000,
        isKey: true,
        basis: "ССОИ строится вокруг выделенных интеграционных шлюзов и серверного ядра управления.",
      },
    },
    TRASSIR: {
      gateway: {
        model: "TRASSIR SoftIntegrator / шлюз интеграции",
        unitPrice: 128000,
      },
    },
    "ISS (Интеллект)": {
      gateway: {
        model: "Интеллект API / шлюз интеграции",
        unitPrice: 136000,
      },
    },
    Macroscop: {
      gateway: {
        model: "Macroscop Integration Module",
        unitPrice: 118000,
      },
    },
    AxxonSoft: {
      gateway: {
        model: "Axxon PSIM Integration Gateway",
        unitPrice: 142000,
      },
    },
  },
});

function mergeComponent(baseComponent, vendorComponent) {
  if (!baseComponent && !vendorComponent) return null;
  return {
    ...(baseComponent || {}),
    ...(vendorComponent || {}),
  };
}

export function getArchitectureComponent(systemType, vendor, role) {
  const systemConfig = SYSTEM_ARCHITECTURE?.[systemType] || {};
  return mergeComponent(systemConfig?.default?.[role], systemConfig?.[vendor]?.[role]);
}

function formatRow(row, fallbackLabel = "") {
  if (!row) return "";
  const model = String(row.model || "").trim();
  const qty = Number(row.qty || 0);
  const suffix = qty > 0 ? `, ${qty} шт.` : "";
  return `${fallbackLabel || row.name}${model ? ` ${model}` : ""}${suffix}`.trim();
}

export function buildArchitectureSummaryLines({ systemType, vendor, details = [] }) {
  const rows = Array.isArray(details) ? details : [];
  const getRow = (code) => rows.find((item) => item.code === code);

  const srvSw = getRow("SRV_SW");
  const srvHw = getRow("SRV");
  const armSw = getRow("ARM_SW");
  const armHw = getRow("ARM");

  const lines = [];

  if (systemType === "aps") {
    const panel = getRow("PANEL");
    const module = getRow("MOD");
    const power = getRow("PWR");
    if (panel) {
      lines.push(
        `Архитектура ${vendor} по АПС собрана вокруг главного прибора ${formatRow(panel)}${
          module ? `, а адресные линии и расширение контура вынесены в ${formatRow(module)}` : ""
        }${power ? `; резерв питания оформлен отдельной позицией ${formatRow(power)}` : ""}.`
      );
    }
  }

  if (systemType === "soue") {
    const controller = getRow("CTRL");
    const amp = getRow("AMP");
    const cabinet = getRow("CAB");
    const speaker = getRow("SPK");
    if (controller || amp || speaker) {
      lines.push(
        `Архитектура ${vendor} по СОУЭ разделена на контур управления${
          controller ? ` (${formatRow(controller)})` : ""
        }, усилительный контур${amp ? ` (${formatRow(amp)})` : ""} и оповещатели${speaker ? ` (${formatRow(speaker)})` : ""}${
          cabinet ? `; шкафы и резерв питания вынесены в ${formatRow(cabinet)}` : ""
        }.`
      );
    }
  }

  if (systemType === "sots") {
    const panel = getRow("PANEL");
    const module = getRow("MOD");
    const power = getRow("PWR");
    if (panel || module) {
      lines.push(
        `Архитектура ${vendor} по СОТС разделяет главную контрольную панель${
          panel ? ` (${formatRow(panel)})` : ""
        } и зональные/расширительные узлы${module ? ` (${formatRow(module)})` : ""}${
          power ? `; питание и резерв вынесены в ${formatRow(power)}` : ""
        }.`
      );
    }
  }

  if (systemType === "sot") {
    const camera = getRow("CAM");
    const recorder = getRow("NVR");
    const network = getRow("SW");
    if (camera || recorder) {
      lines.push(
        `Архитектура ${vendor} по СОТ разделена на полевой уровень камер${camera ? ` (${formatRow(camera)})` : ""}, уровень записи/видеосервера${
          recorder ? ` (${formatRow(recorder)})` : ""
        } и сетевой транспорт${network ? ` (${formatRow(network)})` : ""}.`
      );
    }
  }

  if (systemType === "skud") {
    const controller = getRow("CTRL");
    const reader = getRow("RDR");
    const lock = getRow("LOCK");
    const cabinet = getRow("CAB");
    if (controller || reader || lock) {
      lines.push(
        `Архитектура ${vendor} по СКУД разделена на контроллеры доступа${controller ? ` (${formatRow(controller)})` : ""}, считыватели/терминалы${
          reader ? ` (${formatRow(reader)})` : ""
        } и исполнительные устройства${lock ? ` (${formatRow(lock)})` : ""}${
          cabinet ? `; шкафы питания вынесены в ${formatRow(cabinet)}` : ""
        }.`
      );
    }
  }

  if (systemType === "ssoi") {
    const server = getRow("NVR");
    const gateway = getRow("GW");
    const network = getRow("SW");
    if (server || gateway) {
      lines.push(
        `Архитектура ${vendor} по ССОИ разделяет серверное ядро${server ? ` (${formatRow(server)})` : ""}, интеграционные шлюзы${
          gateway ? ` (${formatRow(gateway)})` : ""
        } и сетевое ядро${network ? ` (${formatRow(network)})` : ""}.`
      );
    }
  }

  const managementParts = [];
  if (srvSw) managementParts.push(`серверное ПО: ${formatRow(srvSw)}`);
  if (srvHw) managementParts.push(`серверное оборудование: ${formatRow(srvHw)}`);
  if (armSw) managementParts.push(`ПО АРМ: ${formatRow(armSw)}`);
  if (armHw) managementParts.push(`аппаратный АРМ: ${formatRow(armHw)}`);
  if (managementParts.length) {
    lines.push(`Управляющий контур разделён в спецификации на отдельные роли: ${managementParts.join("; ")}.`);
  }

  return lines.filter(Boolean);
}
