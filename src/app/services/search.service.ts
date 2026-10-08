import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Route } from '../models/route.model';

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private searchQuerySubject = new BehaviorSubject<string>('');
  searchQuery$ = this.searchQuerySubject.asObservable();

  setSearchQuery(query: string): void {
    this.searchQuerySubject.next(query);
  }

  clearSearch(): void {
    this.searchQuerySubject.next('');
  }

  /** Matches name, description and device id (case-insensitive). */
  static matches(route: Route, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) {
      return true;
    }
    return route.name.toLowerCase().includes(q)
      || (route.description ?? '').toLowerCase().includes(q)
      || route.deviceId.toLowerCase().includes(q);
  }
}
