import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom, map, tap } from 'rxjs';
import { AuthApi } from '../api/auth.api';
import { ApiOptions } from '../api/http';
import { Preferences, UserInfo } from '../api/users.models';
import { normalizePreferences } from '../prefs/preferences';
import { clearApiCache } from '../pwa/service-worker';

function normalizeUser(user: UserInfo): UserInfo {
  return { ...user, preferences: normalizePreferences(user.preferences) };
}

const LAST_USER_KEY = 'app.lastUser';

/** The last signed-in user, used only when the server is unreachable at startup (offline PWA, read-only). */
function rememberUser(user: UserInfo | null): void {
  try {
    if (user) {
      localStorage.setItem(LAST_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LAST_USER_KEY);
    }
  } catch {
    // storage unavailable – no offline start
  }
}

function lastUser(): UserInfo | null {
  try {
    const stored = localStorage.getItem(LAST_USER_KEY);
    return stored ? normalizeUser(JSON.parse(stored) as UserInfo) : null;
  } catch {
    return null;
  }
}

/** Session state. The whole app except `/login` and `/share/:token` requires a logged-in user. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);
  private readonly current = signal<UserInfo | null>(null);

  readonly user = this.current.asReadonly();
  readonly isLoggedIn = computed(() => this.current() !== null);
  readonly isAdmin = computed(() => this.current()?.role === 'ADMIN');
  /** Server-side preferences of the logged-in user; null when logged out (see PrefsService for the effective ones). */
  readonly preferences = computed(() => this.current()?.preferences ?? null);

  /**
   * Restores the session on startup (provideAppInitializer). Never rejects. When the server cannot be reached
   * (status 0, offline) the last signed-in user is assumed, so cached data can be browsed; the next successful
   * request decides (a 401 then ends the session as usual).
   */
  async init(): Promise<void> {
    try {
      this.setUser(normalizeUser(await firstValueFrom(this.api.me({ silent: true }))));
    } catch (error) {
      this.current.set(error instanceof HttpErrorResponse && error.status === 0 ? lastUser() : null);
      if (!this.current()) {
        rememberUser(null);
      }
    }
  }

  /** Errors are not shown globally – the login form maps 401 / 429 to its own messages. */
  login(username: string, password: string): Observable<UserInfo> {
    return this.api.login({ username, password }, { silent: true }).pipe(
      map(normalizeUser),
      tap(user => this.setUser(user)),
    );
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.logout({ silent: true }));
    } catch {
      // the session may already be gone – the local state is cleared anyway
    }
    this.endSession();
    await this.router.navigateByUrl('/login');
  }

  /** Called by the HTTP interceptor on 401: clears the user and sends them to the login page. */
  sessionExpired(): void {
    if (!this.current()) {
      return;
    }
    const returnUrl = this.router.url;
    this.endSession();
    void this.router.navigate(['/login'], { queryParams: { returnUrl } });
  }

  /** 400 when the current password is wrong (pass `{ silent: true }` to show it inline). */
  changePassword(currentPassword: string, newPassword: string, options?: ApiOptions): Observable<void> {
    return this.api.changePassword({ currentPassword, newPassword }, options);
  }

  /** Prefer `PrefsService.update()` in the UI – it is optimistic and also handles the logged-out case. */
  savePreferences(preferences: Preferences): Observable<UserInfo> {
    return this.api.savePreferences(preferences).pipe(
      map(normalizeUser),
      tap(user => this.setUser(user)),
    );
  }

  /** Local (optimistic) update of the preferences of the current user. */
  setPreferences(preferences: Preferences): void {
    this.current.update(user => (user ? { ...user, preferences } : user));
  }

  private setUser(user: UserInfo): void {
    this.current.set(user);
    rememberUser(user);
  }

  private endSession(): void {
    this.current.set(null);
    rememberUser(null);
    void clearApiCache();
  }
}
