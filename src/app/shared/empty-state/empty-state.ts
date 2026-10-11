import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Placeholder for empty lists / missing data / errors: icon, title, text and an optional action.
 * Additional actions can be projected.
 *
 * ```html
 * <app-empty-state icon="route" [title]="'routes.empty' | t" [actionLabel]="'common.actions.refresh' | t"
 *                  (action)="reload()" />
 * ```
 */
@Component({
  selector: 'app-empty-state',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (icon()) {
      <mat-icon class="icon" aria-hidden="true">{{ icon() }}</mat-icon>
    }
    <h2 class="title">{{ title() }}</h2>
    @if (text()) {
      <p class="text">{{ text() }}</p>
    }
    <div class="actions">
      @if (actionLabel()) {
        <button matButton="outlined" type="button" (click)="action.emit()">{{ actionLabel() }}</button>
      }
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--app-space-2);
      padding: var(--app-space-6) var(--app-space-5);
      border: 1px dashed var(--mat-sys-outline-variant);
      border-radius: var(--app-radius-card);
    }

    .icon {
      width: 32px;
      height: 32px;
      font-size: 32px;
      color: var(--mat-sys-outline);
    }

    .title {
      font-size: 16px;
      line-height: 24px;
    }

    .text {
      max-width: 72ch;
      color: var(--mat-sys-on-surface-variant);
    }

    .actions:not(:empty) {
      display: flex;
      flex-wrap: wrap;
      gap: var(--app-space-2);
      margin-top: var(--app-space-2);
    }
  `,
})
export class EmptyState {
  /** Material Symbols name. */
  readonly icon = input('');
  readonly title = input.required<string>();
  readonly text = input('');
  /** Label of the built-in action button; omit for none. */
  readonly actionLabel = input('');
  readonly action = output<void>();
}
