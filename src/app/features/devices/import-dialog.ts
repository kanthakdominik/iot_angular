import {
  ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { DevicesApi } from '../../core/api/devices.api';
import { DeviceDto, ImportResult } from '../../core/api/devices.models';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Notifier } from '../../core/notify/notifier';
import { NumberPipe } from '../../core/units/number.pipe';
import { StatTile } from '../../shared/stat-tile/stat-tile';
import { deviceLabel } from './device-meta';
import { FileSizePipe } from './file-size.pipe';

export interface ImportDialogData {
  readonly device: DeviceDto;
}

/** Limits of `POST /api/devices/{id}/import` (V2.1-SPEC §3.3). */
export const IMPORT_MAX_FILES = 20;
export const IMPORT_MAX_BYTES = 50 * 1024 * 1024;
const ACCEPTED = ['.jsonl', '.txt'];

type Step = 'select' | 'uploading' | 'done';

function accepted(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED.some(ext => name.endsWith(ext));
}

/**
 * Uploads `r<N>.jsonl` files written to the SD card while the device had no connection. Drag & drop or file picker,
 * client-side validation of the server limits, then a summary (imported / duplicates / invalid lines per route).
 * Closes with the ImportResult when something was uploaded, so the caller reloads.
 */
@Component({
  selector: 'app-import-dialog',
  imports: [
    FileSizePipe, MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule, MatTooltipModule, NumberPipe,
    RouterLink, StatTile, TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './import-dialog.html',
  styleUrl: './import-dialog.scss',
  host: {
    // a file dropped next to the drop zone must not make the browser open it
    '(dragover)': '$event.preventDefault()',
    '(drop)': '$event.preventDefault()',
  },
})
export class ImportDialog {
  private readonly data = inject<ImportDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ImportDialog, ImportResult>>(MatDialogRef);
  private readonly api = inject(DevicesApi);
  private readonly notifier = inject(Notifier);

  protected readonly deviceName = deviceLabel(this.data.device);
  protected readonly maxFiles = IMPORT_MAX_FILES;
  protected readonly maxBytes = IMPORT_MAX_BYTES;

  protected readonly step = signal<Step>('select');
  protected readonly files = signal<readonly File[]>([]);
  protected readonly rejected = signal<readonly string[]>([]);
  protected readonly dragOver = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<ImportResult | null>(null);

  protected readonly totalBytes = computed(() => this.files().reduce((sum, file) => sum + file.size, 0));
  protected readonly tooMany = computed(() => this.files().length > IMPORT_MAX_FILES);
  protected readonly tooLarge = computed(() => this.totalBytes() > IMPORT_MAX_BYTES);
  protected readonly canUpload = computed(() => this.files().length > 0 && !this.tooMany() && !this.tooLarge());

  private readonly summaryHeading = viewChild<ElementRef<HTMLElement>>('summaryHeading');
  private dragDepth = 0;

  constructor() {
    // move focus to the summary once it is shown (screen readers read the result)
    effect(() => this.summaryHeading()?.nativeElement.focus());
  }

  protected picked(input: HTMLInputElement): void {
    this.add(Array.from(input.files ?? []));
    input.value = '';
  }

  protected dragEnter(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth++;
    this.dragOver.set(true);
  }

  protected dragOverZone(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  protected dragLeave(): void {
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) {
      this.dragOver.set(false);
    }
  }

  protected drop(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth = 0;
    this.dragOver.set(false);
    if (this.step() === 'select') {
      this.add(Array.from(event.dataTransfer?.files ?? []));
    }
  }

  protected remove(file: File): void {
    this.files.update(list => list.filter(item => item !== file));
  }

  protected upload(): void {
    if (!this.canUpload() || this.step() !== 'select') {
      return;
    }
    this.step.set('uploading');
    this.error.set(null);
    this.dialogRef.disableClose = true;
    this.api.import(this.data.device.id, this.files(), { silent: true }).subscribe({
      next: result => {
        this.dialogRef.disableClose = false;
        this.result.set(result);
        this.step.set('done');
      },
      error: (error: unknown) => {
        this.dialogRef.disableClose = false;
        this.error.set(this.notifier.describe(error));
        this.step.set('select');
      },
    });
  }

  protected close(): void {
    this.dialogRef.close(this.result() ?? undefined);
  }

  private add(incoming: readonly File[]): void {
    const rejected = incoming.filter(file => !accepted(file)).map(file => file.name);
    this.rejected.set(rejected);
    this.error.set(null);
    const known = new Set(this.files().map(file => `${file.name}|${file.size}`));
    const added = incoming.filter(file => accepted(file) && !known.has(`${file.name}|${file.size}`));
    if (added.length) {
      this.files.update(list => [...list, ...added]);
    }
  }
}
