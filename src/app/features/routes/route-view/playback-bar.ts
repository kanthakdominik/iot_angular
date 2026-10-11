import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, model, signal, untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MeasurementDto } from '../../../core/api/routes.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { DateTimePipe } from '../../../core/units/date-time.pipe';
import { formatElapsed } from '../../../shared/chart/time-axis';
import { indexAtTime } from './route-stats';

export const PLAYBACK_SPEEDS = [1, 10, 60] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

/** Pauses longer than this (in real time at the chosen speed) are skipped. */
const MAX_WAIT_MS = 2000;

/**
 * Replays the route: play / pause, speed 1× / 10× / 60× (real time) and a scrubber. `position` (two-way) is the
 * sample index shown on the map and chart.
 */
@Component({
  selector: 'app-playback-bar',
  imports: [DateTimePipe, MatButtonModule, MatButtonToggleModule, MatIconModule, MatSliderModule, MatTooltipModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    '[attr.aria-label]': 'groupLabel()',
  },
  template: `
    <button matIconButton type="button" (click)="toggle()" [disabled]="count() < 2"
            [attr.aria-label]="(playing() ? 'routes.playback.pause' : 'routes.playback.play') | t"
            [matTooltip]="(playing() ? 'routes.playback.pause' : 'routes.playback.play') | t">
      <mat-icon aria-hidden="true" class="app-icon-filled">{{ playing() ? 'pause' : 'play_arrow' }}</mat-icon>
    </button>
    <mat-slider class="slider" [min]="0" [max]="Math.max(count() - 1, 1)" [step]="1" [disabled]="count() < 2">
      <input matSliderThumb [value]="position() ?? 0" (valueChange)="seek($event)"
             [attr.aria-label]="'routes.playback.position' | t" [attr.aria-valuetext]="positionText()" />
    </mat-slider>
    <span class="time app-num" aria-hidden="true">
      @if (current(); as m) {
        <span>{{ m.timestamp | dateTime: 'timeSeconds' }}</span>
        <span class="elapsed">{{ elapsed() }}</span>
      }
    </span>
    <mat-button-toggle-group class="speed" [value]="speed()" (change)="speed.set($event.value)" hideSingleSelectionIndicator
                             [attr.aria-label]="'routes.playback.speed' | t">
      @for (option of speeds; track option) {
        <mat-button-toggle [value]="option">{{ option }}×</mat-button-toggle>
      }
    </mat-button-toggle-group>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--app-space-2);
      min-height: 56px;
      padding: var(--app-space-1) var(--app-space-3) var(--app-space-1) var(--app-space-1);
      background: var(--mat-sys-surface-container-low);
      border-top: 1px solid var(--mat-sys-outline-variant);
    }

    .slider {
      flex: 1;
      min-width: 80px;
    }

    .time {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      min-width: 64px;
      font-size: 12px;
      line-height: 16px;
    }

    .elapsed {
      color: var(--mat-sys-on-surface-variant);
    }

    .speed {
      --mat-button-toggle-height: 32px;
      flex: none;
      font-size: 12px;
    }

    @media (max-width: 599.98px) {
      .time {
        display: none;
      }
    }
  `,
})
export class PlaybackBar {
  private readonly i18n = inject(I18nService);
  protected readonly Math = Math;
  protected readonly speeds = PLAYBACK_SPEEDS;

  readonly measurements = input<readonly MeasurementDto[]>([]);
  /** Current sample index (null = not started). */
  readonly position = model<number | null>(null);

  protected readonly groupLabel = computed(() => this.i18n.t('routes.playback.label'));
  protected readonly playing = signal(false);
  protected readonly speed = signal<PlaybackSpeed>(10);
  protected readonly count = computed(() => this.measurements().length);
  private readonly times = computed(() => this.measurements().map(m => Date.parse(m.timestamp)));
  protected readonly current = computed(() => {
    const index = this.position();
    return index === null ? null : this.measurements()[index] ?? null;
  });
  protected readonly elapsed = computed(() => {
    const index = this.position();
    const times = this.times();
    return index === null || !times.length ? '' : formatElapsed(times[index] - times[0]);
  });
  protected readonly positionText = computed(() => {
    const index = this.position() ?? 0;
    return this.i18n.t('routes.detail.sampleIndex', { n: index + 1, total: this.count() });
  });

  private frame = 0;
  private lastFrameAt = 0;
  /** Virtual playback clock (epoch ms of the route). */
  private clock = 0;
  /** Index set by the last frame – a different position means the user moved it meanwhile. */
  private lastIndex: number | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frame));
    // stop when the samples are replaced by fewer ones (e.g. a deleted sample at the end)
    effect(() => {
      const count = this.count();
      untracked(() => {
        const position = this.position();
        if (position !== null && position >= count) {
          this.position.set(count ? count - 1 : null);
        }
      });
    });
  }

  protected toggle(): void {
    if (this.playing()) {
      this.pause();
      return;
    }
    const times = this.times();
    let index = this.position() ?? 0;
    if (index >= times.length - 1) {
      index = 0;
    }
    this.position.set(index);
    this.lastIndex = index;
    this.clock = times[index];
    this.playing.set(true);
    this.lastFrameAt = performance.now();
    this.frame = requestAnimationFrame(now => this.tick(now));
  }

  protected seek(index: number): void {
    this.position.set(index);
    this.clock = this.times()[index] ?? 0;
  }

  private pause(): void {
    cancelAnimationFrame(this.frame);
    this.playing.set(false);
  }

  private tick(now: number): void {
    const times = this.times();
    const speed = this.speed();
    const external = this.position();
    if (external !== null && external !== this.lastIndex) {
      this.clock = times[external] ?? this.clock;
    }
    const dt = Math.min(250, now - this.lastFrameAt);
    this.lastFrameAt = now;
    this.clock += dt * speed;
    let index = Math.max(0, indexAtTime(times, this.clock));
    const next = times[index + 1];
    if (next !== undefined && (next - this.clock) / speed > MAX_WAIT_MS) {
      this.clock = next;
      index++;
    }
    this.lastIndex = index;
    if (index !== this.position()) {
      this.position.set(index);
    }
    if (index >= times.length - 1) {
      this.pause();
      return;
    }
    this.frame = requestAnimationFrame(t => this.tick(t));
  }
}
