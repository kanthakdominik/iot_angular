import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Observable } from 'rxjs';
import { AlertsApi } from '../../core/api/alerts.api';
import { ALERT_TYPES, AlertRuleDto, AlertRuleInput, AlertType } from '../../core/api/alerts.models';
import { DeviceDto } from '../../core/api/devices.models';
import { TranslationKey } from '../../core/i18n/pl';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Notifier } from '../../core/notify/notifier';
import { DoseFormat } from '../../core/units/dose-format';
import { NumberPipe } from '../../core/units/number.pipe';
import { deviceLabel } from '../devices/device-meta';
import { ALERT_TYPE_KEYS } from './alert-meta';

export interface RuleDialogData {
  /** Absent = new rule. */
  readonly rule?: AlertRuleDto;
  readonly devices: readonly DeviceDto[];
}

/** Backend limits (AlertRuleService.validate): dose 0 < x ≤ 1000 µSv/h, battery 0 < x ≤ 100 %, cooldown 0–10080. */
const MAX_DOSE_USV = 1000;
const MAX_BATTERY = 100;
const MAX_COOLDOWN = 10_080;
const DEFAULT_COOLDOWN = 15;

const TYPE_HINT_KEYS: Readonly<Record<AlertType, TranslationKey>> = {
  DOSE_RATE_ABOVE: 'alerts.dialog.typeHints.DOSE_RATE_ABOVE',
  BATTERY_BELOW: 'alerts.dialog.typeHints.BATTERY_BELOW',
  DEVICE_OFFLINE: 'alerts.dialog.typeHints.DEVICE_OFFLINE',
};

const notBlank: ValidatorFn = (control: AbstractControl<string | null>): ValidationErrors | null =>
  control.value && !control.value.trim() ? { required: true } : null;

/** Greater than 0 and at most `max`; the error carries the limits for the message. */
function rangeValidator(max: () => number): ValidatorFn {
  return (control: AbstractControl<number | null>): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || (value as unknown) === '') {
      return null;
    }
    return Number.isFinite(value) && value > 0 && value <= max() ? null : { range: { max: max() } };
  };
}

/** Rounds away floating-point noise from unit conversions (0.30000000000000004 -> 0.3). */
function clean(value: number): number {
  return Number(value.toPrecision(6));
}

/**
 * Create / edit an alert rule. The dose threshold is entered in the user's preferred unit and stored in µSv/h;
 * the battery threshold in %. Saves itself and closes with the stored rule; server validation errors are shown inline.
 */
@Component({
  selector: 'app-rule-dialog',
  imports: [
    MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule,
    MatSelectModule, MatSlideToggleModule, NumberPipe, ReactiveFormsModule, TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rule-dialog.html',
  styleUrl: './rule-dialog.scss',
})
export class RuleDialog {
  protected readonly data = inject<RuleDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<RuleDialog, AlertRuleDto>>(MatDialogRef);
  private readonly api = inject(AlertsApi);
  private readonly notifier = inject(Notifier);
  protected readonly dose = inject(DoseFormat);

  protected readonly types = ALERT_TYPES;
  protected readonly typeKeys = ALERT_TYPE_KEYS;
  protected readonly typeHintKeys = TYPE_HINT_KEYS;
  protected readonly maxCooldown = MAX_COOLDOWN;
  protected readonly devices = [...this.data.devices]
    .map(device => ({ id: device.id, label: deviceLabel(device) }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  protected readonly isEdit = this.data.rule !== undefined;

  /** Dose threshold limits in the preferred unit. */
  protected readonly doseMax = computed(() => clean(this.dose.convert(MAX_DOSE_USV)));

  protected readonly form = new FormGroup({
    name: new FormControl(this.data.rule?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100), notBlank],
    }),
    type: new FormControl<AlertType>(this.data.rule?.type ?? 'DOSE_RATE_ABOVE', { nonNullable: true }),
    threshold: new FormControl<number | null>(this.initialThreshold()),
    deviceId: new FormControl<string | null>(this.data.rule?.deviceId ?? null),
    cooldownMinutes: new FormControl<number | null>(this.data.rule?.cooldownMinutes ?? DEFAULT_COOLDOWN, [
      Validators.required, Validators.min(0), Validators.max(MAX_COOLDOWN), Validators.pattern(/^\d+$/),
    ]),
    notifyPush: new FormControl(this.data.rule?.notifyPush ?? true, { nonNullable: true }),
    enabled: new FormControl(this.data.rule?.enabled ?? true, { nonNullable: true }),
  });

  protected readonly type = toSignal(this.form.controls.type.valueChanges as Observable<AlertType>,
    { initialValue: this.form.controls.type.value });
  protected readonly thresholdMax = computed(() => (this.type() === 'BATTERY_BELOW' ? MAX_BATTERY : this.doseMax()));
  protected readonly thresholdUnit = computed(() => (this.type() === 'BATTERY_BELOW' ? '%' : this.dose.unitLabel()));
  protected readonly thresholdStep = computed(() => {
    if (this.type() === 'BATTERY_BELOW') {
      return 1;
    }
    return this.dose.unit() === 'nSv' ? 1 : 0.001 * this.dose.convert(1);
  });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.form.controls.threshold.addValidators(rangeValidator(() => this.thresholdMax()));
    this.form.controls.type.valueChanges.pipe(takeUntilDestroyed()).subscribe(type => this.applyType(type, true));
    this.applyType(this.form.controls.type.value, false);
  }

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const threshold = value.threshold === null ? null
      : value.type === 'DOSE_RATE_ABOVE' ? clean(value.threshold / this.dose.convert(1))
        : value.type === 'BATTERY_BELOW' ? value.threshold : null;
    const body: AlertRuleInput = {
      name: value.name.trim(),
      type: value.type,
      threshold,
      deviceId: value.deviceId,
      cooldownMinutes: value.cooldownMinutes ?? DEFAULT_COOLDOWN,
      notifyPush: value.notifyPush,
      enabled: value.enabled,
    };
    this.saving.set(true);
    this.error.set(null);
    const request = this.data.rule
      ? this.api.updateRule(this.data.rule.id, body, { silent: true })
      : this.api.createRule(body, { silent: true });
    request.subscribe({
      next: rule => this.dialogRef.close(rule),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(this.notifier.describe(error));
      },
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }

  private initialThreshold(): number | null {
    const rule = this.data.rule;
    if (!rule || rule.threshold === null) {
      return null;
    }
    return rule.type === 'DOSE_RATE_ABOVE' ? clean(this.dose.convert(rule.threshold)) : rule.threshold;
  }

  /** Threshold is required for dose / battery rules and disabled for "device offline". */
  private applyType(type: AlertType, reset: boolean): void {
    const threshold = this.form.controls.threshold;
    if (type === 'DEVICE_OFFLINE') {
      threshold.removeValidators(Validators.required);
      threshold.disable({ emitEvent: false });
    } else {
      threshold.addValidators(Validators.required);
      threshold.enable({ emitEvent: false });
    }
    if (reset) {
      threshold.setValue(null, { emitEvent: false });
      threshold.markAsUntouched();
    }
    threshold.updateValueAndValidity({ emitEvent: false });
  }
}
