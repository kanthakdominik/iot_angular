import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UsersApi } from '../../core/api/users.api';
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH, Role, UserDto } from '../../core/api/users.models';
import { passwordValidator, usernameValidator } from '../../core/auth/validators';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Notifier } from '../../core/notify/notifier';
import { ROLE_KEYS } from './account-section';
import { passwordsMatch } from './password-match';

const DIALOG_IMPORTS = [
  MatButtonModule, MatButtonToggleModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule,
  MatProgressSpinnerModule, ReactiveFormsModule, TranslatePipe,
];

const PASSWORD_FIELDS = `
  <mat-form-field>
    <mat-label>{{ 'auth.password.new' | t }}</mat-label>
    <input matInput [type]="showPassword() ? 'text' : 'password'" formControlName="password" autocomplete="new-password"
           required />
    <button matIconButton matIconSuffix type="button" (click)="showPassword.set(!showPassword())"
            [attr.aria-label]="(showPassword() ? 'auth.login.hidePassword' : 'auth.login.showPassword') | t"
            [attr.aria-pressed]="showPassword()">
      <mat-icon aria-hidden="true">{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
    </button>
    <mat-hint>{{ 'settings.account.passwordHint' | t: { min: minLength } }}</mat-hint>
    @if (form.controls.password.hasError('passwordTooShort')) {
      <mat-error>{{ 'auth.password.tooShort' | t: { min: minLength } }}</mat-error>
    } @else if (form.controls.password.hasError('passwordTooLong')) {
      <mat-error>{{ 'auth.password.tooLong' | t: { max: maxBytes } }}</mat-error>
    } @else {
      <mat-error>{{ 'common.dialog.required' | t }}</mat-error>
    }
  </mat-form-field>
  <mat-form-field>
    <mat-label>{{ 'auth.password.repeat' | t }}</mat-label>
    <input matInput [type]="showPassword() ? 'text' : 'password'" formControlName="confirm" autocomplete="new-password"
           required />
    @if (form.controls.confirm.hasError('mismatch')) {
      <mat-error>{{ 'auth.password.mismatch' | t }}</mat-error>
    } @else {
      <mat-error>{{ 'common.dialog.required' | t }}</mat-error>
    }
  </mat-form-field>
`;

const ERROR_BANNER = `
  @if (error(); as message) {
    <div class="banner" role="alert">
      <mat-icon aria-hidden="true">error</mat-icon>
      <span>{{ message }}</span>
    </div>
  }
`;

const DIALOG_STYLES = `
  .fields {
    display: flex;
    flex-direction: column;
    gap: var(--app-space-3);
    width: min(420px, 100%);
    padding-top: var(--app-space-2) !important;
  }

  .banner {
    display: flex;
    align-items: flex-start;
    gap: var(--app-space-2);
    padding: var(--app-space-3);
    border-radius: var(--app-radius-chip);
    background: var(--mat-sys-error-container);
    color: var(--mat-sys-on-error-container);
  }

  .role-label {
    font: var(--mat-sys-label-large);
    color: var(--mat-sys-on-surface-variant);
  }

  .role-hint {
    font-size: 12px;
    line-height: 16px;
    color: var(--mat-sys-on-surface-variant);
  }

  mat-spinner {
    display: inline-block;
    margin-inline-end: 8px;
  }
`;

