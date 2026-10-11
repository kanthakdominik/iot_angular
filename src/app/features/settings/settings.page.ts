import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { TranslationKey } from '../../core/i18n/pl';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AboutSection } from './about-section';
import { AccountSection } from './account-section';
import { PreferencesSection } from './preferences-section';
import { UsersSection } from './users-section';

type SettingsTab = 'preferences' | 'account' | 'users' | 'about';

const TAB_LABELS: Readonly<Record<SettingsTab, TranslationKey>> = {
  preferences: 'settings.preferences.title',
  account: 'settings.account.title',
  users: 'settings.users.title',
  about: 'settings.about.title',
};

/** `/settings`: preferences, account (password), users (ADMIN only) and about – one tab each, `?tab=` in the URL. */
@Component({
  selector: 'app-settings-page',
  imports: [AboutSection, AccountSection, MatTabsModule, PreferencesSection, TranslatePipe, UsersSection],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-page">
      <mat-tab-group [selectedIndex]="index()" (selectedIndexChange)="select($event)" animationDuration="0ms"
                     mat-stretch-tabs="false" mat-align-tabs="start" [attr.aria-label]="'settings.title' | t">
        @for (tab of tabs(); track tab) {
          <mat-tab [label]="labels[tab] | t">
            <ng-template matTabContent>
              <div class="panel">
                @switch (tab) {
                  @case ('preferences') { <app-preferences-section /> }
                  @case ('account') { <app-account-section /> }
                  @case ('users') { <app-users-section /> }
                  @case ('about') { <app-about-section /> }
                }
              </div>
            </ng-template>
          </mat-tab>
        }
      </mat-tab-group>
    </div>
  `,
  styles: `
    .panel {
      padding-top: var(--app-space-5);
    }
  `,
})
export class SettingsPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** `?tab=preferences|account|users|about` */
  readonly tab = input<string>();

  protected readonly labels = TAB_LABELS;
  /** Viewers never see the users tab. */
  protected readonly tabs = computed<SettingsTab[]>(() =>
    this.auth.isAdmin() ? ['preferences', 'account', 'users', 'about'] : ['preferences', 'account', 'about']);
  protected readonly index = computed(() => Math.max(0, this.tabs().indexOf(this.tab() as SettingsTab)));

  protected select(index: number): void {
    if (index === this.index()) {
      return;
    }
    const tab = this.tabs()[index];
    void this.router.navigate([], {
      queryParams: { tab: tab === 'preferences' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
