import { DOCUMENT, Injectable, computed, effect, inject } from '@angular/core';
import { Chart } from 'chart.js';
import { ThemeService } from '../../core/prefs/theme.service';
import { NO_FIX_COLOR } from '../../core/units/dose-scale';
import { registerCharts } from './chart-setup';

/** Material colours resolved for canvas drawing (`rgb(...)` strings). */
export interface ChartColors {
  readonly text: string;
  readonly muted: string;
  readonly grid: string;
  readonly primary: string;
  readonly tertiary: string;
  readonly surface: string;
  readonly tooltipBackground: string;
  readonly tooltipText: string;
  readonly noFix: string;
}

/**
 * Theme-aware Chart.js defaults (font, text / grid / tooltip colours from `--mat-sys-*`), re-applied on theme change.
 * Charts created earlier pick up new defaults on their next update – in a component:
 * `effect(() => { this.chartTheme.colors(); chart?.update('none'); })`.
 */
@Injectable({ providedIn: 'root' })
export class ChartTheme {
  private readonly theme = inject(ThemeService);
  private readonly document = inject(DOCUMENT);

  readonly colors = computed<ChartColors>(() => {
    this.theme.revision();
    const color = (token: string) => this.theme.resolveColor(token);
    return {
      text: color('--mat-sys-on-surface'),
      muted: color('--mat-sys-on-surface-variant'),
      grid: color('--mat-sys-outline-variant'),
      primary: color('--mat-sys-primary'),
      tertiary: color('--mat-sys-tertiary'),
      surface: color('--mat-sys-surface'),
      tooltipBackground: color('--mat-sys-inverse-surface'),
      tooltipText: color('--mat-sys-inverse-on-surface'),
      noFix: NO_FIX_COLOR,
    };
  });

  constructor() {
    registerCharts();
    effect(() => this.applyDefaults(this.colors()));
  }

  private applyDefaults(colors: ChartColors): void {
    const defaults = Chart.defaults;
    defaults.font.family = getComputedStyle(this.document.body).fontFamily;
    defaults.font.size = 12;
    defaults.color = colors.muted;
    defaults.borderColor = colors.grid;
    defaults.maintainAspectRatio = false;
    defaults.animation = false;
    const tooltip = defaults.plugins.tooltip;
    tooltip.backgroundColor = colors.tooltipBackground;
    tooltip.titleColor = colors.tooltipText;
    tooltip.bodyColor = colors.tooltipText;
    tooltip.footerColor = colors.tooltipText;
    tooltip.cornerRadius = 4;
    tooltip.padding = 8;
    tooltip.boxPadding = 4;
    tooltip.titleFont = { weight: 'normal' };
    tooltip.bodyFont = { weight: 'bold' };
    defaults.plugins.legend.labels.boxWidth = 12;
    defaults.plugins.legend.labels.boxHeight = 12;
  }
}
