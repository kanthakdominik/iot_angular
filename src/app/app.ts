import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DateAdapter } from '@angular/material/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {
  NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { I18nService } from './core/i18n/i18n.service';
import { TranslatePipe } from './core/i18n/translate.pipe';
import { PageTitle } from './layout/page-title';

/** Root: router outlet plus a thin progress bar while a (lazy) page loads. */
@Component({
  selector: 'app-root',
  imports: [MatProgressBarModule, RouterOutlet, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (navigating()) {
      <mat-progress-bar class="progress" mode="indeterminate" [attr.aria-label]="'nav.loadingPage' | t" />
    }
    <router-outlet />
  `,
  styles: `
    .progress {
      position: fixed;
      inset: 0 0 auto;
      z-index: 20;
      // appears only when loading takes longer than 200 ms
      animation: app-delayed-appear 0s 200ms both;
    }

    @keyframes app-delayed-appear {
      from { visibility: hidden; }
      to { visibility: visible; }
    }
  `,
})
export class App {
  private readonly router = inject(Router);

  protected readonly navigating = toSignal(
    this.router.events.pipe(
      filter(event => event instanceof NavigationStart || event instanceof NavigationEnd
        || event instanceof NavigationCancel || event instanceof NavigationError),
      map(event => event instanceof NavigationStart),
    ),
    { initialValue: false },
  );

  constructor() {
    inject(PageTitle);
    const i18n = inject(I18nService);
    const dateAdapter = inject(DateAdapter);
    effect(() => dateAdapter.setLocale(i18n.locale()));
  }
}
