import { DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, computed, inject, linkedSignal, signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, map, of, scan, startWith, switchMap } from 'rxjs';
import { SearchApi } from '../../core/api/search.api';
import { EMPTY_SEARCH, SearchResult } from '../../core/api/search.models';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ThemeService } from '../../core/prefs/theme.service';
import { dateFormat } from '../../core/units/format-utils';
import { NAV_ITEMS, THEME_ICONS } from '../nav/nav-items';
import { RecentItem, RecentItems } from './recent-items';

interface PaletteItem {
  /** Unique within the list (also the DOM id suffix). */
  readonly id: string;
  readonly icon: string;
  readonly label: string;
  readonly detail?: readonly string[];
  readonly run: () => void;
}

interface PaletteGroup {
  readonly key: string;
  readonly title: string;
  readonly items: readonly PaletteItem[];
}

const KIND_ICONS: Readonly<Record<RecentItem['kind'], string>> = { route: 'route', device: 'sensors', marker: 'place' };

interface SearchState {
  readonly query: string;
  readonly result: SearchResult | null;
  readonly loading: boolean;
}

const INITIAL_SEARCH: SearchState = { query: '', result: null, loading: false };

/** Lower case without diacritics ("Łódź" -> "lodz") for forgiving matching of page names. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase();
}

/**
 * Ctrl/⌘+K search: pages and actions (instant), routes / devices / markers from `/api/search` (debounced),
 * recently opened entities. Combobox + listbox pattern with keyboard navigation. Opened by CommandPaletteService.
 */
