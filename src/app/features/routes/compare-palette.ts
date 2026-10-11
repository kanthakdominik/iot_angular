/**
 * Categorical colours of compared routes (identity, not dose – the dose scale is never used for them).
 * Hues blue / orange / teal / magenta, deliberately away from the green–yellow–red dose ramp; separate steps for
 * light and dark surfaces. Validated as a set for all pairs (maps): CVD ΔE ≥ 9.9 (deutan / protan), normal-vision
 * ΔE ≥ 18, contrast ≥ 3:1 against the surface in both modes. A route keeps its slot while it stays in the comparison.
 */
const LIGHT = ['#0871c1', '#a05b11', '#109d7b', '#84307f'] as const;
const DARK = ['#3e96ea', '#9a5505', '#049a78', '#a04c9a'] as const;

export const COMPARE_SLOTS = LIGHT.length;

export function compareColor(slot: number, dark: boolean): string {
  const palette = dark ? DARK : LIGHT;
  return palette[slot % palette.length];
}

/** Dash pattern per slot – a second, colour-independent cue in the chart. */
export const COMPARE_DASHES: readonly (readonly number[])[] = [[], [6, 4], [2, 3], [10, 3, 2, 3]];
