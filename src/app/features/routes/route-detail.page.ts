import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, numberAttribute, signal, viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, concat, filter, merge, switchMap, tap } from 'rxjs';
import { MarkerDto, MeasurementDto, RouteDto, RoutesApi } from '../../core/api';
import { AuthService } from '../../core/auth/auth.service';
import { ExportFormat, exportRoute } from '../../core/export/export';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LiveService } from '../../core/live/live.service';
import { Notifier } from '../../core/notify/notifier';
import { DoseFormat } from '../../core/units/dose-format';
import { dateFormat } from '../../core/units/format-utils';
import { PageTitle } from '../../layout/page-title';
import { Dialogs } from '../../shared/dialogs/dialogs.service';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { RouteEditDialog } from './route-edit-dialog';
import { RouteShareDialog, RouteShareDialogData } from './route-share-dialog';
import { MarkerRequest, RouteView, SamplesState } from './route-view/route-view';

type RouteState = 'loading' | 'ready' | 'notFound' | 'error';

const optionalNumber = (value: unknown): number | null =>
  value === null || value === undefined || value === '' ? null : numberAttribute(value, NaN) || null;

/** Inserts a live sample in time order (normally at the end), ignoring samples already present. */
function withSample(list: readonly MeasurementDto[], m: MeasurementDto): readonly MeasurementDto[] {
  const last = list[list.length - 1];
  if (!last || m.timestamp > last.timestamp || (m.timestamp === last.timestamp && m.seq > last.seq)) {
    return last?.id === m.id ? list : [...list, m];
  }
  if (list.some(existing => existing.id === m.id)) {
    return list;
  }
  return [...list, m].sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.seq - b.seq);
}

