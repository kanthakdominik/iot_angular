# Radmon frontend – foundation guide (v2.1)

For whoever adds or changes pages. Read `docs/UI.md` (look and feel) and `iot_spring/docs/V2.1-SPEC.md` (API)
first; this file explains what already exists and how to use it.

Stack: Angular 22 (standalone, zoneless, signals, OnPush everywhere), Angular Material 22 (M3), Leaflet 1.9,
Chart.js 4, `@angular/service-worker`. No other UI libraries. TypeScript strict + `strictTemplates`.

## 1. Folder map

```
src/
  index.html, main.ts, styles.scss        fonts (Archivo, Material Symbols Rounded), early theme, global styles
  environments/                           apiUrl = '/api'
  app/
    app.ts, app.config.ts, app.routes.ts  root, providers, every route (lazy)
    theme/      _palettes (M3 tonal palettes), _theme (mat.theme), _tokens (--app-*), _typography, _base (layout
                helpers, focus, reduced motion), _overlays (menu panels), _leaflet (map controls, popups, dark mode)
    core/
      api/      *.models.ts (DTO types) + *.api.ts (one service per area) + http.ts (API_URL, SILENT_ERRORS,
                toParams, ApiOptions) + index.ts (barrel)
      auth/     AuthService, guards (authGuard, adminGuard, guestGuard, safeReturnUrl), http-errors.interceptor,
                validators (passwordValidator, usernameValidator)
      prefs/    PrefsService (effective preferences), ThemeService, preferences.ts (defaults, localStorage)
      i18n/     I18nService, TranslatePipe (`t`), dict/<area>.pl.ts + .en.ts, AppPaginatorIntl
      units/    DoseScale, DoseFormat, pipes dose / distance / duration / relativeTime / dateTime / num / csq,
                NowService (30 s clock), format-utils (Intl caches, CSQ helpers)
      live/     LiveService (SSE /api/stream)
      alerts/   OpenAlertsStore (bell badge + newest open alerts)
      notify/   Notifier (snackbars, user-facing HTTP error text)
      export/   GPX / GeoJSON / CSV + download
      pwa/      clearApiCache (ngsw data caches, on logout)
    shared/     dose-readout, dose-legend, stat-tile, sparkline, track-thumbnail, empty-state, page-header,
                skeleton, dialogs/ (confirm, text prompt, Dialogs service), map/ (Leaflet), chart/ (Chart.js)
    layout/     shell, nav (rail, bottom bar, nav-items), top-bar, notifications, command-palette, page-title,
                layout-mode
    features/   auth/login (done); placeholders to replace: dashboard, routes, map, devices, alerts, events,
                settings, share
```

Naming: `kebab-case.ts`, classes without `Component` suffix (`DoseReadout`), pages `*.page.ts` (`RouteListPage`),
selectors `app-*`. Bigger components keep `.html` + `.scss` next to the `.ts`; inline styles are SCSS.

## 2. Conventions (must)

- `ChangeDetectionStrategy.OnPush`, `inject()`, `input()` / `output()` / `model()`, `viewChild()`, `@if / @for /
  @switch / @defer`, `host: {}` (no `@HostBinding` / `@HostListener`). The app is **zoneless**: anything a template
  reads must be a signal (or come through `toSignal`, `httpResource`, `rxResource`).
- Loading data – pick the simplest:
  ```ts
  // plain GET bound to inputs: httpResource (re-fetches when id() changes)
  readonly id = input.required({ transform: numberAttribute });
  readonly route = httpResource<RouteDto>(() => `${this.apiUrl}/routes/${this.id()}`);   // apiUrl = inject(API_URL)
  // anything the API services already wrap (query params, silent errors, mutations): rxResource / subscribe
  readonly page = rxResource({ params: () => this.query(), stream: ({ params }) => this.routesApi.list(params) });
  ```
  Template: `@if (route.isLoading()) { <app-skeleton/> } @else if (route.error()) { <app-empty-state/> } @else { … }`.
  Mutations: call the API service, then `reload()` the resource or update local signals.
- All UI text through i18n, numbers / dates through the pipes (never `toFixed` / `toLocaleString` in templates),
  colours from tokens (`var(--mat-sys-*)`, `var(--app-*)`, `DoseScale`).
- Accessibility: icon-only buttons get `aria-label` (+ `matTooltip`); decorative icons `aria-hidden="true"`; forms use
  `mat-form-field` + `mat-label` + `mat-error`; important status changes go to an `aria-live` region; loading
  regions get `aria-busy`. Keyboard must reach everything.
