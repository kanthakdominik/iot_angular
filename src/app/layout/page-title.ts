import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, NavigationStart, Router } from '@angular/router';
import { I18nService } from '../core/i18n/i18n.service';

/**
 * Title shown in the top bar (and `document.title`): the translated `data.titleKey` of the active route, or a value
 * set by the page – e.g. the route name: `effect(() => pageTitle.set(route()?.name ?? null))`. The override is
 * cleared at the start of every navigation.
 */
@Injectable({ providedIn: 'root' })
export class PageTitle {
  private readonly i18n = inject(I18nService);
  private readonly titleKey = signal<string | null>(null);
  private readonly override = signal<string | null>(null);

  readonly title = computed(() => {
    const key = this.titleKey();
    return this.override() ?? (key ? this.i18n.translate(key) : this.i18n.t('common.appName'));
  });

  constructor() {
    const router = inject(Router);
    const document = inject(DOCUMENT);
    router.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationStart) {
        this.override.set(null);
      } else if (event instanceof NavigationEnd) {
        let snapshot: ActivatedRouteSnapshot = router.routerState.snapshot.root;
        let key: unknown = snapshot.data['titleKey'];
        while (snapshot.firstChild) {
          snapshot = snapshot.firstChild;
          key = snapshot.data['titleKey'] ?? key;
        }
        this.titleKey.set(typeof key === 'string' ? key : null);
      }
    });
    effect(() => {
      const app = this.i18n.t('common.appName');
      const title = this.title();
      document.title = title === app ? app : `${title} – ${app}`;
    });
  }

  set(title: string | null): void {
    this.override.set(title);
  }
}
