const DEFAULT_PER_DIEM = 1000;

const CLOSED_AIRPORT_CODES = new Set(["AAQ", "EGO", "BZK", "VOZ", "URS", "LPK", "ROV", "SIP"]);

const AIRPORTS = [
  { code: "SVO", city: "Москва", label: "Шереметьево", lat: 55.9726, lon: 37.4146 },
  { code: "DME", city: "Москва", label: "Домодедово", lat: 55.4088, lon: 37.9063 },
  { code: "VKO", city: "Москва", label: "Внуково", lat: 55.5915, lon: 37.2615 },
  { code: "LED", city: "Санкт-Петербург", label: "Пулково", lat: 59.8003, lon: 30.2625 },
  { code: "AER", city: "Сочи", label: "Сочи", lat: 43.4499, lon: 39.9566 },
  { code: "KGD", city: "Калининград", label: "Храброво", lat: 54.889, lon: 20.5926 },
  { code: "SVX", city: "Екатеринбург", label: "Кольцово", lat: 56.7431, lon: 60.8027 },
  { code: "KZN", city: "Казань", label: "Казань", lat: 55.6062, lon: 49.2787 },
  { code: "KUF", city: "Самара", label: "Курумоч", lat: 53.5049, lon: 50.1643 },
  { code: "ROV", city: "Ростов-на-Дону", label: "Платов", lat: 47.4939, lon: 39.9247 },
  { code: "AAQ", city: "Анапа", label: "Витязево", lat: 45.0021, lon: 37.3473 },
  { code: "EGO", city: "Белгород", label: "Белгород", lat: 50.6438, lon: 36.5901 },
  { code: "BZK", city: "Брянск", label: "Брянск", lat: 53.2142, lon: 34.1764 },
  { code: "VOZ", city: "Воронеж", label: "Чертовицкое", lat: 51.8142, lon: 39.2296 },
  { code: "URS", city: "Курск", label: "Восточный", lat: 51.7513, lon: 36.2956 },
  { code: "LPK", city: "Липецк", label: "Липецк", lat: 52.7028, lon: 39.5378 },
  { code: "SIP", city: "Симферополь", label: "Симферополь", lat: 45.0522, lon: 33.9751 },
  { code: "MCX", city: "Махачкала", label: "Уйташ", lat: 42.8168, lon: 47.6523 },
  { code: "MRV", city: "Минеральные Воды", label: "Минеральные Воды", lat: 44.2251, lon: 43.0819 },
  { code: "OVB", city: "Новосибирск", label: "Толмачево", lat: 55.0126, lon: 82.6507 },
  { code: "KRR", city: "Краснодар", label: "Пашковский", lat: 45.0347, lon: 39.1705 },
  { code: "GDZ", city: "Геленджик", label: "Геленджик", lat: 44.5821, lon: 38.0125 },
  { code: "ESL", city: "Элиста", label: "Элиста", lat: 46.3739, lon: 44.3309 },
  { code: "VVO", city: "Владивосток", label: "Кневичи", lat: 43.3989, lon: 132.1486 },
  { code: "IKT", city: "Иркутск", label: "Иркутск", lat: 52.268, lon: 104.3889 },
  { code: "KJA", city: "Красноярск", label: "Красноярск", lat: 56.1731, lon: 92.4933 },
];

const TUTU_REFERENCE_LINKS = {
  ground: "https://bus.tutu.ru/",
  rail: "https://www.tutu.ru/poezda/",
  air: "https://avia.tutu.ru/",
  hotel: "https://hotel.tutu.ru/",
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(toNumber(value, 0) * factor) / factor;
}

function ceil(value) {
  return Math.max(Math.ceil(toNumber(value, 0)), 0);
}

