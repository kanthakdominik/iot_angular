import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { debounceTime, filter } from 'rxjs';
import { DevicesApi } from '../../core/api/devices.api';
import { DeviceCommand, DeviceDto } from '../../core/api/devices.models';
import { EventsApi } from '../../core/api/events.api';
import { RoutesApi } from '../../core/api/routes.api';
import { AuthService } from '../../core/auth/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LiveService } from '../../core/live/live.service';
import { CsqPipe } from '../../core/units/csq.pipe';
import { DateTimePipe } from '../../core/units/date-time.pipe';
import { DistancePipe } from '../../core/units/distance.pipe';
import { DosePipe } from '../../core/units/dose.pipe';
import { csqIcon } from '../../core/units/format-utils';
import { NumberPipe } from '../../core/units/number.pipe';
import { RelativeTimePipe } from '../../core/units/relative-time.pipe';
import { PageTitle } from '../../layout/page-title';
import { DoseReadout } from '../../shared/dose-readout/dose-readout';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { TrackThumbnail } from '../../shared/track-thumbnail/track-thumbnail';
import { EventItem } from '../events/event-item';
import { DeviceActions } from './device-actions';
import { DeviceHealth } from './device-health';
import { batteryIcon, deviceLabel, isLowBattery } from './device-meta';
import { DeviceReading } from './live-devices';

const ROUTES_SIZE = 6;
const EVENTS_SIZE = 10;
const INITIAL_READING_WINDOW_MS = 10 * 60_000;

/**
 * `/devices/:id`: status and live dose reading, admin actions (rename, new route, battery report, SD import),
 * device information, battery / signal history, the device's routes and its event log. Kept current by SSE.
 */
