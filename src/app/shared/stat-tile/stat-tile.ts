import { ChangeDetectionStrategy, Component, booleanAttribute, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../../core/i18n/i18n.service';
import { numberFormat } from '../../core/units/format-utils';
import { Skeleton } from '../skeleton/skeleton';

/**
 * A labelled number: label (+ optional icon), expanded value with unit, optional hint underneath.
 * Pass preformatted strings for units with their own formatting (`route.distanceM | distance` gives value + unit),
 * or a number + `unit`. Extra content (e.g. a sparkline) can be projected.
 *
 * ```html
 * <app-stat-tile [label]="'routes.stats.samples' | t" [value]="route.sampleCount" />
 * <app-stat-tile [label]="'routes.stats.gps' | t" [value]="gpsPct()" unit="%" icon="satellite_alt" />
 * <app-stat-tile [label]="'routes.stats.distance' | t" [value]="route.distanceM | distance" [loading]="loading()" />
 * ```
 */
@Component({
  selector: 'app-stat-tile',
  imports: [MatIconModule, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      @if (icon()) {
        <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
      }
      <span class="label">{{ label() }}</span>
    </div>
    @if (loading()) {
      <app-skeleton width="60%" height="32px" />
    } @else {
      <div class="value">
        <span class="app-num-expanded">{{ display() }}</span>
        @if (unit() && display() !== '—') {
          <span class="unit">{{ unit() }}</span>
        }
      </div>
    }
    @if (hint()) {
      <div class="hint">{{ hint() }}</div>
    }
    <ng-content />
  `,
  styles: `
    :host {
      display: flex;
      container-type: inline-size;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
      padding: var(--app-space-3) var(--app-space-4);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--app-radius-card);
      background: var(--mat-sys-surface);
    }

    .head {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-large);
    }

    mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }

    .value {
      display: flex;
      align-items: baseline;
      gap: 4px;
      min-width: 0;
    }

    .app-num-expanded {
      /* shrinks in narrow tiles so values with units (0,071 µSv/h) stay readable instead of being cut */
      font-size: clamp(20px, 15cqi, 28px);
      line-height: 36px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .unit {
      font-size: 14px;
      font-weight: 500;
      color: var(--mat-sys-on-surface-variant);
    }

    .hint {
      font-size: 12px;
      line-height: 16px;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class StatTile {
  private readonly i18n = inject(I18nService);

  readonly label = input.required<string>();
  /** Numbers are locale-formatted (max. 2 fraction digits); null / undefined shows "—". */
  readonly value = input<string | number | null | undefined>(null);
  readonly unit = input('');
  /** Small text below the value (e.g. "of 1 204 samples"). */
  readonly hint = input('');
  /** Material Symbols name shown before the label. */
  readonly icon = input('');
  /** Shows a skeleton instead of the value. */
  readonly loading = input(false, { transform: booleanAttribute });

  protected readonly display = computed(() => {
    const value = this.value();
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    return typeof value === 'number'
      ? numberFormat(this.i18n.locale(), { maximumFractionDigits: 2 }).format(value)
      : value;
  });
}
