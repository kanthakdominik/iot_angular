import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, booleanAttribute, computed, inject, input } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { OpenAlertsStore } from '../../core/alerts/open-alerts.store';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { NAV_ITEMS } from './nav-items';

/** Navigation rail (M3): icons with labels (≥ 1024 px) or icons with tooltips (collapsed, 600–1023 px). */
@Component({
  selector: 'app-nav-rail',
  imports: [MatBadgeModule, MatIconModule, MatTooltipModule, NgTemplateOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nav-rail.html',
  styleUrl: './nav-rail.scss',
  host: {
    '[class.collapsed]': 'collapsed()',
  },
})
export class NavRail {
  protected readonly alerts = inject(OpenAlertsStore);

  readonly collapsed = input(false, { transform: booleanAttribute });

  protected readonly mainItems = NAV_ITEMS.filter(item => item.path !== '/settings');
  protected readonly settingsItem = NAV_ITEMS.find(item => item.path === '/settings')!;
  protected readonly badge = computed(() => (this.alerts.count() > 99 ? '99+' : String(this.alerts.count())));
}
