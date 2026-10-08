/** One sample of a route. Samples without a GNSS fix have gpsFix = false and no position. */
export interface Measurement {
  id: number;
  seq: number;
  timestamp: string;
  timeSource: 'gnss' | 'net' | 'srv';
  gpsFix: boolean;
  latitude: number | null;
  longitude: number | null;
  satellites: number | null;
  hdop: number | null;
  speed: number | null;
  cps: number;
  cpm: number;
  usvPerHour: number;
  mode: 'SLOW' | 'FAST' | 'INST';
}

/** A measurement that has a position (can be drawn on the map). */
export type PositionedMeasurement = Measurement & { latitude: number; longitude: number };

export function hasPosition(m: Measurement): m is PositionedMeasurement {
  return m.gpsFix && m.latitude !== null && m.longitude !== null;
}
