import {
  ChangeDetectionStrategy, Component, ElementRef, booleanAttribute, computed, effect, inject, input, viewChild,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { DoseFormat } from '../../core/units/dose-format';
import { DoseScale } from '../../core/units/dose-scale';

export type ReadoutSize = 'lg' | 'md' | 'sm';

/** Fewest fraction digits (max. 2) that show a tick value exactly: 0 / 0,1 / 100 / 0,17. */
function tickDigits(value: number): number {
  for (let digits = 0; digits < 2; digits++) {
    const scaled = value * 10 ** digits;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-6) {
      return digits;
    }
  }
  return 2;
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The signature element (UI.md §1): a dose rate reading like on a meter – big expanded number with its unit,
 * a label, the dose gradient scale 0…max with a needle at the value (clamped, with an "above scale" mark).
 *
 * ```html
 * <app-dose-readout [value]="route.maxUsv" [label]="'routes.stats.max' | t" size="lg" />
 * <app-dose-readout [value]="device.lastUsv" label="ESP32-01" live />
 * ```
 */
@Component({
  selector: 'app-dose-readout',
  templateUrl: './dose-readout.html',
  styleUrl: './dose-readout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'meter',
    '[attr.data-size]': 'size()',
    '[attr.aria-label]': 'label() || i18n.t("common.dose.scale")',
    'aria-valuemin': '0',
    '[attr.aria-valuemax]': 'max()',
    '[attr.aria-valuenow]': 'ariaValueNow()',
    '[attr.aria-valuetext]': 'valueText()',
  },
})
export class DoseReadout {
  protected readonly i18n = inject(I18nService);
  private readonly dose = inject(DoseFormat);

  /** Dose rate in µSv/h; null / undefined shows "—" without a needle. */
  readonly value = input<number | null | undefined>(null);
  /** Text above the number, e.g. "Maksimum" or a device name. */
  readonly label = input('');
  /** lg = 56 px number (route view), md = 40 px (cards), sm = 28 px without tick labels. */
  readonly size = input<ReadoutSize>('md');
  /** Live reading: shows a dot that pulses whenever the value changes. */
  readonly live = input(false, { transform: booleanAttribute });
  readonly showScale = input(true, { transform: booleanAttribute });
  /** Upper end of the scale in µSv/h. */
  readonly max = input(DoseScale.max);

  private readonly pulseRing = viewChild<ElementRef<HTMLElement>>('pulse');

  protected readonly gradient = computed(() => DoseScale.gradientCss('to right', this.max()));
  protected readonly hasValue = computed(() => {
    const value = this.value();
    return value !== null && value !== undefined && Number.isFinite(value);
  });
  protected readonly parts = computed(() => this.hasValue()
    ? this.dose.parts(this.value()!)
    : { value: '—', unit: this.dose.unitLabel() });
  protected readonly overflow = computed(() => this.hasValue() && this.value()! > this.max());
  /** Needle position in % of the scale width. */
  protected readonly position = computed(() => this.hasValue() ? DoseScale.position(this.value()!, this.max()) * 100 : null);
  protected readonly needleColor = computed(() => this.hasValue() ? DoseScale.color(this.value()!) : null);
  protected readonly ticks = computed(() => {
    const max = this.max();
    const unit = this.dose.unit();
    return [0, max / 3, (2 * max) / 3, max].map(usv => ({
      position: (usv / max) * 100,
      label: this.dose.formatValue(usv, unit, tickDigits(this.dose.convert(usv, unit))),
    }));
  });
  protected readonly ariaValueNow = computed(() => this.hasValue() ? Math.min(this.value()!, this.max()) : null);
  protected readonly valueText = computed(() => {
    if (!this.hasValue()) {
      return this.i18n.t('common.dose.noValue');
    }
    const text = this.dose.format(this.value()!);
    return this.overflow() ? `${text}, ${this.i18n.t('common.dose.aboveScale')}` : text;
  });

  constructor() {
    let previous: number | null | undefined;
    effect(() => {
      const value = this.value();
      const ring = this.pulseRing()?.nativeElement;
      if (ring && previous !== undefined && value !== previous && !reducedMotion()) {
        ring.animate(
          [{ transform: 'scale(1)', opacity: 0.8 }, { transform: 'scale(3)', opacity: 0 }],
          { duration: 1000, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
        );
      }
      previous = value;
    });
  }
}
