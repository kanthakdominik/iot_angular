import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Login, LoginResponse } from '../models/login.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authUrl = `${environment.apiUrl}/auth`;
  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  private usernameSubject = new BehaviorSubject<string>('');

  isLoggedIn$ = this.isLoggedInSubject.asObservable();
  username$ = this.usernameSubject.asObservable();

  constructor(private http: HttpClient) {
    this.checkInitialAuth();
  }

  login(credentials: Login): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.authUrl}/login`, credentials)
      .pipe(
        tap(response => {
          this.isLoggedInSubject.next(true);
          this.usernameSubject.next(response.username);
          localStorage.setItem('username', response.username);
        })
      );
  }

  logout(): void {
    this.isLoggedInSubject.next(false);
    this.usernameSubject.next('');
    localStorage.removeItem('username');
  }

  private checkInitialAuth(): void {
    const username = localStorage.getItem('username');
    if (username) {
      this.http.get<{username: string}>(`${this.authUrl}/username`).subscribe({
        next: (response) => {
          this.isLoggedInSubject.next(true);
          this.usernameSubject.next(response.username);
        },
        error: () => {
          this.logout();
        }
      });
    }
  }
}