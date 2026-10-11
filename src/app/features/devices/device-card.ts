import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { DeviceCommand, DeviceDto } from '../../core/api/devices.models';
import { AuthService } from '../../core/auth/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CsqPipe } from '../../core/units/csq.pipe';
import { DateTimePipe } from '../../core/units/date-time.pipe';
import { csqIcon } from '../../core/units/format-utils';
import { NumberPipe } from '../../core/units/number.pipe';
import { RelativeTimePipe } from '../../core/units/relative-time.pipe';
import { DoseReadout } from '../../shared/dose-readout/dose-readout';
import { DeviceActions } from './device-actions';
import { batteryIcon, deviceLabel, isLowBattery } from './device-meta';
import { DeviceReading } from './live-devices';

/**
 * A device at a glance: status, live dose readout while online, battery, signal, current route, last contact.
 * `variant="list"` adds firmware and the number of routes. Admins get the commands (New route, Battery) and a menu
 * with rename / SD import; `changed` emits the device after a rename.
 */
@Component({
  selector: 'app-device-card',
  imports: [
    CsqPipe, DateTimePipe, DoseReadout, MatButtonModule, MatCardModule, MatDividerModule, MatIconModule, MatMenuModule,
    MatTooltipModule, NumberPipe, RelativeTimePipe, RouterLink, TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './device-card.html',
  styleUrl: './device-card.scss',
})
export class DeviceCard {
  protected readonly auth = inject(AuthService);
  private readonly actions = inject(DeviceActions);

  readonly device = input.required<DeviceDto>();
  readonly reading = input<DeviceReading | undefined>(undefined);
  readonly variant = input<'dashboard' | 'list'>('dashboard');
  readonly changed = output<DeviceDto>();

  protected readonly busy = signal<DeviceCommand | null>(null);
  protected readonly name = computed(() => deviceLabel(this.device()));
  protected readonly link = computed(() => ['/devices', this.device().id]);
  protected readonly batteryIcon = computed(() => batteryIcon(this.device().batteryPct));
  protected readonly lowBattery = computed(() => isLowBattery(this.device().batteryPct));
  protected readonly signalIcon = computed(() => csqIcon(this.device().signalCsq));
  /** The live reading only while it belongs to the route being recorded. */
  protected readonly usv = computed(() => {
    const reading = this.reading();
    const device = this.device();
    return reading && (device.currentRouteId === null || reading.routeId === device.currentRouteId) ? reading : null;
  });

  protected async command(cmd: DeviceCommand): Promise<void> {
    this.busy.set(cmd);
    try {
      await this.actions.command(this.device(), cmd);
    } finally {
      this.busy.set(null);
    }
  }

  protected async rename(): Promise<void> {
    const updated = await this.actions.rename(this.device());
    if (updated) {
      this.changed.emit(updated);
    }
  }

  protected async importFromSd(): Promise<void> {
    if (await this.actions.importFromSd(this.device())) {
      this.changed.emit(this.device());
    }
  }
}
