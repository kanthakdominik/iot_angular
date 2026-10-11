import { Pipe, PipeTransform, inject } from '@angular/core';
import { IsoInstant } from '../api/http';
import { I18nService } from '../i18n/i18n.service';
import { DateStyle, dateFormat, toEpoch } from './format-utils';
import { Memo } from './memo';

/**
 * Locale-aware date / time in the browser's time zone: `{{ route.startedAt | dateTime }}` -> "10 paź 2026, 08:15";
 * styles: datetime (default), datetimeSeconds, date, dateLong, time, timeSeconds, dayMonth. Null -> "—".
 */
@Pipe({ name: 'dateTime', pure: false })
export class DateTimePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  private readonly memo = new Memo<string>();

  transform(value: IsoInstant | Date | number | null | undefined, style: DateStyle = 'datetime'): string {
    const locale = this.i18n.locale();
    const at = toEpoch(value);
    return this.memo.get([at, style, locale], () => (at === null ? '—' : dateFormat(locale, style).format(at)));
  }
}
