import { IsoInstant } from '../api/http';

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const relativeFormats = new Map<string, Intl.RelativeTimeFormat>();

export function numberFormat(locale: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, options);
    numberFormats.set(key, format);
  }
  return format;
}

export type DateStyle = 'datetime' | 'datetimeSeconds' | 'date' | 'dateLong' | 'time' | 'timeSeconds' | 'dayMonth';

const DATE_OPTIONS: Readonly<Record<DateStyle, Intl.DateTimeFormatOptions>> = {
  datetime: { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  datetimeSeconds: { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' },
  date: { day: 'numeric', month: 'short', year: 'numeric' },
  dateLong: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  time: { hour: '2-digit', minute: '2-digit' },
  timeSeconds: { hour: '2-digit', minute: '2-digit', second: '2-digit' },
  dayMonth: { day: 'numeric', month: 'short' },
};

export function dateFormat(locale: string, style: DateStyle): Intl.DateTimeFormat {
  const key = `${locale}|${style}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, DATE_OPTIONS[style]);
    dateFormats.set(key, format);
  }
  return format;
}

export function relativeTimeFormat(locale: string): Intl.RelativeTimeFormat {
  let format = relativeFormats.get(locale);
  if (!format) {
    format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
    relativeFormats.set(locale, format);
  }
  return format;
}

/** Epoch ms of an ISO instant / Date / epoch number; null when missing or invalid. */
export function toEpoch(value: IsoInstant | Date | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const ms = typeof value === 'number' ? value : value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** GSM CSQ (0–31) -> dBm: -113 + 2·CSQ. */
export function csqToDbm(csq: number): number {
  return -113 + 2 * csq;
}

/** GSM CSQ -> 0–4 bars (0–1 none, 2–9 marginal, 10–14 ok, 15–19 good, 20+ excellent). */
export function csqBars(csq: number): 0 | 1 | 2 | 3 | 4 {
  if (csq < 2 || csq > 31) {
    return 0;
  }
  return csq < 10 ? 1 : csq < 15 ? 2 : csq < 20 ? 3 : 4;
}

/** Material Symbols name for a CSQ value (`signal_cellular_0_bar` … `signal_cellular_4_bar`). */
export function csqIcon(csq: number | null | undefined): string {
  return csq === null || csq === undefined ? 'signal_cellular_off' : `signal_cellular_${csqBars(csq)}_bar`;
}
