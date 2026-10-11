import { IsoInstant, DateParam } from './http';
import { PageQuery } from './page.models';

/** Preview track point: [latitude, longitude, µSv/h]. */
export type TrackPoint = readonly [number, number, number];

export interface RoutePreview {
  /** Max. 150 points with a GNSS fix. */
  readonly track: TrackPoint[];
  /** Up to 60 values: max µSv/h per time bucket. */
  readonly spark: number[];
}

export interface RouteDto {
  readonly id: number;
  readonly deviceId: string;
  readonly deviceName: string | null;
  readonly deviceRouteNo: number | null;
  readonly name: string;
  readonly description: string | null;
  /** Null for a route without samples. */
  readonly startedAt: IsoInstant | null;
  readonly endedAt: IsoInstant | null;
  readonly sampleCount: number;
  readonly fixCount: number;
  /** Statistics are null until RouteStatsJob computes them (or when there is no data). */
  readonly distanceM: number | null;
  readonly minUsv: number | null;
  readonly avgUsv: number | null;
  readonly maxUsv: number | null;
  /** Accumulated dose in µSv. */
  readonly doseUsv: number | null;
  /** Device online, recording this route and last sample < 5 min ago. */
  readonly active: boolean;
  /** Not sent on the SSE `route` event. */
  readonly preview: RoutePreview | null;
  /** Only for ADMIN, otherwise null. */
  readonly shareToken: string | null;
}

export type RouteSort = 'startedAt' | 'distance' | 'maxUsv' | 'samples' | 'name';
export type SortDir = 'asc' | 'desc';

export interface RouteQuery extends PageQuery {
  /** Case-insensitive match on name, description, id and device name. */
  readonly q?: string;
  readonly deviceId?: string;
  /** Filter on `startedAt`. */
  readonly from?: DateParam;
  readonly to?: DateParam;
  /** Default `startedAt`; nulls always last. */
  readonly sort?: RouteSort;
  /** Default `desc`. */
  readonly dir?: SortDir;
}

/** PATCH body: omitted = unchanged, empty description removes it. */
export interface RouteUpdate {
  readonly name?: string;
  readonly description?: string;
}

export type TimeSource = 'gnss' | 'net' | 'srv';
export type MeasurementMode = 'SLOW' | 'FAST' | 'INST';

export interface MeasurementDto {
  readonly id: number;
  readonly seq: number;
  readonly timestamp: IsoInstant;
  readonly timeSource: TimeSource;
  readonly gpsFix: boolean;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly satellites: number | null;
  readonly hdop: number | null;
  readonly speed: number | null;
  readonly cps: number;
  readonly cpm: number;
  readonly usvPerHour: number;
  readonly mode: MeasurementMode;
}

/** A measurement with a position (can be drawn on a map). */
export type PositionedMeasurement = MeasurementDto & { readonly latitude: number; readonly longitude: number };

export function hasPosition(m: MeasurementDto): m is PositionedMeasurement {
  return m.gpsFix && m.latitude !== null && m.longitude !== null;
}

export interface MarkerDto {
  readonly id: number;
  readonly timestamp: IsoInstant;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly label: string;
  readonly source: 'user' | 'device';
}

export interface MarkerCreate {
  /** 1–200 characters. */
  readonly label: string;
  readonly timestamp?: IsoInstant;
  readonly latitude?: number;
  readonly longitude?: number;
}

export interface ShareTokenDto {
  readonly token: string;
}

/** SSE `measurement` payload. Samples imported from the SD card are not streamed. */
export interface MeasurementEvent {
  readonly routeId: number;
  readonly deviceId: string;
  readonly measurement: MeasurementDto;
}
