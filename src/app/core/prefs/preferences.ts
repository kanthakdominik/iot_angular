import {
  DOSE_UNITS, LANGS, MAP_LAYER_KEYS, Preferences, THEME_PREFS,
} from '../api/users.models';

const STORAGE_KEY = 'app.preferences';

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Language used before anything is stored: Polish unless the browser prefers English. */
function browserLanguage(): Preferences['language'] {
  const lang = typeof navigator === 'undefined' ? '' : navigator.language.toLowerCase();
  return lang.startsWith('en') ? 'en' : 'pl';
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: THEME_PREFS[0],
  language: LANGS[0],
  doseUnit: DOSE_UNITS[0],
  mapLayer: MAP_LAYER_KEYS[0],
};

/** Tolerant parsing (same rule as the backend): missing or unknown values fall back to `defaults`. */
export function normalizePreferences(raw: unknown, defaults: Preferences = DEFAULT_PREFERENCES): Preferences {
  const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    theme: pick(value['theme'], THEME_PREFS, defaults.theme),
    language: pick(value['language'], LANGS, defaults.language),
    doseUnit: pick(value['doseUnit'], DOSE_UNITS, defaults.doseUnit),
    mapLayer: pick(value['mapLayer'], MAP_LAYER_KEYS, defaults.mapLayer),
  };
}

/** Preferences remembered in this browser (used while logged out and before `/me` answers). */
export function readStoredPreferences(): Preferences {
  const defaults = { ...DEFAULT_PREFERENCES, language: browserLanguage() };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return normalizePreferences(stored ? JSON.parse(stored) : null, defaults);
  } catch {
    return defaults;
  }
}

export function writeStoredPreferences(preferences: Preferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // storage unavailable (private mode, quota) – preferences then live for this tab only
  }
}
