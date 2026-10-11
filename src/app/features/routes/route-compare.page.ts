import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, signal,
  untracked, viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Chart, ChartDataset } from 'chart.js';
import * as L from 'leaflet';
import {
  Observable, Subject, catchError, debounceTime, distinctUntilChanged, forkJoin, map, of, switchMap,
} from 'rxjs';
import { MeasurementDto, RouteDto, RoutesApi, hasPosition } from '../../core/api';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ThemeService } from '../../core/prefs/theme.service';
import { DateTimePipe } from '../../core/units/date-time.pipe';
import { DistancePipe } from '../../core/units/distance.pipe';
import { DoseFormat } from '../../core/units/dose-format';
import { DosePipe } from '../../core/units/dose.pipe';
import { DurationPipe } from '../../core/units/duration.pipe';
import { NumberPipe } from '../../core/units/number.pipe';
import { ChartTheme } from '../../shared/chart/chart-theme';
import { elapsedAxis, formatElapsed } from '../../shared/chart/time-axis';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { AppMap, MapFactory } from '../../shared/map/map-factory';
import { COMPARE_DASHES, COMPARE_SLOTS, compareColor } from './compare-palette';
import { RouteStats, computeRouteStats } from './route-view/route-stats';

interface LoadedRoute {
  readonly id: number;
  readonly route: RouteDto;
  readonly measurements: readonly MeasurementDto[];
  readonly stats: RouteStats;
}

type CompareEntry = LoadedRoute | { readonly id: number; readonly failed: true; readonly notFound: boolean };

interface ComparedRoute extends LoadedRoute {
  readonly slot: number;
  readonly color: string;
}

interface ElapsedPoint {
  readonly x: number;
  readonly y: number;
}

const MAX_ROUTES = COMPARE_SLOTS;

/** `?ids=1,2,3` -> unique positive ids, at most 4, in order. */
function parseIds(value: string | undefined): number[] {
  const ids: number[] = [];
  for (const part of (value ?? '').split(',')) {
    const id = Number(part.trim());
    if (Number.isInteger(id) && id > 0 && !ids.includes(id) && ids.length < MAX_ROUTES) {
      ids.push(id);
    }
  }
  return ids;
}

function isLoaded(entry: CompareEntry): entry is LoadedRoute {
  return !('failed' in entry);
}

