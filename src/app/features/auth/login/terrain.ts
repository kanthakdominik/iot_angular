import { DoseScale } from '../../../core/units/dose-scale';

/** Size of the drawing (viewBox); the SVG is scaled with `slice`, so any panel shape is covered. */
export const TERRAIN_WIDTH = 800;
export const TERRAIN_HEIGHT = 1000;

export interface ContourLevel {
  readonly d: string;
  /** Every fifth line is an index contour (drawn heavier, as on topographic maps). */
  readonly index: boolean;
}

export interface TrackSegment {
  readonly d: string;
  readonly color: string;
}

export interface Terrain {
  readonly contours: readonly ContourLevel[];
  readonly track: readonly TrackSegment[];
  readonly trackOutline: string;
}

const CELL = 10;
const W = TERRAIN_WIDTH;
const H = TERRAIN_HEIGHT;

const gauss = (x: number, y: number, cx: number, cy: number, rx: number, ry = rx) =>
  Math.exp(-((x - cx) ** 2 / (2 * rx * rx) + (y - cy) ** 2 / (2 * ry * ry)));

/** Height field: a main ridge, two lower hills and some undulation. */
function height(x: number, y: number): number {
  return gauss(x, y, 0.64 * W, 0.34 * H, 0.3 * W, 0.2 * H)
    + 0.5 * gauss(x, y, 0.2 * W, 0.8 * H, 0.19 * W)
    + 0.25 * gauss(x, y, 0.86 * W, 0.72 * H, 0.1 * W)
    + 0.08 * Math.sin(x / W * 3.4 + 0.6) * Math.cos(y / H * 2.6 + 0.3)
    + 0.035 * Math.sin(x / W * 11 + y / H * 7);
}

/** Contour lines by marching squares (segments interpolated on cell edges; one path per level). */
function contours(): ContourLevel[] {
  const cols = W / CELL + 1;
  const rows = H / CELL + 1;
  const field: number[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      field.push(height(i * CELL, j * CELL));
    }
  }
  const at = (i: number, j: number) => field[j * cols + i];
  const levels: ContourLevel[] = [];
  let n = 0;
  for (let level = 0.06; level < 1; level += 0.055, n++) {
    const parts: string[] = [];
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const corners = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
        const x = i * CELL;
        const y = j * CELL;
        // crossing points on the four edges (top, right, bottom, left)
        const points: [number, number][] = [];
        const edge = (a: number, b: number, ax: number, ay: number, bx: number, by: number) => {
          if ((a < level) !== (b < level)) {
            const t = (level - a) / (b - a);
            points.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
          }
        };
        edge(corners[0], corners[1], x, y, x + CELL, y);
        edge(corners[1], corners[2], x + CELL, y, x + CELL, y + CELL);
        edge(corners[2], corners[3], x + CELL, y + CELL, x, y + CELL);
        edge(corners[3], corners[0], x, y + CELL, x, y);
        for (let k = 0; k + 1 < points.length; k += 2) {
          const [a, b] = [points[k], points[k + 1]];
          parts.push(`M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`);
        }
      }
    }
    levels.push({ d: parts.join(''), index: n % 5 === 4 });
  }
  return levels;
}

/** A measurement track climbing the main hill; the dose follows the height (illustrative, not data). */
function track(): Pick<Terrain, 'track' | 'trackOutline'> {
  const points: [number, number][] = [];
  const steps = 56;
  const p0 = [0.08 * W, 0.97 * H];
  const p1 = [0.3 * W, 0.62 * H];
  const p2 = [0.42 * W, 0.66 * H];
  const p3 = [0.63 * W, 0.36 * H];
  for (let s = 0; s <= steps; s++) {
    // cubic Bézier from the lower left towards the summit
    const t = s / steps;
    const u = 1 - t;
    points.push([
      u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
      u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1],
    ]);
  }
  const segments: TrackSegment[] = [];
  for (let k = 1; k < points.length; k++) {
    const [a, b] = [points[k - 1], points[k]];
    const usv = 0.03 + 0.22 * height((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    segments.push({
      d: `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`,
      color: DoseScale.color(usv),
    });
  }
  const outline = points.map((p, k) => `${k ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
  return { track: segments, trackOutline: outline };
}

let cached: Terrain | undefined;

/** The decorative terrain of the login page (computed once). */
export function terrain(): Terrain {
  cached ??= { contours: contours(), ...track() };
  return cached;
}
