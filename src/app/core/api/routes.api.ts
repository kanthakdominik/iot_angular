import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, ApiOptions, DateParam, apiContext, toParams } from './http';
import { Page } from './page.models';
import {
  MarkerCreate, MarkerDto, MeasurementDto, RouteDto, RouteQuery, RouteUpdate, ShareTokenDto,
} from './routes.models';

/** `/api/routes` (V2.1-SPEC §3.2). Mutations require ADMIN. */
@Injectable({ providedIn: 'root' })
export class RoutesApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/routes`;

  list(query: RouteQuery = {}, options?: ApiOptions): Observable<Page<RouteDto>> {
    return this.http.get<Page<RouteDto>>(this.url, { params: toParams(query), context: apiContext(options) });
  }

  get(id: number, options?: ApiOptions): Observable<RouteDto> {
    return this.http.get<RouteDto>(`${this.url}/${id}`, { context: apiContext(options) });
  }

  update(id: number, body: RouteUpdate, options?: ApiOptions): Observable<RouteDto> {
    return this.http.patch<RouteDto>(`${this.url}/${id}`, body, { context: apiContext(options) });
  }

  delete(id: number, options?: ApiOptions): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`, { context: apiContext(options) });
  }

  /** Ascending by time; `after` returns only newer samples (catch-up after an SSE reconnect). */
  measurements(id: number, after?: DateParam, options?: ApiOptions): Observable<MeasurementDto[]> {
    return this.http.get<MeasurementDto[]>(`${this.url}/${id}/measurements`,
      { params: toParams({ after }), context: apiContext(options) });
  }

  deleteMeasurement(id: number, measurementId: number, options?: ApiOptions): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}/measurements/${measurementId}`, { context: apiContext(options) });
  }

  markers(id: number, options?: ApiOptions): Observable<MarkerDto[]> {
    return this.http.get<MarkerDto[]>(`${this.url}/${id}/markers`, { context: apiContext(options) });
  }

  addMarker(id: number, body: MarkerCreate, options?: ApiOptions): Observable<MarkerDto> {
    return this.http.post<MarkerDto>(`${this.url}/${id}/markers`, body, { context: apiContext(options) });
  }

  deleteMarker(id: number, markerId: number, options?: ApiOptions): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}/markers/${markerId}`, { context: apiContext(options) });
  }

  /** Creates the public share token or returns the existing one. Link: `/share/<token>`. */
  share(id: number, options?: ApiOptions): Observable<ShareTokenDto> {
    return this.http.post<ShareTokenDto>(`${this.url}/${id}/share`, null, { context: apiContext(options) });
  }

  unshare(id: number, options?: ApiOptions): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}/share`, { context: apiContext(options) });
  }
}
