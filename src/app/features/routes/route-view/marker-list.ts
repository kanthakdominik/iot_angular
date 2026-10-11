import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MarkerDto } from '../../../core/api/routes.models';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { DateTimePipe } from '../../../core/units/date-time.pipe';

/** Markers of a route (device button presses and manual ones); choosing one focuses it on the map. */
@Component({
  selector: 'app-marker-list',
  imports: [DateTimePipe, MatButtonModule, MatIconModule, MatTooltipModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (markers().length) {
      <ul class="list">
        @for (marker of markers(); track marker.id) {
          <li class="row" [class.active]="marker.id === activeId()">
            <button type="button" class="item" (click)="select.emit(marker)" [attr.aria-pressed]="marker.id === activeId()"
                    [disabled]="marker.latitude === null">
              <mat-icon aria-hidden="true">{{ marker.source === 'device' ? 'memory' : 'flag' }}</mat-icon>
              <span class="text">
                <span class="label">{{ marker.label }}</span>
                <span class="meta">
                  <span class="app-num">{{ marker.timestamp | dateTime: 'timeSeconds' }}</span>
                  <span>{{ (marker.source === 'device' ? 'routes.detail.markerFromDevice' : 'routes.detail.markerManual') | t }}</span>
                  @if (marker.latitude === null) {
                    <span>{{ 'routes.detail.markerNoPosition' | t }}</span>
                  }
                </span>
              </span>
            </button>
            @if (editable()) {
              <button matIconButton type="button" (click)="remove.emit(marker)"
                      [attr.aria-label]="'routes.detail.deleteMarker' | t: { label: marker.label }"
                      [matTooltip]="'common.actions.delete' | t">
                <mat-icon aria-hidden="true">delete</mat-icon>
              </button>
            }
          </li>
        }
      </ul>
    } @else {
      <p class="empty">{{ (editable() ? 'routes.detail.markersEmptyEditable' : 'routes.detail.markersEmpty') | t }}</p>
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

    .row {
      display: flex;
      align-items: center;
      gap: var(--app-space-1);
      border-radius: var(--app-radius-chip);

      &.active {
        background: var(--mat-sys-secondary-container);
        color: var(--mat-sys-on-secondary-container);
      }
    }

    .item {
      display: flex;
      flex: 1;
      align-items: center;
      gap: var(--app-space-3);
      min-width: 0;
      min-height: 48px;
      padding: 6px var(--app-space-3);
      border: 0;
      border-radius: var(--app-radius-chip);
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;

      &:hover:not(:disabled) {
        background: color-mix(in srgb, var(--mat-sys-on-surface) 6%, transparent);
      }

      &:disabled {
        cursor: default;
      }

      mat-icon {
        flex: none;
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .label {
      overflow-wrap: anywhere;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0 var(--app-space-3);
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant);
    }

    .empty {
      max-width: 72ch;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class MarkerList {
  readonly markers = input<readonly MarkerDto[]>([]);
  readonly activeId = input<number | null>(null);
  readonly editable = input(false, { transform: booleanAttribute });
  readonly select = output<MarkerDto>();
  readonly remove = output<MarkerDto>();
}
