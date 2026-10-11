import { DOCUMENT, Injectable, inject, signal } from '@angular/core';

/** A clock signal ticking every 30 s (and when the tab becomes visible) – drives relative times and durations. */
@Injectable({ providedIn: 'root' })
export class NowService {
  private readonly current = signal(Date.now());
  readonly now = this.current.asReadonly();

  constructor() {
    const document = inject(DOCUMENT);
    setInterval(() => this.tick(), 30_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.tick();
      }
    });
  }

  private tick(): void {
    this.current.set(Date.now());
  }
}
