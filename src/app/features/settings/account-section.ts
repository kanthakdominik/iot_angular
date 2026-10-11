import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH, Role } from '../../core/api/users.models';
import { AuthService } from '../../core/auth/auth.service';
import { passwordValidator } from '../../core/auth/validators';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslationKey } from '../../core/i18n/pl';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Notifier } from '../../core/notify/notifier';
import { passwordsMatch } from './password-match';

export const ROLE_KEYS: Readonly<Record<Role, TranslationKey>> = {
  ADMIN: 'common.roles.ADMIN',
  VIEWER: 'common.roles.VIEWER',
};

/** The signed-in account and changing its password (a wrong current password is shown at the field). */
@Component({
  selector: 'app-account-section',
  imports: [
    MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, ReactiveFormsModule,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-section.html',
  styleUrl: './settings-section.scss',
})
export class AccountSection {
  protected readonly auth = inject(AuthService);
  private readonly notifier = inject(Notifier);
  private readonly i18n = inject(I18nService);

  protected readonly roleKeys = ROLE_KEYS;
  protected readonly minLength = PASSWORD_MIN_LENGTH;
  protected readonly maxBytes = PASSWORD_MAX_BYTES;
  protected readonly form = new FormGroup({
    current: new FormControl('', { nonNullable: true, validators: Validators.required }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, passwordValidator] }),
    confirm: new FormControl('', { nonNullable: true, validators: Validators.required }),
  }, { validators: passwordsMatch() });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  private readonly currentInput = viewChild<ElementRef<HTMLInputElement>>('currentInput');
  private readonly formDirective = viewChild(FormGroupDirective);

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { current, password } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.auth.changePassword(current, password, { silent: true }).subscribe({
      next: () => {
        this.saving.set(false);
        this.formDirective()?.resetForm();
        this.showPassword.set(false);
        this.notifier.info(this.i18n.t('auth.password.changed'));
      },
      error: (error: unknown) => {
        this.saving.set(false);
        if (error instanceof HttpErrorResponse && error.status === 400) {
          this.form.controls.current.setErrors({ wrongCurrent: true });
          this.form.controls.current.markAsTouched();
          this.currentInput()?.nativeElement.focus();
        } else {
          this.error.set(this.notifier.describe(error));
        }
      },
    });
  }
}
