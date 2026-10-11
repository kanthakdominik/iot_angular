import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Heading row of a page or section: title, subtitle, projected meta (`[headerMeta]`) and actions (`[headerActions]`).
 * The top app bar already shows the page title as the `<h1>`, so the default level here is 2.
 *
 * ```html
 * <app-page-header [title]="route.name" [subtitle]="route.deviceName ?? ''">
 *   <button headerActions matIconButton [matMenuTriggerFor]="menu" [attr.aria-label]="'common.actions.more' | t">
 *     <mat-icon>more_vert</mat-icon>
 *   </button>
 * </app-page-header>
 * ```
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="titles">
      @switch (level()) {
        @case (1) { <h1>{{ title() }}</h1> }
        @case (3) { <h3>{{ title() }}</h3> }
        @default { <h2>{{ title() }}</h2> }
      }
      @if (subtitle()) {
        <p class="subtitle">{{ subtitle() }}</p>
      }
      <ng-content select="[headerMeta]" />
    </div>
    <div class="actions">
      <ng-content select="[headerActions]" />
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--app-space-2) var(--app-space-4);
    }

    .titles {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    h1, h2, h3 {
      overflow-wrap: anywhere;
    }

    .subtitle {
      max-width: 72ch;
      color: var(--mat-sys-on-surface-variant);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--app-space-2);
    }

    .actions:empty {
      display: none;
    }
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  /** Heading level (the shell's top bar holds the page `<h1>`). */
  readonly level = input<1 | 2 | 3>(2);
}
