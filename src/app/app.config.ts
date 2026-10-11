import { provideHttpClient, withFetch, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import {
  ApplicationConfig, inject, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { MAT_CARD_CONFIG } from '@angular/material/card';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { httpErrorsInterceptor } from './core/auth/http-errors.interceptor';
import { I18nService } from './core/i18n/i18n.service';
import { AppPaginatorIntl } from './core/i18n/paginator-intl';
import { ThemeService } from './core/prefs/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // route params, query params and route data bind to component inputs (e.g. RouteDetailPage.id)
    provideRouter(routes, withComponentInputBinding()),
    // Spring Security (csrf.spa()) sets the XSRF-TOKEN cookie; HttpClient echoes it in X-XSRF-TOKEN on mutations
    provideHttpClient(
      withFetch(),
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
      withInterceptors([httpErrorsInterceptor]),
    ),
    provideNativeDateAdapter(),
    // PWA (ngsw-config.json): app shell prefetched, assets lazy, GET /api/** freshness with offline fallback
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' }),
    // restore the session before the first navigation (guards rely on it); theme and language follow preferences
    provideAppInitializer(() => {
      inject(ThemeService);
      inject(I18nService);
      return inject(AuthService).init();
    }),
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline', subscriptSizing: 'dynamic' } },
    { provide: MAT_SNACK_BAR_DEFAULT_OPTIONS, useValue: { duration: 5000 } },
    { provide: MAT_CARD_CONFIG, useValue: { appearance: 'outlined' } },
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-rounded' } },
    { provide: MatPaginatorIntl, useClass: AppPaginatorIntl },
  ],
};
