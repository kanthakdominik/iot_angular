import { ChangeDetectionStrategy, Component, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Router } from '@angular/router';
import { AlertsApi } from '../../core/api/alerts.api';
import { AlertDto } from '../../core/api/alerts.models';
import { OpenAlertsStore } from '../../core/alerts/open-alerts.store';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LiveService } from '../../core/live/live.service';
import { Notifier } from '../../core/notify/notifier';
import { Dialogs } from '../../shared/dialogs/dialogs.service';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { AlertItem } from './alert-item';

export type AlertState = 'open' | 'all';

export const ALERTS_PAGE_SIZE = 25;

/**
 * Paginated alert list with the open / all filter (state and page live in the URL), acknowledging one or all
 * (through OpenAlertsStore so the bell follows) and live insertion of new alerts on the first page.
 */
@Component({
  selector: 'app-alerts-list',
  imports: [
    AlertItem, EmptyState, MatButtonModule, MatButtonToggleModule, MatCardModule, MatIconModule, MatPaginatorModule,
    Skeleton, TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './alerts-list.html',
  styleUrl: './alerts-list.scss',
})
export class AlertsList {
  private readonly api = inject(AlertsApi);
  private readonly live = inject(LiveService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(Dialogs);
  private readonly notifier = inject(Notifier);
  private readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  protected readonly store = inject(OpenAlertsStore);

  readonly state = input<AlertState>('all');
  /** Zero-based page index. */
  readonly page = input(0, { transform: numberAttribute });

  protected readonly pageSize = ALERTS_PAGE_SIZE;
  protected readonly alerts = rxResource({
    params: () => ({ state: this.state(), page: this.page(), size: ALERTS_PAGE_SIZE }),
    stream: ({ params }) => this.api.list(params, { silent: true }),
  });
  protected readonly list = computed<AlertDto[]>(() => (this.alerts.hasValue() ? this.alerts.value()?.content ?? [] : []));
  protected readonly total = computed(() => (this.alerts.hasValue() ? this.alerts.value()?.totalElements ?? 0 : 0));
  protected readonly busy = signal<number | 'all' | null>(null);
  protected readonly announcement = signal('');

  constructor() {
    this.live.alert$.pipe(takeUntilDestroyed()).subscribe(alert => this.insert(alert));
    this.live.reconnected$.pipe(takeUntilDestroyed()).subscribe(() => this.alerts.reload());
  }

  protected setState(change: MatButtonToggleChange): void {
    this.navigate({ state: change.value === 'open' ? 'open' : null, page: null });
  }

  protected setPage(event: PageEvent): void {
    this.navigate({ page: event.pageIndex > 0 ? event.pageIndex + 1 : null });
  }

  protected ack(alert: AlertDto): void {
    this.busy.set(alert.id);
    this.store.ack(alert.id).subscribe({
      next: updated => {
        this.busy.set(null);
        this.announcement.set(this.i18n.t('alerts.ackDone', { name: alert.ruleName }));
        if (this.state() === 'open') {
          this.alerts.update(page => page && {
            ...page,
            content: page.content.filter(item => item.id !== alert.id),
            totalElements: Math.max(0, page.totalElements - 1),
          });
          if (this.list().length === 0 && this.total() > 0) {
            this.alerts.reload();
          }
        } else {
          this.alerts.update(page => page && {
            ...page,
            content: page.content.map(item => (item.id === updated.id ? updated : item)),
          });
        }
      },
      error: () => this.busy.set(null),
    });
  }

  protected async ackAll(): Promise<void> {
    const count = this.store.count();
    const confirmed = await this.dialogs.confirm({
      title: this.i18n.t('alerts.ackAllTitle'),
      message: this.i18n.t('alerts.ackAllText', { count }),
      confirmLabel: this.i18n.t('alerts.ackAll'),
    });
    if (!confirmed) {
      return;
    }
    this.busy.set('all');
    this.store.ackAll().subscribe({
      next: result => {
        this.busy.set(null);
        this.notifier.info(this.i18n.t('alerts.ackAllDone', { count: result.acknowledged }));
        this.alerts.reload();
      },
      error: () => this.busy.set(null),
    });
  }

  private insert(alert: AlertDto): void {
    if (this.page() !== 0 || !this.alerts.hasValue() || this.list().some(item => item.id === alert.id)) {
      return;
    }
    this.alerts.update(page => page && {
      ...page,
      content: [alert, ...page.content].slice(0, ALERTS_PAGE_SIZE),
      totalElements: page.totalElements + 1,
    });
    this.announcement.set(this.i18n.t('alerts.newAlert', { message: alert.message }));
  }

  private navigate(queryParams: Record<string, string | number | null>): void {
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
