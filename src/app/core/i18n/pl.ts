import { alertsPl } from './dict/alerts.pl';
import { authPl } from './dict/auth.pl';
import { commonPl } from './dict/common.pl';
import { dashboardPl } from './dict/dashboard.pl';
import { devicesPl } from './dict/devices.pl';
import { eventsPl } from './dict/events.pl';
import { mapPl } from './dict/map.pl';
import { navPl } from './dict/nav.pl';
import { routesPl } from './dict/routes.pl';
import { settingsPl } from './dict/settings.pl';
import { sharePl } from './dict/share.pl';
import { Leaves } from './i18n.types';

/** Polish – the source of truth for translation keys. */
export const pl = {
  common: commonPl,
  nav: navPl,
  auth: authPl,
  dashboard: dashboardPl,
  routes: routesPl,
  map: mapPl,
  devices: devicesPl,
  alerts: alertsPl,
  events: eventsPl,
  settings: settingsPl,
  share: sharePl,
};

/** Every valid translation key, e.g. `'routes.title'`. */
export type TranslationKey = Leaves<typeof pl>;
