import { alertsEn } from './dict/alerts.en';
import { authEn } from './dict/auth.en';
import { commonEn } from './dict/common.en';
import { dashboardEn } from './dict/dashboard.en';
import { devicesEn } from './dict/devices.en';
import { eventsEn } from './dict/events.en';
import { mapEn } from './dict/map.en';
import { navEn } from './dict/nav.en';
import { routesEn } from './dict/routes.en';
import { settingsEn } from './dict/settings.en';
import { shareEn } from './dict/share.en';
import { DictShape } from './i18n.types';
import type { pl } from './pl';

/** English – must have exactly the keys of `pl`. */
export const en: DictShape<typeof pl> = {
  common: commonEn,
  nav: navEn,
  auth: authEn,
  dashboard: dashboardEn,
  routes: routesEn,
  map: mapEn,
  devices: devicesEn,
  alerts: alertsEn,
  events: eventsEn,
  settings: settingsEn,
  share: shareEn,
};
