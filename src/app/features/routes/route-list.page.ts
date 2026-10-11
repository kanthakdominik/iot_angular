import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, debounceTime, distinctUntilChanged, filter, map, of, switchMap, tap } from 'rxjs';
import { DevicesApi, Page, RouteDto, RouteQuery, RouteSort, RoutesApi, SortDir } from '../../core/api';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslationKey } from '../../core/i18n/pl';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LiveService } from '../../core/live/live.service';
import { Notifier } from '../../core/notify/notifier';
import { DateTimePipe } from '../../core/units/date-time.pipe';
import { DistancePipe } from '../../core/units/distance.pipe';
import { DosePipe } from '../../core/units/dose.pipe';
import { DoseScale } from '../../core/units/dose-scale';
import { DurationPipe } from '../../core/units/duration.pipe';
import { NumberPipe } from '../../core/units/number.pipe';
import { LayoutMode } from '../../layout/layout-mode';
import { Dialogs } from '../../shared/dialogs/dialogs.service';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { Sparkline } from '../../shared/sparkline/sparkline';
import { RouteCard } from './route-card';
import { RouteEditDialog } from './route-edit-dialog';

type ListView = 'cards' | 'table';
type LoadState = 'loading' | 'ready' | 'error';

const VIEW_KEY = 'app.routes.view';
const PAGE_SIZES = [12, 24, 48] as const;
const DEFAULT_SIZE = 24;
const MAX_SELECTED = 4;
const SORTS: readonly RouteSort[] = ['startedAt', 'distance', 'maxUsv', 'samples', 'name'];
const SORT_LABELS: Readonly<Record<RouteSort, TranslationKey>> = {
  startedAt: 'routes.list.sortBy.startedAt',
  distance: 'routes.list.sortBy.distance',
  maxUsv: 'routes.list.sortBy.maxUsv',
  samples: 'routes.list.sortBy.samples',
  name: 'routes.list.sortBy.name',
};
const DATE_PARAM = /^\d{4}-\d{2}-\d{2}$/;

function readView(): ListView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards';
  } catch {
    return 'cards';
  }
}

function storeView(view: ListView): void {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // storage unavailable – the choice lasts for this visit only
  }
}

