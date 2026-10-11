import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { I18nService } from '../i18n/i18n.service';

/** `detail` of an RFC 9457 problem+json body, if any. */
export function problemDetail(error: unknown): string | null {
  if (error instanceof HttpErrorResponse && typeof error.error === 'object' && error.error !== null) {
    const detail = (error.error as { detail?: unknown }).detail;
    return typeof detail === 'string' && detail.trim() ? detail : null;
  }
  return null;
}

/** Snackbar messages. Identical messages within 3 s are shown once (e.g. several requests failing offline). */
@Injectable({ providedIn: 'root' })
export class Notifier {
  private readonly snackBar = inject(MatSnackBar);
  private readonly i18n = inject(I18nService);
  private last = { message: '', at: 0 };

  info(message: string): void {
    this.open(message, false);
  }

  error(message: string): void {
    this.open(message, true);
  }

  /** Shows `describe(error)`. */
  httpError(error: unknown): void {
    this.error(this.describe(error));
  }

  /** User-facing text for a failed request: problem+json `detail` or a generic message for the status. */
  describe(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return this.i18n.t('common.errors.unknown');
    }
    if (error.status === 0) {
      return this.i18n.t('common.errors.network');
    }
    const detail = problemDetail(error);
    if (detail && error.status < 500) {
      return detail;
    }
    switch (error.status) {
      case 403:
        return this.i18n.t('common.errors.forbidden');
      case 404:
        return this.i18n.t('common.errors.notFound');
      case 409:
        return this.i18n.t('common.errors.conflict');
      case 429:
        return this.i18n.t('common.errors.tooManyRequests');
      default:
        return error.status >= 500
          ? detail ?? this.i18n.t('common.errors.server', { status: error.status })
          : this.i18n.t('common.errors.unknown');
    }
  }

  private open(message: string, isError: boolean): void {
    const now = Date.now();
    if (message === this.last.message && now - this.last.at < 3000) {
      return;
    }
    this.last = { message, at: now };
    this.snackBar.open(message, isError ? this.i18n.t('common.actions.close') : undefined, isError
      ? { duration: 8000, politeness: 'assertive' }
      : { politeness: 'polite' });
  }
}
