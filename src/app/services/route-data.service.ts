import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError } from 'rxjs';
import { IotData } from '../models/iot-data.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RouteDataService {
  private readonly apiUrl = `${environment.apiUrl}/routes`;

  constructor(private http: HttpClient) {}

  getRouteData(routeId: number): Observable<IotData[]> {
    return this.http.get<IotData[]>(`${this.apiUrl}/${routeId}/data`).pipe(
      catchError((error) => {
        console.error('Error fetching route data:', error);
        throw error;
      })
    );
  }

  getAllRoutes(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl).pipe(
      catchError((error) => {
        console.error('Error fetching routes:', error);
        throw error;
      })
    );
  }
}