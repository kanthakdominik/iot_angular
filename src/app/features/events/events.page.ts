import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipListboxChange, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { DevicesApi } from '../../core/api/devices.api';
import { EventsApi } from '../../core/api/events.api';
import { EVENT_TYPES, EventDto, EventType } from '../../core/api/events.models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LiveService } from '../../core/live/live.service';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { PageHeader } from '../../shared/page-header/page-header';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { deviceLabel } from '../devices/device-meta';
import { EventItem } from './event-item';
import { EVENT_ICONS, EVENT_TYPE_KEYS } from './event-meta';

const PAGE_SIZE = 25;

function isEventType(value: string | undefined): value is EventType {
  return value !== undefined && (EVENT_TYPES as readonly string[]).includes(value);
}

/**
 * `/events`: the activity log, newest first. Filters by device and type and the page live in the URL
 * (`?deviceId=…&type=…&page=2`); new SSE events are prepended on the first page when they match the filters.
 */
@Component({
  selector: 'app-events-page',
  imports: [
    EmptyState, EventItem, MatButtonModule, MatCardModule, MatChipsModule, MatFormFieldModule, MatIconModule,
    MatPaginatorModule, MatSelectModule, PageHeader, Skeleton, TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './events.page.html',
  styleUrl: './events.page.scss',
})
export class EventsPage {
  private readonly api = inject(EventsApi);
  private readonly devicesApi = inject(DevicesApi);
  private readonly live = inject(LiveService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  /** `?deviceId=` */
  readonly deviceId = input<string>();
  /** `?type=` (one of EVENT_TYPES) */
  readonly type = input<string>();
  /** `?page=` (1-based) */
  readonly page = input<string>();

  protected readonly types = EVENT_TYPES;
  protected readonly typeKeys = EVENT_TYPE_KEYS;
  protected readonly icons = EVENT_ICONS;
  protected readonly pageSize = PAGE_SIZE;

  protected readonly selectedType = computed<EventType | null>(() => {
    const type = this.type();
    return isEventType(type) ? type : null;
  });
  protected readonly selectedDevice = computed(() => this.deviceId() || null);
  protected readonly pageIndex = computed(() => {
    const page = Number(this.page());
    return Number.isInteger(page) && page > 1 ? page - 1 : 0;
  });
  protected readonly filtered = computed(() => this.selectedType() !== null || this.selectedDevice() !== null);

  protected readonly events = rxResource({
    params: () => ({
      deviceId: this.selectedDevice() ?? undefined,
      type: this.selectedType() ?? undefined,
      page: this.pageIndex(),
      size: PAGE_SIZE,
    }),
    stream: ({ params }) => this.api.list(params, { silent: true }),
  });
  private readonly devices = rxResource({ stream: () => this.devicesApi.list({ silent: true }) });

  protected readonly list = computed<EventDto[]>(() => (this.events.hasValue() ? this.events.value()?.content ?? [] : []));
  protected readonly total = computed(() => (this.events.hasValue() ? this.events.value()?.totalElements ?? 0 : 0));
  protected readonly deviceOptions = computed(() => {
    const devices = (this.devices.hasValue() ? this.devices.value() ?? [] : [])
      .map(device => ({ id: device.id, label: deviceLabel(device) }));
    const selected = this.selectedDevice();
    if (selected && !devices.some(device => device.id === selected)) {
      devices.push({ id: selected, label: selected });
    }
    return devices.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  });
  protected readonly announcement = signal('');

  constructor() {
    this.live.event$.pipe(takeUntilDestroyed()).subscribe(event => this.prepend(event));
    this.live.reconnected$.pipe(takeUntilDestroyed()).subscribe(() => this.events.reload());
  }

  protected selectDevice(change: MatSelectChange): void {
    this.navigate({ deviceId: (change.value as string | null) || null, page: null });
  }

  protected selectType(change: MatChipListboxChange): void {
    const value = (change.value as string | null | undefined) ?? undefined;
    this.navigate({ type: isEventType(value) ? value : null, page: null });
  }

  protected setPage(event: PageEvent): void {
    this.navigate({ page: event.pageIndex > 0 ? event.pageIndex + 1 : null });
  }

  protected clearFilters(): void {
    this.navigate({ deviceId: null, type: null, page: null });
  }

  private prepend(event: EventDto): void {
    const device = this.selectedDevice();
    const type = this.selectedType();
    if (this.pageIndex() !== 0 || !this.events.hasValue()
      || (device !== null && event.deviceId !== device) || (type !== null && event.type !== type)
      || this.list().some(item => item.id === event.id)) {
      return;
    }
    this.events.update(page => page && {
      ...page,
      content: [event, ...page.content].slice(0, PAGE_SIZE),
      totalElements: page.totalElements + 1,
    });
    this.announcement.set(this.i18n.t('events.newEvent', {
      type: this.i18n.t(EVENT_TYPE_KEYS[event.type]),
      message: event.message,
    }));
  }

  private navigate(queryParams: Record<string, string | number | null>): void {
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
