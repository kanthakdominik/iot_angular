import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Preferences } from '../api/users.models';
import { AuthService } from '../auth/auth.service';
import { normalizePreferences, readStoredPreferences, writeStoredPreferences } from './preferences';

/**
 * Effective UI preferences: the server copy when logged in, otherwise the copy stored in this browser.
 * The effective value is always mirrored to localStorage so the next start renders with it immediately.
 */
@Injectable({ providedIn: 'root' })
export class PrefsService {
  private readonly auth = inject(AuthService);
  private readonly local = signal<Preferences>(readStoredPreferences());

  readonly prefs = computed<Preferences>(() => this.auth.preferences() ?? this.local());

  constructor() {
    effect(() => writeStoredPreferences(this.prefs()));
  }

  /**
   * Applies the change immediately (optimistic) and, when logged in, saves the full object on the server.
   * Rejects – after reverting – when saving fails; the global interceptor has already shown the error.
   */
  async update(patch: Partial<Preferences>): Promise<void> {
    const previous = this.prefs();
    const next = normalizePreferences({ ...previous, ...patch });
    this.local.set(next);
    if (!this.auth.isLoggedIn()) {
      return;
    }
    this.auth.setPreferences(next);
    try {
      await firstValueFrom(this.auth.savePreferences(next));
    } catch (error) {
      this.auth.setPreferences(previous);
      this.local.set(previous);
      throw error;
    }
  }
}
