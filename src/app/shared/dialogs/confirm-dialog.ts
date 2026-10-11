import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

export interface ConfirmDialogData {
  readonly title: string;
  readonly message?: string;
  /** Default: "Potwierdź" / "Confirm" (or "Usuń" / "Delete" when `destructive`). */
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  /** Confirm button in the error colour (deleting, revoking a link…). */
  readonly destructive?: boolean;
}

/** Yes / no dialog; closes with `true` when confirmed. Open it through `Dialogs.confirm()`. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [MatButtonModule, MatDialogModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    @if (data.message) {
      <mat-dialog-content>
        <p class="message">{{ data.message }}</p>
      </mat-dialog-content>
    }
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>{{ data.cancelLabel ?? ('common.actions.cancel' | t) }}</button>
      <button matButton="filled" type="button" [mat-dialog-close]="true" [class.destructive]="data.destructive"
              cdkFocusInitial>
        {{ data.confirmLabel ?? ((data.destructive ? 'common.actions.delete' : 'common.actions.confirm') | t) }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .message {
      max-width: 60ch;
      white-space: pre-line;
    }

    .destructive {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
