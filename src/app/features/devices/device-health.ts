import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, untracked,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { Chart, ChartDataset, ChartOptions } from 'chart.js';
import { DevicesApi } from '../../core/api/devices.api';
import { HealthPoint } from '../../core/api/devices.models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslationKey } from '../../core/i18n/pl';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { csqToDbm, dateFormat, numberFormat } from '../../core/units/format-utils';
import { ChartColors, ChartTheme } from '../../shared/chart/chart-theme';
import { timeAxis } from '../../shared/chart/time-axis';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Skeleton } from '../../shared/skeleton/skeleton';

export type HealthRange = '24h' | '7d' | '30d';

const RANGE_MS: Readonly<Record<HealthRange, number>> = {
  '24h': 24 * 3_600_000,
  '7d': 7 * 24 * 3_600_000,
  '30d': 30 * 24 * 3_600_000,
};

interface XY {
  readonly x: number;
  readonly y: number;
}

function series(points: readonly HealthPoint[], value: (p: HealthPoint) => number | null): XY[] {
  const result: XY[] = [];
  for (const point of points) {
    const y = value(point);
    if (y !== null && Number.isFinite(y)) {
      result.push({ x: Date.parse(point.ts), y });
    }
  }
  return result;
}

/**
 * Battery (% and mV) and GSM signal (CSQ, axis in dBm) of a device over the last 24 h / 7 d / 30 d.
 * Two Chart.js line charts on a linear epoch-ms axis (no date adapter); destroyed with the component.
 */
