import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { AlertDto } from '../../core/api/alerts.models';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { DateTimePipe } from '../../core/units/date-time.pipe';
import { DosePipe } from '../../core/units/dose.pipe';
import { NumberPipe } from '../../core/units/number.pipe';
import { RelativeTimePipe } from '../../core/units/relative-time.pipe';
import { ALERT_ICONS, ALERT_TYPE_KEYS } from './alert-meta';

/**
 * One alert: open ones in the warning (tertiary) colour with an acknowledge button for admins, acknowledged ones
 * muted. Dose alerts show value and threshold in the preferred dose unit, battery alerts in %.
 * Use inside a `role="list"` container.
 */
@Component({
  selector: 'app-alert-item',
  imports: [
    DateTimePipe, DosePipe, MatButtonModule, MatIconModule, MatTooltipModule, NumberPipe, RelativeTimePipe, RouterLink,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'listitem',
    '[class.open]': 'isOpen()',
    '[class.compact]': 'compact()',
  },
  templateUrl: './alert-item.html',
  styleUrl: './alert-item.scss',
})
export class AlertItem {
  readonly alert = input.required<AlertDto>();
  /** Shows the acknowledge button on open alerts (ADMIN). */
  readonly canAck = input(false, { transform: booleanAttribute });
  /** Disables the button while a request runs. */
  readonly busy = input(false, { transform: booleanAttribute });
  /** Dashboard: no value line and a smaller button. */
  readonly compact = input(false, { transform: booleanAttribute });
  readonly ack = output<AlertDto>();

  protected readonly icons = ALERT_ICONS;
  protected readonly typeKeys = ALERT_TYPE_KEYS;
  protected readonly isOpen = computed(() => this.alert().acknowledgedAt === null);
  protected readonly hasPosition = computed(() => this.alert().latitude !== null && this.alert().longitude !== null);
}
