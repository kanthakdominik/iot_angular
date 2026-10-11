import * as L from 'leaflet';
import { MeasurementDto, hasPosition } from '../../core/api/routes.models';
import { DoseScale } from '../../core/units/dose-scale';

export interface TrackRendererOptions {
  /** Line width in px (default 4). */
  readonly weight?: number;
  /** A dark halo under the line for contrast on any base layer (default true). */
  readonly halo?: boolean;
  /** Pause after which the line is interrupted, in ms (default 5 min). */
  readonly gapMs?: number;
  /** Show the pulsing head marker at the last sample (live routes). */
  readonly live?: boolean;
  /** Leaflet pane (default overlayPane). */
  readonly pane?: string;
}

/** Colours are quantised to this step (µSv/h) so neighbouring segments merge into one polyline. */
const COLOR_STEP = 0.004;

/**
 * Draws a route as dose-coloured polyline segments on a shared canvas renderer, plus a highlight marker for a
 * sample index (map <-> chart sync) and a pulsing head for live routes. Indices always refer to the full
 * `measurements` array (samples without GPS included), i.e. the same index as the chart's data.
 *
 * ```ts
 * const track = new TrackRenderer(map, { live: route.active });
 * track.setMeasurements(measurements);
 * track.fitBounds();
 * track.onHover(index => this.hovered.set(index));   // map -> chart
 * effect(() => track.highlight(this.hovered()));      // chart -> map
 * live.routeMeasurements(id, () => last()?.timestamp ?? null).subscribe(m => track.append(m));
 * ```
 */
export class TrackRenderer {
  private readonly renderer: L.Canvas;
  /** Separate canvas so halos always stay below the coloured lines, also for segments appended live. */
  private readonly haloRenderer: L.Canvas;
  private readonly group = L.layerGroup();
  private readonly settings: { weight: number; halo: boolean; gapMs: number; live: boolean };
  private measurements: MeasurementDto[] = [];
  /** Indices (into `measurements`) of samples with a position. */
  private fixIndices: number[] = [];
  private highlightMarker: L.Marker | null = null;
  private headMarker: L.Marker | null = null;
  private hoverFrame = 0;
  private hovered: number | null = null;
  private detachHover?: () => void;

  constructor(private readonly map: L.Map, options: TrackRendererOptions = {}) {
    // never pass `pane: undefined` – Leaflet would override its default pane with it
    const rendererOptions: L.RendererOptions = options.pane ? { padding: 0.5, pane: options.pane } : { padding: 0.5 };
    this.haloRenderer = L.canvas(rendererOptions);
    this.renderer = L.canvas(rendererOptions);
    this.settings = {
      weight: options.weight ?? 4,
      halo: options.halo ?? true,
      gapMs: options.gapMs ?? 5 * 60_000,
      live: options.live ?? false,
    };
    this.group.addTo(map);
  }

  /** Replaces the drawn track. */
  setMeasurements(measurements: readonly MeasurementDto[]): void {
    this.measurements = [...measurements];
    this.fixIndices = [];
    this.measurements.forEach((m, i) => {
      if (hasPosition(m)) {
        this.fixIndices.push(i);
      }
    });
    this.group.clearLayers();
    this.headMarker = null;
    this.highlightMarker = null;
    this.drawRuns(this.fixIndices);
    this.updateHead(false);
  }

  /** Adds one live sample at the end (keeps everything drawn so far) and pulses the head. */
  append(measurement: MeasurementDto): void {
    this.measurements.push(measurement);
    if (!hasPosition(measurement)) {
      return;
    }
    const index = this.measurements.length - 1;
    const previous = this.fixIndices[this.fixIndices.length - 1];
    this.fixIndices.push(index);
    if (previous !== undefined) {
      this.drawRuns([previous, index]);
    }
    this.updateHead(true);
  }

  /** Shows / hides the live head marker. */
  setLive(live: boolean): void {
    this.settings.live = live;
    this.updateHead(false);
  }

  bounds(): L.LatLngBounds | null {
    if (!this.fixIndices.length) {
      return null;
    }
    return L.latLngBounds(this.fixIndices.map(i => this.latLng(i)));
  }

