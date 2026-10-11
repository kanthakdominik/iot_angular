import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSidenavContent, MatSidenavModule } from '@angular/material/sidenav';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, pairwise, startWith } from 'rxjs';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CommandPaletteService } from '../command-palette/command-palette.service';
import { LayoutMode } from '../layout-mode';
import { BottomNav } from '../nav/bottom-nav';
import { NavRail } from '../nav/nav-rail';
import { TopBar } from '../top-bar/top-bar';

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

/**
 * App shell for logged-in pages: navigation rail (≥ 600 px) or bottom bar (phones), top app bar and the content
 * outlet. Global shortcuts: Ctrl/⌘+K and "/" open the command palette.
 */
@Component({
  selector: 'app-shell',
  imports: [BottomNav, MatSidenavModule, NavRail, RouterOutlet, TopBar, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class Shell {
  protected readonly layout = inject(LayoutMode);
  private readonly palette = inject(CommandPaletteService);
  // optional: the first NavigationEnd arrives before the shell's view exists
  private readonly content = viewChild(MatSidenavContent);

  constructor() {
    // the content area (not the window) scrolls: back to the top when the path changes (not for query changes)
    const router = inject(Router);
    router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects.split(/[?#]/)[0]),
      startWith(router.url.split(/[?#]/)[0]),
      pairwise(),
      filter(([previous, current]) => previous !== current),
      takeUntilDestroyed(),
    ).subscribe(() => this.content()?.scrollTo({ top: 0 }));
  }

  protected onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.palette.open();
    } else if (event.key === '/' && !event.ctrlKey && !event.metaKey && !isEditable(event.target)) {
      event.preventDefault();
      this.palette.open();
    }
  }

  /** In-page skip link (a plain `href="#main"` would navigate to "/#main" because of `<base href="/">`). */
  protected skipToMain(event: Event, main: HTMLElement): void {
    event.preventDefault();
    main.focus();
  }
}
