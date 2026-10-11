import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, signal,
  untracked, viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as L from 'leaflet';
import { EMPTY, Subject, catchError, combineLatest, debounceTime, filter, map, of, startWith, switchMap, tap } from 'rxjs';
import { DevicesApi, Grid, GridCell, GridQuery, MapApi, StatsApi } from '../../core/api';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Notifier } from '../../core/notify/notifier';
import { DoseFormat } from '../../core/units/dose-format';
import { formatDistance } from '../../core/units/distance.pipe';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { AppMap, MapFactory } from '../../shared/map/map-factory';
import { GridLayer, GridMetric } from './grid-layer';

interface Viewport {
  readonly bounds: L.LatLngBounds;
  readonly zoom: number;
}

interface StoredView {
  readonly lat: number;
  readonly lng: number;
  readonly zoom: number;
}

type GridState = 'idle' | 'loading' | 'ready' | 'error';

const VIEW_KEY = 'app.map.view';
const METRIC_KEY = 'app.map.metric';
/** The backend returns at most this many cells (the ones with the most samples). */
const MAX_CELLS = 10_000;

function readSession<T>(key: string): T | null {
  try {
    const value = sessionStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function writeSession(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable – the view is not remembered
  }
}

function isStoredView(value: unknown): value is StoredView {
  const v = value as StoredView | null;
  return !!v && Number.isFinite(v.lat) && Number.isFinite(v.lng) && Number.isFinite(v.zoom);
}

/** `/map` – every measurement aggregated into grid cells for the visible area, filtered by date range and device. */
@Component({
  selector: 'app-global-map-page',
  imports: [
    EmptyState, MatButtonModule, MatButtonToggleModule, MatDatepickerModule, MatFormFieldModule, MatIconModule,
    MatInputModule, MatProgressBarModule, MatSelectModule, MatTooltipModule, ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [provideNativeDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './global-map.page.html',
  styleUrl: './global-map.page.scss',
})
export class GlobalMapPage {
  private readonly mapApi = inject(MapApi);
  private readonly devicesApi = inject(DevicesApi);
  private readonly statsApi = inject(StatsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly maps = inject(MapFactory);
  private readonly i18n = inject(I18nService);
  private readonly dose = inject(DoseFormat);
  private readonly notifier = inject(Notifier);
  private readonly mapElement = viewChild.required<ElementRef<HTMLElement>>('map');

  protected readonly metric = signal<GridMetric>(readSession<GridMetric>(METRIC_KEY) === 'max' ? 'max' : 'avg');
  protected readonly device = signal<string>('');
  protected readonly dateRange = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });
  private readonly range = toSignal(
    this.dateRange.valueChanges.pipe(
      filter(({ start, end }) => !start === !end),
      map(({ start, end }) => ({ start: start ?? null, end: end ?? null })),
    ),
    { initialValue: { start: null, end: null } as { start: Date | null; end: Date | null } },
  );
  protected readonly hasFilters = computed(() => !!this.device() || !!this.range().start);

  protected readonly devices = toSignal(
    this.devicesApi.list({ silent: true }).pipe(catchError(() => of([]))),
    { initialValue: [] },
  );

  protected readonly grid = signal<Grid | null>(null);
  protected readonly state = signal<GridState>('idle');
  protected readonly errorText = signal('');
  protected readonly cellCount = computed(() => this.grid()?.cells.length ?? 0);
  protected readonly truncated = computed(() => this.cellCount() >= MAX_CELLS);
  protected readonly empty = computed(() => this.state() === 'ready' && this.cellCount() === 0);
  /** Approximate cell edge length, e.g. "≈ 610 m". */
  protected readonly cellSize = computed(() => {
    const grid = this.grid();
    const center = this.center();
    if (!grid || !center) {
      return null;
    }
    const metres = grid.cellDeg * 111_320 * Math.cos((center.lat * Math.PI) / 180);
    return formatDistance(metres, this.i18n.locale());
  });

  private readonly viewport$ = new Subject<Viewport>();
  private readonly retry$ = new Subject<void>();
  private readonly center = signal<L.LatLng | null>(null);
  private appMap?: AppMap;
  private readonly layer = new GridLayer();
  private tooltip?: L.Tooltip;

  constructor() {
    afterNextRender(() => this.createMap());
    this.destroyRef.onDestroy(() => this.appMap?.destroy());

    combineLatest([
      this.viewport$,
      toObservable(this.device),
      toObservable(this.range),
      this.retry$.pipe(startWith(undefined)),
    ]).pipe(
      debounceTime(250),
      map(([viewport, deviceId, range]) => this.query(viewport, deviceId, range.start, range.end)),
      switchMap(query => {
        this.state.set('loading');
        return this.mapApi.grid(query, { silent: true }).pipe(
          tap(grid => {
            this.grid.set(grid);
            this.state.set('ready');
          }),
          catchError((error: unknown) => {
            this.errorText.set(this.notifier.describe(error));
            this.state.set('error');
            return EMPTY;
          }),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe();

    effect(() => {
      const grid = this.grid();
      untracked(() => this.layer.setGrid(grid));
    });
    effect(() => {
      const metric = this.metric();
      untracked(() => {
        this.layer.setMetric(metric);
        writeSession(METRIC_KEY, metric);
      });
    });
    // tooltips are built from the current unit / language
    effect(() => {
      this.dose.unit();
      this.i18n.locale();
      untracked(() => this.tooltip?.close());
    });
  }

  protected retry(): void {
    this.retry$.next();
  }

  protected setMetric(metric: GridMetric): void {
    this.metric.set(metric);
  }

  protected clearFilters(): void {
    this.device.set('');
    this.dateRange.setValue({ start: null, end: null });
  }

  private createMap(): void {
    const stored = readSession<unknown>(VIEW_KEY);
    const appMap = this.maps.create(this.mapElement().nativeElement, {
      legend: 'vertical',
      ...(isStoredView(stored) ? { center: [stored.lat, stored.lng] as L.LatLngTuple, zoom: stored.zoom } : {}),
      mapOptions: { minZoom: 3 },
    });
    this.appMap = appMap;
    const map = appMap.map;
    this.layer.addTo(map);
    this.tooltip = L.tooltip({ direction: 'top', offset: [0, -8], opacity: 1 });

    const emitViewport = () => {
      const center = map.getCenter();
      this.center.set(center);
      writeSession(VIEW_KEY, { lat: center.lat, lng: center.lng, zoom: map.getZoom() });
      this.viewport$.next({ bounds: map.getBounds(), zoom: map.getZoom() });
    };
    map.on('moveend', emitViewport);
    emitViewport();
    if (!isStoredView(stored)) {
      this.fitToLastRoute(map);
    }

    let frame = 0;
    map.on('mousemove', event => {
      const latLng = (event as L.LeafletMouseEvent).latlng;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => this.showCell(latLng, false));
    });
    map.on('mouseout', () => {
      cancelAnimationFrame(frame);
      this.hideCell();
    });
    // touch: tap shows the cell details
    map.on('click', event => this.showCell((event as L.LeafletMouseEvent).latlng, true));
  }

  /** First visit (no remembered view): start where the data is – the area of the most recent route. */
  private fitToLastRoute(map: L.Map): void {
    this.statsApi.summary({ silent: true }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: summary => {
        const track = summary.lastRoute?.preview?.track ?? [];
        if (track.length > 0) {
          map.fitBounds(L.latLngBounds(track.map(([lat, lon]) => [lat, lon] as L.LatLngTuple)),
            { padding: [48, 48], maxZoom: 14 });
        }
      },
      error: () => undefined,
    });
  }

  private showCell(latLng: L.LatLng, sticky: boolean): void {
    const map = this.appMap?.map;
    const tooltip = this.tooltip;
    if (!map || !tooltip) {
      return;
    }
    const cell = this.layer.cellAt(latLng);
    this.layer.highlight(cell);
    if (!cell) {
      if (!sticky) {
        tooltip.close();
      }
      return;
    }
    const bounds = this.layer.cellBounds(cell);
    tooltip
      .setLatLng(L.latLng(bounds.getNorth(), bounds.getCenter().lng))
      .setContent(this.cellContent(cell));
    if (!map.hasLayer(tooltip)) {
      tooltip.addTo(map);
    }
  }

  private hideCell(): void {
    this.layer.highlight(null);
    this.tooltip?.close();
  }

  private cellContent(cell: GridCell): HTMLElement {
    const root = document.createElement('div');
    root.className = 'app-grid-tooltip';
    const rows: [string, string][] = [
      [this.i18n.t('map.grid.avg'), this.dose.format(cell.avgUsv)],
      [this.i18n.t('map.grid.max'), this.dose.format(cell.maxUsv)],
      [this.i18n.t('map.grid.samples'), new Intl.NumberFormat(this.i18n.locale()).format(cell.count)],
    ];
    for (const [label, value] of rows) {
      const row = document.createElement('div');
      const name = document.createElement('span');
      name.textContent = `${label}: `;
      const strong = document.createElement('strong');
      strong.textContent = value;
      strong.style.fontVariantNumeric = 'tabular-nums';
      row.append(name, strong);
      root.appendChild(row);
    }
    return root;
  }

  private query(viewport: Viewport, deviceId: string, start: Date | null, end: Date | null): GridQuery {
    const bounds = viewport.bounds.pad(0.1);
    return {
      south: Math.max(-90, bounds.getSouth()),
      west: Math.max(-180, bounds.getWest()),
      north: Math.min(90, bounds.getNorth()),
      east: Math.min(180, bounds.getEast()),
      zoom: Math.min(18, Math.max(3, Math.round(viewport.zoom))),
      from: start ?? undefined,
      to: end ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999) : undefined,
      deviceId: deviceId || undefined,
    };
  }
}
