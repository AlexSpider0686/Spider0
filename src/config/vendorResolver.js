import { VENDOR_EQUIPMENT } from "./vendorConfig";

export function resolveVendorEquipment(systemType, vendor) {
  return VENDOR_EQUIPMENT?.[systemType]?.[vendor] || VENDOR_EQUIPMENT?.[systemType]?.["Базовый"] || null;
}