- Comments in English and only where they help; no dead code.

## 3. Routing and pages

`app.routes.ts` holds every screen of V2.1-SPEC §6. Logged-in pages are children of the lazy `Shell` (`authGuard`).
Route params, query params and route data bind to inputs (`withComponentInputBinding`).

| Placeholder to replace (keep path, class, selector) | URL inputs |
|---|---|
| `features/dashboard/dashboard.page.ts` `DashboardPage` | – |
| `features/routes/route-list.page.ts` `RouteListPage` | add query inputs you need (`q`, `page`, …) |
| `features/routes/route-detail.page.ts` `RouteDetailPage` | `id` (number); optional `?marker=<id>` from the command palette |
| `features/routes/route-compare.page.ts` `RouteComparePage` | `?ids=1,2,3` → add `readonly ids = input<string>()` |
| `features/map/global-map.page.ts` `GlobalMapPage` | – |
| `features/devices/device-list.page.ts` `DeviceListPage` / `device-detail.page.ts` `DeviceDetailPage` | `id` (string) |
| `features/alerts/alerts.page.ts` `AlertsPage`, `features/events/events.page.ts` `EventsPage`, `features/settings/settings.page.ts` `SettingsPage` | – |
| `features/share/share.page.ts` `SharePage` (public, no shell) | `token` |

Adding a route: a child of the shell with `loadComponent` and `data: { titleKey: '<dictionary key>' }`;
admin-only → `canActivate: [adminGuard]`. Old `/routes/:id/map|chart` already redirect to `/routes/:id`.

- **Title**: the top bar shows the translated `titleKey` as the page `<h1>`. Data-dependent title:
  `effect(() => this.pageTitle.set(this.route.value()?.name ?? null))` (`PageTitle` from `layout/page-title`;
  reset on every navigation).
- **Layout**: normal pages `<div class="app-page">` (padding, left aligned, max 1440 px, 24 px between sections);
  route view / global map `<div class="app-page-full">`. Helpers: `.app-stack` (vertical 16 px), `.app-cluster`
  (inline wrap 8 px), `.app-grid` (auto-fill tiles, set `--app-grid-min`). `inject(LayoutMode).isHandset()` for phone
  layouts (< 600 px; content is already padded for the bottom bar).

## 4. API layer (`core/api`)

One service per area, every endpoint typed, base `API_URL` (`/api`). Each method takes an optional last
`ApiOptions` argument: `{ silent: true }` suppresses the global error snackbar – handle the error yourself
(`inject(Notifier).describe(error)` gives the text).

| Service | Methods |
|---|---|
| `RoutesApi` | `list(RouteQuery)`, `get(id)`, `update(id, {name?, description?})`, `delete(id)`, `measurements(id, after?)`, `deleteMeasurement(id, mid)`, `markers(id)`, `addMarker(id, MarkerCreate)`, `deleteMarker(id, mid)`, `share(id)` → `{token}`, `unshare(id)` |
| `PublicApi` | `route(token)`, `measurements(token)`, `markers(token)` |
| `DevicesApi` | `list()`, `get(id)`, `rename(id, name)`, `command(id, 'new-route' \| 'battery')`, `health(id, {from?, to?})`, `import(id, File[])` |
| `EventsApi` | `list({deviceId?, type?, routeId?, page?, size?})` |
| `AlertsApi` | `list({state?, page?, size?})`, `count()`, `ack(id)`, `ackAll()`, `rules()`, `createRule()` (201), `updateRule(id, …)`, `deleteRule(id)` |
| `UsersApi` | `list()`, `create({username, password, role})`, `update(id, {role?, password?})`, `delete(id)` |
| `StatsApi` | `summary()`, `activity({from?, to?})` |
| `MapApi` | `grid({south, west, north, east, zoom, from?, to?, deviceId?})` |
| `SearchApi` | `search(q)` (< 2 chars → empty result, no request) |
| `AuthApi` | used by `AuthService` / `PrefsService` – do not call directly |

Types: `RouteDto` (`preview: {track: [lat, lon, usv][], spark: number[]}`), `MeasurementDto` (+ `hasPosition(m)`),
`MarkerDto`, `DeviceDto`, `HealthPoint`, `ImportResult`, `EventDto` (`EVENT_TYPES`), `AlertDto`, `AlertRuleDto` /
`AlertRuleInput` (`ALERT_TYPES`), `UserInfo`, `UserDto`, `Preferences`, `StatsSummary`, `ActivityDay`, `Grid`,
`SearchResult`, `Page<T>`. Dates are ISO strings; `from` / `to` / `after` accept ISO instants, `Date` or plain
`'YYYY-MM-DD'`. `toParams()` skips `undefined` / `null` / `''`.

