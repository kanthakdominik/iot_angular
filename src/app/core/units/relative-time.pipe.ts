import { Pipe, PipeTransform, inject } from '@angular/core';
import { IsoInstant } from '../api/http';
import { I18nService } from '../i18n/i18n.service';
import { relativeTimeFormat, toEpoch } from './format-utils';
import { Memo } from './memo';
import { NowService } from './now';

const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['minute', 60], ['hour', 3600], ['day', 86400], ['week', 604800], ['month', 2629800], ['year', 31557600],
];

/** "5 min temu" / "5 min ago", "wczoraj" / "yesterday"; refreshed every 30 s. Use with a `title` holding the exact time. */
@Pipe({ name: 'relativeTime', pure: false })
export class RelativeTimePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  private readonly clock = inject(NowService);
  private readonly memo = new Memo<string>();

  transform(value: IsoInstant | Date | number | null | undefined): string {
    const at = toEpoch(value);
    const now = this.clock.now();
    const locale = this.i18n.locale();
    return this.memo.get([at, now, locale], () => {
      if (at === null) {
        return '—';
      }
      const seconds = (at - now) / 1000;
      if (Math.abs(seconds) < 45) {
        return this.i18n.t('common.time.justNow');
      }
      let unit: Intl.RelativeTimeFormatUnit = 'minute';
      let size = 60;
      for (const [candidate, candidateSize] of UNITS) {
        if (Math.abs(seconds) >= candidateSize * 0.9 || candidate === 'minute') {
          unit = candidate;
          size = candidateSize;
        }
      }
      return relativeTimeFormat(locale).format(Math.round(seconds / size), unit);
    });
  }
}
