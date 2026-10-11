import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { AlertDto, AlertType } from '../../core/api/alerts.models';
import { OpenAlertsStore } from '../../core/alerts/open-alerts.store';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Notifier } from '../../core/notify/notifier';
import { DateTimePipe } from '../../core/units/date-time.pipe';
import { RelativeTimePipe } from '../../core/units/relative-time.pipe';

const ALERT_ICONS: Readonly<Record<AlertType, string>> = {
  DOSE_RATE_ABOVE: 'warning',
  BATTERY_BELOW: 'battery_alert',
  DEVICE_OFFLINE: 'cloud_off',
};

/** Bell with the open-alert count and a menu of the newest open alerts. */
@Component({
  selector: 'app-notifications-button',
  imports: [
    DateTimePipe, MatBadgeModule, MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule,
    MatProgressSpinnerModule, MatTooltipModule, RelativeTimePipe, RouterLink, TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notifications-button.html',
  // the menu panel lives in the overlay container – its styles are in theme/_overlays.scss
  styles: ':host { display: inline-flex; }',
})
export class NotificationsButton {
  protected readonly store = inject(OpenAlertsStore);
  protected readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly notifier = inject(Notifier);

  protected readonly icons = ALERT_ICONS;
  protected readonly label = computed(() => this.i18n.t('nav.notifications.button', { count: this.store.count() }));
  protected readonly badge = computed(() => (this.store.count() > 99 ? '99+' : String(this.store.count())));

  protected link(alert: AlertDto): string[] {
    return alert.routeId !== null ? ['/routes', String(alert.routeId)] : ['/alerts'];
  }

  protected ackAll(): void {
    this.store.ackAll().subscribe(result =>
      this.notifier.info(this.i18n.t('nav.notifications.ackAllDone', { count: result.acknowledged })));
  }
}
