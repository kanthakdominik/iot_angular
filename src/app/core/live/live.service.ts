import { DOCUMENT, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, Observable, Subject, catchError, defer, distinct, filter, from, map, merge, mergeMap, switchMap } from 'rxjs';
import { AlertDto } from '../api/alerts.models';
import { AuthApi } from '../api/auth.api';
import { DeviceDto } from '../api/devices.models';
import { EventDto } from '../api/events.models';
import { API_URL, IsoInstant } from '../api/http';
import { RoutesApi } from '../api/routes.api';
import { MeasurementDto, MeasurementEvent, RouteDto } from '../api/routes.models';
import { AuthService } from '../auth/auth.service';

export type LiveStatus = 'connecting' | 'live' | 'offline';

/** Payloads of the SSE events of `/api/stream` (V2.1-SPEC §3.6). */
export interface LiveEvents {
  /** A stored live sample (SD-card imports are not streamed). */
  readonly measurement: MeasurementEvent;
  /** New route or recomputed statistics; `preview` is always null here. */
  readonly route: RouteDto;
  readonly device: DeviceDto;
  /** New alert (acknowledging emits nothing). */
  readonly alert: AlertDto;
  readonly event: EventDto;
}

type LiveEventName = keyof LiveEvents;

const EVENT_NAMES: readonly LiveEventName[] = ['measurement', 'route', 'device', 'alert', 'event'];
const MAX_RETRY_MS = 30_000;
/** After this many failed attempts in a row the session is checked (the stream cannot report 401 itself). */
const SESSION_CHECK_AFTER = 3;

/**
 * One EventSource to `/api/stream`, open while a user is logged in. Reconnects with exponential back-off
 * (1 s … 30 s), immediately when the browser comes back online or the tab becomes visible again.
 */
@Injectable({ providedIn: 'root' })
export class LiveService {
  // ngsw-bypass: the Angular service worker must not proxy the long-lived event stream
  private readonly url = `${inject(API_URL)}/stream?ngsw-bypass=true`;
  private readonly auth = inject(AuthService);
  private readonly authApi = inject(AuthApi);
  private readonly routesApi = inject(RoutesApi);

  private source: EventSource | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private failures = 0;
  private everConnected = false;

  private readonly currentStatus = signal<LiveStatus>('offline');
  /** 'connecting' | 'live' | 'offline' – shown as the dot in the top bar. */
  readonly status = this.currentStatus.asReadonly();

  private readonly subjects: { readonly [K in LiveEventName]: Subject<LiveEvents[K]> } = {
    measurement: new Subject<MeasurementEvent>(),
    route: new Subject<RouteDto>(),
    device: new Subject<DeviceDto>(),
    alert: new Subject<AlertDto>(),
    event: new Subject<EventDto>(),
  };
  private readonly reconnectedSubject = new Subject<void>();

  readonly measurement$: Observable<MeasurementEvent> = this.subjects.measurement.asObservable();
  readonly route$: Observable<RouteDto> = this.subjects.route.asObservable();
  readonly device$: Observable<DeviceDto> = this.subjects.device.asObservable();
  readonly alert$: Observable<AlertDto> = this.subjects.alert.asObservable();
  readonly event$: Observable<EventDto> = this.subjects.event.asObservable();
  /** Emits when the stream is open again after a disconnect – reload or catch up data that may have been missed. */
  readonly reconnected$: Observable<void> = this.reconnectedSubject.asObservable();

  constructor() {
    effect(() => {
      const loggedIn = this.auth.isLoggedIn();
      untracked(() => (loggedIn ? this.connect() : this.disconnect()));
    });
    const document = inject(DOCUMENT);
    const reconnectNow = () => {
      if (this.auth.isLoggedIn() && this.currentStatus() === 'offline') {
        this.connect();
      }
    };
    window.addEventListener('online', reconnectNow);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        reconnectNow();
      }
    });
  }

  /** Typed access by event name. */
  on<K extends LiveEventName>(name: K): Observable<LiveEvents[K]> {
    return this.subjects[name].asObservable();
  }

  /**
   * Live samples of one route. With `lastTimestamp` (timestamp of the newest sample the caller has) missed samples
   * are fetched with `?after=` after every reconnect. Each subscription emits a sample id at most once.
   */
  routeMeasurements(routeId: number, lastTimestamp?: () => IsoInstant | null): Observable<MeasurementDto> {
    return defer(() => {
      const live$ = this.measurement$.pipe(
        filter(event => event.routeId === routeId),
        map(event => event.measurement),
      );
      const catchUp$ = !lastTimestamp ? EMPTY : this.reconnected$.pipe(
        switchMap(() => {
          const after = lastTimestamp();
          return after
            ? this.routesApi.measurements(routeId, after, { silent: true }).pipe(catchError(() => EMPTY))
            : EMPTY;
        }),
        mergeMap(list => from(list)),
      );
      return merge(live$, catchUp$).pipe(distinct(m => m.id));
    });
  }

  private connect(): void {
    this.clearRetry();
    this.closeSource();
    this.currentStatus.set('connecting');

    const source = new EventSource(this.url);
    this.source = source;
    source.onopen = () => {
      const reconnect = this.everConnected;
      this.everConnected = true;
      this.failures = 0;
      this.currentStatus.set('live');
      if (reconnect) {
        this.reconnectedSubject.next();
      }
    };
    source.onerror = () => {
      if (this.source !== source) {
        return;
      }
      // handle reconnection ourselves (back-off, session check) instead of the browser's fixed retry
      this.closeSource();
      this.currentStatus.set('offline');
      this.scheduleRetry();
    };
    for (const name of EVENT_NAMES) {
      source.addEventListener(name, event => this.dispatch(name, event as MessageEvent<string>));
    }
  }

  private disconnect(): void {
    this.clearRetry();
    this.closeSource();
    this.failures = 0;
    this.everConnected = false;
    this.currentStatus.set('offline');
  }

  private scheduleRetry(): void {
    this.failures++;
    if (this.failures === SESSION_CHECK_AFTER) {
      this.authApi.me({ silent: true }).subscribe({
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 401) {
            this.auth.sessionExpired();
          }
        },
      });
    }
    const delay = Math.min(MAX_RETRY_MS, 1000 * 2 ** (this.failures - 1)) + Math.random() * 500;
    this.retryTimer = setTimeout(() => {
      if (this.auth.isLoggedIn()) {
        this.connect();
      }
    }, delay);
  }

  private dispatch<K extends LiveEventName>(name: K, event: MessageEvent<string>): void {
    let payload: LiveEvents[K];
    try {
      payload = JSON.parse(event.data) as LiveEvents[K];
    } catch {
      console.warn(`Invalid SSE payload for "${name}"`, event.data);
      return;
    }
    this.subjects[name].next(payload);
  }

  private closeSource(): void {
    this.source?.close();
    this.source = null;
  }

  private clearRetry(): void {
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
  }
}
