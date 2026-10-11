import { EventType, Severity } from '../../core/api/events.models';
import { TranslationKey } from '../../core/i18n/pl';

/** Material Symbols name per event type. */
export const EVENT_ICONS: Readonly<Record<EventType, string>> = {
  DEVICE_ONLINE: 'wifi',
  DEVICE_OFFLINE: 'wifi_off',
  ROUTE_STARTED: 'route',
  BATTERY: 'battery_5_bar',
  DEVICE_ERROR: 'error',
  MARKER: 'location_on',
  COMMAND_SENT: 'send',
  ALERT: 'warning',
  IMPORT: 'sd_card',
};

export const EVENT_TYPE_KEYS: Readonly<Record<EventType, TranslationKey>> = {
  DEVICE_ONLINE: 'events.types.DEVICE_ONLINE',
  DEVICE_OFFLINE: 'events.types.DEVICE_OFFLINE',
  ROUTE_STARTED: 'events.types.ROUTE_STARTED',
  BATTERY: 'events.types.BATTERY',
  DEVICE_ERROR: 'events.types.DEVICE_ERROR',
  MARKER: 'events.types.MARKER',
  COMMAND_SENT: 'events.types.COMMAND_SENT',
  ALERT: 'events.types.ALERT',
  IMPORT: 'events.types.IMPORT',
};

export const SEVERITY_KEYS: Readonly<Record<Severity, TranslationKey>> = {
  INFO: 'events.severity.INFO',
  WARN: 'events.severity.WARN',
  ERROR: 'events.severity.ERROR',
};
