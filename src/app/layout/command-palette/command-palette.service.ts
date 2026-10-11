import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { Injectable, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CommandPalette } from './command-palette';

/** Opens the command palette (Ctrl/⌘+K, "/" or the search field in the top bar); at most one instance. */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  private readonly i18n = inject(I18nService);
  private ref: DialogRef<unknown, CommandPalette> | null = null;

  open(): void {
    if (this.ref) {
      return;
    }
    this.ref = this.dialog.open(CommandPalette, {
      ariaLabel: this.i18n.t('nav.search.dialogLabel'),
      width: 'min(640px, calc(100vw - 32px))',
      maxHeight: 'min(560px, calc(100dvh - 96px))',
      positionStrategy: this.overlay.position().global().centerHorizontally().top('10vh'),
      backdropClass: 'app-palette-backdrop',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
    this.ref.closed.subscribe(() => (this.ref = null));
  }
}
