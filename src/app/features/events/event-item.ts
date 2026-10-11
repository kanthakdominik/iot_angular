import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { EventDto } from '../../core/api/events.models';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { DateTimePipe } from '../../core/units/date-time.pipe';
import { RelativeTimePipe } from '../../core/units/relative-time.pipe';
import { EVENT_ICONS, EVENT_TYPE_KEYS, SEVERITY_KEYS } from './event-meta';

/**
 * One row of the activity log: type icon in the severity colour, type and message, device / route links,
 * relative time (exact time in the tooltip and below on wide screens). Use inside a `role="list"` container.
 */
@Component({
  selector: 'app-event-item',
  imports: [DateTimePipe, MatIconModule, RelativeTimePipe, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'listitem',
    '[attr.data-severity]': 'event().severity',
    '[class.compact]': 'compact()',
  },
  template: `
    @let e = event();
    <span class="icon" [attr.title]="severityKeys[e.severity] | t">
      <mat-icon aria-hidden="true">{{ icons[e.type] }}</mat-icon>
    </span>
    <div class="main">
      <div class="line">
        <span class="type">{{ typeKeys[e.type] | t }}</span>
        @if (e.severity !== 'INFO') {
          <span class="app-visually-hidden">({{ severityKeys[e.severity] | t }})</span>
        }
        <span class="message">{{ e.message }}</span>
      </div>
      <div class="meta">
        @if (showDevice() && e.deviceId) {
          <a [routerLink]="['/devices', e.deviceId]">
            <mat-icon aria-hidden="true">sensors</mat-icon>{{ e.deviceName ?? e.deviceId }}
          </a>
        }
        @if (e.routeId !== null) {
          <a [routerLink]="['/routes', e.routeId]">
            <mat-icon aria-hidden="true">route</mat-icon>{{ 'events.routeLink' | t: { id: '' + e.routeId } }}
          </a>
        }
        @if (compact()) {
          <time [attr.datetime]="e.ts" [attr.title]="e.ts | dateTime: 'datetimeSeconds'">{{ e.ts | relativeTime }}</time>
        }
      </div>
    </div>
    @if (!compact()) {
      <div class="time">
        <time [attr.datetime]="e.ts" [attr.title]="e.ts | dateTime: 'datetimeSeconds'">{{ e.ts | relativeTime }}</time>
        <span class="exact app-num">{{ e.ts | dateTime: 'datetimeSeconds' }}</span>
      </div>
    }
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: var(--app-space-3);
      align-items: start;
      padding: var(--app-space-3) 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }

    :host(:last-child) {
      border-bottom: 0;
    }

    .icon {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface-variant);

      mat-icon {
        width: 18px;
        height: 18px;
        font-size: 18px;
      }
    }

    :host([data-severity='WARN']) .icon {
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }

    :host([data-severity='ERROR']) .icon {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }

    .main {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .line {
      display: flex;
      flex-wrap: wrap;
      column-gap: var(--app-space-2);
      line-height: 20px;
    }

    .type {
      font-weight: 600;
    }

    .message {
      color: var(--mat-sys-on-surface-variant);
      overflow-wrap: anywhere;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 2px var(--app-space-3);
      font-size: 12px;
      line-height: 16px;
      color: var(--mat-sys-on-surface-variant);

      a {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }

      mat-icon {
        width: 14px;
        height: 14px;
        font-size: 14px;
      }
    }

    .time {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
      font-size: 12px;
      line-height: 16px;
      color: var(--mat-sys-on-surface-variant);
      white-space: nowrap;
    }

    .exact {
      opacity: 0.8;
    }

    :host(.compact) {
      grid-template-columns: auto minmax(0, 1fr);
    }

    @media (max-width: 599.98px) {
      .exact {
        display: none;
      }
    }
  `,
})
export class EventItem {
  readonly event = input.required<EventDto>();
  readonly showDevice = input(true, { transform: booleanAttribute });
  /** Dashboard: time in the meta line instead of a column. */
  readonly compact = input(false, { transform: booleanAttribute });

  protected readonly icons = EVENT_ICONS;
  protected readonly typeKeys = EVENT_TYPE_KEYS;
  protected readonly severityKeys = SEVERITY_KEYS;
}
