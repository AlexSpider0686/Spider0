import { BUILDING_STATUS, OBJECT_PROFILE_CATALOG } from "../config/costModelConfig";
import { toNumber } from "./estimate";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const OBJECT_TYPE_BASE_PROTECTION_SHARE = {
  production: 0.87,
  warehouse: 0.74,
  public: 0.9,
  residential: 0.82,
  transport: 0.93,
  energy: 0.88,
};

export function calculateProtectedArea(objectData = {}) {
  const objectType = objectData.objectType || "public";
  const profile = OBJECT_PROFILE_CATALOG[objectType] || OBJECT_PROFILE_CATALOG.public;
  const buildingStatus = BUILDING_STATUS[objectData.buildingStatus] || BUILDING_STATUS.operational;
  const totalAreaM2 = Math.max(toNumber(objectData.totalArea, objectData.totalAreaM2), 0);
  const aboveGroundFloors = Math.max(1, Math.round(toNumber(objectData.floors, objectData.aboveGroundFloors || 1)));
  const undergroundFloors = Math.max(0, Math.round(toNumber(objectData.basementFloors, objectData.undergroundFloors || 0)));
  const ceilingHeightM = Math.max(toNumber(objectData.ceilingHeight, 3.2), 2.5);

  const baseShare = OBJECT_TYPE_BASE_PROTECTION_SHARE[objectType] || OBJECT_TYPE_BASE_PROTECTION_SHARE.public;
  const profileAdjustment =
    (toNumber(profile.engineeringDensity, 1) - 1) * 0.06 + (toNumber(profile.securityIntensity, 1) - 1) * 0.05;
  const floorAdjustment = Math.min(Math.max(aboveGroundFloors - 1, 0) * 0.004, 0.03);
  const basementAdjustment = Math.min(undergroundFloors * 0.012, 0.04);
  const statusAdjustment = buildingStatus.value === "operational" ? 0.015 : 0;
  const largeObjectAdjustment = totalAreaM2 > 40000 ? -0.015 : totalAreaM2 > 15000 ? -0.008 : 0;
  const ceilingAdjustment = ceilingHeightM > 4.5 ? -0.01 : ceilingHeightM > 3.6 ? -0.005 : 0;

  const protectionShare = clamp(
    baseShare + profileAdjustment + floorAdjustment + basementAdjustment + statusAdjustment + largeObjectAdjustment + ceilingAdjustment,
    0.62,
    0.98
  );

  const breakdown = [
    {
      key: "base",
      label: "Базовая доля по типу объекта",
      value: baseShare,
      reason: "Для каждого типа объекта задан стартовый уровень покрытия на основе типовой структуры защищаемых зон.",
    },
    {
      key: "profile",
      label: "Поправка на инженерную насыщенность и интенсивность защиты",
      value: profileAdjustment,
      reason: "Берется из профиля объекта: чем выше инженерная плотность и требования к безопасности, тем выше защищаемая доля.",
    },
    {
      key: "floors",
      label: "Поправка на надземную этажность",
      value: floorAdjustment,
      reason: "С ростом этажности обычно увеличиваются зоны общего пользования, вертикальные связи и охват систем.",
    },
    {
      key: "basement",
      label: "Поправка на подземные этажи",
      value: basementAdjustment,
      reason: "Подземные уровни часто добавляют паркинг, техпомещения и маршруты, которые входят в защищаемую площадь.",
    },
    {
      key: "status",
      label: "Поправка на статус здания",
      value: statusAdjustment,
      reason: "Для действующего здания доля немного повышается, потому что обычно учитывается больше реально эксплуатируемых зон.",
    },
    {
      key: "large_object",
      label: "Поправка на масштаб объекта",
      value: largeObjectAdjustment,
      reason: "У очень крупных объектов часть площадей чаще оказывается вспомогательной или обслуживающей, поэтому доля немного снижается.",
    },
    {
      key: "ceiling",
      label: "Поправка на высоту помещений",
      value: ceilingAdjustment,
      reason: "При большой высоте растет доля объемов и пространств, которые не всегда пропорционально увеличивают защищаемую площадь.",
    },
  ];

  return {
    protectedAreaM2: Math.round(totalAreaM2 * protectionShare),
    protectionShare,
    breakdown,
  };
}
