import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { Login, UserInfo } from '../models/login.model';
import { ApiService } from './api.service';

/**
 * Keeps the current user. The session lives in an HttpOnly cookie, so on start-up the app simply asks
 * the backend who is logged in (/api/auth/me). That first request also gives the browser the CSRF cookie.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly userSubject = new BehaviorSubject<UserInfo | null>(null);

  readonly user$: Observable<UserInfo | null> = this.userSubject.asObservable();
  readonly isAdmin$: Observable<boolean> = this.user$.pipe(map(user => user?.role === 'ADMIN'));

  constructor(private apiService: ApiService) {
    this.refresh();
  }

  refresh(): void {
    this.apiService.me().subscribe({
      next: user => this.userSubject.next(user),
      error: () => this.userSubject.next(null)
    });
  }

  login(credentials: Login): Observable<UserInfo> {
    return this.apiService.login(credentials).pipe(
      tap(user => this.userSubject.next(user))
    );
  }

  logout(): Observable<void> {
    return this.apiService.logout().pipe(
      tap(() => this.userSubject.next(null))
    );
  }

  get currentUser(): UserInfo | null {
    return this.userSubject.value;
  }

  get isAdmin(): boolean {
    return this.userSubject.value?.role === 'ADMIN';
  }
}
