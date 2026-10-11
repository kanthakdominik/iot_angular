import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TrackPoint } from '../../core/api/routes.models';
import { DoseScale } from '../../core/units/dose-scale';

interface Segment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly color: string;
}

/**
 * Small SVG preview of a track (`route.preview.track`, `[lat, lon, µSv/h]`) coloured by dose.
 * Equirectangular projection with cos(latitude) correction, fitted into the box with the aspect ratio kept.
 *
 * ```html
 * <app-track-thumbnail [track]="route.preview?.track ?? null" [ariaLabel]="route.name" />
 * ```
 */
@Component({
  selector: 'app-track-thumbnail',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.aspect-ratio]': 'width() + " / " + height()',
  },
  template: `
    @if (shape(); as s) {
      <svg [attr.viewBox]="'0 0 ' + width() + ' ' + height()" [attr.role]="ariaLabel() ? 'img' : null"
           [attr.aria-label]="ariaLabel() || null" [attr.aria-hidden]="ariaLabel() ? null : 'true'">
        @for (segment of s.segments; track $index) {
          <line [attr.x1]="segment.x1" [attr.y1]="segment.y1" [attr.x2]="segment.x2" [attr.y2]="segment.y2"
                [attr.stroke]="segment.color" />
        }
        <circle class="start" [attr.cx]="s.start[0]" [attr.cy]="s.start[1]" r="3" />
        <circle class="end" [attr.cx]="s.end[0]" [attr.cy]="s.end[1]" r="3.5" [attr.fill]="s.endColor" />
      </svg>
    } @else {
      <mat-icon class="empty" aria-hidden="true">location_off</mat-icon>
    }
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
      width: 100%;
      border-radius: var(--app-radius-chip);
      background: var(--mat-sys-surface-container);
      overflow: hidden;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
    }

    line {
      stroke-width: 2.5;
      stroke-linecap: round;
    }

    .start {
      fill: var(--mat-sys-surface-container);
      stroke: var(--mat-sys-on-surface-variant);
      stroke-width: 1.5;
    }

    .end {
      stroke: var(--mat-sys-surface-container);
      stroke-width: 1.5;
    }

    .empty {
      color: var(--mat-sys-outline);
    }
  `,
})
export class TrackThumbnail {
  readonly track = input<readonly TrackPoint[] | null | undefined>(null);
  /** Size of the drawing in viewBox units; also the aspect ratio of the element (width follows the container). */
  readonly width = input(160);
  readonly height = input(100);
  /** Accessible description; without it the thumbnail is decorative. */
  readonly ariaLabel = input('');

  protected readonly shape = computed(() => {
    const track = this.track() ?? [];
    if (track.length < 2) {
      return null;
    }
    const width = this.width();
    const height = this.height();
    const pad = 8;
    const meanLat = track.reduce((sum, p) => sum + p[0], 0) / track.length;
    const kx = Math.cos((meanLat * Math.PI) / 180);
    const xs = track.map(p => p[1] * kx);
    const ys = track.map(p => -p[0]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const spanX = Math.max(...xs) - minX;
    const spanY = Math.max(...ys) - minY;
    const scale = Math.min(
      spanX > 0 ? (width - 2 * pad) / spanX : Infinity,
      spanY > 0 ? (height - 2 * pad) / spanY : Infinity,
    );
    const k = Number.isFinite(scale) ? scale : 0;
    const offsetX = (width - spanX * k) / 2;
    const offsetY = (height - spanY * k) / 2;
    const points = xs.map((x, i) => [
      Math.round(((x - minX) * k + offsetX) * 10) / 10,
      Math.round(((ys[i] - minY) * k + offsetY) * 10) / 10,
    ] as const);

    const segments: Segment[] = [];
    for (let i = 1; i < points.length; i++) {
      segments.push({
        x1: points[i - 1][0], y1: points[i - 1][1], x2: points[i][0], y2: points[i][1],
        color: DoseScale.color((track[i - 1][2] + track[i][2]) / 2),
      });
    }
    return {
      segments,
      start: points[0],
      end: points[points.length - 1],
      endColor: DoseScale.color(track[track.length - 1][2]),
    };
  });
}
