import { Injectable, computed, inject } from '@angular/core';
import { DoseUnit } from '../api/users.models';
import { I18nService } from '../i18n/i18n.service';
import { PrefsService } from '../prefs/prefs.service';

/** `rate` = µSv/h and friends; `total` = accumulated dose (µSv, nSv, µR). */
export type DoseKind = 'rate' | 'total';

const UNIT_LABELS: Readonly<Record<DoseUnit, Readonly<Record<DoseKind, string>>>> = {
  uSv: { rate: 'µSv/h', total: 'µSv' },
  nSv: { rate: 'nSv/h', total: 'nSv' },
  uR: { rate: 'µR/h', total: 'µR' },
};

/** 1 µSv = 1000 nSv = 100 µR (gamma, 1 Sv ≈ 100 R). */
const FACTORS: Readonly<Record<DoseUnit, number>> = { uSv: 1, nSv: 1000, uR: 100 };

/** Fraction digits giving ~3 significant digits for typical values; fixed per range so columns line up. */
function fractionDigits(value: number, unit: DoseUnit): number {
  const abs = Math.abs(value);
  switch (unit) {
    case 'nSv':
      return abs < 10 ? 1 : 0;
    case 'uR':
      return abs < 1 ? 2 : abs < 100 ? 1 : 0;
    default:
      return abs < 1 ? 3 : abs < 10 ? 2 : abs < 100 ? 1 : 0;
  }
}

export interface DoseParts {
  readonly value: string;
  readonly unit: string;
}

/**
 * Formats dose values (always given in µSv/h or µSv) in the unit chosen in the preferences, locale-aware.
 * Methods read signals, so calling them in a template / computed follows unit and language changes.
 */
@Injectable({ providedIn: 'root' })
export class DoseFormat {
  private readonly prefs = inject(PrefsService);
  private readonly i18n = inject(I18nService);
  private readonly formats = new Map<string, Intl.NumberFormat>();

  readonly unit = computed(() => this.prefs.prefs().doseUnit);

  unitLabel(kind: DoseKind = 'rate', unit: DoseUnit = this.unit()): string {
    return UNIT_LABELS[unit][kind];
  }

  /** µSv(/h) -> the given unit. */
  convert(usv: number, unit: DoseUnit = this.unit()): number {
    return usv * FACTORS[unit];
  }

  /** Number only, e.g. "0,184". `digits` overrides the automatic precision. */
  formatValue(usv: number, unit: DoseUnit = this.unit(), digits?: number): string {
    const value = this.convert(usv, unit);
    const fraction = digits ?? fractionDigits(value, unit);
    return this.numberFormat(fraction).format(value);
  }

  parts(usv: number, kind: DoseKind = 'rate', unit: DoseUnit = this.unit()): DoseParts {
    return { value: this.formatValue(usv, unit), unit: this.unitLabel(kind, unit) };
  }

  /** "0,184 µSv/h" (non-breaking space). */
  format(usv: number, kind: DoseKind = 'rate', unit: DoseUnit = this.unit()): string {
    return `${this.formatValue(usv, unit)} ${this.unitLabel(kind, unit)}`;
  }

  private numberFormat(digits: number): Intl.NumberFormat {
    const locale = this.i18n.locale();
    const key = `${locale}:${digits}`;
    let format = this.formats.get(key);
    if (!format) {
      format = new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
      this.formats.set(key, format);
    }
    return format;
  }
}
