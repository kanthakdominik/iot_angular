import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Login, LoginResponse } from '../models/login.model';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<string | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private apiService: ApiService) {
    if (this.hasValidToken()) {
      this.fetchCurrentUser();
    }
  }

  private hasValidToken(): boolean {
    return !!localStorage.getItem('isLoggedIn');
  }

  private fetchCurrentUser(): void {
    this.apiService.getCurrentUser().subscribe({
      next: (response) => this.currentUserSubject.next(response.username),
      error: () => this.currentUserSubject.next(null)
    });
  }

  login(credentials: Login): Observable<LoginResponse> {
    return this.apiService.login(credentials).pipe(
      tap((response) => {
        if (response.username) {
          localStorage.setItem('isLoggedIn', 'true');
          this.currentUserSubject.next(response.username);
        }
      })
    );
  }

  logout(): Observable<{ message: string }> {
    return this.apiService.logout().pipe(
      tap(() => {
        localStorage.removeItem('isLoggedIn');
        this.currentUserSubject.next(null);
      })
    );
  }

  isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }

  getCurrentUser(): string | null {
    return this.currentUserSubject.value;
  }
}