import { ChartDataset, ChartOptions, ScriptableContext, ScriptableLineSegmentContext } from 'chart.js';
import { MeasurementDto, hasPosition } from '../../core/api/routes.models';
import { DoseScale, NO_FIX_COLOR } from '../../core/units/dose-scale';
import { dateFormat } from '../../core/units/format-utils';
import { ChartColors } from './chart-theme';
import { CrosshairOptions } from './crosshair.plugin';
import { timeAxis } from './time-axis';

/** A chart point of a sample: x = epoch ms, y = µSv/h; `fix` = the sample has a position. */
export interface DosePoint {
  readonly x: number;
  readonly y: number;
  readonly fix: boolean;
}

export function toDosePoint(m: MeasurementDto): DosePoint {
  return { x: Date.parse(m.timestamp), y: m.usvPerHour, fix: hasPosition(m) };
}

/** `segment.borderColor`: each line segment in the dose colour of its mean value (y in µSv/h). */
export function doseSegmentColor(ctx: ScriptableLineSegmentContext): string {
  return DoseScale.color(((ctx.p0.parsed.y ?? 0) + (ctx.p1.parsed.y ?? 0)) / 2);
}

function isNoFix(ctx: ScriptableContext<'line'>): boolean {
  return (ctx.raw as DosePoint | undefined)?.fix === false;
}

/**
 * µSv/h line dataset: dose-coloured segments, grey points for samples without GPS (other points hidden until hover).
 * Live samples: `(dataset.data as DosePoint[]).push(toDosePoint(m)); chart.update('none')`.
 */
export function doseDataset(measurements: readonly MeasurementDto[], label: string): ChartDataset<'line', DosePoint[]> {
  return {
    label,
    data: measurements.map(toDosePoint),
    parsing: false,
    normalized: true,
    borderWidth: 2,
    borderColor: DoseScale.color(0.1),
    backgroundColor: DoseScale.color(0.1),
    segment: { borderColor: doseSegmentColor },
    pointRadius: ctx => (isNoFix(ctx) ? 2.5 : 0),
    pointHoverRadius: 5,
    pointBorderWidth: 0,
    pointBackgroundColor: ctx => (isNoFix(ctx) ? NO_FIX_COLOR : DoseScale.color((ctx.raw as DosePoint).y)),
    pointHoverBackgroundColor: ctx => (isNoFix(ctx) ? NO_FIX_COLOR : DoseScale.color((ctx.raw as DosePoint).y)),
    tension: 0,
  };
}

export interface TimeSeriesOptionsParams {
  readonly locale: string;
  readonly colors: ChartColors;
  /** y tick labels, e.g. `v => dose.formatValue(v)` for the preferred dose unit (data stays in µSv/h). */
  readonly yTicks?: (value: number) => string;
  readonly yTitle?: string;
  readonly crosshair?: CrosshairOptions;
}

/** Options of a time series line chart (µSv/h, CPM…): time axis, index tooltip, crosshair, no legend. */
export function timeSeriesOptions(params: TimeSeriesOptionsParams): ChartOptions<'line'> {
  const { locale, colors, yTicks, yTitle, crosshair } = params;
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false, axis: 'x' },
    scales: {
      x: timeAxis(locale),
      y: {
        beginAtZero: true,
        grid: { color: colors.grid },
        border: { display: false },
        ticks: yTicks ? { callback: value => yTicks(Number(value)) } : {},
        title: yTitle ? { display: true, text: yTitle } : { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: items => items.length ? dateFormat(locale, 'timeSeconds').format(items[0].parsed.x ?? 0) : '',
        },
      },
      appCrosshair: { color: colors.muted, ...crosshair },
    },
  };
}
