import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { numberFormat } from './format-utils';
import { Memo } from './memo';

/** Locale-aware number: `{{ m.cpm | num }}`, `{{ value | num: 1 }}` (fixed fraction digits). Null -> "—". */
@Pipe({ name: 'num', pure: false })
export class NumberPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  private readonly memo = new Memo<string>();

  transform(value: number | null | undefined, digits?: number): string {
    const locale = this.i18n.locale();
    return this.memo.get([value, digits, locale], () => {
      if (value === null || value === undefined || !Number.isFinite(value)) {
        return '—';
      }
      const options = digits === undefined ? {} : { minimumFractionDigits: digits, maximumFractionDigits: digits };
      return numberFormat(locale, options).format(value);
    });
  }
}
