import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, booleanAttribute, computed, effect,
  inject, input, output, signal, untracked, viewChild,
} from '@angular/core';
import { Chart, ChartDataset, ChartOptions, Scale } from 'chart.js';
import { MeasurementDto } from '../../../core/api/routes.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { DoseFormat } from '../../../core/units/dose-format';
import { numberFormat } from '../../../core/units/format-utils';
import { ChartTheme } from '../../../shared/chart/chart-theme';
import { crosshairPlugin, setCrosshairIndex } from '../../../shared/chart/crosshair.plugin';
import { DosePoint, doseDataset, timeSeriesOptions, toDosePoint } from '../../../shared/chart/dose-series';
import { listChange } from './route-stats';

interface CountPoint {
  readonly x: number;
  readonly y: number;
}

/** Fixed width of the y axes so both charts share the same x positions (aligned crosshairs). */
const Y_AXIS_WIDTH = 60;

function toCountPoint(m: MeasurementDto): CountPoint {
  return { x: Date.parse(m.timestamp), y: m.cpm };
}

/**
 * Dose rate (µSv/h, dose-coloured, grey samples without GPS) and counts (CPM) over time as two aligned charts
 * (no dual axis). The crosshair follows `cursor`; hover / click are reported as sample indices.
 */
@Component({
  selector: 'app-route-chart-panel',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="series">
      <h3 class="title">{{ 'routes.detail.doseChart' | t }} <span class="unit">{{ dose.unitLabel() }}</span></h3>
      <div class="canvas dose" [style.height.px]="compact() ? 180 : 240" (click)="select()">
        <canvas #doseCanvas role="img" [attr.aria-label]="summary()"></canvas>
      </div>
    </div>
    <div class="series">
      <h3 class="title">{{ 'routes.detail.cpmChart' | t }} <span class="unit">CPM</span></h3>
      <div class="canvas cpm" [style.height.px]="compact() ? 90 : 110" (click)="select()">
        <canvas #cpmCanvas role="img" [attr.aria-label]="'routes.detail.cpmChartLabel' | t"></canvas>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--app-space-3);
      min-width: 0;
    }

    .series {
      display: flex;
      flex-direction: column;
      gap: var(--app-space-1);
    }

    .title {
      display: flex;
      align-items: baseline;
      gap: 6px;
      font-size: 14px;
      line-height: 20px;
      font-weight: 500;
      font-stretch: 100%;
    }

    .unit {
      font-size: 12px;
      font-weight: 400;
      color: var(--mat-sys-on-surface-variant);
    }

    .canvas {
      position: relative;
      min-width: 0;
      cursor: crosshair;
    }

    canvas {
      position: absolute;
      inset: 0;
    }
  `,
})
export class RouteChartPanel {
  protected readonly dose = inject(DoseFormat);
  private readonly i18n = inject(I18nService);
  private readonly chartTheme = inject(ChartTheme);
  private readonly doseCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('doseCanvas');
  private readonly cpmCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('cpmCanvas');

  readonly measurements = input<readonly MeasurementDto[]>([]);
  readonly cursor = input<number | null>(null);
  /** Lower charts (phone). */
  readonly compact = input(false, { transform: booleanAttribute });

  readonly hoverIndex = output<number | null>();
  readonly selectIndex = output<number>();

  protected readonly summary = computed(() => {
    const list = this.measurements();
    const max = list.reduce((m, s) => Math.max(m, s.usvPerHour), 0);
    return this.i18n.t('routes.detail.doseChartLabel', { count: list.length, max: this.dose.format(max) });
  });

  private readonly ready = signal(false);
  private doseChart?: Chart<'line', DosePoint[]>;
  private cpmChart?: Chart<'line', CountPoint[]>;
  private drawn: readonly MeasurementDto[] = [];
  private lastHover: number | null = null;

  constructor() {
    afterNextRender(() => {
      const list = this.measurements();
      this.drawn = list;
      this.doseChart = new Chart(this.doseCanvas().nativeElement, {
        type: 'line',
        data: { datasets: [doseDataset(list, this.dose.unitLabel())] },
        options: this.doseOptions(),
        plugins: [crosshairPlugin],
      });
      this.cpmChart = new Chart(this.cpmCanvas().nativeElement, {
        type: 'line',
        data: { datasets: [this.cpmDataset(list)] },
        options: this.cpmOptions(),
        plugins: [crosshairPlugin],
      });
      this.ready.set(true);
    });
    inject(DestroyRef).onDestroy(() => {
      this.doseChart?.destroy();
      this.cpmChart?.destroy();
    });

    effect(() => {
      const list = this.measurements();
      if (this.ready()) {
        untracked(() => this.update(list));
      }
    });
    effect(() => {
      const index = this.cursor();
      if (this.ready()) {
        untracked(() => {
          if (this.doseChart && this.cpmChart) {
            setCrosshairIndex(this.doseChart, index);
            setCrosshairIndex(this.cpmChart, index);
          }
        });
      }
    });
    // theme, language and dose unit: rebuild options (colours, tick formats)
    effect(() => {
      this.chartTheme.colors();
      this.i18n.locale();
      this.dose.unit();
      if (this.ready()) {
        untracked(() => this.restyle());
      }
    });
  }

  protected select(): void {
    if (this.lastHover !== null) {
      this.selectIndex.emit(this.lastHover);
    }
  }

  private onHover(index: number | null): void {
    this.lastHover = index;
    this.hoverIndex.emit(index);
  }

  private update(list: readonly MeasurementDto[]): void {
    const doseChart = this.doseChart;
    const cpmChart = this.cpmChart;
    if (!doseChart || !cpmChart) {
      return;
    }
    const change = listChange(this.drawn, list);
    if (change === 'append') {
      const added = list.slice(this.drawn.length);
      doseChart.data.datasets[0].data.push(...added.map(toDosePoint));
      cpmChart.data.datasets[0].data.push(...added.map(toCountPoint));
    } else if (change === 'replace') {
      doseChart.data.datasets[0].data = list.map(toDosePoint);
      cpmChart.data.datasets[0].data = list.map(toCountPoint);
    }
    this.drawn = list;
    if (change !== 'same') {
      doseChart.update('none');
      cpmChart.update('none');
    }
  }

  private restyle(): void {
    if (this.doseChart && this.cpmChart) {
      this.doseChart.options = this.doseOptions();
      this.doseChart.data.datasets[0].label = this.dose.unitLabel();
      this.cpmChart.options = this.cpmOptions();
      Object.assign(this.cpmChart.data.datasets[0], this.cpmStyle());
      this.doseChart.update('none');
      this.cpmChart.update('none');
    }
  }

  private cpmStyle() {
    const color = this.chartTheme.colors().muted;
    return { borderColor: color, backgroundColor: color, pointHoverBackgroundColor: color };
  }

  private cpmDataset(list: readonly MeasurementDto[]): ChartDataset<'line', CountPoint[]> {
    return {
      label: 'CPM',
      data: list.map(toCountPoint),
      parsing: false,
      normalized: true,
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointBorderWidth: 0,
      tension: 0,
      ...this.cpmStyle(),
    };
  }

  private baseOptions(yTicks: (value: number) => string): ChartOptions<'line'> {
    const base = timeSeriesOptions({
      locale: this.i18n.locale(),
      colors: this.chartTheme.colors(),
      yTicks,
      crosshair: { onHover: index => this.onHover(index) },
    });
    const y = base.scales?.['y'];
    return {
      ...base,
      scales: {
        ...base.scales,
        y: { ...y, afterFit: (scale: Scale) => { scale.width = Y_AXIS_WIDTH; } },
      },
    };
  }

  private doseOptions(): ChartOptions<'line'> {
    const base = this.baseOptions(value => this.dose.formatValue(value));
    const tooltip = base.plugins?.tooltip;
    const noFix = this.i18n.t('common.dose.noFix');
    return {
      ...base,
      plugins: {
        ...base.plugins,
        tooltip: {
          ...tooltip,
          callbacks: {
            ...tooltip?.callbacks,
            label: item => {
              const point = item.raw as DosePoint;
              return `${this.dose.format(point.y)}${point.fix ? '' : ` (${noFix})`}`;
            },
          },
        },
      },
    };
  }

  private cpmOptions(): ChartOptions<'line'> {
    const format = numberFormat(this.i18n.locale(), { maximumFractionDigits: 0 });
    const base = this.baseOptions(value => format.format(value));
    const tooltip = base.plugins?.tooltip;
    return {
      ...base,
      plugins: {
        ...base.plugins,
        tooltip: {
          ...tooltip,
          callbacks: {
            ...tooltip?.callbacks,
            label: item => `${format.format((item.raw as CountPoint).y)} CPM`,
          },
        },
      },
    };
  }
}