/** `YYYY-MM-DD` (URL) -> local Date; null when missing or malformed. */
function parseDay(value: string | undefined): Date | null {
  if (!value || !DATE_PARAM.test(value)) {
    return null;
  }
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDay(date: Date | null): string | null {
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const toPage = (value: unknown): number => Math.max(0, Math.floor(Number(value)) || 0);
const toSize = (value: unknown): number => PAGE_SIZES.find(size => size === Number(value)) ?? DEFAULT_SIZE;

/** `/routes` – cards or table, filters in the URL, server-side sorting and paging, selection for comparison. */
@Component({
  selector: 'app-route-list-page',
  imports: [
    DateTimePipe, DistancePipe, DosePipe, DurationPipe, EmptyState, MatButtonModule, MatButtonToggleModule,
    MatCheckboxModule, MatDatepickerModule, MatFormFieldModule, MatIconModule, MatInputModule, MatMenuModule,
    MatPaginatorModule, MatProgressBarModule, MatSelectModule, MatSortModule, MatTableModule, MatTooltipModule,
    NumberPipe, ReactiveFormsModule, RouteCard, RouterLink, Skeleton, Sparkline, TranslatePipe,
  ],
  providers: [provideNativeDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './route-list.page.html',
  styleUrl: './route-list.page.scss',
})
export class RouteListPage {
  private readonly api = inject(RoutesApi);
  private readonly devicesApi = inject(DevicesApi);
  private readonly live = inject(LiveService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);
  private readonly notifier = inject(Notifier);
  private readonly dialogs = inject(Dialogs);
  private readonly dialog = inject(MatDialog);
  protected readonly auth = inject(AuthService);
  protected readonly layout = inject(LayoutMode);

  // query parameters (bound by the router)
  readonly q = input<string>();
  readonly device = input<string>();
  readonly from = input<string>();
  readonly to = input<string>();
  readonly sort = input<string>();
  readonly dir = input<string>();
  readonly page = input<number, unknown>(0, { transform: toPage });
  readonly size = input<number, unknown>(DEFAULT_SIZE, { transform: toSize });

  protected readonly pageSizes = [...PAGE_SIZES];
  protected readonly sorts = SORTS;
  protected readonly sortLabels = SORT_LABELS;
  protected readonly tableColumns = ['select', 'name', 'device', 'startedAt', 'duration', 'distance', 'samples', 'maxUsv', 'preview', 'actions'];

  protected readonly trackById = (_: number, route: RouteDto) => route.id;
  protected readonly view = signal<ListView>(readView());
  /** Phones always get cards. */
  protected readonly effectiveView = computed<ListView>(() => (this.layout.isHandset() ? 'cards' : this.view()));
  protected readonly sortKey = computed<RouteSort>(() => SORTS.find(s => s === this.sort()) ?? 'startedAt');
  protected readonly sortDir = computed<SortDir>(() => (this.dir() === 'asc' ? 'asc' : 'desc'));
  protected readonly fromDate = computed(() => parseDay(this.from()));
  protected readonly toDate = computed(() => parseDay(this.to()));
  protected readonly hasFilters = computed(() => !!this.q() || !!this.device() || !!this.fromDate() || !!this.toDate());

  protected readonly query = computed<RouteQuery>(() => {
    const to = this.toDate();
    return {
      q: this.q()?.trim() || undefined,
      deviceId: this.device() || undefined,
      from: this.fromDate() ?? undefined,
      // the whole "to" day
      to: to ? new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999) : undefined,
      sort: this.sortKey(),
      dir: this.sortDir(),
      page: this.page(),
      size: this.size(),
    };
  });

  protected readonly result = signal<Page<RouteDto> | null>(null);
  protected readonly state = signal<LoadState>('loading');
  protected readonly errorText = signal('');
  /** Background refresh indicator (data stays visible). */
  protected readonly loadingMore = signal(false);
  private readonly reloads = signal(0);
  protected readonly routes = computed(() => this.result()?.content ?? []);

  protected readonly devices = toSignal(
    this.devicesApi.list({ silent: true }).pipe(catchError(() => of([]))),
    { initialValue: [] },
  );

  protected readonly searchText = signal('');
  private readonly search$ = new Subject<string>();
  private lastSearch = '';

  protected readonly dateRange = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  /** Selected for comparison: id -> name, in selection order. */
  protected readonly selected = signal<ReadonlyMap<number, string>>(new Map());
  protected readonly selectionFull = computed(() => this.selected().size >= MAX_SELECTED);
  protected readonly selectedNames = computed(() => [...this.selected().values()]);

  constructor() {
    toObservable(computed(() => ({ query: this.query(), reload: this.reloads() }))).pipe(
      switchMap(({ query }) => {
        this.state.set(this.result() ? 'ready' : 'loading');
        this.loadingMore.set(true);
        return this.api.list(query, { silent: true }).pipe(
          tap(page => {
            this.result.set(page);
            this.state.set('ready');
            this.loadingMore.set(false);
          }),
          catchError((error: unknown) => {
            this.errorText.set(this.notifier.describe(error));
            this.state.set('error');
            this.loadingMore.set(false);
            return EMPTY;
          }),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe();

    // search box -> ?q= (debounced)
    this.search$.pipe(
      map(text => text.trim()),
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(text => {
      this.lastSearch = text;
      this.navigate({ q: text || null });
    });
    // ?q= changed from outside (back / forward, clear filters) -> search box
    effect(() => {
      const q = this.q() ?? '';
      untracked(() => {
        if (q !== this.lastSearch) {
          this.lastSearch = q;
          this.searchText.set(q);
        }
      });
    });
    // ?from / ?to -> date range inputs
    effect(() => {
      const start = this.fromDate();
      const end = this.toDate();
      untracked(() => this.dateRange.setValue({ start, end }, { emitEvent: false }));
    });
    this.dateRange.valueChanges.pipe(
      // a range is applied once complete (or cleared)
      filter(({ start, end }) => !start === !end),
      debounceTime(50),
      takeUntilDestroyed(),
    ).subscribe(({ start, end }) => this.navigate({ from: formatDay(start ?? null), to: formatDay(end ?? null) }));

    // live: merge recomputed statistics; new routes reload the first page
    const newRoute$ = new Subject<void>();
    this.live.route$.pipe(takeUntilDestroyed()).subscribe(event => {
      const page = this.result();
      if (page?.content.some(r => r.id === event.id)) {
        this.result.set({
          ...page,
          content: page.content.map(r => (r.id === event.id
            ? { ...event, preview: r.preview, shareToken: event.shareToken ?? r.shareToken }
            : r)),
        });
      } else if (this.page() === 0) {
        newRoute$.next();
      }
    });
    newRoute$.pipe(debounceTime(1500), takeUntilDestroyed()).subscribe(() => this.reload());
    this.live.reconnected$.pipe(takeUntilDestroyed()).subscribe(() => this.reload());
  }

  protected reload(): void {
    this.reloads.update(n => n + 1);
  }

  protected setView(view: ListView): void {
    this.view.set(view);
    storeView(view);
  }

  protected onSearch(text: string): void {
    this.searchText.set(text);
    this.search$.next(text);
  }

  protected clearSearch(): void {
    this.searchText.set('');
    this.lastSearch = '';
    this.navigate({ q: null });
  }

  protected setDevice(deviceId: string | null): void {
    this.navigate({ device: deviceId || null });
  }

  protected clearDates(): void {
    this.navigate({ from: null, to: null });
  }

  protected setSort(sort: RouteSort): void {
    // names read naturally A–Z, everything else highest / newest first
    this.navigate({ sort: sort === 'startedAt' ? null : sort, dir: sort === 'name' ? 'asc' : null });
  }

  protected toggleDir(): void {
    this.navigate({ dir: this.sortDir() === 'desc' ? 'asc' : 'desc' });
  }

  protected onSortChange(sort: Sort): void {
    const key = SORTS.find(s => s === sort.active) ?? 'startedAt';
    this.navigate({
      sort: key === 'startedAt' ? null : key,
      dir: sort.direction === 'asc' ? 'asc' : sort.direction === 'desc' ? 'desc' : null,
    });
  }

  protected onPage(event: PageEvent): void {
    this.navigate({
      page: event.pageSize !== this.size() ? null : event.pageIndex || null,
      size: event.pageSize === DEFAULT_SIZE ? null : event.pageSize,
    }, false);
  }

  protected clearFilters(): void {
    this.searchText.set('');
    this.lastSearch = '';
    this.navigate({ q: null, device: null, from: null, to: null });
  }

  protected isSelected(route: RouteDto): boolean {
    return this.selected().has(route.id);
  }

  protected toggleSelected(route: RouteDto): void {
    const next = new Map(this.selected());
    if (next.has(route.id)) {
      next.delete(route.id);
    } else if (next.size >= MAX_SELECTED) {
      this.notifier.info(this.i18n.t('routes.list.selectionLimit'));
      return;
    } else {
      next.set(route.id, route.name);
    }
    this.selected.set(next);
  }

  protected clearSelection(): void {
    this.selected.set(new Map());
  }

  protected compare(): void {
    void this.router.navigate(['/routes/compare'], { queryParams: { ids: [...this.selected().keys()].join(',') } });
  }

  protected doseColor(usv: number | null): string | null {
    return usv === null ? null : DoseScale.color(usv);
  }

  protected edit(route: RouteDto): void {
    this.dialog.open<RouteEditDialog, RouteDto, RouteDto>(RouteEditDialog, {
      data: route,
      maxWidth: 'min(600px, calc(100vw - 32px))',
    }).afterClosed().subscribe(updated => {
      const page = this.result();
      if (updated && page) {
        this.result.set({
          ...page,
          content: page.content.map(r => (r.id === updated.id ? { ...r, name: updated.name, description: updated.description } : r)),
        });
      }
    });
  }

  protected async remove(route: RouteDto): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: this.i18n.t('routes.delete.title'),
      message: this.i18n.t('routes.delete.message', { name: route.name, count: route.sampleCount }),
      confirmLabel: this.i18n.t('routes.delete.confirm'),
      destructive: true,
    });
    if (confirmed) {
      this.api.delete(route.id).subscribe(() => {
        this.notifier.info(this.i18n.t('routes.delete.done'));
        if (this.selected().has(route.id)) {
          this.toggleSelected(route);
        }
        this.reload();
      });
    }
  }

  private navigate(params: Record<string, string | number | null>, resetPage = true): void {
    void this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: resetPage ? { ...params, page: null } : params,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
