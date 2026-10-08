/** A labelled point of interest inside a route. */
export interface Marker {
  id: number;
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  label: string;
  source: 'user' | 'device';
}

export interface MarkerCreate {
  label: string;
  timestamp?: string;
  latitude?: number;
  longitude?: number;
}
