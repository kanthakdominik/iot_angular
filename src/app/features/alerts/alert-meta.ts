import { AlertType } from '../../core/api/alerts.models';
import { TranslationKey } from '../../core/i18n/pl';

export const ALERT_ICONS: Readonly<Record<AlertType, string>> = {
  DOSE_RATE_ABOVE: 'warning',
  BATTERY_BELOW: 'battery_alert',
  DEVICE_OFFLINE: 'cloud_off',
};

export const ALERT_TYPE_KEYS: Readonly<Record<AlertType, TranslationKey>> = {
  DOSE_RATE_ABOVE: 'alerts.types.DOSE_RATE_ABOVE',
  BATTERY_BELOW: 'alerts.types.BATTERY_BELOW',
  DEVICE_OFFLINE: 'alerts.types.DEVICE_OFFLINE',
};
