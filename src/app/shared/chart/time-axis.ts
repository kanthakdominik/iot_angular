import { Scale } from 'chart.js';
import { DateStyle, dateFormat } from '../../core/units/format-utils';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "Nice" tick steps for a time axis in epoch ms. */
const STEPS = [
  SECOND, 2 * SECOND, 5 * SECOND, 10 * SECOND, 15 * SECOND, 30 * SECOND,
  MINUTE, 2 * MINUTE, 5 * MINUTE, 10 * MINUTE, 15 * MINUTE, 30 * MINUTE,
  HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR,
  DAY, 2 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 91 * DAY, 182 * DAY, 365 * DAY,
];

/**
 * Tick values at round local times (…, 08:10, 08:15, … or midnights) between min and max, at most `maxTicks`.
 * With `localTime`, steps of an hour and more are aligned to local time (time zone offset of `min`).
 */
export function timeTicks(min: number, max: number, maxTicks = 8, localTime = true): number[] {
  const span = max - min;
  if (!(span > 0)) {
    return [min];
  }
  const step = STEPS.find(candidate => span / candidate <= maxTicks) ?? Math.ceil(span / maxTicks / DAY) * DAY;
  const offset = localTime && step >= HOUR ? -new Date(min).getTimezoneOffset() * MINUTE : 0;
  const ticks: number[] = [];
  for (let t = Math.ceil((min + offset) / step) * step - offset; t <= max; t += step) {
    ticks.push(t);
  }
  return ticks;
}

function styleForSpan(span: number): DateStyle {
  if (span <= 10 * MINUTE) {
    return 'timeSeconds';
  }
  if (span <= 2 * DAY) {
    return 'time';
  }
  return span <= 300 * DAY ? 'dayMonth' : 'date';
}

/**
 * Options for a linear x axis holding epoch ms (no date adapter): round tick positions and local time labels
 * whose precision follows the visible span. Spread into `scales.x`.
 *
 * ```ts
 * scales: { x: { ...timeAxis(i18n.locale()) }, y: { … } }
 * ```
 */
export function timeAxis(locale: string, maxTicks = 8) {
  return {
    type: 'linear' as const,
    bounds: 'data' as const,
    grid: { display: false },
    ticks: {
      maxRotation: 0,
      autoSkip: false,
      callback(this: Scale, value: number | string): string {
        return dateFormat(locale, styleForSpan(this.max - this.min)).format(Number(value));
      },
    },
    afterBuildTicks(scale: Scale): void {
      scale.ticks = timeTicks(scale.min, scale.max, maxTicks).map(value => ({ value }));
    },
  };
}

/** Elapsed time since start for comparison charts: "12:30" (m:ss) below an hour, "1:05:00" (h:mm:ss) above. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(hours ? 2 : 1, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Linear x axis in ms since the start of each route (route comparison), with round minute ticks. */
export function elapsedAxis(maxTicks = 8) {
  return {
    type: 'linear' as const,
    min: 0,
    bounds: 'data' as const,
    grid: { display: false },
    ticks: {
      maxRotation: 0,
      autoSkip: false,
      callback(value: number | string): string {
        return formatElapsed(Number(value));
      },
    },
    afterBuildTicks(scale: Scale): void {
      scale.ticks = timeTicks(0, scale.max, maxTicks, false).map(value => ({ value }));
    },
  };
}
