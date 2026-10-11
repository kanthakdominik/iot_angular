import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { numberFormat } from '../../core/units/format-utils';

const KB = 1024;
const MB = 1024 * KB;

/** Bytes -> "820 B", "14,2 kB", "3,4 MB" (locale-aware, binary multiples as shown by file managers). */
@Pipe({ name: 'fileSize', pure: false })
export class FileSizePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(bytes: number | null | undefined): string {
    if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
      return '—';
    }
    const locale = this.i18n.locale();
    if (bytes < KB) {
      return numberFormat(locale, { style: 'unit', unit: 'byte', unitDisplay: 'narrow' }).format(bytes);
    }
    const [value, unit] = bytes < MB ? [bytes / KB, 'kilobyte'] : [bytes / MB, 'megabyte'];
    return numberFormat(locale, { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: value < 10 ? 1 : 0 })
      .format(value);
  }
}
