import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, ApiOptions, apiContext } from './http';
import { MarkerDto, MeasurementDto, RouteDto } from './routes.models';

/** Read-only access to a shared route, no session required (`/api/public/routes/{token}`); 404 for unknown tokens. */
@Injectable({ providedIn: 'root' })
export class PublicApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/public/routes`;

  route(token: string, options?: ApiOptions): Observable<RouteDto> {
    return this.http.get<RouteDto>(`${this.url}/${encodeURIComponent(token)}`, { context: apiContext(options) });
  }

  measurements(token: string, options?: ApiOptions): Observable<MeasurementDto[]> {
    return this.http.get<MeasurementDto[]>(`${this.url}/${encodeURIComponent(token)}/measurements`,
      { context: apiContext(options) });
  }

  markers(token: string, options?: ApiOptions): Observable<MarkerDto[]> {
    return this.http.get<MarkerDto[]>(`${this.url}/${encodeURIComponent(token)}/markers`,
      { context: apiContext(options) });
  }
}
