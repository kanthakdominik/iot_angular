export interface Device {
  id: string;
  name: string;
  online: boolean;
  lastSeenAt: string | null;
  fwVersion: string | null;
  currentRouteNo: number | null;
  lastReset: string | null;
  batteryMv: number | null;
  batteryPct: number | null;
  batteryAt: string | null;
}

export type DeviceCommand = 'new-route' | 'battery';
