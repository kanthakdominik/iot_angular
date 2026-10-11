import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, ApiOptions, apiContext } from './http';
import { LoginRequest, PasswordChange, Preferences, UserInfo } from './users.models';

/**
 * `/api/auth` (V2.1-SPEC §3.1). Use `AuthService` in the UI – it keeps the session signals up to date.
 * Session cookie and CSRF token (XSRF-TOKEN cookie -> X-XSRF-TOKEN header) are handled by the browser and HttpClient.
 */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/auth`;

  /** 401 for wrong credentials, 429 after 5 failures within 15 minutes. */
  login(body: LoginRequest, options?: ApiOptions): Observable<UserInfo> {
    return this.http.post<UserInfo>(`${this.url}/login`, body, { context: apiContext(options) });
  }

  logout(options?: ApiOptions): Observable<void> {
    return this.http.post<void>(`${this.url}/logout`, null, { context: apiContext(options) });
  }

  /** 401 without a session. */
  me(options?: ApiOptions): Observable<UserInfo> {
    return this.http.get<UserInfo>(`${this.url}/me`, { context: apiContext(options) });
  }

  /** Full object; missing fields = defaults. */
  savePreferences(body: Preferences, options?: ApiOptions): Observable<UserInfo> {
    return this.http.put<UserInfo>(`${this.url}/preferences`, body, { context: apiContext(options) });
  }

  /** 204; 400 when the current password is wrong. */
  changePassword(body: PasswordChange, options?: ApiOptions): Observable<void> {
    return this.http.post<void>(`${this.url}/password`, body, { context: apiContext(options) });
  }
}