  fitBounds(options: L.FitBoundsOptions = {}): void {
    const bounds = this.bounds();
    if (bounds) {
      this.map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17, ...options });
    }
  }

  /**
   * Highlights the sample at `index` (null clears). A sample without GPS is shown dashed at the last known position.
   * With `pan` the map pans when the point is outside the view.
   */
  highlight(index: number | null, pan = false): void {
    const fixIndex = index === null ? undefined : this.lastFixAtOrBefore(index);
    if (index === null || fixIndex === undefined) {
      this.highlightMarker?.remove();
      this.highlightMarker = null;
      return;
    }
    const noFix = fixIndex !== index;
    const latLng = this.latLng(fixIndex);
    const icon = L.divIcon({ className: `app-track-highlight${noFix ? ' app-no-fix' : ''}`, iconSize: [18, 18] });
    if (!this.highlightMarker) {
      this.highlightMarker = L.marker(latLng, { icon, interactive: false, keyboard: false, zIndexOffset: 1000 })
        .addTo(this.group);
    } else {
      this.highlightMarker.setLatLng(latLng).setIcon(icon);
    }
    this.highlightMarker.getElement()?.style
      .setProperty('--app-highlight-color', noFix ? 'transparent' : DoseScale.color(this.measurements[index].usvPerHour));
    if (pan && !this.map.getBounds().contains(latLng)) {
      this.map.panTo(latLng);
    }
  }

  /**
   * Calls `handler` with the index of the sample nearest to the pointer (within 16 px) or null
   * – on mouse move and on tap. Replaces a previous handler.
   */
  onHover(handler: (index: number | null) => void): void {
    this.detachHover?.();
    const emit = (index: number | null) => {
      if (index !== this.hovered) {
        this.hovered = index;
        handler(index);
      }
    };
    const move = (event: L.LeafletMouseEvent) => {
      cancelAnimationFrame(this.hoverFrame);
      this.hoverFrame = requestAnimationFrame(() => emit(this.nearestIndex(event.latlng)));
    };
    const out = () => {
      cancelAnimationFrame(this.hoverFrame);
      emit(null);
    };
    this.map.on('mousemove click', move as L.LeafletEventHandlerFn);
    this.map.on('mouseout', out);
    this.detachHover = () => {
      this.map.off('mousemove click', move as L.LeafletEventHandlerFn);
      this.map.off('mouseout', out);
    };
  }

  /** Index of the positioned sample nearest to `latLng` on screen, or null when none is within `maxPx`. */
  nearestIndex(latLng: L.LatLng, maxPx = 16): number | null {
    const target = this.map.latLngToContainerPoint(latLng);
    let best: number | null = null;
    let bestDistance = maxPx * maxPx;
    for (const i of this.fixIndices) {
      const point = this.map.latLngToContainerPoint(this.latLng(i));
      const dx = point.x - target.x;
      const dy = point.y - target.y;
      const distance = dx * dx + dy * dy;
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    return best;
  }

  destroy(): void {
    this.detachHover?.();
    cancelAnimationFrame(this.hoverFrame);
    this.group.remove();
  }

  private latLng(index: number): L.LatLng {
    const m = this.measurements[index];
    return L.latLng(m.latitude!, m.longitude!);
  }

  private lastFixAtOrBefore(index: number): number | undefined {
    for (let i = this.fixIndices.length - 1; i >= 0; i--) {
      if (this.fixIndices[i] <= index) {
        return this.fixIndices[i];
      }
    }
    return this.fixIndices[0];
  }

  /** Draws consecutive positioned samples, splitting at pauses and merging equally coloured segments. */
  private drawRuns(indices: readonly number[]): void {
    const { weight, halo, gapMs } = this.settings;
    const points = indices.map(i => this.latLng(i));
    const lines: { color: string; latLngs: L.LatLng[] }[] = [];
    const runs: L.LatLng[][] = [];
    let run: L.LatLng[] = [];
    for (let k = 1; k < indices.length; k++) {
      const a = this.measurements[indices[k - 1]];
      const b = this.measurements[indices[k]];
      const from = points[k - 1];
      const to = points[k];
      if (Date.parse(b.timestamp) - Date.parse(a.timestamp) > gapMs) {
        if (run.length) {
          runs.push(run);
        }
        run = [];
        continue;
      }
      run.push(...(run.length ? [to] : [from, to]));
      const usv = Math.round((a.usvPerHour + b.usvPerHour) / 2 / COLOR_STEP) * COLOR_STEP;
      const color = DoseScale.color(usv);
      const last = lines[lines.length - 1];
      if (last && last.color === color && last.latLngs[last.latLngs.length - 1] === from) {
        last.latLngs.push(to);
      } else {
        lines.push({ color, latLngs: [from, to] });
      }
    }
    if (run.length) {
      runs.push(run);
    }
    const common = { interactive: false, lineCap: 'round', lineJoin: 'round' } as const;
    if (halo) {
      for (const latLngs of runs) {
        L.polyline(latLngs, { ...common, renderer: this.haloRenderer, color: '#000', opacity: 0.35, weight: weight + 3 })
          .addTo(this.group);
      }
    }
    for (const line of lines) {
      L.polyline(line.latLngs, { ...common, renderer: this.renderer, color: line.color, opacity: 1, weight })
        .addTo(this.group);
    }
  }

  private updateHead(pulse: boolean): void {
    const lastFix = this.fixIndices[this.fixIndices.length - 1];
    if (!this.settings.live || lastFix === undefined) {
      this.headMarker?.remove();
      this.headMarker = null;
      return;
    }
    const latLng = this.latLng(lastFix);
    if (!this.headMarker) {
      this.headMarker = L.marker(latLng, {
        icon: L.divIcon({ className: 'app-track-head', iconSize: [14, 14] }),
        interactive: false,
        keyboard: false,
        zIndexOffset: 900,
      }).addTo(this.group);
    } else {
      this.headMarker.setLatLng(latLng);
    }
    const element = this.headMarker.getElement();
    if (element) {
      element.style.setProperty('--app-head-color', DoseScale.color(this.measurements[lastFix].usvPerHour));
      if (pulse) {
        element.classList.remove('app-pulse');
        void element.offsetWidth; // restart the CSS animation
        element.classList.add('app-pulse');
      }
    }
  }
}
