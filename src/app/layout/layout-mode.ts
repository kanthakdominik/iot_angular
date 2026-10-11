import { BreakpointObserver } from '@angular/cdk/layout';
import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/** rail: ≥ 1024 px (icons + labels); rail-collapsed: 600–1023 px (icons); bottom: < 600 px (bottom bar). */
export type NavMode = 'rail' | 'rail-collapsed' | 'bottom';

const WIDE = '(min-width: 1024px)';
const MEDIUM = '(min-width: 600px)';

/** Responsive navigation mode of the shell (also useful for features, e.g. phone layouts). */
@Injectable({ providedIn: 'root' })
export class LayoutMode {
  private readonly breakpoints = inject(BreakpointObserver);

  readonly navMode = toSignal(
    this.breakpoints.observe([WIDE, MEDIUM]).pipe(map(state => this.mode(state.breakpoints[WIDE], state.breakpoints[MEDIUM]))),
    { initialValue: this.mode(this.breakpoints.isMatched(WIDE), this.breakpoints.isMatched(MEDIUM)) },
  );
  /** Phone layout (< 600 px). */
  readonly isHandset = computed(() => this.navMode() === 'bottom');

  private mode(wide: boolean, medium: boolean): NavMode {
    return wide ? 'rail' : medium ? 'rail-collapsed' : 'bottom';
  }
}
