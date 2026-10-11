import { MarkerDto, MeasurementDto, RouteDto, hasPosition } from '../api/routes.models';

export type ExportFormat = 'gpx' | 'geojson' | 'csv';

export interface ExportSource {
  readonly route: Pick<RouteDto, 'id' | 'name' | 'deviceId' | 'description' | 'startedAt'>
    & Partial<Pick<RouteDto, 'deviceName' | 'distanceM' | 'minUsv' | 'avgUsv' | 'maxUsv' | 'doseUsv'>>;
  /** Ascending by time. */
  readonly measurements: readonly MeasurementDto[];
  readonly markers?: readonly MarkerDto[];
}

/** A new GPX track segment starts after a pause longer than this. */
const SEGMENT_GAP_MS = 5 * 60_000;

const MIME: Readonly<Record<ExportFormat, string>> = {
  gpx: 'application/gpx+xml',
  geojson: 'application/geo+json',
  csv: 'text/csv;charset=utf-8',
};

function xml(text: string): string {
  return text.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&apos;' })[ch]!);
}

/** GPX 1.1: one track (segments split at pauses > 5 min), dose rate and CPM as extensions, markers as waypoints. */
export function toGpx({ route, measurements, markers = [] }: ExportSource): string {
  const segments: string[][] = [];
  let current: string[] = [];
  let lastTime = 0;
  for (const m of measurements) {
    if (!hasPosition(m)) {
      continue;
    }
    const time = Date.parse(m.timestamp);
    if (current.length && time - lastTime > SEGMENT_GAP_MS) {
      segments.push(current);
      current = [];
    }
    lastTime = time;
    current.push(
      `      <trkpt lat="${m.latitude}" lon="${m.longitude}"><time>${m.timestamp}</time>`
      + (m.satellites !== null ? `<sat>${m.satellites}</sat>` : '')
      + (m.hdop !== null ? `<hdop>${m.hdop}</hdop>` : '')
      + `<extensions><rad:usvh>${m.usvPerHour}</rad:usvh><rad:cpm>${m.cpm}</rad:cpm></extensions></trkpt>`);
  }
  if (current.length) {
    segments.push(current);
  }
  const waypoints = markers
    .filter(marker => marker.latitude !== null && marker.longitude !== null)
    .map(marker => `  <wpt lat="${marker.latitude}" lon="${marker.longitude}"><time>${marker.timestamp}</time>`
      + `<name>${xml(marker.label)}</name></wpt>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="iot-radiation" xmlns="http://www.topografix.com/GPX/1/1"'
    + ' xmlns:rad="urn:iot-radiation:gpx:1">',
    `  <metadata><name>${xml(route.name)}</name>`
    + (route.description ? `<desc>${xml(route.description)}</desc>` : '')
    + (route.startedAt ? `<time>${route.startedAt}</time>` : '') + '</metadata>',
    ...waypoints,
    `  <trk><name>${xml(route.name)}</name>`,
    ...segments.map(points => `    <trkseg>\n${points.join('\n')}\n    </trkseg>`),
    '  </trk>',
    '</gpx>',
    '',
  ].join('\n');
}

/** GeoJSON FeatureCollection: the track (LineString), every positioned sample (Point) and the markers. */
export function toGeoJson({ route, measurements, markers = [] }: ExportSource): string {
  const positioned = measurements.filter(hasPosition);
  const features: object[] = [{
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: positioned.map(m => [m.longitude, m.latitude]) },
    properties: {
      kind: 'track', id: route.id, name: route.name, deviceId: route.deviceId, deviceName: route.deviceName ?? null,
      startedAt: route.startedAt, distanceM: route.distanceM ?? null, minUsv: route.minUsv ?? null,
      avgUsv: route.avgUsv ?? null, maxUsv: route.maxUsv ?? null, doseUsv: route.doseUsv ?? null,
    },
  }];
  for (const m of positioned) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [m.longitude, m.latitude] },
      properties: {
        kind: 'sample', seq: m.seq, timestamp: m.timestamp, usvPerHour: m.usvPerHour, cpm: m.cpm, cps: m.cps,
        satellites: m.satellites, hdop: m.hdop, speed: m.speed, mode: m.mode,
      },
    });
  }
  for (const marker of markers) {
    if (marker.latitude !== null && marker.longitude !== null) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [marker.longitude, marker.latitude] },
        properties: { kind: 'marker', label: marker.label, timestamp: marker.timestamp, source: marker.source },
      });
    }
  }
  return JSON.stringify({ type: 'FeatureCollection', features });
}

const CSV_COLUMNS: readonly (keyof MeasurementDto)[] = [
  'seq', 'timestamp', 'timeSource', 'gpsFix', 'latitude', 'longitude', 'satellites', 'hdop', 'speed', 'cps', 'cpm',
  'usvPerHour', 'mode',
];

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 CSV of all samples (incl. those without GPS), UTF-8 with BOM so spreadsheets detect the encoding. */
export function toCsv({ measurements }: Pick<ExportSource, 'measurements'>): string {
  const rows = measurements.map(m => CSV_COLUMNS.map(column => csvCell(m[column])).join(','));
  return `﻿${[CSV_COLUMNS.join(','), ...rows].join('\r\n')}\r\n`;
}

/** "route-12-park-skaryszewski.gpx" (ASCII, no diacritics). */
export function exportFileName(route: Pick<RouteDto, 'id' | 'name'>, format: ExportFormat): string {
  const slug = route.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `route-${route.id}${slug ? `-${slug}` : ''}.${format}`;
}

/** Saves `content` as a file through a temporary object URL. */
export function downloadFile(content: BlobPart, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Builds the file in the given format and downloads it. */
export function exportRoute(format: ExportFormat, source: ExportSource): void {
  const content = format === 'gpx' ? toGpx(source) : format === 'geojson' ? toGeoJson(source) : toCsv(source);
  downloadFile(content, exportFileName(source.route, format), MIME[format]);
}
