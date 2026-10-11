import { Injectable, signal } from '@angular/core';

/** An entity opened from the command palette (route, device or marker). */
export interface RecentItem {
  readonly id: string;
  readonly kind: 'route' | 'device' | 'marker';
  readonly label: string;
  /** Secondary texts shown next to each other (device, date…). */
  readonly detail?: readonly string[];
  /** Router link (absolute path) and optional query parameters. */
  readonly link: string;
  readonly queryParams?: Readonly<Record<string, string>>;
}

const STORAGE_KEY = 'app.palette.recent';
const MAX_ITEMS = 6;

function read(): RecentItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as RecentItem[]).slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

/** Last entities opened from the command palette, newest first (localStorage, this browser only). */
@Injectable({ providedIn: 'root' })
export class RecentItems {
  private readonly current = signal<RecentItem[]>(read());
  readonly items = this.current.asReadonly();

  add(item: RecentItem): void {
    const next = [item, ...this.current().filter(existing => existing.id !== item.id)].slice(0, MAX_ITEMS);
    this.current.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable – the list lives for this tab only
    }
  }
}
