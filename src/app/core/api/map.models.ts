import { DateParam } from './http';

export interface GridQuery {
  readonly south: number;
  readonly west: number;
  readonly north: number;
  readonly east: number;
  /** 3–18; the cell size is 360 / 2^zoom / 16 degrees. */
  readonly zoom: number;
  readonly from?: DateParam;
  readonly to?: DateParam;
  readonly deviceId?: string;
}

export interface GridCell {
  /** South-west corner of the cell. */
  readonly lat: number;
  readonly lon: number;
  readonly avgUsv: number;
  readonly maxUsv: number;
  readonly count: number;
}

/** Max. 10 000 cells (the ones with the most samples). */
export interface Grid {
  readonly cellDeg: number;
  readonly cells: GridCell[];
}
