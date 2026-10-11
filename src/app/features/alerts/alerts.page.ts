import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AlertState, AlertsList } from './alerts-list';
import { RulesPanel } from './rules-panel';

/** `/alerts`: tabs "Alerts" (open / all, acknowledge) and "Rules" (`?tab=rules`; editing for admins only). */
@Component({
  selector: 'app-alerts-page',
  imports: [AlertsList, MatTabsModule, RulesPanel, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-page">
      <mat-tab-group [selectedIndex]="tabIndex()" (selectedIndexChange)="selectTab($event)" animationDuration="0ms"
                     mat-stretch-tabs="false" mat-align-tabs="start" [attr.aria-label]="'alerts.title' | t">
        <mat-tab [label]="'alerts.alertsTab' | t">
          <ng-template matTabContent>
            <app-alerts-list class="panel" [state]="alertState()" [page]="pageIndex()" />
          </ng-template>
        </mat-tab>
        <mat-tab [label]="'alerts.rulesTab' | t">
          <ng-template matTabContent>
            <app-rules-panel class="panel" />
          </ng-template>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: `
    .panel {
      padding-top: var(--app-space-4);
    }
  `,
})
export class AlertsPage {
  private readonly router = inject(Router);

  /** `?tab=rules` */
  readonly tab = input<string>();
  /** `?state=open` (default: all) */
  readonly state = input<string>();
  /** `?page=2` (1-based in the URL) */
  readonly page = input<string>();

  protected readonly tabIndex = computed(() => (this.tab() === 'rules' ? 1 : 0));
  protected readonly alertState = computed<AlertState>(() => (this.state() === 'open' ? 'open' : 'all'));
  protected readonly pageIndex = computed(() => {
    const page = Number(this.page());
    return Number.isInteger(page) && page > 1 ? page - 1 : 0;
  });

  protected selectTab(index: number): void {
    if (index === this.tabIndex()) {
      return;
    }
    void this.router.navigate([], {
      queryParams: { tab: index === 1 ? 'rules' : null, state: null, page: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