/** `/routes/compare?ids=` – 2–4 routes on one map and one chart (time since start) plus a statistics table. */
@Component({
  selector: 'app-route-compare-page',
  imports: [
    DateTimePipe, DistancePipe, DosePipe, DurationPipe, EmptyState, MatAutocompleteModule, MatButtonModule,
    MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule, MatTooltipModule,
    NumberPipe, RouterLink, TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './route-compare.page.html',
  styleUrl: './route-compare.page.scss',
})
export class RouteComparePage {
  private readonly api = inject(RoutesApi);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);
  private readonly chartTheme = inject(ChartTheme);
  private readonly dose = inject(DoseFormat);
  private readonly maps = inject(MapFactory);
  private readonly mapElement = viewChild<ElementRef<HTMLElement>>('map');
  private readonly chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chart');

  /** `?ids=1,2,3`. */
  readonly ids = input<string>();

  protected readonly routeIds = computed(() => parseIds(this.ids()));
  protected readonly entries = signal<readonly CompareEntry[] | null>(null);
  protected readonly loading = computed(() => this.entries() === null);
  /** Loading after a change of `ids` (current routes stay visible). */
  protected readonly pending = signal(false);
  /** Stable colour slot per route id while it stays in the comparison. */
  private readonly slots = new Map<number, number>();
  protected readonly compared = computed<ComparedRoute[]>(() => {
    const dark = this.theme.isDark();
    return (this.entries() ?? []).filter(isLoaded).map(entry => {
      const slot = this.slots.get(entry.id) ?? 0;
      return { ...entry, slot, color: compareColor(slot, dark) };
    });
  });
  protected readonly failedIds = computed(() => (this.entries() ?? []).filter(e => !isLoaded(e)).map(e => e.id));
  protected readonly full = computed(() => this.routeIds().length >= MAX_ROUTES);
  protected readonly dashes = COMPARE_DASHES;

  // route picker
  protected readonly searchText = signal('');
  private readonly search$ = new Subject<string>();
  protected readonly options = signal<readonly RouteDto[]>([]);
  protected readonly searching = signal(false);

  private readonly cache = new Map<number, CompareEntry>();
  private appMap?: AppMap;
  private readonly trackLayer = L.layerGroup();
  private chart?: Chart<'line', ElapsedPoint[]>;
  private fittedKey = '';

  constructor() {
    toObservable(this.routeIds).pipe(
      switchMap(ids => {
        // keep showing the current routes while one more is loaded
        this.pending.set(true);
        return ids.length ? forkJoin(ids.map(id => this.load(id))) : of([]);
      }),
      takeUntilDestroyed(),
    ).subscribe(entries => {
      this.assignSlots(entries.filter(isLoaded).map(e => e.id));
      this.entries.set(entries);
      this.pending.set(false);
    });

    this.search$.pipe(
      map(text => text.trim()),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(q => {
        this.searching.set(true);
        return this.api.list({ q: q || undefined, size: 8 }, { silent: true }).pipe(
          map(page => page.content),
          catchError(() => of([] as RouteDto[])),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe(routes => {
      this.searching.set(false);
      this.options.set(routes);
    });

    // map: created when its element appears, redrawn when routes or theme change
    effect(() => {
      const element = this.mapElement()?.nativeElement;
      untracked(() => {
        if (element && !this.appMap) {
          this.appMap = this.maps.create(element, { overlays: {} });
          this.trackLayer.addTo(this.appMap.map);
        } else if (!element && this.appMap) {
          this.destroyMap();
        }
      });
      const routes = this.compared();
      untracked(() => this.drawTracks(routes));
    });
    // chart: the same life cycle
    effect(() => {
      const canvas = this.chartCanvas()?.nativeElement;
      const routes = this.compared();
      this.chartTheme.colors();
      this.i18n.locale();
      this.dose.unit();
      untracked(() => {
        if (!canvas) {
          this.chart?.destroy();
          this.chart = undefined;
          return;
        }
        if (this.chart && this.chart.canvas !== canvas) {
          this.chart.destroy();
          this.chart = undefined;
        }
        this.drawChart(canvas, routes);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.chart?.destroy();
      this.destroyMap();
    });
  }

  protected onSearch(text: string): void {
    this.searchText.set(text);
    this.search$.next(text);
  }

  protected openPicker(): void {
    this.search$.next(this.searchText());
  }

  protected isCompared(id: number): boolean {
    return this.routeIds().includes(id);
  }

  protected add(event: MatAutocompleteSelectedEvent): void {
    const route = event.option.value as RouteDto;
    this.searchText.set('');
    if (!this.isCompared(route.id) && !this.full()) {
      this.setIds([...this.routeIds(), route.id]);
    }
  }

  protected remove(id: number): void {
    this.setIds(this.routeIds().filter(other => other !== id));
  }

  protected removeFailed(): void {
    const failed = this.failedIds();
    this.setIds(this.routeIds().filter(id => !failed.includes(id)));
  }

  protected readonly displayNothing = () => '';

  private setIds(ids: readonly number[]): void {
    void this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: { ids: ids.length ? ids.join(',') : null },
      replaceUrl: true,
    });
  }

  private load(id: number): Observable<CompareEntry> {
    const cached = this.cache.get(id);
    if (cached) {
      return of(cached);
    }
    return forkJoin({
      route: this.api.get(id, { silent: true }),
      measurements: this.api.measurements(id, undefined, { silent: true }),
    }).pipe(
      map(({ route, measurements }): CompareEntry => ({ id, route, measurements, stats: computeRouteStats(measurements) })),
      catchError((error: unknown) => of<CompareEntry>({
        id,
        failed: true,
        notFound: error instanceof HttpErrorResponse && error.status === 404,
      })),
      map(entry => {
        if (isLoaded(entry)) {
          this.cache.set(id, entry);
        }
        return entry;
      }),
    );
  }

  /** Keeps the slot of routes that stay; new routes take the lowest free slot. */
  private assignSlots(ids: readonly number[]): void {
    for (const id of [...this.slots.keys()]) {
      if (!ids.includes(id)) {
        this.slots.delete(id);
      }
    }
    for (const id of ids) {
      if (!this.slots.has(id)) {
        const used = new Set(this.slots.values());
        let slot = 0;
        while (used.has(slot)) {
          slot++;
        }
        this.slots.set(id, slot);
      }
    }
  }

  private destroyMap(): void {
    this.trackLayer.remove();
    this.appMap?.destroy();
    this.appMap = undefined;
    this.fittedKey = '';
  }

  private drawTracks(routes: readonly ComparedRoute[]): void {
    const map = this.appMap?.map;
    if (!map) {
      return;
    }
    this.trackLayer.clearLayers();
    const renderer = L.canvas({ padding: 0.5 });
    const bounds = L.latLngBounds([]);
    for (const route of routes) {
      const points = route.measurements.filter(hasPosition).map(m => L.latLng(m.latitude, m.longitude));
      if (points.length < 1) {
        continue;
      }
      const common = { renderer, interactive: false, lineCap: 'round', lineJoin: 'round' } as const;
      L.polyline(points, { ...common, color: '#000', opacity: 0.3, weight: 7 }).addTo(this.trackLayer);
      const line = L.polyline(points, { ...common, interactive: true, color: route.color, weight: 4, opacity: 1 })
        .addTo(this.trackLayer);
      const label = document.createElement('span');
      label.textContent = route.route.name;
      line.bindTooltip(label, { sticky: true });
      L.circleMarker(points[0], {
        renderer, radius: 5, color: route.color, weight: 3, fillColor: '#fff', fillOpacity: 1, interactive: false,
      }).addTo(this.trackLayer);
      L.circleMarker(points[points.length - 1], {
        renderer, radius: 6, color: '#fff', weight: 2, fillColor: route.color, fillOpacity: 1, interactive: false,
      }).addTo(this.trackLayer);
      points.forEach(point => bounds.extend(point));
    }
    // fit only when the set of routes changes (not on theme changes)
    const key = routes.map(r => r.id).join(',');
    if (bounds.isValid() && key !== this.fittedKey) {
      this.fittedKey = key;
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17, animate: false });
    }
  }

  private drawChart(canvas: HTMLCanvasElement, routes: readonly ComparedRoute[]): void {
    const colors = this.chartTheme.colors();
    const datasets: ChartDataset<'line', ElapsedPoint[]>[] = routes.map(route => {
      const start = route.measurements.length ? Date.parse(route.measurements[0].timestamp) : 0;
      return {
        label: route.route.name,
        data: route.measurements.map(m => ({ x: Date.parse(m.timestamp) - start, y: m.usvPerHour })),
        parsing: false,
        normalized: true,
        borderColor: route.color,
        backgroundColor: route.color,
        borderWidth: 2,
        borderDash: [...this.dashes[route.slot % this.dashes.length]],
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBorderWidth: 2,
        pointHoverBorderColor: colors.surface,
        tension: 0,
      };
    });
    const options: Chart<'line', ElapsedPoint[]>['options'] = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      scales: {
        x: { ...elapsedAxis(), title: { display: true, text: this.i18n.t('routes.compare.elapsed') } },
        y: {
          beginAtZero: true,
          grid: { color: colors.grid },
          border: { display: false },
          ticks: { callback: value => this.dose.formatValue(Number(value)) },
          title: { display: true, text: this.dose.unitLabel() },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => (items.length ? formatElapsed(items[0].parsed.x ?? 0) : ''),
            label: item => `${item.dataset.label ?? ''}: ${this.dose.format(item.parsed.y ?? 0)}`,
          },
        },
      },
    };
    if (this.chart) {
      this.chart.data.datasets = datasets;
      this.chart.options = options;
      this.chart.update('none');
    } else {
      this.chart = new Chart(canvas, { type: 'line', data: { datasets }, options });
    }
  }
}