@Component({
  selector: 'app-device-detail-page',
  imports: [
    CsqPipe, DateTimePipe, DeviceHealth, DistancePipe, DosePipe, DoseReadout, EmptyState, EventItem, MatButtonModule,
    MatCardModule, MatIconModule, MatMenuModule, MatPaginatorModule, MatTooltipModule, NumberPipe, RelativeTimePipe,
    RouterLink, Skeleton, TrackThumbnail, TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './device-detail.page.html',
  styleUrl: './device-detail.page.scss',
})
export class DeviceDetailPage {
  private readonly api = inject(DevicesApi);
  private readonly routesApi = inject(RoutesApi);
  private readonly eventsApi = inject(EventsApi);
  private readonly live = inject(LiveService);
  private readonly actions = inject(DeviceActions);
  private readonly pageTitle = inject(PageTitle);
  protected readonly auth = inject(AuthService);

  /** Device id from the URL (`/devices/:id`). */
  readonly id = input.required<string>();

  protected readonly device = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.get(params, { silent: true }),
  });
  protected readonly routes = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.routesApi.list({ deviceId: params, page: 0, size: ROUTES_SIZE }, { silent: true }),
  });
  protected readonly eventsPage = signal(0);
  protected readonly events = rxResource({
    params: () => ({ deviceId: this.id(), page: this.eventsPage() }),
    stream: ({ params }) => this.eventsApi.list({ ...params, size: EVENTS_SIZE }, { silent: true }),
  });

  protected readonly eventsSize = EVENTS_SIZE;
  protected readonly reading = signal<DeviceReading | null>(null);
  protected readonly busy = signal<DeviceCommand | 'import' | null>(null);
  protected readonly healthRefresh = signal(0);

  protected readonly current = computed(() => (this.device.hasValue() ? this.device.value() ?? null : null));
  protected readonly name = computed(() => {
    const device = this.current();
    return device ? deviceLabel(device) : '';
  });
  protected readonly notFound = computed(() => {
    const error = this.device.error();
    return error instanceof HttpErrorResponse && error.status === 404;
  });
  protected readonly batteryIcon = computed(() => batteryIcon(this.current()?.batteryPct));
  protected readonly lowBattery = computed(() => isLowBattery(this.current()?.batteryPct));
  protected readonly signalIcon = computed(() => csqIcon(this.current()?.signalCsq));
  protected readonly routeList = computed(() => (this.routes.hasValue() ? this.routes.value()?.content ?? [] : []));
  protected readonly routeTotal = computed(() => (this.routes.hasValue() ? this.routes.value()?.totalElements ?? 0 : 0));
  protected readonly eventList = computed(() => (this.events.hasValue() ? this.events.value()?.content ?? [] : []));
  protected readonly eventTotal = computed(() => (this.events.hasValue() ? this.events.value()?.totalElements ?? 0 : 0));
  /** The live reading, while it belongs to the route being recorded. */
  protected readonly liveReading = computed(() => {
    const reading = this.reading();
    const device = this.current();
    return reading && device?.online && (device.currentRouteId === null || reading.routeId === device.currentRouteId)
      ? reading : null;
  });

  private readingLookup = '';

  constructor() {
    effect(() => this.pageTitle.set(this.name() || null));

    // a new device page starts on the first page of events, without the previous device's reading
    effect(() => {
      this.id();
      untracked(() => {
        this.eventsPage.set(0);
        this.reading.set(null);
      });
    });

    // initial reading of an online device: the newest sample of the last minutes
    effect(() => {
      const device = this.current();
      if (!device?.online || device.currentRouteId === null) {
        return;
      }
      const key = `${device.id}:${device.currentRouteId}`;
      if (key === this.readingLookup) {
        return;
      }
      this.readingLookup = key;
      const routeId = device.currentRouteId;
      untracked(() => this.routesApi.measurements(routeId, new Date(Date.now() - INITIAL_READING_WINDOW_MS),
        { silent: true }).subscribe({
        next: list => {
          const last = list.at(-1);
          if (last && !this.reading()) {
            this.reading.set({ usv: last.usvPerHour, ts: last.timestamp, routeId });
          }
        },
        error: () => undefined,
      }));
    });

    this.live.device$.pipe(filter(device => device.id === this.id()), takeUntilDestroyed())
      .subscribe(device => this.device.set(device));
    this.live.measurement$.pipe(filter(event => event.deviceId === this.id()), takeUntilDestroyed())
      .subscribe(event => this.reading.set({
        usv: event.measurement.usvPerHour,
        ts: event.measurement.timestamp,
        routeId: event.routeId,
      }));
    this.live.event$.pipe(filter(event => event.deviceId === this.id()), takeUntilDestroyed()).subscribe(event => {
      if (this.eventsPage() === 0 && this.events.hasValue()) {
        this.events.update(page => page && !page.content.some(item => item.id === event.id)
          ? { ...page, content: [event, ...page.content].slice(0, EVENTS_SIZE), totalElements: page.totalElements + 1 }
          : page);
      }
      if (event.type === 'BATTERY') {
        this.healthRefresh.update(n => n + 1);
      }
    });
    this.live.route$.pipe(filter(route => route.deviceId === this.id()), debounceTime(3000), takeUntilDestroyed())
      .subscribe(() => this.routes.reload());
    this.live.reconnected$.pipe(takeUntilDestroyed()).subscribe(() => this.reloadAll());
  }

  protected async rename(device: DeviceDto): Promise<void> {
    const updated = await this.actions.rename(device);
    if (updated) {
      this.device.set(updated);
    }
  }

  protected async command(device: DeviceDto, cmd: DeviceCommand): Promise<void> {
    this.busy.set(cmd);
    try {
      await this.actions.command(device, cmd);
    } finally {
      this.busy.set(null);
    }
  }

  protected async importFromSd(device: DeviceDto): Promise<void> {
    this.busy.set('import');
    try {
      if (await this.actions.importFromSd(device)) {
        // SD imports are not streamed – reload what they change
        this.reloadAll();
      }
    } finally {
      this.busy.set(null);
    }
  }

  protected pageEvents(event: PageEvent): void {
    this.eventsPage.set(event.pageIndex);
  }

  private reloadAll(): void {
    this.device.reload();
    this.routes.reload();
    this.events.reload();
    this.healthRefresh.update(n => n + 1);
  }
}