@Component({
  selector: 'app-command-palette',
  imports: [MatIconModule, MatProgressSpinnerModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './command-palette.html',
  styleUrl: './command-palette.scss',
})
export class CommandPalette {
  private readonly dialogRef = inject(DialogRef);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly searchApi = inject(SearchApi);
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  private readonly recent = inject(RecentItems);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly query = signal('');
  private readonly trimmed = computed(() => this.query().trim());

  private readonly search = toSignal(
    toObservable(this.trimmed).pipe(
      debounceTime(200),
      distinctUntilChanged(),
      switchMap(query => query.length < 2
        ? of<SearchState>({ query, result: null, loading: false })
        : this.searchApi.search(query, { silent: true }).pipe(
          map(result => ({ query, result, loading: false })),
          catchError(() => of({ query, result: EMPTY_SEARCH, loading: false })),
          startWith<SearchState>({ query, result: null, loading: true }),
        )),
      // keep showing the previous results while the next request runs (no flicker while typing)
      scan((previous, next) => (next.loading ? { ...next, result: previous.result } : next), INITIAL_SEARCH),
    ),
    { initialValue: INITIAL_SEARCH },
  );

  /** A search request is pending (or the query changed and is waiting for the debounce). */
  protected readonly searching = computed(() =>
    this.trimmed().length >= 2 && (this.search().loading || this.search().query !== this.trimmed()));

  protected readonly groups = computed<PaletteGroup[]>(() => {
    const query = this.trimmed();
    const needle = normalize(query);
    const matches = (text: string) => !needle || normalize(text).includes(needle);
    const groups: PaletteGroup[] = [];

    if (!query && this.recent.items().length) {
      groups.push({
        key: 'recent',
        title: this.i18n.t('nav.search.recent'),
        items: this.recent.items().map(item => ({
          id: `recent-${item.id}`,
          icon: KIND_ICONS[item.kind],
          label: item.label,
          detail: item.detail,
          run: () => this.open(item),
        })),
      });
    }

    const pages = NAV_ITEMS
      .map(item => ({ id: `page-${item.path}`, icon: item.icon, label: this.i18n.t(item.labelKey), run: () => this.go(item.path) }))
      .filter(item => matches(item.label));
    if (pages.length) {
      groups.push({ key: 'pages', title: this.i18n.t('nav.search.pages'), items: pages });
    }

    const actions: PaletteItem[] = [
      {
        id: 'action-theme',
        icon: THEME_ICONS[this.theme.theme()],
        label: this.i18n.t('nav.actions.toggleTheme'),
        run: () => void this.theme.cycle(),
      },
      { id: 'action-logout', icon: 'logout', label: this.i18n.t('nav.actions.logout'), run: () => void this.auth.logout() },
    ].filter(item => matches(item.label));
    if (actions.length) {
      groups.push({ key: 'actions', title: this.i18n.t('nav.search.actions'), items: actions });
    }

    const result = query.length >= 2 ? this.search().result : null;
    if (result) {
      groups.push(...this.resultGroups(result));
    }
    return groups;
  });

  protected readonly items = computed(() => this.groups().flatMap(group => group.items));

  /** Keeps the highlighted entry when the list changes (e.g. search results arrive), otherwise the first one. */
  protected readonly activeIndex = linkedSignal<readonly PaletteItem[], number>({
    source: this.items,
    computation: (items, previous) => {
      const previousId = previous ? previous.source[previous.value]?.id : undefined;
      const index = previousId ? items.findIndex(item => item.id === previousId) : -1;
      return Math.max(0, index);
    },
  });
  protected readonly activeId = computed(() => {
    const item = this.items()[this.activeIndex()];
    return item ? this.optionId(item) : null;
  });

  protected readonly emptyText = computed(() => {
    if (this.items().length || this.searching()) {
      return null;
    }
    return this.trimmed().length < 2
      ? this.i18n.t('nav.search.hint')
      : this.i18n.t('nav.search.noResults', { q: this.trimmed() });
  });

  protected readonly status = computed(() => this.searching()
    ? this.i18n.t('nav.search.searching')
    : this.trimmed() ? this.i18n.t('nav.search.results', { count: this.items().length }) : '');

  constructor() {
    afterRenderEffect(() => {
      const id = this.activeId();
      if (id) {
        this.host.nativeElement.querySelector(`#${id}`)?.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  protected optionId(item: PaletteItem): string {
    return `app-palette-${item.id.replace(/[^A-Za-z0-9_-]/g, '_')}`;
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.items().length;
    if (!count) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.activeIndex.set((this.activeIndex() + step + count) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.select(this.items()[this.activeIndex()]);
    }
  }

  protected activate(item: PaletteItem): void {
    const index = this.items().indexOf(item);
    if (index >= 0 && index !== this.activeIndex()) {
      this.activeIndex.set(index);
    }
  }

  protected select(item: PaletteItem | undefined): void {
    if (item) {
      this.dialogRef.close();
      item.run();
    }
  }

  private resultGroups(result: SearchResult): PaletteGroup[] {
    const date = (iso: string | null) => (iso ? dateFormat(this.i18n.locale(), 'date').format(Date.parse(iso)) : '');
    const routes: PaletteItem[] = result.routes.map(route => this.entity({
      id: `route-${route.id}`, kind: 'route', label: route.name,
      detail: [route.deviceId, date(route.startedAt)].filter(Boolean), link: `/routes/${route.id}`,
    }));
    const devices: PaletteItem[] = result.devices.map(device => this.entity({
      id: `device-${device.id}`, kind: 'device', label: device.name, detail: [device.id], link: `/devices/${device.id}`,
    }));
    const markers: PaletteItem[] = result.markers.map(marker => this.entity({
      id: `marker-${marker.id}`, kind: 'marker', label: marker.label, detail: [date(marker.ts)],
      link: `/routes/${marker.routeId}`, queryParams: { marker: String(marker.id) },
    }));
    return [
      { key: 'routes', title: this.i18n.t('nav.search.routes'), items: routes },
      { key: 'devices', title: this.i18n.t('nav.search.devices'), items: devices },
      { key: 'markers', title: this.i18n.t('nav.search.markers'), items: markers },
    ].filter(group => group.items.length > 0);
  }

  private entity(item: RecentItem): PaletteItem {
    return {
      id: item.id,
      icon: KIND_ICONS[item.kind],
      label: item.label,
      detail: item.detail,
      run: () => this.open(item),
    };
  }

  private open(item: RecentItem): void {
    this.recent.add(item);
    void this.router.navigate([item.link], { queryParams: item.queryParams });
  }

  private go(path: string): void {
    void this.router.navigateByUrl(path);
  }
}
