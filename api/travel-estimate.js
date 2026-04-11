import { estimateTravelFromRoute } from "../src/lib/travelEstimate.js";

export async function resolveTravelEstimate(payload = {}) {
  const originAddress = String(payload?.originAddress || "").trim();
  const destinationAddress = String(payload?.destinationAddress || "").trim();

  if (!originAddress || !destinationAddress) {
    throw new Error("Для расчета командировки нужно указать начальную и конечную точки маршрута.");
  }

  return estimateTravelFromRoute({
    originAddress,
    destinationAddress,
    destinationLocality: payload?.destinationLocality,
    crewSize: payload?.crewSize,
    workDurationDays: payload?.workDurationDays,
    perDiemPerPersonDay: payload?.perDiemPerPersonDay,
    systemsCount: payload?.systemsCount,
  });
}