function haversineKm(left, right) {
  if (!left || !right) return 0;
  const lat1 = (toNumber(left.lat) * Math.PI) / 180;
  const lon1 = (toNumber(left.lon) * Math.PI) / 180;
  const lat2 = (toNumber(right.lat) * Math.PI) / 180;
  const lon2 = (toNumber(right.lon) * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatHoursLabel(hours) {
  const safeHours = toNumber(hours, 0);
  if (safeHours <= 0) return "0 ч";
  if (safeHours < 24) return `${round(safeHours, 1)} ч`;
  return `${round(safeHours / 24, 1)} сут.`;
}

function getCrewSizeFromResults(systemResults = []) {
  const peak = Math.max(...(Array.isArray(systemResults) ? systemResults : []).map((item) => toNumber(item?.executionTeamSize, 0)), 0);
  return Math.max(peak, 1);
}

function getWorkDurationDays(systemResults = []) {
  const maxDays = Math.max(...(Array.isArray(systemResults) ? systemResults : []).map((item) => toNumber(item?.executionDurationDays ?? item?.executionDaysExact, 0)), 0);
  return Math.max(Math.ceil(maxDays), 1);
}

function makeAirportDescriptor(airport, point) {
  if (!airport || !point) return null;
  return {
    ...airport,
    distanceKm: round(haversineKm(airport, point), 1),
    closed: CLOSED_AIRPORT_CODES.has(airport.code),
  };
}

function findNearestAirports(point) {
  return AIRPORTS.map((airport) => makeAirportDescriptor(airport, point)).sort((left, right) => left.distanceKm - right.distanceKm);
}

function pickAirRoute(originPoint, destinationPoint) {
  const fromList = findNearestAirports(originPoint);
  const toList = findNearestAirports(destinationPoint);
  const fromOpen = fromList.find((item) => !item.closed);
  const toOpen = toList.find((item) => !item.closed);
  const fromNearest = fromList[0] || null;
  const toNearest = toList[0] || null;
  const airportClosed = Boolean(fromNearest?.closed || toNearest?.closed);
  const openUnavailable = !fromOpen || !toOpen;
  return {
    airportClosed,
    openUnavailable,
    fromAirport: fromOpen || fromNearest || null,
    toAirport: toOpen || toNearest || null,
    airAllowed: !openUnavailable,
  };
}

function chooseTransportMode(oneWayDistanceKm, airRoute) {
  if (oneWayDistanceKm < 500) {
    return oneWayDistanceKm <= 260 ? "ground_bus" : "ground_suburban";
  }

  if (oneWayDistanceKm < 1500) {
    return "rail";
  }

  if (airRoute?.airAllowed) {
    return "air";
  }

  return "rail";
}

function describeTransportMode(mode) {
  switch (mode) {
    case "ground_bus":
      return "Автобус";
    case "ground_suburban":
      return "Электричка";
    case "air":
      return "Самолет";
    default:
      return "Ж/д поезд (купе)";
  }
}

function getTutuTransportLink(mode) {
  if (mode === "ground_bus" || mode === "ground_suburban") return TUTU_REFERENCE_LINKS.ground;
  if (mode === "air") return TUTU_REFERENCE_LINKS.air;
  return TUTU_REFERENCE_LINKS.rail;
}

function buildTransportPricing(mode, oneWayDistanceKm, drivingHours, airRoute) {
  const safeDistance = Math.max(toNumber(oneWayDistanceKm, 0), 1);

  if (mode === "ground_bus") {
    return {
      perPersonOneWayCost: round(Math.max(900, safeDistance * 4.1), 0),
      oneWayDurationHours: round(Math.max(drivingHours, safeDistance / 60), 1),
      sourceLabel: "tutu.ru / автобусы",
    };
  }

  if (mode === "ground_suburban") {
    return {
      perPersonOneWayCost: round(Math.max(750, safeDistance * 3.7), 0),
      oneWayDurationHours: round(Math.max(drivingHours * 0.95, safeDistance / 70), 1),
      sourceLabel: "tutu.ru / электрички",
    };
  }

  if (mode === "air") {
    const groundAccessHours =
      toNumber(airRoute?.fromAirport?.distanceKm, 0) / 45 +
      toNumber(airRoute?.toAirport?.distanceKm, 0) / 45;
    const flightHours = safeDistance / 650;
    return {
      perPersonOneWayCost: round(Math.max(8500, safeDistance * 7.9), 0),
      oneWayDurationHours: round(4 + groundAccessHours + flightHours, 1),
      sourceLabel: "tutu.ru / авиабилеты",
    };
  }

  return {
    perPersonOneWayCost: round(Math.max(2200, safeDistance * 5.2), 0),
    oneWayDurationHours: round(Math.max(safeDistance / 85, 4.5), 1),
    sourceLabel: "tutu.ru / ж/д билеты (купе)",
  };
}

export function createEmptyTravelEstimate() {
  return {
    enabled: false,
    originAddress: "",
    destinationAddress: "",
    mode: "rail",
    modeLabel: "Ж/д поезд (купе)",
    sourceLabel: "",
    transportSourceUrl: TUTU_REFERENCE_LINKS.rail,
    hotelSourceUrl: TUTU_REFERENCE_LINKS.hotel,
    calculationMethod: "manual",
    calculationStatus: "idle",
    calculationProgress: 0,
    calculationStage: "",
    notes: "",
    alerts: [],
    airportClosed: false,
    airportComment: "",
    routeSummary: "",
    departureAirport: "",
    arrivalAirport: "",
    crewSize: 1,
    workDurationDays: 1,
    oneWayDistanceKm: 0,
    roundTripDistanceKm: 0,
    oneWayDurationHours: 0,
    roundTripDurationHours: 0,
    oneWayTravelDays: 0,
    roundTripTravelDays: 0,
    hotelRooms: 1,
    hotelNights: 1,
    hotelRatePerRoomNight: 4900,
    perPersonOneWayCost: 0,
    perDiemPerPersonDay: DEFAULT_PER_DIEM,
    perDiemDays: 1,
    totalTransportCost: 0,
    totalHotelCost: 0,
    totalPerDiemCost: 0,
    totalCost: 0,
    perSystemCost: 0,
    calculatedAt: null,
    sourceMeta: {},
  };
}

export function recalculateTravelEstimateDraft(travelEstimate, systemsCount = 0) {
  const safe = {
    ...createEmptyTravelEstimate(),
    ...(travelEstimate || {}),
  };

  const crewSize = Math.max(ceil(safe.crewSize), 1);
  const hotelRooms = Math.max(ceil(safe.hotelRooms || crewSize / 2), 1);
  const hotelNights = Math.max(ceil(safe.hotelNights || safe.workDurationDays), 1);
  const perDiemDays = Math.max(ceil(safe.perDiemDays || safe.workDurationDays), 1);
  const oneWayDurationHours = Math.max(toNumber(safe.oneWayDurationHours, 0), 0);
  const roundTripDurationHours = Math.max(toNumber(safe.roundTripDurationHours, oneWayDurationHours * 2), 0);
  const totalTransportCost = round(Math.max(toNumber(safe.perPersonOneWayCost, 0), 0) * crewSize * 2, 0);
  const totalHotelCost = round(Math.max(toNumber(safe.hotelRatePerRoomNight, 0), 0) * hotelRooms * hotelNights, 0);
  const totalPerDiemCost = round(Math.max(toNumber(safe.perDiemPerPersonDay, DEFAULT_PER_DIEM), 0) * crewSize * perDiemDays, 0);
  const totalCost = round(totalTransportCost + totalHotelCost + totalPerDiemCost, 0);

  return {
    ...safe,
    crewSize,
    hotelRooms,
    hotelNights,
    perDiemDays,
    oneWayDurationHours: round(oneWayDurationHours, 1),
    roundTripDurationHours: round(roundTripDurationHours, 1),
    oneWayTravelDays: Math.max(ceil(oneWayDurationHours / 8), 0),
    roundTripTravelDays: Math.max(ceil(roundTripDurationHours / 8), 0),
    oneWayDistanceKm: round(safe.oneWayDistanceKm, 1),
    roundTripDistanceKm: round(safe.roundTripDistanceKm || safe.oneWayDistanceKm * 2, 1),
    totalTransportCost,
    totalHotelCost,
    totalPerDiemCost,
    totalCost,
    perSystemCost: systemsCount > 0 ? round(totalCost / systemsCount, 0) : 0,
    formattedOneWayDuration: formatHoursLabel(oneWayDurationHours),
    formattedRoundTripDuration: formatHoursLabel(roundTripDurationHours),
  };
}

export function applyTravelToResults(systemResults = [], totals = {}, travelEstimate = null) {
  const safeSystems = Array.isArray(systemResults) ? systemResults : [];
  const normalizedTravel = recalculateTravelEstimateDraft(travelEstimate, safeSystems.length);
  if (!normalizedTravel.enabled || normalizedTravel.totalCost <= 0 || !safeSystems.length) {
    return {
      systemResults: safeSystems,
      totals,
      travelEstimate: normalizedTravel,
    };
  }

  const distributedSystems = safeSystems.map((item, index) => {
    const isLast = index === safeSystems.length - 1;
    const allocated = isLast
      ? round(normalizedTravel.totalCost - normalizedTravel.perSystemCost * (safeSystems.length - 1), 0)
      : normalizedTravel.perSystemCost;
    return {
      ...item,
      baseWorkTotal: item.workTotal,
      baseTotal: item.total,
      tripCostAllocation: allocated,
      workTotal: round(toNumber(item.workTotal, 0) + allocated, 0),
      total: round(toNumber(item.total, 0) + allocated, 0),
    };
  });

  return {
    systemResults: distributedSystems,
    totals: {
      ...totals,
      tripTotal: normalizedTravel.totalCost,
      totalWork: round(toNumber(totals?.totalWork, 0) + normalizedTravel.totalCost, 0),
      total: round(toNumber(totals?.total, 0) + normalizedTravel.totalCost, 0),
    },
    travelEstimate: normalizedTravel,
  };
}

async function geocodeAddress(addressLine, fetchImpl) {
  const query = String(addressLine || "").trim();
  if (!query) {
    throw new Error("Укажите адрес для расчета маршрута.");
  }

  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    limit: "1",
    "accept-language": "ru",
    countrycodes: "ru",
    q: query,
  });
  const response = await fetchImpl(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ProjectCoreTravel/1.0",
    },
  });

  if (!response.ok) {
    throw new Error("Не удалось уточнить адрес для расчета командировки.");
  }

  const items = await response.json();
  const best = Array.isArray(items) ? items[0] : null;
  if (!best) {
    throw new Error("Не удалось построить маршрут: один из адресов не найден.");
  }

  return {
    lat: toNumber(best.lat, 0),
    lon: toNumber(best.lon, 0),
    label: best.display_name || query,
  };
}

