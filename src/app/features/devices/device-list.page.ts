import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { PageHeader } from '../../shared/page-header/page-header';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { DeviceCard } from './device-card';
import { LiveDevices } from './live-devices';

/** `/devices`: every device as a card (live readout, battery, signal, firmware, routes); admins can rename. */
@Component({
  selector: 'app-device-list-page',
  imports: [DeviceCard, EmptyState, MatButtonModule, MatIconModule, MatTooltipModule, PageHeader, Skeleton, TranslatePipe],
  providers: [LiveDevices],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-page" [attr.aria-busy]="devices.loading()">
      <app-page-header [title]="'devices.listTitle' | t"
                       [subtitle]="devices.devices()?.length ? ('devices.listSubtitle' | t: { count: devices.devices()?.length ?? 0, online: devices.onlineCount() }) : ''">
        <button headerActions matIconButton type="button" (click)="devices.load()" [disabled]="devices.loading()"
                [attr.aria-label]="'common.actions.refresh' | t" [matTooltip]="'common.actions.refresh' | t">
          <mat-icon aria-hidden="true">refresh</mat-icon>
        </button>
      </app-page-header>

      @if (devices.devices(); as list) {
        @if (list.length) {
          <div class="grid">
            @for (device of list; track device.id) {
              <app-device-card variant="list" [device]="device" [reading]="devices.readings().get(device.id)"
                               (changed)="devices.upsert($event)" />
            }
          </div>
        } @else {
          <app-empty-state icon="sensors_off" [title]="'devices.empty' | t" [text]="'devices.emptyText' | t" />
        }
      } @else if (devices.error()) {
        <app-empty-state icon="cloud_off" [title]="'common.states.loadFailed' | t"
                         [actionLabel]="'common.actions.retry' | t" (action)="devices.load()" />
      } @else {
        <div class="grid">
          @for (i of [0, 1, 2]; track i) {
            <app-skeleton height="300px" />
          }
        </div>
        <span class="app-visually-hidden">{{ 'common.states.loading' | t }}</span>
      }
    </div>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
      gap: var(--app-space-4);
    }
  `,
})
export class DeviceListPage {
  protected readonly devices = inject(LiveDevices);
}
