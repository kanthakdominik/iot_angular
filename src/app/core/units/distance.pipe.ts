import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { numberFormat } from './format-utils';
import { Memo } from './memo';

/** Metres -> "850 m", "1,25 km", "12,4 km", "184 km". Null -> "—". */
@Pipe({ name: 'distance', pure: false })
export class DistancePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  private readonly memo = new Memo<string>();

  transform(metres: number | null | undefined): string {
    const locale = this.i18n.locale();
    return this.memo.get([metres, locale], () => formatDistance(metres, locale));
  }
}

export function formatDistance(metres: number | null | undefined, locale: string): string {
  if (metres === null || metres === undefined || !Number.isFinite(metres)) {
    return '—';
  }
  if (metres < 1000) {
    return `${numberFormat(locale, { maximumFractionDigits: 0 }).format(metres)} m`;
  }
  const km = metres / 1000;
  const digits = km < 10 ? 2 : km < 100 ? 1 : 0;
  return `${numberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(km)} km`;
}
