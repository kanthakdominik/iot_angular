import { DateParam, IsoInstant } from './http';

export interface DeviceDto {
  readonly id: string;
  readonly name: string;
  readonly online: boolean;
  readonly lastSeenAt: IsoInstant | null;
  readonly fwVersion: string | null;
  readonly currentRouteNo: number | null;
  readonly currentRouteId: number | null;
  readonly lastReset: string | null;
  readonly batteryMv: number | null;
  readonly batteryPct: number | null;
  readonly batteryAt: IsoInstant | null;
  /** GSM signal quality 0–31, null = unknown. */
  readonly signalCsq: number | null;
  readonly signalAt: IsoInstant | null;
  readonly routeCount: number;
}

export type DeviceCommand = 'new-route' | 'battery';

export interface HealthPoint {
  readonly ts: IsoInstant;
  readonly batteryMv: number | null;
  readonly batteryPct: number | null;
  readonly signalCsq: number | null;
}

/** Default: last 7 days, max. 5000 points. */
export interface HealthQuery {
  readonly from?: DateParam;
  readonly to?: DateParam;
}

export interface ImportResult {
  readonly files: number;
  readonly lines: number;
  readonly imported: number;
  readonly duplicates: number;
  readonly invalid: number;
  readonly routes: ImportedRoute[];
}

export interface ImportedRoute {
  readonly routeId: number;
  readonly deviceRouteNo: number;
  readonly imported: number;
}
