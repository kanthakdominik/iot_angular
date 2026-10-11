import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Loading placeholder with a shimmer (static with reduced motion). Decorative – mark the loading region with
 * `aria-busy="true"` and keep a text alternative (e.g. a visually hidden "Loading…") in the page.
 *
 * ```html
 * <app-skeleton height="180px" />                <!-- block -->
 * <app-skeleton shape="text" [lines]="3" />      <!-- paragraph -->
 * <app-skeleton shape="circle" width="40px" />
 * ```
 */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[attr.data-shape]': 'shape()',
    '[style.width]': 'width()',
  },
  template: `
    @for (line of lineList(); track line) {
      <span class="block" [style.height]="shape() === 'text' ? null : height()"
            [style.width]="shape() === 'text' && line === lineList().length - 1 && line > 0 ? '60%' : null"></span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .block {
      display: block;
      width: 100%;
      border-radius: 4px;
      background: linear-gradient(90deg, var(--mat-sys-surface-container-high) 0%,
        var(--mat-sys-surface-container-highest) 50%, var(--mat-sys-surface-container-high) 100%) 0 0 / 200% 100%;
      animation: shimmer 1.4s linear infinite;
    }

    :host([data-shape='text']) .block {
      height: 14px;
    }

    :host([data-shape='circle']) .block {
      aspect-ratio: 1;
      height: auto !important;
      border-radius: 50%;
    }

    :host([data-shape='rect']) .block {
      border-radius: var(--app-radius-card);
    }

    @keyframes shimmer {
      from { background-position: 100% 0; }
      to { background-position: -100% 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .block {
        animation: none;
      }
    }
  `,
})
export class Skeleton {
  readonly shape = input<'rect' | 'text' | 'circle'>('rect');
  /** CSS width of the element (default: full width). */
  readonly width = input<string | null>(null);
  /** CSS height of a block (rect). */
  readonly height = input('16px');
  /** Number of lines for `shape="text"`. */
  readonly lines = input(1);

  protected readonly lineList = computed(() =>
    Array.from({ length: this.shape() === 'text' ? Math.max(1, this.lines()) : 1 }, (_, i) => i));
}
