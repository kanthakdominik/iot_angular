import { ChangeDetectionStrategy, Component, booleanAttribute, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { DoseFormat } from '../../core/units/dose-format';
import { DoseScale } from '../../core/units/dose-scale';

/**
 * Gradient legend of the dose scale for maps and charts, labelled in the preferred unit.
 * Vertical: labels at every threshold of the scale; horizontal: at 0, ⅓, ⅔ and max.
 *
 * ```html
 * <app-dose-legend orientation="vertical" showNoFix />
 * ```
 * On a Leaflet map use `MapFactory.create(..., { legend: true })`, which hosts this component in a map control.
 */
@Component({
  selector: 'app-dose-legend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'img',
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.data-orientation]': 'orientation()',
  },
  template: `
    <span class="title">{{ dose.unitLabel() }}</span>
    <div class="scale">
      <div class="bar" [style.background]="gradient()"></div>
      <div class="labels">
        @for (label of labels(); track label.offset) {
          <span class="tick" [style.--offset]="label.offset + '%'">{{ label.text }}</span>
        }
      </div>
    </div>
    @if (showNoFix()) {
      <span class="no-fix"><span class="swatch"></span>{{ i18n.t('common.dose.noFix') }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-direction: column;
      gap: 6px;
      font-size: 12px;
      line-height: 16px;
      font-variant-numeric: tabular-nums;
      color: var(--mat-sys-on-surface);
    }

    .title {
      font-weight: 500;
      color: var(--mat-sys-on-surface-variant);
    }

    .scale {
      position: relative;
      display: grid;
    }

    .bar {
      border-radius: 4px;
    }

    .labels {
      position: relative;
    }

    .tick {
      position: absolute;
      white-space: nowrap;
    }

    :host([data-orientation='horizontal']) {
      min-width: 200px;

      .bar {
        height: 8px;
      }

      .labels {
        height: 16px;
        margin-top: 4px;
      }

      .tick {
        left: var(--offset);
        transform: translateX(-50%);

        &:first-child {
          transform: none;
        }

        &:last-child {
          transform: translateX(-100%);
        }
      }
    }

    :host([data-orientation='vertical']) {
      .scale {
        grid-template-columns: 10px auto;
        gap: 8px;
        height: 148px;
      }

      .labels {
        min-width: 3.5em;
      }

      .tick {
        bottom: var(--offset);
        transform: translateY(50%);
      }
    }

    .no-fix {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--mat-sys-on-surface-variant);
    }

    .swatch {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--app-no-fix);
    }
  `,
})
export class DoseLegend {
  protected readonly i18n = inject(I18nService);
  protected readonly dose = inject(DoseFormat);

  readonly orientation = input<'horizontal' | 'vertical'>('horizontal');
  /** Upper end of the scale in µSv/h. */
  readonly max = input(DoseScale.max);
  /** Adds the grey swatch of samples without GPS. */
  readonly showNoFix = input(false, { transform: booleanAttribute });

  protected readonly gradient = computed(() =>
    DoseScale.gradientCss(this.orientation() === 'vertical' ? 'to top' : 'to right', this.max()));

  protected readonly labels = computed(() => {
    const max = this.max();
    const values = this.orientation() === 'vertical'
      ? [0, ...DoseScale.stops.map(stop => stop.usv).filter(usv => usv <= max)]
      : [0, max / 3, (2 * max) / 3, max];
    // skip labels closer than ~9 % to the previous one (e.g. 0 and 0,02 on a 0,3 scale would overlap)
    const kept: number[] = [];
    for (const usv of values) {
      if (kept.length === 0 || ((usv - kept[kept.length - 1]) / max) * 100 >= 9) {
        kept.push(usv);
      }
    }
    return kept.map(usv => ({ offset: (usv / max) * 100, text: this.dose.formatValue(usv) }));
  });

  protected readonly ariaLabel = computed(() =>
    `${this.i18n.t('common.dose.scale')}: 0–${this.dose.format(this.max())}`);
}