/** `/routes/:id` – the route view with live updates, export and admin actions. */
@Component({
  selector: 'app-route-detail-page',
  imports: [
    EmptyState, MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule, MatTooltipModule,
    RouteView, RouterLink, Skeleton, TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './route-detail.page.html',
  styleUrl: './route-detail.page.scss',
})
export class RouteDetailPage {
  private readonly api = inject(RoutesApi);
  private readonly live = inject(LiveService);
  private readonly i18n = inject(I18nService);
  private readonly notifier = inject(Notifier);
  private readonly dialogs = inject(Dialogs);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly pageTitle = inject(PageTitle);
  private readonly dose = inject(DoseFormat);
  protected readonly auth = inject(AuthService);

  /** Route id from the URL (`/routes/:id`). */
  readonly id = input.required({ transform: numberAttribute });
  /** `?marker=<id>` (command palette): focus this marker. */
  readonly marker = input<number | null, unknown>(null, { transform: optionalNumber });

  private readonly view = viewChild(RouteView);

  protected readonly route = signal<RouteDto | null>(null);
  protected readonly routeState = signal<RouteState>('loading');
  protected readonly routeError = signal('');
  protected readonly measurements = signal<readonly MeasurementDto[]>([]);
  protected readonly samplesState = signal<SamplesState>('loading');
  protected readonly markers = signal<readonly MarkerDto[]>([]);
  private readonly reloads = signal(0);

  protected readonly isLive = computed(() => this.route()?.active ?? false);
  protected readonly lastSample = computed(() => {
    const list = this.measurements();
    return list[list.length - 1] ?? null;
  });

  constructor() {
    effect(() => this.pageTitle.set(this.route()?.name ?? null));

    toObservable(computed(() => ({ id: this.id(), reload: this.reloads() }))).pipe(
      switchMap(({ id }) => this.load(id)),
      takeUntilDestroyed(),
    ).subscribe();

    // live samples while the route is being recorded (after the initial samples are in)
    const liveRouteId = computed(() => this.isLive() && this.samplesState() === 'ready' ? this.id() : null);
    toObservable(liveRouteId).pipe(
      switchMap(id => {
        if (id === null) {
          return EMPTY;
        }
        const after = this.lastSample()?.timestamp;
        // samples stored between the initial load and the subscription
        const gap$ = after
          ? this.api.measurements(id, after, { silent: true }).pipe(switchMap(list => list), catchError(() => EMPTY))
          : EMPTY;
        return concat(gap$, this.live.routeMeasurements(id, () => this.lastSample()?.timestamp ?? null));
      }),
      takeUntilDestroyed(),
    ).subscribe(m => this.appendSample(m));

    // recomputed statistics, activity changes (preview and share token are not part of the event)
    this.live.route$.pipe(
      filter(event => event.id === this.id()),
      takeUntilDestroyed(),
    ).subscribe(event => this.route.update(current => current
      ? { ...event, preview: current.preview, shareToken: event.shareToken ?? current.shareToken }
      : current));
  }

  protected reload(): void {
    this.reloads.update(n => n + 1);
  }

  private load(id: number) {
    this.routeState.set('loading');
    this.samplesState.set('loading');
    this.route.set(null);
    this.measurements.set([]);
    this.markers.set([]);
    const route$ = this.api.get(id, { silent: true }).pipe(
      tap(route => {
        this.route.set(route);
        this.routeState.set('ready');
      }),
      catchError((error: unknown) => {
        const notFound = error instanceof HttpErrorResponse && (error.status === 404 || error.status === 400);
        this.routeState.set(notFound ? 'notFound' : 'error');
        this.routeError.set(this.notifier.describe(error));
        return EMPTY;
      }),
    );
    const samples$ = this.api.measurements(id, undefined, { silent: true }).pipe(
      tap(list => {
        this.measurements.set(list);
        this.samplesState.set('ready');
      }),
      catchError(() => {
        this.samplesState.set('error');
        return EMPTY;
      }),
    );
    const markers$ = this.api.markers(id, { silent: true }).pipe(
      tap(list => this.markers.set(list)),
      catchError(() => EMPTY),
    );
    return merge(route$, samples$, markers$);
  }

  private appendSample(m: MeasurementDto): void {
    const before = this.measurements();
    const next = withSample(before, m);
    if (next !== before) {
      this.measurements.set(next);
    }
  }

  // ---------------------------------------------------------------- export

  protected export(format: ExportFormat): void {
    const route = this.route();
    if (route) {
      exportRoute(format, { route, measurements: this.measurements(), markers: this.markers() });
    }
  }

  // ---------------------------------------------------------------- admin

  protected edit(): void {
    const route = this.route();
    if (!route) {
      return;
    }
    this.dialog.open<RouteEditDialog, RouteDto, RouteDto>(RouteEditDialog, {
      data: route,
      maxWidth: 'min(600px, calc(100vw - 32px))',
    }).afterClosed().subscribe(updated => {
      if (updated) {
        this.route.update(current => current ? { ...current, name: updated.name, description: updated.description } : current);
      }
    });
  }

  protected share(): void {
    const route = this.route();
    if (!route) {
      return;
    }
    this.dialog.open<RouteShareDialog, RouteShareDialogData>(RouteShareDialog, {
      data: { route, onChange: shareToken => this.route.update(current => current ? { ...current, shareToken } : current) },
      maxWidth: 'min(600px, calc(100vw - 32px))',
    });
  }

  protected async deleteRoute(): Promise<void> {
    const route = this.route();
    if (!route) {
      return;
    }
    const confirmed = await this.dialogs.confirm({
      title: this.i18n.t('routes.delete.title'),
      message: this.i18n.t('routes.delete.message', { name: route.name, count: route.sampleCount }),
      confirmLabel: this.i18n.t('routes.delete.confirm'),
      destructive: true,
    });
    if (confirmed) {
      this.api.delete(route.id).subscribe(() => {
        this.notifier.info(this.i18n.t('routes.delete.done'));
        void this.router.navigateByUrl('/routes');
      });
    }
  }

  protected async addMarker(request: MarkerRequest): Promise<void> {
    const label = await this.dialogs.prompt({
      title: this.i18n.t('routes.detail.addMarkerTitle'),
      label: this.i18n.t('routes.detail.markerLabel'),
      maxLength: 200,
      confirmLabel: this.i18n.t('common.actions.add'),
    });
    if (!label) {
      return;
    }
    this.api.addMarker(this.id(), { ...request, label }).subscribe(marker => {
      this.markers.update(list => [...list, marker].sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
      this.notifier.info(this.i18n.t('routes.detail.markerAdded'));
    });
  }

  protected async deleteMarker(marker: MarkerDto): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: this.i18n.t('routes.detail.deleteMarkerTitle'),
      message: marker.label,
      confirmLabel: this.i18n.t('common.actions.delete'),
      destructive: true,
    });
    if (confirmed) {
      this.api.deleteMarker(this.id(), marker.id).subscribe(() => {
        this.markers.update(list => list.filter(m => m.id !== marker.id));
        this.notifier.info(this.i18n.t('routes.detail.markerDeleted'));
      });
    }
  }

  protected async deleteSample(m: MeasurementDto): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: this.i18n.t('routes.detail.deleteSampleTitle'),
      message: this.i18n.t('routes.detail.deleteSampleMessage', {
        time: dateFormat(this.i18n.locale(), 'datetimeSeconds').format(Date.parse(m.timestamp)),
        value: this.dose.format(m.usvPerHour),
      }),
      confirmLabel: this.i18n.t('common.actions.delete'),
      destructive: true,
    });
    if (confirmed) {
      this.api.deleteMeasurement(this.id(), m.id).subscribe(() => {
        this.view()?.clearSelection();
        this.measurements.update(list => list.filter(item => item.id !== m.id));
        this.notifier.info(this.i18n.t('routes.detail.sampleDeleted'));
      });
    }
  }
}
