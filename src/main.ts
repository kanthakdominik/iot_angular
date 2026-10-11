import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { readStoredPreferences } from './app/core/prefs/preferences';
import { applyTheme, prefersDark } from './app/core/prefs/theme.service';

// apply the remembered theme and language before the first render (no flash of the wrong colour scheme)
const preferences = readStoredPreferences();
applyTheme(document.documentElement, preferences.theme,
  preferences.theme === 'dark' || (preferences.theme === 'system' && prefersDark()));
document.documentElement.lang = preferences.language;

bootstrapApplication(App, appConfig).catch(error => console.error(error));
