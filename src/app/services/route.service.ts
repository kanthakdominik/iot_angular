import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Route } from '../models/route.model';
import { IotData } from '../models/iot-data.model';
import { RouteNameUpdate } from '../models/route-name-update.model';

@Injectable({
  providedIn: 'root'
})
export class RouteService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getAllRoutes(): Observable<Route[]> {
    return this.http.get<Route[]>(`${this.apiUrl}/routes`);
  }

  getRouteData(routeId: number): Observable<IotData[]> {
    return this.http.get<IotData[]>(`${this.apiUrl}/routes/${routeId}/data`);
  }

  updateRouteName(routeId: number, newName: string): Observable<void> {
    const body: RouteNameUpdate = { newName };
    return this.http.put<void>(`${this.apiUrl}/routes/${routeId}/name`, body);
  }
}