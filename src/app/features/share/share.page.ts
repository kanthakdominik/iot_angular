import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, merge, switchMap, tap } from 'rxjs';
import { LANGS, Lang } from '../../core/api/users.models';
import { MarkerDto, MeasurementDto, PublicApi, RouteDto } from '../../core/api';
import { AuthService } from '../../core/auth/auth.service';
import { ExportFormat, exportRoute } from '../../core/export/export';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslationKey } from '../../core/i18n/pl';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Notifier } from '../../core/notify/notifier';
import { PrefsService } from '../../core/prefs/prefs.service';
import { ThemeService } from '../../core/prefs/theme.service';
import { PageTitle } from '../../layout/page-title';
import { THEME_ICONS, THEME_LABEL_KEYS } from '../../layout/nav/nav-items';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { RouteView, SamplesState } from '../routes/route-view/route-view';

type ShareState = 'loading' | 'ready' | 'notFound' | 'error';

const LANG_LABEL_KEYS: Readonly<Record<Lang, TranslationKey>> = { pl: 'common.language.pl', en: 'common.language.en' };

/** `/share/:token` – public, read-only route view (no session, no live updates, no admin actions). */
@Component({
  selector: 'app-share-page',
  imports: [
    EmptyState, MatButtonModule, MatButtonToggleModule, MatIconModule, MatMenuModule, MatTooltipModule, RouteView,
    RouterLink, Skeleton, TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './share.page.html',
  styleUrl: './share.page.scss',
})
export class SharePage {
  private readonly api = inject(PublicApi);
  private readonly notifier = inject(Notifier);
  private readonly prefs = inject(PrefsService);
  private readonly pageTitle = inject(PageTitle);
  protected readonly i18n = inject(I18nService);
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);

  /** Share token from the URL (`/share/:token`). */
  readonly token = input.required<string>();

  protected readonly state = signal<ShareState>('loading');
  protected readonly errorText = signal('');
  protected readonly route = signal<RouteDto | null>(null);
  protected readonly measurements = signal<readonly MeasurementDto[]>([]);
  protected readonly samplesState = signal<SamplesState>('loading');
  protected readonly markers = signal<readonly MarkerDto[]>([]);
  private readonly reloads = signal(0);

  protected readonly languages = LANGS.map(lang => ({ lang, labelKey: LANG_LABEL_KEYS[lang] }));
  protected readonly themeIcon = computed(() => THEME_ICONS[this.theme.theme()]);
  protected readonly themeLabel = computed(() =>
    this.i18n.t('common.theme.toggle', { theme: this.i18n.t(THEME_LABEL_KEYS[this.theme.theme()]) }));

  constructor() {
    effect(() => this.pageTitle.set(this.route()?.name ?? null));

    toObservable(computed(() => ({ token: this.token(), reload: this.reloads() }))).pipe(
      switchMap(({ token }) => {
        this.state.set('loading');
        this.samplesState.set('loading');
        this.route.set(null);
        this.measurements.set([]);
        this.markers.set([]);
        const route$ = this.api.route(token, { silent: true }).pipe(
          tap(route => {
            this.route.set(route);
            this.state.set('ready');
          }),
          catchError((error: unknown) => {
            const notFound = error instanceof HttpErrorResponse && (error.status === 404 || error.status === 400);
            this.state.set(notFound ? 'notFound' : 'error');
            this.errorText.set(this.notifier.describe(error));
            return EMPTY;
          }),
        );
        const samples$ = this.api.measurements(token, { silent: true }).pipe(
          tap(list => {
            this.measurements.set(list);
            this.samplesState.set('ready');
          }),
          catchError(() => {
            this.samplesState.set('error');
            return EMPTY;
          }),
        );
        const markers$ = this.api.markers(token, { silent: true }).pipe(
          tap(list => this.markers.set(list)),
          catchError(() => EMPTY),
        );
        return merge(route$, samples$, markers$);
      }),
      takeUntilDestroyed(),
    ).subscribe();
  }

  protected reload(): void {
    this.reloads.update(n => n + 1);
  }

  protected setLanguage(event: MatButtonToggleChange): void {
    void this.prefs.update({ language: event.value as Lang }).catch(() => undefined);
  }

  protected cycleTheme(): void {
    void this.theme.cycle().catch(() => undefined);
  }

  protected export(format: ExportFormat): void {
    const route = this.route();
    if (route) {
      exportRoute(format, { route, measurements: this.measurements(), markers: this.markers() });
    }
  }
}