/** Creates a user (ADMIN). A taken name (409) is shown at the username field; closes with the new user. */
@Component({
  selector: 'app-user-create-dialog',
  imports: DIALOG_IMPORTS,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <h2 mat-dialog-title>{{ 'settings.users.addTitle' | t }}</h2>
      <mat-dialog-content class="fields">
        ${ERROR_BANNER}
        <mat-form-field>
          <mat-label>{{ 'settings.account.username' | t }}</mat-label>
          <input matInput formControlName="username" autocomplete="off" autocapitalize="off" spellcheck="false"
                 maxlength="50" required cdkFocusInitial />
          <mat-hint>{{ 'auth.username.invalid' | t }}</mat-hint>
          @if (form.controls.username.hasError('taken')) {
            <mat-error>{{ 'settings.users.errors.taken' | t }}</mat-error>
          } @else if (form.controls.username.hasError('pattern')) {
            <mat-error>{{ 'auth.username.invalid' | t }}</mat-error>
          } @else {
            <mat-error>{{ 'common.dialog.required' | t }}</mat-error>
          }
        </mat-form-field>
        ${PASSWORD_FIELDS}
        <span class="role-label" id="new-user-role">{{ 'settings.account.role' | t }}</span>
        <mat-button-toggle-group formControlName="role" hideSingleSelectionIndicator aria-labelledby="new-user-role">
          <mat-button-toggle value="VIEWER">{{ roleKeys.VIEWER | t }}</mat-button-toggle>
          <mat-button-toggle value="ADMIN">{{ roleKeys.ADMIN | t }}</mat-button-toggle>
        </mat-button-toggle-group>
        <span class="role-hint">
          {{ (form.controls.role.value === 'ADMIN' ? 'settings.account.adminHint' : 'settings.account.viewerHint') | t }}
        </span>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>{{ 'common.actions.cancel' | t }}</button>
        <button matButton="filled" type="submit" [disabled]="saving()">
          @if (saving()) {
            <mat-spinner diameter="18" aria-hidden="true" />
          }
          {{ 'settings.users.add' | t }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: DIALOG_STYLES,
})
export class UserCreateDialog {
  private readonly api = inject(UsersApi);
  private readonly notifier = inject(Notifier);
  private readonly dialogRef = inject<MatDialogRef<UserCreateDialog, UserDto>>(MatDialogRef);

  protected readonly roleKeys = ROLE_KEYS;
  protected readonly minLength = PASSWORD_MIN_LENGTH;
  protected readonly maxBytes = PASSWORD_MAX_BYTES;
  protected readonly form = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required, usernameValidator] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, passwordValidator] }),
    confirm: new FormControl('', { nonNullable: true, validators: Validators.required }),
    role: new FormControl<Role>('VIEWER', { nonNullable: true }),
  }, { validators: passwordsMatch() });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { username, password, role } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.api.create({ username: username.trim(), password, role }, { silent: true }).subscribe({
      next: user => this.dialogRef.close(user),
      error: (error: unknown) => {
        this.saving.set(false);
        if (error instanceof HttpErrorResponse && error.status === 409) {
          this.form.controls.username.setErrors({ taken: true });
          this.form.controls.username.markAsTouched();
        } else {
          this.error.set(this.notifier.describe(error));
        }
      },
    });
  }
}

export interface PasswordResetDialogData {
  readonly user: UserDto;
}

/** Sets a new password for another user (ADMIN); closes with true when saved. */
@Component({
  selector: 'app-password-reset-dialog',
  imports: DIALOG_IMPORTS,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <h2 mat-dialog-title>{{ 'settings.users.resetTitle' | t: { name: data.user.username } }}</h2>
      <mat-dialog-content class="fields">
        <p class="role-hint">{{ 'settings.users.resetText' | t }}</p>
        <input type="text" class="app-visually-hidden" autocomplete="username" [value]="data.user.username"
               tabindex="-1" aria-hidden="true" readonly />
        ${ERROR_BANNER}
        ${PASSWORD_FIELDS}
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>{{ 'common.actions.cancel' | t }}</button>
        <button matButton="filled" type="submit" [disabled]="saving()">
          @if (saving()) {
            <mat-spinner diameter="18" aria-hidden="true" />
          }
          {{ 'settings.users.resetSubmit' | t }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: DIALOG_STYLES,
})
export class PasswordResetDialog {
  protected readonly data = inject<PasswordResetDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(UsersApi);
  private readonly notifier = inject(Notifier);
  private readonly dialogRef = inject<MatDialogRef<PasswordResetDialog, boolean>>(MatDialogRef);

  protected readonly minLength = PASSWORD_MIN_LENGTH;
  protected readonly maxBytes = PASSWORD_MAX_BYTES;
  protected readonly form = new FormGroup({
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, passwordValidator] }),
    confirm: new FormControl('', { nonNullable: true, validators: Validators.required }),
  }, { validators: passwordsMatch() });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.api.update(this.data.user.id, { password: this.form.getRawValue().password }, { silent: true }).subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(this.notifier.describe(error));
      },
    });
  }
}