Backend facts: `POST /api/alert-rules` → 201; passwords 10 characters to 72 **bytes** (`passwordValidator`);
usernames `USERNAME_PATTERN`; SD-card imports never appear on SSE and never trigger alerts (reload after an import);
acknowledging emits no SSE `alert` – acknowledge through `OpenAlertsStore.ack()` / `ackAll()` (or call its
`refresh()`), so the bell count stays right; `/api/events` accepts `routeId`; every mutation except preferences /
password / logout requires ADMIN (`AuthService.isAdmin()` – hide or disable for viewers).

## 5. Session, preferences, errors

- `AuthService`: `user()`, `isLoggedIn()`, `isAdmin()`, `preferences()`; `login()`, `logout()`,
  `changePassword(current, next, options?)` (400 = wrong current password → `{ silent: true }` and show it inline).
  Session restored before the first navigation; offline start falls back to the last user (cached data only).
- `PrefsService.prefs()` → `{theme, language, doseUnit, mapLayer}`; `update(patch)` applies at once and saves on the
  server when logged in (rejects and reverts on failure), else in localStorage.
- `ThemeService`: `theme()`, `isDark()`, `cycle()`, `resolveColor('--mat-sys-primary')` for canvas drawing (depend on
  `revision()` to follow theme switches).
- Errors: the interceptor shows a snackbar with problem+json `detail` for every failed request (unless silent) and
  on 401 ends the session → `/login?returnUrl=…`. Own messages: `Notifier.info(text)` / `error(text)`.

## 6. i18n

- Dictionaries `core/i18n/dict/<area>.pl.ts` (source of truth) + `<area>.en.ts` (typed – same keys required).
  Areas: `common` (shared words, errors, units), `nav` (shell, search), `auth`, `dashboard`, `routes` (list, detail,
  compare, export), `map`, `devices`, `alerts`, `events`, `settings`, `share`.
  **Each feature adds keys only to its own area files** – no conflicts; the compiler reports missing EN keys and
  unknown keys in templates (the `t` pipe only accepts `TranslationKey`).
- Template: `{{ 'routes.title' | t }}`, `{{ 'nav.search.noResults' | t: { q: query() } }}`.
  Plurals: `'{count, plural, one {# trasa} few {# trasy} many {# tras} other {# trasy}}'` (`=0 {…}` exact);
  numeric params are locale-formatted.
- Code: `i18n.t('routes.title')`; keys built at runtime: `i18n.translate(\`events.types.${e.type}\`)` (in templates
  use a typed `Record<…, TranslationKey>` map). `i18n.lang()`, `i18n.locale()` (`pl-PL` / `en-GB`).
- `mat-paginator` labels are already translated.

## 7. Units and formatting (`core/units`)

| Pipe | Example |
|---|---|
| `dose` | `m.usvPerHour \| dose` → `0,184 µSv/h` / `184 nSv/h` / `18,4 µR/h` (preference); `route.doseUsv \| dose: 'total'` → `0,012 µSv`; `\| dose: 'rate' : false` → number only |
| `distance` | `route.distanceM \| distance` → `850 m`, `12,4 km` |
| `duration` | `ms \| duration`; `route.startedAt \| duration: route.endedAt` (null end = until now) |
| `relativeTime` | `alert.ts \| relativeTime` → `5 min temu` (updates every 30 s; exact time in `title`) |
| `dateTime` | `ts \| dateTime` (`datetime`, `datetimeSeconds`, `date`, `dateLong`, `time`, `timeSeconds`, `dayMonth`) |
| `num` | `m.cpm \| num`, `value \| num: 1` |
| `csq` | `device.signalCsq \| csq` → `−77 dBm`; `\| csq: 'bars'` → 0–4; icon name: `csqIcon(csq)` |

Null → `—`. Data always stays in µSv/h; only formatting converts (`DoseFormat.convert / formatValue / parts /
unitLabel` in code, e.g. chart ticks). `DoseScale.color(usv)`, `rgba()`, `gradientCss()`, `legendStops()`, `palette()`
is the one source of dose colours; `NO_FIX_COLOR` for samples without GPS.

## 8. Shared components

