import { IsoInstant } from './http';
import { PageQuery } from './page.models';

export const EVENT_TYPES = [
  'DEVICE_ONLINE', 'DEVICE_OFFLINE', 'ROUTE_STARTED', 'BATTERY', 'DEVICE_ERROR', 'MARKER', 'COMMAND_SENT', 'ALERT',
  'IMPORT',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type Severity = 'INFO' | 'WARN' | 'ERROR';

export interface EventDto {
  readonly id: number;
  /** Null for system events. */
  readonly deviceId: string | null;
  readonly deviceName: string | null;
  readonly routeId: number | null;
  readonly ts: IsoInstant;
  readonly type: EventType;
  readonly severity: Severity;
  readonly message: string;
}

/** Newest first. */
export interface EventQuery extends PageQuery {
  readonly deviceId?: string;
  readonly type?: EventType;
  readonly routeId?: number;
}
