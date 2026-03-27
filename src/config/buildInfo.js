const fallbackTimestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

export const APP_VERSION = "1.0.4";

const defaultSystem = `local.system.${fallbackTimestamp}`;
const defaultSite = `local.site.${fallbackTimestamp}`;

export const SYSTEM_BUILD_NUMBER =
  typeof __SYSTEM_BUILD_NUMBER__ !== "undefined" ? __SYSTEM_BUILD_NUMBER__ : defaultSystem;

export const SITE_BUILD_NUMBER = typeof __SITE_BUILD_NUMBER__ !== "undefined" ? __SITE_BUILD_NUMBER__ : defaultSite;
