import { MeasurementDto, PositionedMeasurement, RouteDto, hasPosition } from '../../../core/api/routes.models';

/** Route statistics as shown in the stat tiles (same definitions as the backend RouteStatsJob, V2.1-SPEC §2.1). */
export interface RouteStats {
  readonly samples: number;
  readonly fixCount: number;
  /** 0–100, null without samples. */
  readonly gpsPct: number | null;
  readonly minUsv: number | null;
  readonly avgUsv: number | null;
  readonly maxUsv: number | null;
  /** Accumulated dose in µSv. */
  readonly doseUsv: number | null;
  readonly distanceM: number | null;
  /** Epoch ms of the first / last sample. */
  readonly startedAt: number | null;
  readonly endedAt: number | null;
}

const EARTH_RADIUS_M = 6_371_000;
/** Pauses longer than this are not integrated into the dose. */
const DOSE_GAP_MS = 60_000;
/** Segments faster than this are GPS jumps and do not count towards the distance. */
const MAX_SPEED_MS = 100;

/** Great-circle distance in metres. */
export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Statistics computed from the samples (used for live routes and after local changes). */
export function computeRouteStats(measurements: readonly MeasurementDto[]): RouteStats {
  const samples = measurements.length;
  if (!samples) {
    return {
      samples: 0, fixCount: 0, gpsPct: null, minUsv: null, avgUsv: null, maxUsv: null, doseUsv: null, distanceM: null,
      startedAt: null, endedAt: null,
    };
  }
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let dose = 0;
  let distance = 0;
  let fixCount = 0;
  let previousTime: number | null = null;
  let previousFix: PositionedMeasurement | null = null;
  for (const m of measurements) {
    const usv = m.usvPerHour;
    min = Math.min(min, usv);
    max = Math.max(max, usv);
    sum += usv;
    const time = Date.parse(m.timestamp);
    if (previousTime !== null) {
      dose += (usv * Math.min(Math.max(0, time - previousTime), DOSE_GAP_MS)) / 3_600_000;
    }
    previousTime = time;
    if (hasPosition(m)) {
      fixCount++;
      if (previousFix) {
        const d = haversineM(previousFix.latitude, previousFix.longitude, m.latitude, m.longitude);
        const dt = (time - Date.parse(previousFix.timestamp)) / 1000;
        if (dt <= 0 ? d === 0 : d / dt <= MAX_SPEED_MS) {
          distance += d;
        }
      }
      previousFix = m;
    }
  }
  return {
    samples,
    fixCount,
    gpsPct: (fixCount / samples) * 100,
    minUsv: min,
    avgUsv: sum / samples,
    maxUsv: max,
    doseUsv: dose,
    distanceM: fixCount >= 2 ? distance : null,
    startedAt: Date.parse(measurements[0].timestamp),
    endedAt: Date.parse(measurements[samples - 1].timestamp),
  };
}

/** Statistics as delivered by the backend (before the samples are loaded). */
export function statsFromDto(route: RouteDto): RouteStats {
  return {
    samples: route.sampleCount,
    fixCount: route.fixCount,
    gpsPct: route.sampleCount ? (route.fixCount / route.sampleCount) * 100 : null,
    minUsv: route.minUsv,
    avgUsv: route.avgUsv,
    maxUsv: route.maxUsv,
    doseUsv: route.doseUsv,
    distanceM: route.distanceM,
    startedAt: route.startedAt ? Date.parse(route.startedAt) : null,
    endedAt: route.endedAt ? Date.parse(route.endedAt) : null,
  };
}

export interface Hotspot {
  /** Index in the full measurements array (= chart / track index). */
  readonly index: number;
  readonly measurement: PositionedMeasurement;
}

/**
 * The `count` highest positioned samples, at least `minSeparationM` apart – neighbouring samples of one hot spot
 * count once.
 */
export function findHotspots(measurements: readonly MeasurementDto[], count = 5, minSeparationM = 30): Hotspot[] {
  const candidates: Hotspot[] = [];
  measurements.forEach((m, index) => {
    if (hasPosition(m)) {
      candidates.push({ index, measurement: m });
    }
  });
  candidates.sort((a, b) => b.measurement.usvPerHour - a.measurement.usvPerHour || a.index - b.index);
  const picked: Hotspot[] = [];
  for (const candidate of candidates) {
    const m = candidate.measurement;
    if (picked.every(p => haversineM(p.measurement.latitude, p.measurement.longitude, m.latitude, m.longitude) >= minSeparationM)) {
      picked.push(candidate);
      if (picked.length === count) {
        break;
      }
    }
  }
  return picked;
}

export interface HistogramBin {
  /** Lower / upper bound in µSv/h; the last bin is open-ended when `overflow`. */
  readonly from: number;
  readonly to: number;
  readonly count: number;
  readonly overflow: boolean;
}

/** Counts of samples per dose-rate bin (0 … max(scale, data) in steps of `step` µSv/h). */
export function doseHistogram(measurements: readonly MeasurementDto[], step = 0.02, scaleMax = 0.3): HistogramBin[] {
  if (!measurements.length) {
    return [];
  }
  const dataMax = measurements.reduce((max, m) => Math.max(max, m.usvPerHour), 0);
  // at most 20 bins: values far above the scale go into one open-ended bin
  const binCount = Math.min(20, Math.max(Math.ceil(scaleMax / step), Math.ceil((dataMax + 1e-9) / step)));
  const counts = new Array<number>(binCount).fill(0);
  for (const m of measurements) {
    counts[Math.min(binCount - 1, Math.max(0, Math.floor(m.usvPerHour / step)))]++;
  }
  // trim empty bins at the top (keep the scale up to the data)
  let last = binCount - 1;
  while (last > 0 && counts[last] === 0 && (last + 1) * step > Math.max(dataMax, 0.1)) {
    last--;
  }
  return counts.slice(0, last + 1).map((count, i) => ({
    from: i * step,
    to: (i + 1) * step,
    count,
    overflow: i === binCount - 1 && dataMax >= binCount * step,
  }));
}

/** Index of the last sample at or before `time` (binary search over ascending timestamps), -1 when none. */
export function indexAtTime(times: readonly number[], time: number): number {
  let lo = 0;
  let hi = times.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= time) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/**
 * How `next` relates to `previous`: 'append' when it only adds samples at the end (live), 'same' when unchanged,
 * otherwise 'replace'.
 */
export function listChange(previous: readonly MeasurementDto[], next: readonly MeasurementDto[]): 'same' | 'append' | 'replace' {
  if (previous === next) {
    return 'same';
  }
  if (!previous.length || next.length <= previous.length) {
    return next.length === previous.length && next.length > 0 && previous.length > 0
      && next[0].id === previous[0].id && next[next.length - 1].id === previous[previous.length - 1].id
      && next.every((m, i) => m.id === previous[i].id) ? 'same' : 'replace';
  }
  return next[0].id === previous[0].id && next[previous.length - 1].id === previous[previous.length - 1].id
    ? 'append' : 'replace';
}
