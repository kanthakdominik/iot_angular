import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';
import { ThemePref } from '../api/users.models';
import { PrefsService } from './prefs.service';

const NEXT_THEME: Readonly<Record<ThemePref, ThemePref>> = { system: 'light', light: 'dark', dark: 'system' };

/**
 * Sets `data-theme` (CSS maps it to `color-scheme`) and the `app-dark` class on `<html>`.
 * Called once from main.ts before bootstrap to avoid a flash of the wrong theme.
 */
export function applyTheme(root: HTMLElement, theme: ThemePref, dark: boolean): void {
  root.setAttribute('data-theme', theme);
  root.classList.toggle('app-dark', dark);
}

export function prefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Light / dark / system theme and access to resolved Material colour tokens (for canvas-based charts and maps). */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly prefs = inject(PrefsService);
  private readonly document = inject(DOCUMENT);
  private readonly systemDark = signal(prefersDark());
  private probe?: HTMLElement;

  readonly theme = computed(() => this.prefs.prefs().theme);
  /** Effective dark mode (resolves "system"). */
  readonly isDark = computed(() => this.theme() === 'dark' || (this.theme() === 'system' && this.systemDark()));
  private readonly appliedRevision = signal(0);
  /**
   * Incremented after the theme has been applied to the DOM – depend on it (not on `isDark`) when resolving
   * colours with `resolveColor()`, so the computed styles are already up to date.
   */
  readonly revision = this.appliedRevision.asReadonly();

  constructor() {
    if (typeof matchMedia === 'function') {
      matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', event => this.systemDark.set(event.matches));
    }
    effect(() => {
      applyTheme(this.document.documentElement, this.theme(), this.isDark());
      this.document.querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', this.resolveColor('--mat-sys-surface'));
      this.appliedRevision.update(revision => revision + 1);
    });
  }

  /** system -> light -> dark -> system. */
  cycle(): Promise<void> {
    return this.prefs.update({ theme: NEXT_THEME[this.theme()] });
  }

  /**
   * Resolves a colour custom property (e.g. `--mat-sys-primary`) to `rgb(...)` for the current scheme.
   * `getPropertyValue` would return the unresolved `light-dark(...)` expression, so a probe element is used.
   * Read it inside a `computed` / `effect` that also reads `revision()` to follow theme changes.
   */
  resolveColor(token: string): string {
    if (!this.probe) {
      this.probe = this.document.createElement('span');
      this.probe.setAttribute('aria-hidden', 'true');
      this.probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden';
      this.document.body.appendChild(this.probe);
    }
    this.probe.style.color = `var(${token})`;
    return getComputedStyle(this.probe).color;
  }
}
