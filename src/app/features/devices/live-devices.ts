import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DevicesApi } from '../../core/api/devices.api';
import { DeviceDto } from '../../core/api/devices.models';
import { IsoInstant } from '../../core/api/http';
import { RoutesApi } from '../../core/api/routes.api';
import { LiveService } from '../../core/live/live.service';
import { compareDevices } from './device-meta';

/** The newest dose rate reading of a device. */
export interface DeviceReading {
  readonly usv: number;
  readonly ts: IsoInstant;
  readonly routeId: number;
}

/** How far back the initial reading of an online device is looked up. */
const INITIAL_READING_WINDOW_MS = 10 * 60_000;

/**
 * Device list kept current by SSE: `device` events replace devices by id (new devices are added), `measurement`
 * events update the newest reading per device; reloads after a reconnect. Provide it in the component that shows
 * the list (`providers: [LiveDevices]`) – it lives as long as that component.
 */
@Injectable()
export class LiveDevices {
  private readonly api = inject(DevicesApi);
  private readonly routesApi = inject(RoutesApi);
  private readonly live = inject(LiveService);

  private readonly list = signal<DeviceDto[] | null>(null);
  private readonly readingMap = signal<ReadonlyMap<string, DeviceReading>>(new Map());
  private readonly loadingState = signal(true);
  private readonly errorState = signal<unknown>(null);

  /** Online first, then by name; null until the first load finished. */
  readonly devices = computed(() => {
    const list = this.list();
    return list ? [...list].sort(compareDevices) : null;
  });
  readonly readings = this.readingMap.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly onlineCount = computed(() => this.list()?.filter(device => device.online).length ?? 0);

  constructor() {
    this.load();
    this.live.device$.pipe(takeUntilDestroyed()).subscribe(device => this.upsert(device));
    this.live.measurement$.pipe(takeUntilDestroyed()).subscribe(event => this.setReading(event.deviceId, {
      usv: event.measurement.usvPerHour,
      ts: event.measurement.timestamp,
      routeId: event.routeId,
    }));
    this.live.reconnected$.pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

  /** (Re)loads the list; keeps the current one visible while loading. */
  load(): void {
    this.loadingState.set(true);
    this.api.list({ silent: true }).subscribe({
      next: devices => {
        this.list.set(devices);
        this.errorState.set(null);
        this.loadingState.set(false);
        this.loadInitialReadings(devices);
      },
      error: (error: unknown) => {
        this.errorState.set(error);
        this.loadingState.set(false);
      },
    });
  }

  /** Inserts or replaces a device (SSE update, rename). */
  upsert(device: DeviceDto): void {
    this.list.update(list => {
      if (!list) {
        return list;
      }
      const index = list.findIndex(item => item.id === device.id);
      return index < 0 ? [...list, device] : list.map((item, i) => (i === index ? device : item));
    });
  }

  reading(deviceId: string): DeviceReading | undefined {
    return this.readingMap().get(deviceId);
  }

  private setReading(deviceId: string, reading: DeviceReading): void {
    const current = this.readingMap().get(deviceId);
    if (current && Date.parse(current.ts) > Date.parse(reading.ts)) {
      return;
    }
    this.readingMap.update(map => new Map(map).set(deviceId, reading));
  }

  /** Online devices recording a route: the newest sample of the last minutes, until live samples arrive. */
  private loadInitialReadings(devices: readonly DeviceDto[]): void {
    const after = new Date(Date.now() - INITIAL_READING_WINDOW_MS);
    for (const device of devices) {
      const routeId = device.currentRouteId;
      if (!device.online || routeId === null || this.readingMap().has(device.id)) {
        continue;
      }
      this.routesApi.measurements(routeId, after, { silent: true }).subscribe({
        next: list => {
          const last = list.at(-1);
          if (last) {
            this.setReading(device.id, { usv: last.usvPerHour, ts: last.timestamp, routeId });
          }
        },
        error: () => undefined,
      });
    }
  }
}
