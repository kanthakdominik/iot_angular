import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Route, RouteUpdate } from '../models/route.model';
import { Measurement } from '../models/measurement.model';
import { Marker, MarkerCreate } from '../models/marker.model';
import { Device, DeviceCommand } from '../models/device.model';
import { Login, UserInfo } from '../models/login.model';

/**
 * REST client of the backend (docs/PROTOCOL.md, section 3).
 * Requests go to the same origin, so the session cookie and the CSRF token
 * (XSRF-TOKEN cookie -> X-XSRF-TOKEN header) are handled by the browser and Angular automatically.
 */
@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly routesUrl = `${environment.apiUrl}/routes`;
  private readonly devicesUrl = `${environment.apiUrl}/devices`;
  private readonly authUrl = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient) { }

  // ---------------------------------------------------------------- routes

  getRoutes(deviceId?: string): Observable<Route[]> {
    const params = deviceId ? new HttpParams().set('deviceId', deviceId) : undefined;
    return this.http.get<Route[]>(this.routesUrl, { params });
  }

  getRoute(routeId: number): Observable<Route> {
    return this.http.get<Route>(`${this.routesUrl}/${routeId}`);
  }

  updateRoute(routeId: number, update: RouteUpdate): Observable<Route> {
    return this.http.patch<Route>(`${this.routesUrl}/${routeId}`, update);
  }

  deleteRoute(routeId: number): Observable<void> {
    return this.http.delete<void>(`${this.routesUrl}/${routeId}`);
  }

  getMeasurements(routeId: number): Observable<Measurement[]> {
    return this.http.get<Measurement[]>(`${this.routesUrl}/${routeId}/measurements`);
  }

  deleteMeasurement(routeId: number, measurementId: number): Observable<void> {
    return this.http.delete<void>(`${this.routesUrl}/${routeId}/measurements/${measurementId}`);
  }

  getMarkers(routeId: number): Observable<Marker[]> {
    return this.http.get<Marker[]>(`${this.routesUrl}/${routeId}/markers`);
  }

  addMarker(routeId: number, marker: MarkerCreate): Observable<Marker> {
    return this.http.post<Marker>(`${this.routesUrl}/${routeId}/markers`, marker);
  }

  deleteMarker(routeId: number, markerId: number): Observable<void> {
    return this.http.delete<void>(`${this.routesUrl}/${routeId}/markers/${markerId}`);
  }

  // ---------------------------------------------------------------- devices

  getDevices(): Observable<Device[]> {
    return this.http.get<Device[]>(this.devicesUrl);
  }

  renameDevice(deviceId: string, name: string): Observable<Device> {
    return this.http.patch<Device>(`${this.devicesUrl}/${deviceId}`, { name });
  }

  sendCommand(deviceId: string, cmd: DeviceCommand): Observable<void> {
    return this.http.post<void>(`${this.devicesUrl}/${deviceId}/commands`, { cmd });
  }

  // ---------------------------------------------------------------- auth

  login(credentials: Login): Observable<UserInfo> {
    return this.http.post<UserInfo>(`${this.authUrl}/login`, credentials);
  }

  me(): Observable<UserInfo> {
    return this.http.get<UserInfo>(`${this.authUrl}/me`);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.authUrl}/logout`, {});
  }
}
