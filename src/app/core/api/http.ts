import { HttpContext, HttpContextToken, HttpParams } from '@angular/common/http';
import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Base URL of the REST API ("/api"); a token so tests can override it. */
export const API_URL = new InjectionToken<string>('API_URL', { factory: () => environment.apiUrl });

/**
 * Set on a request to suppress the global error snackbar (the caller shows its own message).
 * A 401 still ends the session unless the URL is exempt (see http-errors.interceptor.ts).
 */
export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);

/** Per-call options accepted by every API method. */
export interface ApiOptions {
  /** Do not show the global error snackbar for this request. */
  readonly silent?: boolean;
}

export function apiContext(options?: ApiOptions): HttpContext {
  return new HttpContext().set(SILENT_ERRORS, options?.silent ?? false);
}

/** ISO-8601 instant ("2026-10-10T08:15:00Z") as sent and received by the backend. */
export type IsoInstant = string;

/** `from` / `to` / `after` parameters: the backend accepts ISO instants and plain dates ("2026-10-01"). */
export type DateParam = IsoInstant | Date;

export type QueryValue = string | number | boolean | Date | null | undefined | readonly (string | number)[];

/** Builds query parameters, skipping `undefined`, `null` and empty strings. Dates become ISO instants. */
export function toParams<T extends { [K in keyof T]: QueryValue }>(query: T): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query) as [string, QueryValue][]) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (Array.isArray(value)) {
      params = params.set(key, value.join(','));
    } else if (value instanceof Date) {
      params = params.set(key, value.toISOString());
    } else {
      params = params.set(key, String(value));
    }
  }
  return params;
}
