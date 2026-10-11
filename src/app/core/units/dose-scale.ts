/** One colour stop of the dose rate scale (µSv/h). */
export interface DoseStop {
  readonly usv: number;
  readonly color: string;
}

/** Stops from the thesis (docs/UI.md §2); below the first / above the last stop the colour is constant. */
const STOPS: readonly DoseStop[] = [
  { usv: 0.02, color: '#005500' },
  { usv: 0.10, color: '#00DD00' },
  { usv: 0.14, color: '#EEEE00' },
  { usv: 0.20, color: '#FF8800' },
  { usv: 0.26, color: '#CC0000' },
  { usv: 0.30, color: '#800000' },
];

type Rgb = readonly [number, number, number];

const STOP_RGB: readonly Rgb[] = STOPS.map(stop => [
  parseInt(stop.color.slice(1, 3), 16),
  parseInt(stop.color.slice(3, 5), 16),
  parseInt(stop.color.slice(5, 7), 16),
]);

const hex = (value: number) => Math.round(value).toString(16).padStart(2, '0');

/** Grey of samples without a GNSS fix (`--app-no-fix`). */
export const NO_FIX_COLOR = '#9AA0A6';

const MAX_USV = 0.3;

function rgb(usv: number): Rgb {
  if (!(usv > STOPS[0].usv)) {
    return STOP_RGB[0];
  }
  for (let i = 1; i < STOPS.length; i++) {
    if (usv <= STOPS[i].usv) {
      const t = (usv - STOPS[i - 1].usv) / (STOPS[i].usv - STOPS[i - 1].usv);
      const a = STOP_RGB[i - 1];
      const b = STOP_RGB[i];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
  }
  return STOP_RGB[STOP_RGB.length - 1];
}

function legendStops(max = MAX_USV): { usv: number; color: string; offset: number }[] {
  return [
    { usv: 0, color: STOPS[0].color, offset: 0 },
    ...STOPS.filter(stop => stop.usv <= max).map(stop => ({ ...stop, offset: stop.usv / max })),
  ];
}

/**
 * The single source of dose colours for maps, charts, legends and readouts: a continuous gradient
 * interpolated in sRGB between the stops (the same interpolation CSS gradients use, so legends match the data).
 */
export const DoseScale = {
  stops: STOPS,
  /** Upper end of readout scales and legends (µSv/h); higher values are "above scale". */
  max: MAX_USV,

  rgb,

  /** `#rrggbb` for a dose rate in µSv/h. */
  color(usv: number): string {
    const [r, g, b] = rgb(usv);
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  },

  rgba(usv: number, alpha: number): string {
    const [r, g, b] = rgb(usv);
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
  },

  /** Position 0..1 of a value on a scale 0..max (clamped). */
  position(usv: number, max = MAX_USV): number {
    return Math.min(1, Math.max(0, usv / max));
  },

  /** Stops with their offset (0..1) on a scale 0..max, starting with the colour at 0. */
  legendStops,

  /** CSS gradient of the scale 0..max, e.g. for a legend bar: `DoseScale.gradientCss('to top')`. */
  gradientCss(direction = 'to right', max = MAX_USV): string {
    const stops = legendStops(max)
      .map(stop => `${stop.color} ${(stop.offset * 100).toFixed(2)}%`)
      .join(', ');
    return `linear-gradient(${direction}, ${stops})`;
  },

  /** `size` RGBA entries (4 bytes each) sampling 0..max – a lookup table for canvas colouring. */
  palette(size = 256, max = MAX_USV): Uint8ClampedArray {
    const table = new Uint8ClampedArray(size * 4);
    for (let i = 0; i < size; i++) {
      const [r, g, b] = rgb((i / (size - 1)) * max);
      table.set([r, g, b, 255], i * 4);
    }
    return table;
  },
} as const;
