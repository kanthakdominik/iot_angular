import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { debounceTime, merge } from 'rxjs';
import { AlertDto } from '../../core/api/alerts.models';
import { EventsApi } from '../../core/api/events.api';
import { EventDto } from '../../core/api/events.models';
import { StatsApi } from '../../core/api/stats.api';
import { OpenAlertsStore } from '../../core/alerts/open-alerts.store';
import { AuthService } from '../../core/auth/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LiveService } from '../../core/live/live.service';
import { DateTimePipe } from '../../core/units/date-time.pipe';
import { DistancePipe } from '../../core/units/distance.pipe';
import { DosePipe } from '../../core/units/dose.pipe';
import { DoseScale } from '../../core/units/dose-scale';
import { DurationPipe } from '../../core/units/duration.pipe';
import { NumberPipe } from '../../core/units/number.pipe';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { PageHeader } from '../../shared/page-header/page-header';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { Sparkline } from '../../shared/sparkline/sparkline';
import { StatTile } from '../../shared/stat-tile/stat-tile';
import { TrackThumbnail } from '../../shared/track-thumbnail/track-thumbnail';
import { AlertItem } from '../alerts/alert-item';
import { DeviceCard } from '../devices/device-card';
import { LiveDevices } from '../devices/live-devices';
import { EventItem } from '../events/event-item';
import { ActivityCalendar, localDateKey } from './activity-calendar';

const RECENT_EVENTS = 8;

/**
 * Start page: live device cards (the dose readout is the hero), totals, the latest route, a year of activity,
 * open alerts and recent events. A fresh installation without devices and routes shows how to connect a device.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [
    ActivityCalendar, AlertItem, DateTimePipe, DeviceCard, DistancePipe, DosePipe, DurationPipe, EmptyState, EventItem,
    MatButtonModule, MatCardModule, MatIconModule, NumberPipe, PageHeader, RouterLink, Skeleton, Sparkline, StatTile,
    TrackThumbnail, TranslatePipe,
  ],
  providers: [LiveDevices],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  private readonly statsApi = inject(StatsApi);
  private readonly eventsApi = inject(EventsApi);
  private readonly live = inject(LiveService);
  protected readonly auth = inject(AuthService);
  protected readonly devices = inject(LiveDevices);
  protected readonly alerts = inject(OpenAlertsStore);

  protected readonly summary = rxResource({
    stream: () => this.statsApi.summary({ silent: true }),
  });

  protected readonly activity = rxResource({
    stream: () => {
      const today = new Date();
      const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 364);
      return this.statsApi.activity({ from: localDateKey(from), to: localDateKey(today) }, { silent: true });
    },
  });

  protected readonly events = rxResource({
    stream: () => this.eventsApi.list({ page: 0, size: RECENT_EVENTS }, { silent: true }),
  });
  protected readonly recentEvents = computed<EventDto[]>(() =>
    this.events.hasValue() ? this.events.value()?.content ?? [] : []);

  protected readonly ackBusy = signal<number | null>(null);

  protected readonly stats = computed(() => (this.summary.hasValue() ? this.summary.value() ?? null : null));
  protected readonly maxColor = computed(() => {
    const max = this.stats()?.maxUsv;
    return max ? DoseScale.color(max.value) : null;
  });
  protected readonly lastRoute = computed(() => this.stats()?.lastRoute ?? null);
  /** Nothing recorded yet and no device has ever reported. */
  protected readonly welcome = computed(() =>
    this.devices.devices()?.length === 0 && this.stats()?.routeCount === 0);
  protected readonly activityDays = computed(() => (this.activity.hasValue() ? this.activity.value() ?? [] : []));

  constructor() {
    this.alerts.loadRecent();
    // new routes and recomputed statistics change the totals; batch bursts of updates
    merge(this.live.route$, this.live.reconnected$)
      .pipe(debounceTime(3000), takeUntilDestroyed())
      .subscribe(() => {
        this.summary.reload();
        this.activity.reload();
      });
    this.live.reconnected$.pipe(takeUntilDestroyed()).subscribe(() => this.events.reload());
    this.live.event$.pipe(takeUntilDestroyed()).subscribe(event => {
      if (this.events.hasValue()) {
        this.events.update(page => page && !page.content.some(item => item.id === event.id)
          ? { ...page, content: [event, ...page.content].slice(0, RECENT_EVENTS), totalElements: page.totalElements + 1 }
          : page);
      }
    });
  }

  protected ack(alert: AlertDto): void {
    this.ackBusy.set(alert.id);
    this.alerts.ack(alert.id).subscribe({
      next: () => this.ackBusy.set(null),
      error: () => this.ackBusy.set(null),
    });
  }
}
