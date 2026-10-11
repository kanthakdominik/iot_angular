import { DateParam, IsoInstant } from './http';
import { RouteDto } from './routes.models';

export interface MaxUsv {
  readonly value: number;
  readonly routeId: number;
  readonly routeName: string;
  readonly ts: IsoInstant;
}

export interface StatsSummary {
  readonly routeCount: number;
  readonly deviceCount: number;
  readonly devicesOnline: number;
  readonly sampleCount: number;
  readonly distanceM: number;
  /** µSv. */
  readonly doseUsv: number;
  readonly maxUsv: MaxUsv | null;
  readonly openAlerts: number;
  readonly lastRoute: RouteDto | null;
}

/** One day with data; `date` is a local date (Europe/Warsaw), "2026-10-01". */
export interface ActivityDay {
  readonly date: string;
  readonly samples: number;
  readonly routes: number;
  readonly maxUsv: number;
}

/** Default: last 365 days. */
export interface ActivityQuery {
  readonly from?: DateParam;
  readonly to?: DateParam;
}
