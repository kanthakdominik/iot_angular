import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { DoseScale } from '../../core/units/dose-scale';

let nextId = 0;

/**
 * Inline SVG line of a series (e.g. `route.preview.spark`). Stretches to the width of its container.
 * `tone="dose"` colours the line by height with the dose scale (values in µSv/h, y axis from 0);
 * `tone="neutral"` draws it in the on-surface-variant colour with an auto-scaled y axis.
 *
 * ```html
 * <app-sparkline [values]="route.preview?.spark ?? []" [height]="32" [ariaLabel]="'…'" />
 * ```
 */
@Component({
  selector: 'app-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.height.px]': 'height()',
  },
  template: `
    @if (path(); as d) {
      <svg [attr.viewBox]="'0 0 100 ' + height()" preserveAspectRatio="none"
           [attr.role]="ariaLabel() ? 'img' : null" [attr.aria-label]="ariaLabel() || null"
           [attr.aria-hidden]="ariaLabel() ? null : 'true'">
        @if (tone() === 'dose') {
          <defs>
            <linearGradient [attr.id]="gradientId" gradientUnits="userSpaceOnUse"
                            x1="0" [attr.y1]="height()" x2="0" y2="0">
              @for (stop of gradientStops(); track $index) {
                <stop [attr.offset]="stop.offset" [attr.stop-color]="stop.color" />
              }
            </linearGradient>
          </defs>
        }
        @if (area()) {
          <path [attr.d]="d + ' L100,' + height() + ' L0,' + height() + ' Z'" class="area"
                [attr.fill]="tone() === 'dose' ? 'url(#' + gradientId + ')' : 'currentColor'" />
        }
        <path [attr.d]="d" class="line" [attr.stroke]="tone() === 'dose' ? 'url(#' + gradientId + ')' : 'currentColor'"
              [attr.stroke-width]="strokeWidth()" />
      </svg>
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 40px;
      color: var(--mat-sys-on-surface-variant);
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .line {
      fill: none;
      stroke-linejoin: round;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }

    .area {
      opacity: 0.16;
      stroke: none;
    }
  `,
})
export class Sparkline {
  readonly values = input<readonly number[]>([]);
  readonly tone = input<'dose' | 'neutral'>('dose');
  /** Height in px (the width follows the container). */
  readonly height = input(32);
  readonly strokeWidth = input(1.5);
  /** Fill the area under the line (low opacity). */
  readonly area = input(false, { transform: booleanAttribute });
  /** Accessible description; without it the sparkline is decorative (aria-hidden). */
  readonly ariaLabel = input('');
  /** Top of the y axis in µSv/h for `tone="dose"`; default: max(values, 0.1). */
  readonly max = input<number | null>(null);

  protected readonly gradientId = `app-spark-${nextId++}`;

  private readonly range = computed(() => {
    const values = this.values();
    if (this.tone() === 'dose') {
      return { min: 0, max: this.max() ?? Math.max(0.1, ...values) };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    return max > min ? { min, max } : { min: min - 1, max: max + 1 };
  });

  protected readonly path = computed(() => {
    const values = this.values();
    if (values.length < 2) {
      return null;
    }
    const height = this.height();
    const pad = this.strokeWidth();
    const { min, max } = this.range();
    const y = (v: number) => height - pad - ((Math.min(v, max) - min) / (max - min)) * (height - 2 * pad);
    return values
      .map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * 100).toFixed(2)},${y(v).toFixed(2)}`)
      .join(' ');
  });

  /** Gradient along the y axis: the colour at each height is the dose colour of that value. */
  protected readonly gradientStops = computed(() => {
    const { max } = this.range();
    const stops = DoseScale.legendStops(max).map(stop => ({ offset: stop.offset, color: stop.color }));
    return [...stops, { offset: 1, color: DoseScale.color(max) }];
  });
}
