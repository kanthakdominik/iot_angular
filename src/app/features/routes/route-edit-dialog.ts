import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouteDto, RoutesApi } from '../../core/api';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Notifier } from '../../core/notify/notifier';

export const ROUTE_NAME_MAX = 100;
export const ROUTE_DESCRIPTION_MAX = 2000;

const notBlank: ValidatorFn = control =>
  typeof control.value === 'string' && !control.value.trim() ? { required: true } : null;

/** Edits name and description of a route (PATCH); closes with the updated route. */
@Component({
  selector: 'app-route-edit-dialog',
  imports: [MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <h2 mat-dialog-title>{{ 'routes.edit.title' | t }}</h2>
      <mat-dialog-content class="fields">
        <mat-form-field>
          <mat-label>{{ 'routes.edit.name' | t }}</mat-label>
          <input matInput formControlName="name" [attr.maxlength]="nameMax" autocomplete="off" cdkFocusInitial />
          @if (form.controls.name.hasError('required')) {
            <mat-error>{{ 'common.dialog.required' | t }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'routes.edit.description' | t }}</mat-label>
          <textarea matInput formControlName="description" rows="5" [attr.maxlength]="descriptionMax"></textarea>
          <mat-hint align="end" class="app-num">{{ form.controls.description.value.length }} / {{ descriptionMax }}</mat-hint>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" (click)="dialogRef.close()">{{ 'common.actions.cancel' | t }}</button>
        <button matButton="filled" type="submit" [disabled]="saving()">{{ 'common.actions.save' | t }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .fields {
      display: flex;
      flex-direction: column;
      gap: var(--app-space-3);
      width: min(520px, 100%);
      padding-top: 4px;
    }
  `,
})
export class RouteEditDialog {
  private readonly api = inject(RoutesApi);
  private readonly notifier = inject(Notifier);
  private readonly i18n = inject(I18nService);
  protected readonly route = inject<RouteDto>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject<MatDialogRef<RouteEditDialog, RouteDto>>(MatDialogRef);

  protected readonly nameMax = ROUTE_NAME_MAX;
  protected readonly descriptionMax = ROUTE_DESCRIPTION_MAX;
  protected readonly saving = signal(false);
  protected readonly form = new FormGroup({
    name: new FormControl(this.route.name, {
      nonNullable: true,
      validators: [Validators.required, notBlank, Validators.maxLength(ROUTE_NAME_MAX)],
    }),
    description: new FormControl(this.route.description ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(ROUTE_DESCRIPTION_MAX)],
    }),
  });

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) {
      return;
    }
    const name = this.form.controls.name.value.trim();
    const description = this.form.controls.description.value.trim();
    this.saving.set(true);
    this.api.update(this.route.id, { name, description }).subscribe({
      next: route => {
        this.notifier.info(this.i18n.t('routes.edit.saved'));
        this.dialogRef.close(route);
      },
      error: () => this.saving.set(false),
    });
  }
}
