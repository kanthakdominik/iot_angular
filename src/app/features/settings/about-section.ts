import { DOCUMENT, ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslationKey } from '../../core/i18n/pl';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LiveService, LiveStatus } from '../../core/live/live.service';

const LIVE_KEYS: Readonly<Record<LiveStatus, TranslationKey>> = {
  live: 'settings.about.liveOn',
  connecting: 'settings.about.liveConnecting',
  offline: 'settings.about.liveOff',
};

/** About the app: what it is, installing it as an app (PWA), the live connection and keyboard shortcuts. */
@Component({
  selector: 'app-about-section',
  imports: [MatIconModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section-head">
      <div>
        <h2>{{ 'common.appName' | t }}</h2>
        <p class="app-muted app-measure">{{ 'common.appTagline' | t }}</p>
      </div>
    </div>

    <div class="card">
      <h3>{{ 'settings.about.installTitle' | t }}</h3>
      @if (installed()) {
        <p class="line"><mat-icon aria-hidden="true">check_circle</mat-icon>{{ 'settings.about.installed' | t }}</p>
      } @else {
        <p class="app-measure">{{ 'settings.about.installText' | t }}</p>
        <ul class="hints">
          <li><mat-icon aria-hidden="true">phone_android</mat-icon>{{ 'settings.about.installAndroid' | t }}</li>
          <li><mat-icon aria-hidden="true">phone_iphone</mat-icon>{{ 'settings.about.installIos' | t }}</li>
          <li><mat-icon aria-hidden="true">computer</mat-icon>{{ 'settings.about.installDesktop' | t }}</li>
        </ul>
      }
      <p class="app-muted app-measure">{{ 'settings.about.offline' | t }}</p>
    </div>

    <div class="card">
      <h3>{{ 'settings.about.liveTitle' | t }}</h3>
      <p class="line">
        <span class="dot" [attr.data-status]="live.status()" aria-hidden="true"></span>
        {{ liveKey() | t }}
      </p>
      <p class="app-muted app-measure">{{ 'settings.about.liveText' | t }}</p>
    </div>

    <div class="card">
      <h3>{{ 'settings.about.shortcutsTitle' | t }}</h3>
      <p class="line"><kbd>{{ modifier() }}</kbd><kbd>K</kbd><span>{{ 'settings.about.shortcutSearch' | t }}</span></p>
      <p class="line"><kbd>/</kbd><span>{{ 'settings.about.shortcutSearch' | t }}</span></p>
    </div>
  `,
  styleUrl: './settings-section.scss',
  styles: `
    .line {
      display: flex;
      align-items: center;
      gap: var(--app-space-2);

      mat-icon {
        color: var(--app-live);
      }
    }

    .hints {
      display: flex;
      flex-direction: column;
      gap: var(--app-space-2);
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: flex-start;
        gap: var(--app-space-2);
      }

      mat-icon {
        flex: none;
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--app-offline);

      &[data-status='live'] {
        background: var(--app-live);
      }

      &[data-status='connecting'] {
        background: var(--mat-sys-tertiary);
      }
    }
  `,
})
export class AboutSection {
  protected readonly live = inject(LiveService);
  private readonly window = inject(DOCUMENT).defaultView;

  protected readonly installed = signal(
    !!this.window?.matchMedia?.('(display-mode: standalone)').matches
    || (this.window?.navigator as { standalone?: boolean } | undefined)?.standalone === true);
  protected readonly modifier = signal(/Mac|iPhone|iPad/.test(this.window?.navigator.platform ?? '') ? '⌘' : 'Ctrl');
  protected readonly liveKey = computed(() => LIVE_KEYS[this.live.status()]);
}
