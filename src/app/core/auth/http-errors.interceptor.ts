import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { SILENT_ERRORS } from '../api/http';
import { I18nService } from '../i18n/i18n.service';
import { Notifier } from '../notify/notifier';
import { AuthService } from './auth.service';

/** 401 on these endpoints is an expected answer, not an expired session. */
const SESSION_EXEMPT = ['/auth/me', '/auth/login', '/auth/logout', '/public/'];

/**
 * Global HTTP error handling:
 * - 401 (outside the exempt endpoints) ends the session and redirects to `/login?returnUrl=…`;
 * - any other error shows a snackbar with the problem+json `detail`, unless the request carries `SILENT_ERRORS`.
 * The error is always re-thrown so callers can react (reset a spinner, show inline messages).
 */
export const httpErrorsInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const notifier = inject(Notifier);
  const i18n = inject(I18nService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401 && !SESSION_EXEMPT.some(path => request.url.includes(path))) {
          if (auth.isLoggedIn()) {
            notifier.error(i18n.t('common.errors.sessionExpired'));
            auth.sessionExpired();
          }
        } else if (!request.context.get(SILENT_ERRORS)) {
          notifier.httpError(error);
        }
      }
      return throwError(() => error);
    }),
  );
};
