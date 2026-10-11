import { ChangeDetectionStrategy, Component, booleanAttribute, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslationKey } from '../../core/i18n/pl';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LiveService, LiveStatus } from '../../core/live/live.service';
import { ThemeService } from '../../core/prefs/theme.service';
import { CommandPaletteService } from '../command-palette/command-palette.service';
import { THEME_ICONS, THEME_LABEL_KEYS } from '../nav/nav-items';
import { NotificationsButton } from '../notifications/notifications-button';
import { PageTitle } from '../page-title';

const LIVE_LABELS: Readonly<Record<LiveStatus, TranslationKey>> = {
  live: 'nav.live.live',
  connecting: 'nav.live.connecting',
  offline: 'nav.live.offline',
};

/**
 * Top app bar: page title (the page `<h1>`), live connection dot, search (opens the command palette),
 * alerts bell; on wider screens also the theme toggle and the account menu (on phones they are under "More").
 */
@Component({
  selector: 'app-top-bar',
  imports: [
    MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule, MatTooltipModule, NotificationsButton, RouterLink,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './top-bar.html',
  styleUrl: './top-bar.scss',
})
export class TopBar {
  protected readonly auth = inject(AuthService);
  protected readonly live = inject(LiveService);
  protected readonly theme = inject(ThemeService);
  protected readonly palette = inject(CommandPaletteService);
  protected readonly pageTitle = inject(PageTitle);
  private readonly i18n = inject(I18nService);

  /** Phone layout: icon-only search, no theme toggle / account menu. */
  readonly compact = input(false, { transform: booleanAttribute });

  protected readonly shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';
  protected readonly liveLabel = computed(() => this.i18n.t(LIVE_LABELS[this.live.status()]));
  protected readonly themeIcon = computed(() => THEME_ICONS[this.theme.theme()]);
  protected readonly themeLabel = computed(() =>
    this.i18n.t('common.theme.toggle', { theme: this.i18n.t(THEME_LABEL_KEYS[this.theme.theme()]) }));
  protected readonly initial = computed(() => (this.auth.user()?.username.charAt(0) ?? '?').toUpperCase());
  protected readonly roleKey = computed<TranslationKey>(() =>
    this.auth.isAdmin() ? 'common.roles.ADMIN' : 'common.roles.VIEWER');
}
