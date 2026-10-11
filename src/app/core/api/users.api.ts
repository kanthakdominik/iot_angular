import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, ApiOptions, apiContext } from './http';
import { UserCreate, UserDto, UserUpdate } from './users.models';

/** `/api/users` – ADMIN only (V2.1-SPEC §3.1). Conflicts (name taken, last admin, self-delete) return 409. */
@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/users`;

  list(options?: ApiOptions): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(this.url, { context: apiContext(options) });
  }

  create(body: UserCreate, options?: ApiOptions): Observable<UserDto> {
    return this.http.post<UserDto>(this.url, body, { context: apiContext(options) });
  }

  update(id: number, body: UserUpdate, options?: ApiOptions): Observable<UserDto> {
    return this.http.patch<UserDto>(`${this.url}/${id}`, body, { context: apiContext(options) });
  }

  delete(id: number, options?: ApiOptions): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`, { context: apiContext(options) });
  }
}