async function getDrivingRoute(originPoint, destinationPoint, fetchImpl) {
  const url = `https://router.project-osrm.org/route/v1/driving/${originPoint.lon},${originPoint.lat};${destinationPoint.lon},${destinationPoint.lat}?overview=false`;
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ProjectCoreTravel/1.0",
    },
  });
  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const route = payload?.routes?.[0];
  if (!route) return null;
  return {
    distanceKm: round(toNumber(route.distance, 0) / 1000, 1),
    durationHours: round(toNumber(route.duration, 0) / 3600, 1),
  };
}

export async function estimateTravelFromRoute(input, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const systemsCount = Math.max(ceil(input?.systemsCount), 0);
  const originAddress = String(input?.originAddress || "").trim();
  const destinationAddress = String(input?.destinationAddress || "").trim();
  const crewSize = Math.max(ceil(input?.crewSize), 1);
  const workDurationDays = Math.max(ceil(input?.workDurationDays), 1);
  const perDiemPerPersonDay = Math.max(toNumber(input?.perDiemPerPersonDay, DEFAULT_PER_DIEM), 0);

  const [originPoint, destinationPoint] = await Promise.all([
    geocodeAddress(originAddress, fetchImpl),
    geocodeAddress(destinationAddress, fetchImpl),
  ]);
  const drivingRoute = await getDrivingRoute(originPoint, destinationPoint, fetchImpl);
  const directDistanceKm = round(haversineKm(originPoint, destinationPoint), 1);
  const oneWayDistanceKm = Math.max(toNumber(drivingRoute?.distanceKm, directDistanceKm), directDistanceKm);
  const drivingHours = Math.max(toNumber(drivingRoute?.durationHours, directDistanceKm / 60), 1);
  const airRoute = pickAirRoute(originPoint, destinationPoint);
  const mode = chooseTransportMode(oneWayDistanceKm, airRoute);
  const pricing = buildTransportPricing(mode, oneWayDistanceKm, drivingHours, airRoute);
  const hotelRooms = Math.max(ceil(crewSize / 2), 1);
  const hotelRatePerRoomNight = round(Math.max(3900, 4400 + hotelRooms * 200), 0);
  const hotelNights = Math.max(workDurationDays, 1);
  const roundTripDurationHours = round(pricing.oneWayDurationHours * 2, 1);
  const perDiemDays = Math.max(workDurationDays + ceil(roundTripDurationHours / 24), 1);
  const routeSummary =
    mode === "air"
      ? `${originAddress} -> ${airRoute?.fromAirport?.city || "Аэропорт вылета"} (${airRoute?.fromAirport?.label || "не определен"}) -> ${airRoute?.toAirport?.city || "Аэропорт прилета"} (${airRoute?.toAirport?.label || "не определен"}) -> ${destinationAddress}`
      : `${originAddress} -> ${destinationAddress}`;
  const airportComment =
    mode === "air"
      ? `Вылет: ${airRoute?.fromAirport?.city || "не определен"} (${airRoute?.fromAirport?.label || "аэропорт"}), прилет: ${airRoute?.toAirport?.city || "не определен"} (${airRoute?.toAirport?.label || "аэропорт"}).`
      : airRoute?.airportClosed
        ? "Ближайший аэропорт по маршруту закрыт, поэтому выбран наземный транспорт."
        : "";

  const normalized = recalculateTravelEstimateDraft(
    {
      enabled: true,
      calculationMethod: "smart",
      originAddress,
      destinationAddress,
      mode,
      modeLabel: describeTransportMode(mode),
      sourceLabel: pricing.sourceLabel,
      transportSourceUrl: getTutuTransportLink(mode),
      hotelSourceUrl: TUTU_REFERENCE_LINKS.hotel,
      notes: "Расчет выполнен интеллектуальным алгоритмом. Все параметры ниже можно скорректировать вручную.",
      alerts:
        mode === "air" || !airRoute?.airportClosed
          ? []
          : ["Для авиаперелета маршрут не выбран: ближайший аэропорт по направлению недоступен или нецелесообразен."],
      airportClosed: Boolean(airRoute?.airportClosed && mode !== "air"),
      airportComment,
      routeSummary,
      departureAirport: airRoute?.fromAirport ? `${airRoute.fromAirport.city}, ${airRoute.fromAirport.label}` : "",
      arrivalAirport: airRoute?.toAirport ? `${airRoute.toAirport.city}, ${airRoute.toAirport.label}` : "",
      crewSize,
      workDurationDays,
      oneWayDistanceKm,
      roundTripDistanceKm: round(oneWayDistanceKm * 2, 1),
      oneWayDurationHours: pricing.oneWayDurationHours,
      roundTripDurationHours,
      hotelRooms,
      hotelNights,
      hotelRatePerRoomNight,
      perPersonOneWayCost: pricing.perPersonOneWayCost,
      perDiemPerPersonDay,
      perDiemDays,
      calculatedAt: new Date().toISOString(),
      sourceMeta: {
        tutuTransport: getTutuTransportLink(mode),
        tutuHotels: TUTU_REFERENCE_LINKS.hotel,
        originGeocoded: originPoint.label,
        destinationGeocoded: destinationPoint.label,
      },
    },
    systemsCount
  );

  return normalized;
}

export function buildInitialTravelEstimate(systemResults = [], systemsCount = 0) {
  return recalculateTravelEstimateDraft(
    {
      ...createEmptyTravelEstimate(),
      crewSize: getCrewSizeFromResults(systemResults),
      workDurationDays: getWorkDurationDays(systemResults),
      perDiemPerPersonDay: DEFAULT_PER_DIEM,
    },
    systemsCount
  );
}
