import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MeasurementDto } from '../../../core/api/routes.models';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { DateTimePipe } from '../../../core/units/date-time.pipe';
import { DosePipe } from '../../../core/units/dose.pipe';
import { DoseScale } from '../../../core/units/dose-scale';
import { NumberPipe } from '../../../core/units/number.pipe';
import { findHotspots } from './route-stats';

/** Top 5 positioned samples by dose rate (separated by ≥ 30 m); choosing one selects and shows it on the map. */
@Component({
  selector: 'app-hotspot-list',
  imports: [DateTimePipe, DosePipe, NumberPipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hotspots().length) {
      <ol class="list">
        @for (spot of hotspots(); track spot.index; let rank = $index) {
          <li>
            <button type="button" class="item" [class.active]="spot.index === activeIndex()"
                    [attr.aria-pressed]="spot.index === activeIndex()" (click)="select.emit(spot.index)"
                    (mouseenter)="hover.emit(spot.index)" (mouseleave)="hover.emit(null)"
                    (focus)="hover.emit(spot.index)" (blur)="hover.emit(null)">
              <span class="rank app-num">{{ rank + 1 }}</span>
              <span class="swatch" [style.background]="color(spot.measurement.usvPerHour)" aria-hidden="true"></span>
              <span class="value app-num">{{ spot.measurement.usvPerHour | dose }}</span>
              <span class="meta">
                <span class="app-num">{{ spot.measurement.timestamp | dateTime: 'timeSeconds' }}</span>
                <span class="app-num">{{ spot.measurement.cpm | num }} CPM</span>
              </span>
            </button>
          </li>
        }
      </ol>
    } @else {
      <p class="empty">{{ 'routes.detail.hotspotsEmpty' | t }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .item {
      display: grid;
      grid-template-columns: 20px 12px minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--app-space-3);
      width: 100%;
      min-height: 44px;
      padding: 6px var(--app-space-3);
      border: 0;
      border-radius: var(--app-radius-chip);
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;

      &:hover {
        background: color-mix(in srgb, var(--mat-sys-on-surface) 6%, transparent);
      }

      &.active {
        background: var(--mat-sys-secondary-container);
        color: var(--mat-sys-on-secondary-container);
      }
    }

    .rank {
      color: var(--mat-sys-on-surface-variant);
    }

    .swatch {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .value {
      font-weight: 600;
      white-space: nowrap;
    }

    .meta {
      display: flex;
      gap: var(--app-space-3);
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant);
      white-space: nowrap;
    }

    .empty {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class HotspotList {
  readonly measurements = input<readonly MeasurementDto[]>([]);
  readonly activeIndex = input<number | null>(null);
  readonly select = output<number>();
  readonly hover = output<number | null>();

  protected readonly hotspots = computed(() => findHotspots(this.measurements()));
  protected readonly color = (usv: number) => DoseScale.color(usv);
}
