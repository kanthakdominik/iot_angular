import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { OpenAlertsStore } from '../../core/alerts/open-alerts.store';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ThemeService } from '../../core/prefs/theme.service';
import { NAV_ITEMS, THEME_ICONS, THEME_LABEL_KEYS } from './nav-items';

/** Phone navigation (< 600 px): 4 destinations + "More" (alerts, events, settings, theme, sign out). */
@Component({
  selector: 'app-bottom-nav',
  imports: [MatBadgeModule, MatDividerModule, MatIconModule, MatMenuModule, RouterLink, RouterLinkActive, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.scss',
})
export class BottomNav {
  protected readonly alerts = inject(OpenAlertsStore);
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected readonly primary = NAV_ITEMS.filter(item => item.bottom);
  protected readonly secondary = NAV_ITEMS.filter(item => !item.bottom);
  protected readonly themeIcons = THEME_ICONS;

  private readonly url = toSignal(
    this.router.events.pipe(filter(event => event instanceof NavigationEnd), map(event => event.urlAfterRedirects)),
    { initialValue: this.router.url },
  );
  /** "More" is highlighted when one of its destinations is open. */
  protected readonly moreActive = computed(() => this.secondary.some(item => this.url().startsWith(item.path)));
  protected readonly themeLabel = computed(() =>
    this.i18n.t('common.theme.toggle', { theme: this.i18n.t(THEME_LABEL_KEYS[this.theme.theme()]) }));
  protected readonly badge = computed(() => (this.alerts.count() > 99 ? '99+' : String(this.alerts.count())));
}
