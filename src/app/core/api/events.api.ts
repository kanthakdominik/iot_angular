import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { EventDto, EventQuery } from './events.models';
import { API_URL, ApiOptions, apiContext, toParams } from './http';
import { Page } from './page.models';

/** `/api/events` – device event log, newest first (V2.1-SPEC §3.4). */
@Injectable({ providedIn: 'root' })
export class EventsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/events`;

  list(query: EventQuery = {}, options?: ApiOptions): Observable<Page<EventDto>> {
    return this.http.get<Page<EventDto>>(this.url, { params: toParams(query), context: apiContext(options) });
  }
}
