import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MeasurementDto, hasPosition } from '../../../core/api/routes.models';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { DateTimePipe } from '../../../core/units/date-time.pipe';
import { DosePipe } from '../../../core/units/dose.pipe';
import { DoseScale, NO_FIX_COLOR } from '../../../core/units/dose-scale';
import { NumberPipe } from '../../../core/units/number.pipe';

/**
 * Details of the sample under the cursor (hover) or the selected one (click, hotspot, playback);
 * admins can add a marker at it or delete it.
 */
@Component({
  selector: 'app-sample-inspector',
  imports: [DateTimePipe, DosePipe, MatButtonModule, MatIconModule, MatTooltipModule, NumberPipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.pinned]': 'pinned()',
  },
  template: `
    @if (sample(); as m) {
      <div class="head">
        <span class="swatch" [style.background]="color()" aria-hidden="true"></span>
        <span class="value app-num-expanded">{{ m.usvPerHour | dose }}</span>
        <span class="spacer"></span>
        @if (pinned()) {
          <button matIconButton type="button" (click)="clear.emit()" [attr.aria-label]="'routes.detail.clearSelection' | t"
                  [matTooltip]="'routes.detail.clearSelection' | t">
            <mat-icon aria-hidden="true">close</mat-icon>
          </button>
        }
      </div>
      <dl class="fields">
        <div><dt>{{ 'routes.detail.sampleTime' | t }}</dt><dd class="app-num">{{ m.timestamp | dateTime: 'datetimeSeconds' }}</dd></div>
        <div><dt>CPM</dt><dd class="app-num">{{ m.cpm | num }}</dd></div>
        <div>
          <dt>{{ 'routes.detail.samplePosition' | t }}</dt>
          <dd class="app-num">
            @if (positioned()) {
              {{ m.latitude | num: 5 }}, {{ m.longitude | num: 5 }}
            } @else {
              {{ 'common.dose.noFix' | t }}
            }
          </dd>
        </div>
        <div><dt>{{ 'routes.detail.sampleSatellites' | t }}</dt><dd class="app-num">{{ m.satellites | num }}</dd></div>
        <div><dt>HDOP</dt><dd class="app-num">{{ m.hdop | num: 1 }}</dd></div>
        <div><dt>{{ 'routes.detail.sampleSpeed' | t }}</dt><dd class="app-num">{{ m.speed | num: 1 }}@if (m.speed !== null) { km/h }</dd></div>
      </dl>
      <p class="index app-num">{{ 'routes.detail.sampleIndex' | t: { n: index() + 1, total: total() } }}</p>
      @if (editable() && pinned()) {
        <div class="actions">
          <button matButton="outlined" type="button" (click)="addMarker.emit(m)">
            <mat-icon aria-hidden="true">add_location_alt</mat-icon>{{ 'routes.detail.addMarkerHere' | t }}
          </button>
          <button matButton type="button" class="danger" (click)="remove.emit(m)">
            <mat-icon aria-hidden="true">delete</mat-icon>{{ 'routes.detail.deleteSample' | t }}
          </button>
        </div>
      }
    } @else {
      <p class="hint">{{ 'routes.detail.sampleHint' | t }}</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--app-space-2);
      padding: var(--app-space-3) var(--app-space-4);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--app-radius-card);
    }

    :host(.pinned) {
      border-color: var(--mat-sys-outline);
    }

    .head {
      display: flex;
      align-items: center;
      gap: var(--app-space-2);
      min-height: 40px;
    }

    .swatch {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .value {
      font-size: 20px;
      line-height: 28px;
    }

    .spacer {
      flex: 1;
    }

    .fields {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: var(--app-space-2) var(--app-space-4);
      margin: 0;

      div {
        min-width: 0;
      }

      dt {
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant);
      }

      dd {
        margin: 0;
        overflow-wrap: anywhere;
      }
    }

    .index, .hint {
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--app-space-2);
    }

    .danger {
      color: var(--mat-sys-error);
    }
  `,
})
export class SampleInspector {
  readonly sample = input<MeasurementDto | null>(null);
  readonly index = input(0);
  readonly total = input(0);
  /** Selected (clicked) rather than just hovered. */
  readonly pinned = input(false, { transform: booleanAttribute });
  readonly editable = input(false, { transform: booleanAttribute });

  readonly addMarker = output<MeasurementDto>();
  readonly remove = output<MeasurementDto>();
  readonly clear = output<void>();

  protected readonly positioned = computed(() => {
    const m = this.sample();
    return !!m && hasPosition(m);
  });
  protected readonly color = computed(() => {
    const m = this.sample();
    return !m ? null : this.positioned() ? DoseScale.color(m.usvPerHour) : NO_FIX_COLOR;
  });
}
