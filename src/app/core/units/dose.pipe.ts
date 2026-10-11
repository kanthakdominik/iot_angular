import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { DoseFormat, DoseKind } from './dose-format';
import { Memo } from './memo';

/**
 * `{{ m.usvPerHour | dose }}` -> "0,184 µSv/h" / "184 nSv/h" / "18,4 µR/h" per the preferences;
 * `{{ route.doseUsv | dose: 'total' }}` -> "0,012 µSv"; `| dose: 'rate' : false` -> number only. Null -> "—".
 */
@Pipe({ name: 'dose', pure: false })
export class DosePipe implements PipeTransform {
  private readonly dose = inject(DoseFormat);
  private readonly i18n = inject(I18nService);
  private readonly memo = new Memo<string>();

  transform(usv: number | null | undefined, kind: DoseKind = 'rate', withUnit = true): string {
    const unit = this.dose.unit();
    const locale = this.i18n.locale();
    return this.memo.get([usv, kind, withUnit, unit, locale], () => {
      if (usv === null || usv === undefined || !Number.isFinite(usv)) {
        return '—';
      }
      return withUnit ? this.dose.format(usv, kind, unit) : this.dose.formatValue(usv, unit);
    });
  }
}
