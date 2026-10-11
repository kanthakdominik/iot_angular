import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, signal,
  untracked, viewChild,
} from '@angular/core';
import { Chart, ChartOptions } from 'chart.js';
import { MeasurementDto } from '../../../core/api/routes.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { DoseFormat } from '../../../core/units/dose-format';
import { DoseScale } from '../../../core/units/dose-scale';
import { numberFormat } from '../../../core/units/format-utils';
import { ChartTheme } from '../../../shared/chart/chart-theme';
import { HistogramBin, doseHistogram } from './route-stats';

/** Distribution of dose-rate levels: one bar per 0.02 µSv/h, coloured by the dose scale. */
@Component({
  selector: 'app-dose-histogram',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="canvas"><canvas #canvas role="img" [attr.aria-label]="summary()"></canvas></div>`,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .canvas {
      position: relative;
      height: 200px;
    }

    canvas {
      position: absolute;
      inset: 0;
    }
  `,
})
export class DoseHistogram {
  private readonly i18n = inject(I18nService);
  private readonly dose = inject(DoseFormat);
  private readonly chartTheme = inject(ChartTheme);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  readonly measurements = input<readonly MeasurementDto[]>([]);

  protected readonly bins = computed(() => doseHistogram(this.measurements()));
  /** Text alternative: the most frequent level. */
  protected readonly summary = computed(() => {
    const bins = this.bins();
    const top = bins.reduce<HistogramBin | null>((best, bin) => (!best || bin.count > best.count ? bin : best), null);
    return top
      ? this.i18n.t('routes.detail.histogramLabel', { range: this.rangeLabel(top), count: top.count })
      : this.i18n.t('common.states.empty');
  });

  private readonly ready = signal(false);
  private chart?: Chart<'bar', number[], string>;

  constructor() {
    afterNextRender(() => {
      this.chart = new Chart(this.canvas().nativeElement, {
        type: 'bar',
        data: { labels: [], datasets: [{ data: [] }] },
        options: this.options(),
      });
      this.ready.set(true);
    });
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());

    effect(() => {
      const bins = this.bins();
      this.chartTheme.colors();
      this.dose.unit();
      this.i18n.locale();
      if (this.ready()) {
        untracked(() => this.render(bins));
      }
    });
  }

  private rangeLabel(bin: HistogramBin): string {
    const unit = this.dose.unitLabel();
    return bin.overflow
      ? `≥ ${this.dose.formatValue(bin.from)} ${unit}`
      : `${this.dose.formatValue(bin.from)}–${this.dose.formatValue(bin.to)} ${unit}`;
  }

  private render(bins: readonly HistogramBin[]): void {
    const chart = this.chart;
    if (!chart) {
      return;
    }
    chart.data.labels = bins.map(bin => (bin.overflow ? `≥ ${this.dose.formatValue(bin.from)}` : this.dose.formatValue(bin.from)));
    chart.data.datasets[0] = {
      data: bins.map(bin => bin.count),
      backgroundColor: bins.map(bin => DoseScale.color(bin.overflow ? bin.from : (bin.from + bin.to) / 2)),
      borderRadius: { topLeft: 4, topRight: 4 },
      borderSkipped: 'bottom',
      categoryPercentage: 1,
      barPercentage: 0.9,
      minBarLength: 0,
    };
    chart.options = this.options(bins);
    chart.update('none');
  }

  private options(bins: readonly HistogramBin[] = []): ChartOptions<'bar'> {
    const colors = this.chartTheme.colors();
    const count = numberFormat(this.i18n.locale(), { maximumFractionDigits: 0 });
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxRotation: 0, autoSkipPadding: 8 },
          title: { display: true, text: this.dose.unitLabel() },
        },
        y: {
          beginAtZero: true,
          grid: { color: colors.grid },
          border: { display: false },
          ticks: { precision: 0, callback: value => count.format(Number(value)) },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => (items.length && bins[items[0].dataIndex] ? this.rangeLabel(bins[items[0].dataIndex]) : ''),
            label: item => this.i18n.t('routes.samplesCount', { count: Number(item.raw) }),
          },
        },
      },
    };
  }
}
