import { Pipe, PipeTransform, inject } from '@angular/core';
import { IsoInstant } from '../api/http';
import { I18nService } from '../i18n/i18n.service';
import { toEpoch } from './format-utils';
import { Memo } from './memo';
import { NowService } from './now';

/**
 * `{{ 95000 | duration }}` -> "1 min 35 s"; `{{ route.startedAt | duration: route.endedAt }}` -> "1 h 23 min".
 * With an ISO start and a null end the duration runs until now (live routes) and updates every 30 s.
 */
@Pipe({ name: 'duration', pure: false })
export class DurationPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  private readonly clock = inject(NowService);
  private readonly memo = new Memo<string>();

  transform(start: number | IsoInstant | null | undefined, end?: IsoInstant | null): string {
    const lang = this.i18n.lang();
    let ms: number | null;
    if (typeof start === 'number') {
      ms = start;
    } else {
      const from = toEpoch(start);
      const to = end ? toEpoch(end) : this.clock.now();
      ms = from === null || to === null ? null : to - from;
    }
    return this.memo.get([ms, lang], () => (ms === null ? '—' : this.format(ms)));
  }

  private format(ms: number): string {
    const unit = (key: 'days' | 'hours' | 'minutes' | 'seconds') => this.i18n.t(`common.duration.${key}`);
    const seconds = Math.max(0, Math.round(ms / 1000));
    if (seconds < 60) {
      return `${seconds} ${unit('seconds')}`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      const rest = seconds % 60;
      return minutes < 10 && rest
        ? `${minutes} ${unit('minutes')} ${rest} ${unit('seconds')}`
        : `${minutes} ${unit('minutes')}`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      const rest = minutes % 60;
      return rest ? `${hours} ${unit('hours')} ${rest} ${unit('minutes')}` : `${hours} ${unit('hours')}`;
    }
    const days = Math.floor(hours / 24);
    const rest = hours % 24;
    return rest ? `${days} ${unit('days')} ${rest} ${unit('hours')}` : `${days} ${unit('days')}`;
  }
}
