import { DeviceDto } from '../../core/api/devices.models';

/** Battery level at or below which the level is shown as a warning (tertiary colour). */
export const LOW_BATTERY_PCT = 20;

/** Material Symbols name for a battery level in % (`battery_0_bar` … `battery_full`, `battery_alert`). */
export function batteryIcon(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) {
    return 'battery_unknown';
  }
  if (pct <= 5) {
    return 'battery_alert';
  }
  if (pct >= 95) {
    return 'battery_full';
  }
  return `battery_${Math.min(6, Math.max(0, Math.floor((pct / 100) * 7)))}_bar`;
}

export function isLowBattery(pct: number | null | undefined): boolean {
  return pct !== null && pct !== undefined && pct <= LOW_BATTERY_PCT;
}

/** Display name: the given name, or the id for devices that were never renamed. */
export function deviceLabel(device: Pick<DeviceDto, 'id' | 'name'>): string {
  return device.name?.trim() || device.id;
}

/** Online devices first, then by name. */
export function compareDevices(a: DeviceDto, b: DeviceDto): number {
  if (a.online !== b.online) {
    return a.online ? -1 : 1;
  }
  return deviceLabel(a).localeCompare(deviceLabel(b), undefined, { numeric: true });
}
