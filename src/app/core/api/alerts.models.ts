import { IsoInstant } from './http';
import { PageQuery } from './page.models';

export const ALERT_TYPES = ['DOSE_RATE_ABOVE', 'BATTERY_BELOW', 'DEVICE_OFFLINE'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export interface AlertDto {
  readonly id: number;
  readonly ruleId: number | null;
  readonly ruleName: string;
  readonly type: AlertType;
  readonly deviceId: string | null;
  readonly deviceName: string | null;
  readonly routeId: number | null;
  readonly ts: IsoInstant;
  /** µSv/h or % depending on `type`. */
  readonly value: number | null;
  readonly threshold: number | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly message: string;
  /** Null = open. */
  readonly acknowledgedAt: IsoInstant | null;
  readonly acknowledgedBy: string | null;
}

/** Newest first; `state` defaults to `all`. */
export interface AlertQuery extends PageQuery {
  readonly state?: 'open' | 'all';
}

export interface AlertCount {
  readonly open: number;
}

export interface AckAllResult {
  readonly acknowledged: number;
}

export interface AlertRuleDto {
  readonly id: number;
  readonly name: string;
  readonly type: AlertType;
  /** µSv/h (DOSE_RATE_ABOVE) or % (BATTERY_BELOW); null for DEVICE_OFFLINE. */
  readonly threshold: number | null;
  /** Null = all devices. */
  readonly deviceId: string | null;
  readonly enabled: boolean;
  /** 0–10080. */
  readonly cooldownMinutes: number;
  readonly notifyPush: boolean;
}

/** POST / PUT body: missing booleans default to true, missing cooldown to 15 minutes. */
export interface AlertRuleInput {
  readonly name: string;
  readonly type: AlertType;
  readonly threshold: number | null;
  readonly deviceId: string | null;
  readonly enabled?: boolean;
  readonly cooldownMinutes?: number;
  readonly notifyPush?: boolean;
}
