import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, tap } from 'rxjs';
import { AckAllResult, AlertDto } from '../api/alerts.models';
import { AlertsApi } from '../api/alerts.api';
import { AuthService } from '../auth/auth.service';
import { LiveService } from '../live/live.service';

const RECENT_SIZE = 5;

/**
 * Open-alert count (bell badge) and the newest open alerts (notifications menu).
 * Kept current by SSE `alert`; acknowledging emits no SSE event, so acknowledge through `ack()` / `ackAll()` here
 * (or call `refresh()` after acknowledging elsewhere).
 */
@Injectable({ providedIn: 'root' })
export class OpenAlertsStore {
  private readonly api = inject(AlertsApi);
  private readonly auth = inject(AuthService);
  private readonly live = inject(LiveService);

  private readonly openCount = signal(0);
  private readonly recentAlerts = signal<AlertDto[]>([]);
  private readonly recentLoading = signal(false);
  private recentLoaded = false;

  readonly count = this.openCount.asReadonly();
  /** Up to 5 newest open alerts; loaded on demand with `loadRecent()`. */
  readonly recent = this.recentAlerts.asReadonly();
  readonly loadingRecent = this.recentLoading.asReadonly();

  constructor() {
    effect(() => {
      const loggedIn = this.auth.isLoggedIn();
      untracked(() => {
        if (loggedIn) {
          this.refresh();
        } else {
          this.openCount.set(0);
          this.recentAlerts.set([]);
          this.recentLoaded = false;
        }
      });
    });
    this.live.alert$.pipe(takeUntilDestroyed()).subscribe(alert => {
      if (!alert.acknowledgedAt) {
        this.openCount.update(count => count + 1);
        this.recentAlerts.update(list => [alert, ...list.filter(a => a.id !== alert.id)].slice(0, RECENT_SIZE));
      }
    });
    this.live.reconnected$.pipe(takeUntilDestroyed()).subscribe(() => this.refresh());
  }

  refresh(): void {
    if (this.recentLoaded) {
      this.loadRecent();
    } else {
      this.api.count({ silent: true }).subscribe(result => this.openCount.set(result.open));
    }
  }

  loadRecent(): void {
    this.recentLoading.set(true);
    this.api.list({ state: 'open', page: 0, size: RECENT_SIZE }, { silent: true }).subscribe({
      next: page => {
        this.recentLoaded = true;
        this.recentAlerts.set(page.content);
        this.openCount.set(page.totalElements);
        this.recentLoading.set(false);
      },
      error: () => this.recentLoading.set(false),
    });
  }

  /** ADMIN. Removes the alert from `recent` and reloads the count. */
  ack(id: number): Observable<AlertDto> {
    return this.api.ack(id).pipe(tap(() => {
      this.recentAlerts.update(list => list.filter(alert => alert.id !== id));
      this.refresh();
    }));
  }

  /** ADMIN. */
  ackAll(): Observable<AckAllResult> {
    return this.api.ackAll().pipe(tap(() => {
      this.openCount.set(0);
      this.recentAlerts.set([]);
    }));
  }
}
