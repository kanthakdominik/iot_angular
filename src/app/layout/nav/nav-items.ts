import { ThemePref } from '../../core/api/users.models';
import { TranslationKey } from '../../core/i18n/pl';

export interface NavItem {
  readonly path: string;
  /** Material Symbols name. */
  readonly icon: string;
  readonly labelKey: TranslationKey;
  /** Shown in the phone bottom bar (others go to "More"). */
  readonly bottom: boolean;
  /** Shows the open-alert count. */
  readonly alertsBadge?: boolean;
}

/** Main navigation (UI.md §3), also the "pages" of the command palette. Settings is drawn at the bottom of the rail. */
export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/dashboard', icon: 'space_dashboard', labelKey: 'nav.dashboard', bottom: true },
  { path: '/routes', icon: 'route', labelKey: 'nav.routes', bottom: true },
  { path: '/map', icon: 'map', labelKey: 'nav.map', bottom: true },
  { path: '/devices', icon: 'sensors', labelKey: 'nav.devices', bottom: true },
  { path: '/alerts', icon: 'warning', labelKey: 'nav.alerts', bottom: false, alertsBadge: true },
  { path: '/events', icon: 'history', labelKey: 'nav.events', bottom: false },
  { path: '/settings', icon: 'settings', labelKey: 'nav.settings', bottom: false },
];

export const THEME_ICONS: Readonly<Record<ThemePref, string>> = {
  system: 'brightness_auto',
  light: 'light_mode',
  dark: 'dark_mode',
};

export const THEME_LABEL_KEYS: Readonly<Record<ThemePref, TranslationKey>> = {
  system: 'common.theme.system',
  light: 'common.theme.light',
  dark: 'common.theme.dark',
};
