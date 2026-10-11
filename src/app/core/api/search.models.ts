import { IsoInstant } from './http';

export interface RouteHit {
  readonly id: number;
  readonly name: string;
  readonly deviceId: string;
  readonly startedAt: IsoInstant | null;
}

export interface DeviceHit {
  readonly id: string;
  readonly name: string;
}

export interface MarkerHit {
  readonly id: number;
  readonly routeId: number;
  readonly label: string;
  readonly ts: IsoInstant;
}

/** Up to 8 routes, 5 devices and 5 markers. */
export interface SearchResult {
  readonly routes: RouteHit[];
  readonly devices: DeviceHit[];
  readonly markers: MarkerHit[];
}

export const EMPTY_SEARCH: SearchResult = { routes: [], devices: [], markers: [] };
