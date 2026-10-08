/** Measurement route (docs/PROTOCOL.md, section 3). Dates are ISO-8601 strings in UTC. */
export interface Route {
  id: number;
  deviceId: string;
  deviceRouteNo: number;
  name: string;
  description: string | null;
  startedAt: string | null;
  endedAt: string | null;
  sampleCount: number;
}

/** PATCH body - omitted fields stay unchanged, empty description removes it. */
export interface RouteUpdate {
  name?: string;
  description?: string;
}
