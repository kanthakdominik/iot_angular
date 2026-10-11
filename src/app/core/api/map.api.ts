import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, ApiOptions, apiContext, toParams } from './http';
import { Grid, GridQuery } from './map.models';

/** `/api/map/grid` – all samples aggregated into square cells (V2.1-SPEC §3.5). */
@Injectable({ providedIn: 'root' })
export class MapApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/map`;

  grid(query: GridQuery, options?: ApiOptions): Observable<Grid> {
    return this.http.get<Grid>(`${this.url}/grid`, { params: toParams(query), context: apiContext(options) });
  }
}