| Component | Inputs (outputs) | Use |
|---|---|---|
| `app-dose-readout` | `value` (µSv/h \| null), `label`, `size` `lg \| md \| sm`, `live`, `showScale`, `max` | THE signature element: route max / average, live device cards (`role="meter"`) |
| `app-dose-legend` | `orientation`, `max`, `showNoFix` | next to charts; maps use the `MapFactory` legend option |
| `app-stat-tile` | `label` (req.), `value`, `unit`, `hint`, `icon`, `loading`; projected content | number tiles |
| `app-sparkline` | `values`, `tone` `dose \| neutral`, `height`, `strokeWidth`, `area`, `max`, `ariaLabel` | `route.preview.spark` |
| `app-track-thumbnail` | `track`, `width`, `height` (aspect), `ariaLabel` | `route.preview.track` |
| `app-empty-state` | `icon`, `title` (req.), `text`, `actionLabel` (`action`); projected buttons | empty lists, errors, 404 |
| `app-page-header` | `title` (req.), `subtitle`, `level` (default 2); slots `[headerMeta]`, `[headerActions]` | section heading row |
| `app-skeleton` | `shape` `rect \| text \| circle`, `width`, `height`, `lines` | loading placeholders |
| `Dialogs` (service) | `confirm({title, message?, confirmLabel?, destructive?})` → `Promise<boolean>`; `prompt({title, label, value?, maxLength?, multiline?, required?, hint?})` → `Promise<string \| null>` | confirmations, rename, marker label |

```html
<app-dose-readout [value]="route.value()?.maxUsv" [label]="'routes.stats.max' | t" size="lg" />
<div class="app-grid" style="--app-grid-min: 140px">
  <app-stat-tile [label]="'routes.stats.distance' | t" [value]="route.value()?.distanceM | distance" icon="straighten" />
  <app-stat-tile [label]="'routes.stats.samples' | t" [value]="route.value()?.sampleCount" />
</div>
<app-track-thumbnail [track]="r.preview?.track" [ariaLabel]="r.name" />
<app-sparkline [values]="r.preview?.spark ?? []" [height]="28" />
```
```ts
if (await this.dialogs.confirm({ title: this.i18n.t('common.dialog.deleteTitle'), message: r.name, destructive: true })) { … }
```

## 9. Maps (`shared/map`)

- `MapFactory.create(element, options)` → `{ map, layers, setBaseLayer(key), destroy() }`. Options: `center`, `zoom`,
  `layer` (default = preference), `layerSwitcher` (true), `overlays` (`{ [label]: layer }`), `fullscreen` (true)
  + `fullscreenTarget`, `legend: 'vertical' | 'horizontal'`, `legendNoFix`, `mapOptions`. Canvas renderer, translated
  controls, `invalidateSize` on resize, bundled marker icons.
- `TrackRenderer(map, { live?, weight?, halo?, gapMs? })`: `setMeasurements(list)`, `append(m)` (live; pulses the
  head), `setLive()`, `fitBounds()`, `bounds()`, `highlight(index | null, pan?)`, `onHover(cb)`, `nearestIndex()`,
  `destroy()`. Indices = positions in the **full** measurements array (no-GPS samples included) = chart indices.
- `HeatLayer(points: [lat, lon, usv][], { radius?, opacity?, saturation?, max?, cellSize? })`: canvas layer, colour =
  weighted mean dose, opacity = sample density; `setPoints()`.
- `BASE_LAYERS`, `createBaseLayer(key)`, `FullscreenControl`, `ElementControl` (any element as a control).

```ts
private readonly maps = inject(MapFactory);
private readonly destroyRef = inject(DestroyRef);
private readonly mapEl = viewChild.required<ElementRef<HTMLElement>>('map');
constructor() {
  afterNextRender(() => {
    const appMap = this.maps.create(this.mapEl().nativeElement, { legend: 'vertical', legendNoFix: true });
    const track = new TrackRenderer(appMap.map, { live: this.route.value()?.active });
    track.setMeasurements(this.measurements());
    track.fitBounds();
    track.onHover(index => this.hovered.set(index));
    this.destroyRef.onDestroy(() => { track.destroy(); appMap.destroy(); });
  });
}
```

## 10. Charts (`shared/chart`)

- Inject `ChartTheme` before creating charts (registers the needed Chart.js parts, keeps `Chart.defaults` in the M3
  colours). After a theme switch: `effect(() => { this.chartTheme.colors(); this.chart?.update('none'); })`.
