import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { DevicesApi } from '../../core/api/devices.api';
import { DeviceCommand, DeviceDto, ImportResult } from '../../core/api/devices.models';
import { I18nService } from '../../core/i18n/i18n.service';
import { Notifier } from '../../core/notify/notifier';
import { Dialogs } from '../../shared/dialogs/dialogs.service';
import { deviceLabel } from './device-meta';
import { ImportDialog, ImportDialogData } from './import-dialog';

/** Admin actions on a device shared by the dashboard, the device list and the device page. */
@Injectable({ providedIn: 'root' })
export class DeviceActions {
  private readonly api = inject(DevicesApi);
  private readonly dialogs = inject(Dialogs);
  private readonly dialog = inject(MatDialog);
  private readonly i18n = inject(I18nService);
  private readonly notifier = inject(Notifier);

  /**
   * Sends a command over MQTT (202 = handed to the broker). "New route" asks first – it closes the route the
   * device is recording. Resolves true when the command was sent.
   */
  async command(device: DeviceDto, cmd: DeviceCommand): Promise<boolean> {
    const name = deviceLabel(device);
    if (cmd === 'new-route') {
      const confirmed = await this.dialogs.confirm({
        title: this.i18n.t('devices.commands.newRouteConfirmTitle'),
        message: this.i18n.t('devices.commands.newRouteConfirmText', { name }),
        confirmLabel: this.i18n.t('devices.commands.newRoute'),
      });
      if (!confirmed) {
        return false;
      }
    }
    try {
      await firstValueFrom(this.api.command(device.id, cmd, { silent: true }));
      this.notifier.info(this.i18n.t(cmd === 'new-route' ? 'devices.commands.newRouteSent' : 'devices.commands.batterySent',
        { name }));
      return true;
    } catch (error) {
      this.notifier.error(error instanceof HttpErrorResponse && error.status === 503
        ? this.i18n.t('devices.commands.brokerUnavailable')
        : this.notifier.describe(error));
      return false;
    }
  }

  /** Asks for a new name; resolves the updated device or null when cancelled / failed. */
  async rename(device: DeviceDto): Promise<DeviceDto | null> {
    const name = await this.dialogs.prompt({
      title: this.i18n.t('devices.rename.title'),
      label: this.i18n.t('devices.rename.label'),
      value: device.name,
      hint: this.i18n.t('devices.rename.hint', { id: device.id }),
      maxLength: 100,
    });
    if (name === null || name === device.name) {
      return null;
    }
    try {
      const updated = await firstValueFrom(this.api.rename(device.id, name));
      this.notifier.info(this.i18n.t('devices.rename.done'));
      return updated;
    } catch {
      return null; // the interceptor has shown the error
    }
  }

  /** Opens the SD-card import dialog; resolves the result when something was imported. */
  async importFromSd(device: DeviceDto): Promise<ImportResult | null> {
    const ref = this.dialog.open<ImportDialog, ImportDialogData, ImportResult>(ImportDialog, {
      data: { device },
      width: '640px',
      maxWidth: 'calc(100vw - 32px)',
    });
    return (await firstValueFrom(ref.afterClosed())) ?? null;
  }
}
