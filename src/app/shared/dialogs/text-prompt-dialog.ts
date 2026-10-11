import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

export interface TextPromptDialogData {
  readonly title: string;
  readonly label: string;
  readonly value?: string;
  readonly hint?: string;
  readonly placeholder?: string;
  /** Default 100. */
  readonly maxLength?: number;
  /** Default true. */
  readonly required?: boolean;
  /** Textarea instead of a single-line input. */
  readonly multiline?: boolean;
  /** Default: "Zapisz" / "Save". */
  readonly confirmLabel?: string;
}

/** Asks for one text value (rename, marker label, description). Closes with the trimmed text. */
@Component({
  selector: 'app-text-prompt-dialog',
  imports: [MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form (ngSubmit)="submit()">
      <h2 mat-dialog-title>{{ data.title }}</h2>
      <mat-dialog-content>
        <mat-form-field class="field">
          <mat-label>{{ data.label }}</mat-label>
          @if (data.multiline) {
            <textarea matInput [formControl]="control" [placeholder]="data.placeholder ?? ''" rows="4"
                      [attr.maxlength]="maxLength" cdkFocusInitial></textarea>
          } @else {
            <input matInput [formControl]="control" [placeholder]="data.placeholder ?? ''"
                   [attr.maxlength]="maxLength" autocomplete="off" cdkFocusInitial />
          }
          @if (data.hint) {
            <mat-hint>{{ data.hint }}</mat-hint>
          }
          @if (control.hasError('required')) {
            <mat-error>{{ 'common.dialog.required' | t }}</mat-error>
          } @else if (control.hasError('maxlength')) {
            <mat-error>{{ 'common.dialog.maxLength' | t: { max: maxLength } }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" (click)="dialogRef.close()">{{ 'common.actions.cancel' | t }}</button>
        <button matButton="filled" type="submit">{{ data.confirmLabel ?? ('common.actions.save' | t) }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .field {
      width: min(440px, 100%);
      margin-top: 4px;
    }
  `,
})
export class TextPromptDialog {
  protected readonly data = inject<TextPromptDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject<MatDialogRef<TextPromptDialog, string>>(MatDialogRef);

  protected readonly maxLength = this.data.maxLength ?? 100;
  protected readonly control = new FormControl(this.data.value ?? '', {
    nonNullable: true,
    validators: [
      ...(this.data.required === false ? [] : [Validators.required, notBlank]),
      Validators.maxLength(this.maxLength),
    ],
  });

  protected submit(): void {
    this.control.markAsTouched();
    if (this.control.valid) {
      this.dialogRef.close(this.control.value.trim());
    }
  }
}

const notBlank: ValidatorFn = control =>
  typeof control.value === 'string' && control.value.length > 0 && !control.value.trim() ? { required: true } : null;
