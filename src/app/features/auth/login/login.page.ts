import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { LANGS, Lang } from '../../../core/api/users.models';
import { AuthService } from '../../../core/auth/auth.service';
import { safeReturnUrl } from '../../../core/auth/guards';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslationKey } from '../../../core/i18n/pl';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Notifier } from '../../../core/notify/notifier';
import { PrefsService } from '../../../core/prefs/prefs.service';
import { ThemeService } from '../../../core/prefs/theme.service';
import { THEME_ICONS, THEME_LABEL_KEYS } from '../../../layout/nav/nav-items';
import { TERRAIN_HEIGHT, TERRAIN_WIDTH, terrain } from './terrain';

const LANG_LABEL_KEYS: Readonly<Record<Lang, TranslationKey>> = { pl: 'common.language.pl', en: 'common.language.en' };

/** `/login`: split layout – a contour-map panel with a dose-coloured track, and the sign-in form. */
@Component({
  selector: 'app-login-page',
  imports: [
    MatButtonModule, MatButtonToggleModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressSpinnerModule, MatTooltipModule, ReactiveFormsModule, TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifier = inject(Notifier);
  protected readonly i18n = inject(I18nService);
  protected readonly prefs = inject(PrefsService);
  protected readonly theme = inject(ThemeService);

  /** `?returnUrl=` set by the auth guard / after an expired session. */
  readonly returnUrl = input<string>();

  protected readonly terrain = terrain();
  protected readonly viewBox = `0 0 ${TERRAIN_WIDTH} ${TERRAIN_HEIGHT}`;
  protected readonly languages = LANGS.map(lang => ({ lang, labelKey: LANG_LABEL_KEYS[lang] }));

  protected readonly form = inject(NonNullableFormBuilder).group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected readonly themeIcon = computed(() => THEME_ICONS[this.theme.theme()]);
  protected readonly themeLabel = computed(() =>
    this.i18n.t('common.theme.toggle', { theme: this.i18n.t(THEME_LABEL_KEYS[this.theme.theme()]) }));

  protected submit(): void {
    if (this.pending()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { username, password } = this.form.getRawValue();
    this.pending.set(true);
    this.error.set(null);
    this.auth.login(username.trim(), password).subscribe({
      next: () => void this.router.navigateByUrl(safeReturnUrl(this.returnUrl())),
      error: (error: unknown) => {
        this.pending.set(false);
        this.error.set(this.message(error));
        this.form.controls.password.reset();
      },
    });
  }

  protected setLanguage(event: MatButtonToggleChange): void {
    void this.prefs.update({ language: event.value as Lang });
  }

  private message(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 0:
          return this.i18n.t('auth.login.network');
        case 401:
          return this.i18n.t('auth.login.invalidCredentials');
        case 429:
          return this.i18n.t('auth.login.tooManyAttempts');
      }
    }
    return this.notifier.describe(error);
  }
}
