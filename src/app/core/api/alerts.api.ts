import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AckAllResult, AlertCount, AlertDto, AlertQuery, AlertRuleDto, AlertRuleInput } from './alerts.models';
import { API_URL, ApiOptions, apiContext, toParams } from './http';
import { Page } from './page.models';

/**
 * `/api/alerts` and `/api/alert-rules` (V2.1-SPEC §3.4).
 * Acknowledging emits no SSE event – use `OpenAlertsStore` in the UI so the bell badge stays in sync.
 */
@Injectable({ providedIn: 'root' })
export class AlertsApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_URL);

  list(query: AlertQuery = {}, options?: ApiOptions): Observable<Page<AlertDto>> {
    return this.http.get<Page<AlertDto>>(`${this.base}/alerts`,
      { params: toParams(query), context: apiContext(options) });
  }

  count(options?: ApiOptions): Observable<AlertCount> {
    return this.http.get<AlertCount>(`${this.base}/alerts/count`, { context: apiContext(options) });
  }

  ack(id: number, options?: ApiOptions): Observable<AlertDto> {
    return this.http.post<AlertDto>(`${this.base}/alerts/${id}/ack`, null, { context: apiContext(options) });
  }

  ackAll(options?: ApiOptions): Observable<AckAllResult> {
    return this.http.post<AckAllResult>(`${this.base}/alerts/ack-all`, null, { context: apiContext(options) });
  }

  rules(options?: ApiOptions): Observable<AlertRuleDto[]> {
    return this.http.get<AlertRuleDto[]>(`${this.base}/alert-rules`, { context: apiContext(options) });
  }

  /** 201 Created. */
  createRule(body: AlertRuleInput, options?: ApiOptions): Observable<AlertRuleDto> {
    return this.http.post<AlertRuleDto>(`${this.base}/alert-rules`, body, { context: apiContext(options) });
  }

  updateRule(id: number, body: AlertRuleInput, options?: ApiOptions): Observable<AlertRuleDto> {
    return this.http.put<AlertRuleDto>(`${this.base}/alert-rules/${id}`, body, { context: apiContext(options) });
  }

  deleteRule(id: number, options?: ApiOptions): Observable<void> {
    return this.http.delete<void>(`${this.base}/alert-rules/${id}`, { context: apiContext(options) });
  }
}
