import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialog, ConfirmDialogData } from './confirm-dialog';
import { TextPromptDialog, TextPromptDialogData } from './text-prompt-dialog';

/**
 * Promise-based confirm / prompt dialogs.
 *
 * ```ts
 * if (await this.dialogs.confirm({ title: t('…'), message: route.name, destructive: true })) { … }
 * const name = await this.dialogs.prompt({ title: t('common.actions.rename'), label: t('…'), value: device.name });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class Dialogs {
  private readonly dialog = inject(MatDialog);

  /** Resolves `true` only when confirmed. */
  async confirm(data: ConfirmDialogData): Promise<boolean> {
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
      data,
      maxWidth: 'min(560px, calc(100vw - 32px))',
      role: 'alertdialog',
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  /** Resolves the entered text (trimmed) or null when cancelled. */
  async prompt(data: TextPromptDialogData): Promise<string | null> {
    const ref = this.dialog.open<TextPromptDialog, TextPromptDialogData, string>(TextPromptDialog, {
      data,
      maxWidth: 'min(560px, calc(100vw - 32px))',
    });
    return (await firstValueFrom(ref.afterClosed())) ?? null;
  }
}
