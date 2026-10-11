import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, ApiOptions, apiContext, toParams } from './http';
import { ActivityDay, ActivityQuery, StatsSummary } from './stats.models';

/** `/api/stats` (V2.1-SPEC §3.5). */
@Injectable({ providedIn: 'root' })
export class StatsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/stats`;

  summary(options?: ApiOptions): Observable<StatsSummary> {
    return this.http.get<StatsSummary>(`${this.url}/summary`, { context: apiContext(options) });
  }

  /** Only days with data. */
  activity(query: ActivityQuery = {}, options?: ApiOptions): Observable<ActivityDay[]> {
    return this.http.get<ActivityDay[]>(`${this.url}/activity`,
      { params: toParams(query), context: apiContext(options) });
  }
}
