export const LEGACY_VIDEO_POSTER = "/assets/manhattan-poster.svg";
export const MANHATTAN_VIDEO_POSTER = "/assets/manhattan-poster.svg";

// Старая подложка (первый экран сайта и текущая подложка платформы).
export const LEGACY_VIDEO_SOURCES = ["/assets/background/city-loop.mp4"];

// Новая подложка для сайта: локальный автономный loop ~2 минуты.
export const MANHATTAN_VIDEO_SOURCES = [
  "/assets/background/manhattan-loop-2min.mp4",
  "/assets/background/manhattan-source.mp4",
];

// Для платформы/системы оставляем старую подложку.
export const SYSTEM_VIDEO_SOURCES = [...LEGACY_VIDEO_SOURCES];
