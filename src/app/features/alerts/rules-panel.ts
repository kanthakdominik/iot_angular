import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { AlertsApi } from '../../core/api/alerts.api';
import { AlertRuleDto, AlertRuleInput } from '../../core/api/alerts.models';
import { DevicesApi } from '../../core/api/devices.api';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Notifier } from '../../core/notify/notifier';
import { DoseFormat } from '../../core/units/dose-format';
import { numberFormat } from '../../core/units/format-utils';
import { Dialogs } from '../../shared/dialogs/dialogs.service';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { deviceLabel } from '../devices/device-meta';
import { ALERT_ICONS, ALERT_TYPE_KEYS } from './alert-meta';
import { RuleDialog, RuleDialogData } from './rule-dialog';

function toInput(rule: AlertRuleDto): AlertRuleInput {
  return {
    name: rule.name,
    type: rule.type,
    threshold: rule.threshold,
    deviceId: rule.deviceId,
    enabled: rule.enabled,
    cooldownMinutes: rule.cooldownMinutes,
    notifyPush: rule.notifyPush,
  };
}

/** Alert rules: everybody can read them, only admins create, edit, switch on / off and delete. */
@Component({
  selector: 'app-rules-panel',
  imports: [
    EmptyState, MatButtonModule, MatCardModule, MatIconModule, MatSlideToggleModule, MatTooltipModule, Skeleton,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rules-panel.html',
  styleUrl: './rules-panel.scss',
})
export class RulesPanel {
  private readonly api = inject(AlertsApi);
  private readonly devicesApi = inject(DevicesApi);
  private readonly dialog = inject(MatDialog);
  private readonly dialogs = inject(Dialogs);
  private readonly notifier = inject(Notifier);
  private readonly i18n = inject(I18nService);
  private readonly dose = inject(DoseFormat);
  protected readonly auth = inject(AuthService);

  protected readonly rules = rxResource({ stream: () => this.api.rules({ silent: true }) });
  private readonly devices = rxResource({ stream: () => this.devicesApi.list({ silent: true }) });

  protected readonly icons = ALERT_ICONS;
  protected readonly typeKeys = ALERT_TYPE_KEYS;
  protected readonly busy = signal<number | null>(null);

  protected readonly list = computed(() => {
    const rules = this.rules.hasValue() ? this.rules.value() ?? [] : [];
    return [...rules].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  });
  private readonly deviceNames = computed(() => new Map(
    (this.devices.hasValue() ? this.devices.value() ?? [] : []).map(device => [device.id, deviceLabel(device)])));

  /** "≥ 0,300 µSv/h", "< 20 %", "offline" – reads the dose unit and language signals. */
  protected condition(rule: AlertRuleDto): string {
    switch (rule.type) {
      case 'DOSE_RATE_ABOVE':
        return this.i18n.t('alerts.rules.conditionDose',
          { value: rule.threshold === null ? '—' : this.dose.format(rule.threshold) });
      case 'BATTERY_BELOW':
        return this.i18n.t('alerts.rules.conditionBattery', {
          value: rule.threshold === null ? '—' : `${numberFormat(this.i18n.locale()).format(rule.threshold)} %`,
        });
      default:
        return this.i18n.t('alerts.rules.conditionOffline');
    }
  }

  protected device(rule: AlertRuleDto): string {
    return rule.deviceId === null
      ? this.i18n.t('alerts.rules.allDevices')
      : this.deviceNames().get(rule.deviceId) ?? rule.deviceId;
  }

  protected async edit(rule?: AlertRuleDto): Promise<void> {
    const ref = this.dialog.open<RuleDialog, RuleDialogData, AlertRuleDto>(RuleDialog, {
      data: { rule, devices: this.devices.hasValue() ? this.devices.value() ?? [] : [] },
      width: '560px',
      maxWidth: 'calc(100vw - 32px)',
    });
    const saved = await firstValueFrom(ref.afterClosed());
    if (saved) {
      this.replace(saved);
      this.notifier.info(this.i18n.t('alerts.rules.saved', { name: saved.name }));
    }
  }

  protected toggle(rule: AlertRuleDto, change: MatSlideToggleChange): void {
    const enabled = change.checked;
    this.busy.set(rule.id);
    this.replace({ ...rule, enabled });
    this.api.updateRule(rule.id, { ...toInput(rule), enabled }).subscribe({
      next: saved => {
        this.busy.set(null);
        this.replace(saved);
      },
      error: () => {
        this.busy.set(null);
        this.replace(rule);
      },
    });
  }

  protected async remove(rule: AlertRuleDto): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: this.i18n.t('alerts.rules.deleteTitle'),
      message: this.i18n.t('alerts.rules.deleteText', { name: rule.name }),
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(rule.id);
    this.api.deleteRule(rule.id).subscribe({
      next: () => {
        this.busy.set(null);
        this.rules.update(list => list?.filter(item => item.id !== rule.id));
        this.notifier.info(this.i18n.t('alerts.rules.deleted', { name: rule.name }));
      },
      error: () => this.busy.set(null),
    });
  }

  private replace(rule: AlertRuleDto): void {
    this.rules.update(list => {
      const current = list ?? [];
      return current.some(item => item.id === rule.id)
        ? current.map(item => (item.id === rule.id ? rule : item))
        : [...current, rule];
    });
  }
}