- `doseDataset(measurements, label)`: µSv/h line, dose-coloured segments, grey no-GPS points; live:
  `(dataset.data as DosePoint[]).push(toDosePoint(m)); chart.update('none')`.
- `timeSeriesOptions({ locale, colors, yTicks?, yTitle?, crosshair? })`: linear epoch-ms x axis without a date
  adapter (`timeAxis(locale)`: round local-time ticks); comparisons: `elapsedAxis()` + `formatElapsed()`.
- `crosshairPlugin` + `setCrosshairIndex(chart, index | null)`: cursor line; hover reported via
  `plugins.appCrosshair.onHover`.

Map ↔ chart sync – one signal owns the hovered index:
```ts
readonly hovered = signal<number | null>(null);
this.chart = new Chart(canvas, {
  type: 'line',
  data: { datasets: [doseDataset(list, this.i18n.t('routes.stats.max'))] },
  options: timeSeriesOptions({ locale: this.i18n.locale(), colors: this.chartTheme.colors(),
    yTicks: v => this.dose.formatValue(v), crosshair: { onHover: i => this.hovered.set(i) } }),
  plugins: [crosshairPlugin],
});
effect(() => { const i = this.hovered(); if (this.chart) { setCrosshairIndex(this.chart, i); } this.track?.highlight(i); });
```

## 11. Live data (`core/live`)

`LiveService` keeps one EventSource open while logged in; `status()` (`connecting | live | offline`) drives the dot
in the top bar. Streams `measurement$`, `route$`, `device$`, `alert$`, `event$` (or `on('device')`) and
`reconnected$` (reload / catch up). For a live route:
```ts
this.live.routeMeasurements(id, () => this.lastTimestamp())   // catches up with ?after= after reconnects, dedupes ids
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe(m => { this.measurements.update(list => [...list, m]); this.track.append(m); });
```
Device lists merge `device$` by `id`; the route list applies `route$` (new routes, recomputed stats). Animate only
what changed (head pulse is in `TrackRenderer.append`, the readout needle moves by itself).

## 12. Export, PWA

- `exportRoute('gpx' | 'geojson' | 'csv', { route, measurements, markers })` builds and downloads the file
  (`toGpx`, `toGeoJson`, `toCsv`, `downloadFile`, `exportFileName` are also exported).
- PWA: `@angular/service-worker` (`ngsw-config.json`): app shell prefetched, assets lazy, `GET /api/**` freshness
  (5 s timeout, 7 days); `/api/stream` and `/api/auth/**` never cached. Offline the app shows the last data it saw;
  writes fail with the normal "no connection" snackbar.

## 13. Styling rules

- Colour: interface = `var(--mat-sys-*)`; the dose scale (`DoseScale`, `--app-dose-*`, `--app-dose-gradient`) is the
  only strong colour; `--mat-sys-tertiary` only for warnings / alerts; `--app-no-fix` for samples without GPS;
  `--app-live` for live / online status. No hard-coded hex colours in components.
- Type: Archivo only, body 14 px; headings `font-weight: 600; font-stretch: 112%` (`h1–h3` styled globally);
  numbers `.app-num` (tabular) or `.app-num-expanded` (600, width 125 %) for readouts and tiles; units smaller next
  to the number (`.app-unit`); sizes `.app-text-12 … -56`; descriptions ≤ 72 characters per line (`.app-measure`).
- Spacing 4 px grid: `--app-space-1…6` = 4 / 8 / 12 / 16 / 24 / 32. Radii: cards 12, fields 4, chips 8.
- `<mat-card>` is outlined by default; shadows only on floating elements. Icons: `<mat-icon>` = Material Symbols
  Rounded, filled variant with class `app-icon-filled`.
- Motion only where something changed; `prefers-reduced-motion` switches animations off globally.
- **Don't**: uppercase labels, "eyebrow" text above headings, `·` separators in metadata (separate elements with a gap
  or an icon), centred text blocks, decorative gradients or colours that are not data, generic SaaS card grids.
- Overlay content (menus, dialogs) lives outside component hosts – give `mat-menu` a `class` and style it in a global
  partial like `theme/_overlays.scss` only when needed.

## 14. Already provided by the shell

Navigation rail / bottom bar, top bar with page title, live dot, alerts bell (count, newest open alerts, acknowledge
all for admins), theme toggle, account menu, command palette (Ctrl/⌘+K or "/": pages, actions, routes / devices /
markers from `/api/search`, recent items; a marker opens `/routes/:routeId?marker=:id`), page-loading bar, skip link,
scroll to top on navigation.
