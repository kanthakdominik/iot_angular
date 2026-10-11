import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { csqBars, csqToDbm, numberFormat } from './format-utils';

/**
 * GSM signal quality: `{{ device.signalCsq | csq }}` -> "−77 dBm", `{{ device.signalCsq | csq: 'bars' }}` -> 0..4.
 * For the icon use `csqIcon()` from format-utils.
 */
@Pipe({ name: 'csq', pure: false })
export class CsqPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(csq: number | null | undefined): string;
  transform(csq: number | null | undefined, mode: 'dbm'): string;
  transform(csq: number | null | undefined, mode: 'bars'): number;
  transform(csq: number | null | undefined, mode: 'dbm' | 'bars' = 'dbm'): string | number {
    if (mode === 'bars') {
      return csq === null || csq === undefined ? 0 : csqBars(csq);
    }
    if (csq === null || csq === undefined || csq < 0 || csq > 31) {
      return '—';
    }
    return `${numberFormat(this.i18n.locale()).format(csqToDbm(csq))} dBm`;
  }
}
