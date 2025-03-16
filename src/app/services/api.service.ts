import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Route } from '../models/route.model';
import { IotData } from '../models/iot-data.model';
import { RouteNameUpdate } from '../models/route-name-update.model';
import { Login, LoginResponse } from '../models/login.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly routesUrl = `${environment.apiUrl}/routes`;
  private readonly authUrl = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient) { }

  getAllRoutes(): Observable<Route[]> {
    return this.http.get<Route[]>(this.routesUrl);
  }

  getRoute(routeId: number): Observable<Route> {
    return this.http.get<Route>(`${this.routesUrl}/${routeId}`);
  }

  getRouteData(routeId: number): Observable<IotData[]> {
    return this.http.get<IotData[]>(`${this.routesUrl}/${routeId}/data`);
  }

  updateRouteName(routeId: number, newName: string): Observable<void> {
    const body: RouteNameUpdate = { newName };
    return this.http.put<void>(`${this.routesUrl}/${routeId}/name`, body);
  }

  deleteRoute(routeId: number): Observable<any> {
    return this.http.delete(`${this.routesUrl}/${routeId}`);
  }

  deleteIotDataPoint(routeId: number, iotDataId: number): Observable<any> {
    return this.http.delete(`${this.routesUrl}/${routeId}/data/${iotDataId}`);
  }

  login(credentials: Login): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.authUrl}/login`, credentials, {
      withCredentials: true
    });
  }

  getCurrentUser(): Observable<{ username: string }> {
    return this.http.get<{ username: string }>(`${this.authUrl}/username`, {
      withCredentials: true
    });
  }

  logout(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.authUrl}/logout`, {}, {
      withCredentials: true
    });
  }
}