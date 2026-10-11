import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { API_URL, ApiOptions, apiContext, toParams } from './http';
import { EMPTY_SEARCH, SearchResult } from './search.models';

/** `/api/search` (V2.1-SPEC §3.5). Queries shorter than 2 characters return empty lists without a request. */
@Injectable({ providedIn: 'root' })
export class SearchApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/search`;

  search(q: string, options?: ApiOptions): Observable<SearchResult> {
    const query = q.trim();
    if (query.length < 2) {
      return of(EMPTY_SEARCH);
    }
    return this.http.get<SearchResult>(this.url, { params: toParams({ q: query }), context: apiContext(options) });
  }
}