@Component({
  selector: 'app-device-health',
  imports: [EmptyState, MatButtonToggleModule, Skeleton, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './device-health.html',
  styleUrl: './device-health.scss',
})
export class DeviceHealth {
  private readonly api = inject(DevicesApi);
  private readonly i18n = inject(I18nService);
  private readonly chartTheme = inject(ChartTheme);

  readonly deviceId = input.required<string>();
  /** Bump to reload (e.g. after a battery report was requested). */
  readonly refresh = input(0);

  protected readonly ranges: readonly HealthRange[] = ['24h', '7d', '30d'];
  protected readonly rangeKeys: Readonly<Record<HealthRange, TranslationKey>> = {
    '24h': 'devices.health.ranges.h24',
    '7d': 'devices.health.ranges.d7',
    '30d': 'devices.health.ranges.d30',
  };
  protected readonly range = signal<HealthRange>('7d');

  protected readonly health = rxResource({
    params: () => ({ id: this.deviceId(), range: this.range(), refresh: this.refresh() }),
    stream: ({ params }) => this.api.health(params.id, {
      from: new Date(Date.now() - RANGE_MS[params.range]),
      to: new Date(),
    }, { silent: true }),
  });

  protected readonly points = computed(() => (this.health.hasValue() ? this.health.value() ?? [] : []));
  protected readonly battery = computed(() => ({
    pct: series(this.points(), p => p.batteryPct),
    mv: series(this.points(), p => p.batteryMv),
  }));
  protected readonly signal = computed(() => series(this.points(), p => p.signalCsq));
  protected readonly hasBattery = computed(() => this.battery().pct.length > 0 || this.battery().mv.length > 0);
  protected readonly hasSignal = computed(() => this.signal().length > 0);

  private readonly batteryCanvas = viewChild<ElementRef<HTMLCanvasElement>>('batteryCanvas');
  private readonly signalCanvas = viewChild<ElementRef<HTMLCanvasElement>>('signalCanvas');
  private batteryChart?: Chart<'line', XY[]>;
  private signalChart?: Chart<'line', XY[]>;

  constructor() {
    effect(() => {
      const canvas = this.batteryCanvas()?.nativeElement;
      const data = this.battery();
      const colors = this.chartTheme.colors();
      const locale = this.i18n.locale();
      untracked(() => {
        this.batteryChart = this.draw(this.batteryChart, canvas, this.batteryDatasets(data, colors),
          this.batteryOptions(colors, locale));
      });
    });
    effect(() => {
      const canvas = this.signalCanvas()?.nativeElement;
      const data = this.signal();
      const colors = this.chartTheme.colors();
      const locale = this.i18n.locale();
      untracked(() => {
        this.signalChart = this.draw(this.signalChart, canvas, this.signalDatasets(data, colors),
          this.signalOptions(colors, locale));
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.batteryChart?.destroy();
      this.signalChart?.destroy();
    });
  }

  protected setRange(change: MatButtonToggleChange): void {
    this.range.set(change.value as HealthRange);
  }

  /** Creates the chart on a (new) canvas or updates the existing one in place. */
  private draw(
    chart: Chart<'line', XY[]> | undefined,
    canvas: HTMLCanvasElement | undefined,
    datasets: ChartDataset<'line', XY[]>[],
    options: ChartOptions<'line'>,
  ): Chart<'line', XY[]> | undefined {
    if (chart && chart.canvas !== canvas) {
      chart.destroy();
      chart = undefined;
    }
    if (!canvas) {
      return undefined;
    }
    if (!chart) {
      return new Chart<'line', XY[]>(canvas, { type: 'line', data: { datasets }, options });
    }
    chart.data.datasets = datasets;
    chart.options = options;
    chart.update('none');
    return chart;
  }

  private batteryDatasets(data: { pct: XY[]; mv: XY[] }, colors: ChartColors): ChartDataset<'line', XY[]>[] {
    return [
      {
        label: this.i18n.t('devices.health.batteryPct'),
        data: data.pct,
        yAxisID: 'y',
        parsing: false,
        borderColor: colors.primary,
        backgroundColor: colors.primary,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        stepped: false,
        tension: 0,
      },
      {
        label: this.i18n.t('devices.health.batteryMv'),
        data: data.mv,
        yAxisID: 'y1',
        parsing: false,
        borderColor: colors.muted,
        backgroundColor: colors.muted,
        borderWidth: 1.5,
        borderDash: [4, 3],
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0,
      },
    ];
  }

  private signalDatasets(data: XY[], colors: ChartColors): ChartDataset<'line', XY[]>[] {
    return [{
      label: this.i18n.t('devices.health.signal'),
      data,
      parsing: false,
      borderColor: colors.primary,
      backgroundColor: colors.primary,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      stepped: 'before',
    }];
  }

  /** The x axis always spans the whole selected range, also when data exists only for a part of it. */
  private baseOptions(colors: ChartColors, locale: string): ChartOptions<'line'> {
    const max = Date.now();
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'nearest', intersect: false, axis: 'x' },
      scales: { x: { ...timeAxis(locale, 6), min: max - RANGE_MS[this.range()], max } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => (items.length ? dateFormat(locale, 'datetime').format(items[0].parsed.x ?? 0) : ''),
          },
        },
      },
      color: colors.muted,
    };
  }

  private batteryOptions(colors: ChartColors, locale: string): ChartOptions<'line'> {
    const base = this.baseOptions(colors, locale);
    const int = numberFormat(locale, { maximumFractionDigits: 0 });
    return {
      ...base,
      scales: {
        ...base.scales,
        y: {
          min: 0,
          max: 100,
          grid: { color: colors.grid },
          border: { display: false },
          ticks: { callback: value => `${int.format(Number(value))} %` },
        },
        y1: {
          position: 'right',
          grace: '5%',
          grid: { display: false },
          border: { display: false },
          ticks: { callback: value => `${int.format(Number(value))} mV` },
        },
      },
      plugins: {
        ...base.plugins,
        legend: { display: true, position: 'bottom', align: 'start' },
        tooltip: {
          callbacks: {
            ...base.plugins?.tooltip?.callbacks,
            label: item => item.datasetIndex === 0
              ? ` ${int.format(item.parsed.y ?? 0)} %`
              : ` ${int.format(item.parsed.y ?? 0)} mV`,
          },
        },
      },
    };
  }

  private signalOptions(colors: ChartColors, locale: string): ChartOptions<'line'> {
    const base = this.baseOptions(colors, locale);
    const int = numberFormat(locale, { maximumFractionDigits: 0 });
    return {
      ...base,
      scales: {
        ...base.scales,
        y: {
          min: 0,
          max: 31,
          grid: { color: colors.grid },
          border: { display: false },
          ticks: { stepSize: 5, callback: value => `${int.format(csqToDbm(Number(value)))} dBm` },
        },
      },
      plugins: {
        ...base.plugins,
        tooltip: {
          callbacks: {
            ...base.plugins?.tooltip?.callbacks,
            label: item => ` ${int.format(csqToDbm(item.parsed.y ?? 0))} dBm (CSQ ${int.format(item.parsed.y ?? 0)})`,
          },
        },
      },
    };
  }
}
