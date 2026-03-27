const fallbackTimestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

const defaultSystem = `local.system.${fallbackTimestamp}`;
const defaultSite = `local.site.${fallbackTimestamp}`;

export const SYSTEM_BUILD_NUMBER =
  typeof __SYSTEM_BUILD_NUMBER__ !== "undefined" ? __SYSTEM_BUILD_NUMBER__ : defaultSystem;

export const SITE_BUILD_NUMBER = typeof __SITE_BUILD_NUMBER__ !== "undefined" ? __SITE_BUILD_NUMBER__ : defaultSite;

function formatBuildNumber(buildNumber, fallbackLabel) {
  const match = String(buildNumber || "").match(/^(\d+\.\d+\.\d+)\.(\d{14})\.(system|site)$/);
  if (!match) return fallbackLabel;

  const [, version, timestamp, target] = match;
  const formattedDate = `${timestamp.slice(6, 8)}.${timestamp.slice(4, 6)}.${timestamp.slice(0, 4)} ${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}`;
  return `v${version} (${target}, ${formattedDate})`;
}

export const SYSTEM_BUILD_LABEL = formatBuildNumber(SYSTEM_BUILD_NUMBER, SYSTEM_BUILD_NUMBER);
export const SITE_BUILD_LABEL = formatBuildNumber(SITE_BUILD_NUMBER, SITE_BUILD_NUMBER);
