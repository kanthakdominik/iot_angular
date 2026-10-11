import * as L from 'leaflet';
import { DoseScale } from '../../core/units/dose-scale';

/** `[latitude, longitude, value]` – value in µSv/h. */
export type HeatPoint = readonly [number, number, number];

export interface HeatLayerOptions extends L.LayerOptions {
  /** Kernel radius in screen px (default 24). */
  readonly radius?: number;
  /** Max. opacity of the coloured field (default 0.75). */
  readonly opacity?: number;
  /** Sum of kernel weights at which the field becomes fully opaque (default 3 ≈ three overlapping samples). */
  readonly saturation?: number;
  /** µSv/h mapped to the top of the dose scale (default DoseScale.max). */
  readonly max?: number;
  /** Resolution of the accumulation grid in px per cell (default 2; higher = faster, softer). */
  readonly cellSize?: number;
}

/**
 * Canvas heat map coloured by the dose scale, without plugins. Each point adds a smooth radial kernel;
 * the colour of a pixel is the kernel-weighted average dose of the nearby samples and its opacity grows with the
 * sample density – so a single hot sample shows its true colour instead of saturating like a density heat map.
 * Redrawn after every move / zoom; hidden during the zoom animation.
 *
 * ```ts
 * const heat = new HeatLayer(measurements.filter(hasPosition).map(m => [m.latitude, m.longitude, m.usvPerHour]));
 * layers.addOverlay(heat, i18n.t('map.heatmap'));
 * ```
 */
export class HeatLayer extends L.Layer {
  private points: readonly HeatPoint[];
  private readonly settings: { radius: number; opacity: number; saturation: number; max: number; cellSize: number };
  private readonly palette: Uint8ClampedArray;
  private mapRef?: L.Map;
  private canvas?: HTMLCanvasElement;
  private readonly buffer = document.createElement('canvas');
  private frame = 0;

  constructor(points: readonly HeatPoint[] = [], options: HeatLayerOptions = {}) {
    super(options);
    this.points = points;
    this.settings = {
      radius: options.radius ?? 24,
      opacity: options.opacity ?? 0.75,
      saturation: options.saturation ?? 3,
      max: options.max ?? DoseScale.max,
      cellSize: options.cellSize ?? 2,
    };
    this.palette = DoseScale.palette(256, this.settings.max);
  }

  setPoints(points: readonly HeatPoint[]): this {
    this.points = points;
    this.scheduleDraw();
    return this;
  }

  override onAdd(map: L.Map): this {
    this.mapRef = map;
    this.canvas = L.DomUtil.create('canvas', 'app-heat-layer leaflet-zoom-hide');
    this.canvas.style.pointerEvents = 'none';
    map.getPane(this.options.pane ?? 'overlayPane')?.appendChild(this.canvas);
    map.on('moveend zoomend resize viewreset', this.reset);
    this.reset();
    return this;
  }

  override onRemove(map: L.Map): this {
    map.off('moveend zoomend resize viewreset', this.reset);
    cancelAnimationFrame(this.frame);
    this.canvas?.remove();
    this.canvas = undefined;
    this.mapRef = undefined;
    return this;
  }

  private readonly reset = () => {
    const map = this.mapRef;
    const canvas = this.canvas;
    if (!map || !canvas) {
      return;
    }
    const size = map.getSize();
    L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
    canvas.width = size.x;
    canvas.height = size.y;
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;
    this.scheduleDraw();
  };

  private scheduleDraw(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.draw());
  }

  private draw(): void {
    const map = this.mapRef;
    const ctx = this.canvas?.getContext('2d');
    if (!map || !ctx) {
      return;
    }
    const { radius, opacity, saturation, max, cellSize } = this.settings;
    const size = map.getSize();
    ctx.clearRect(0, 0, size.x, size.y);

    const width = Math.ceil(size.x / cellSize);
    const height = Math.ceil(size.y / cellSize);
    const r = radius / cellSize;
    const r2 = r * r;
    const reach = Math.ceil(r);
    const weights = new Float32Array(width * height);
    const sums = new Float32Array(width * height);

    for (const [lat, lon, value] of this.points) {
      const p = map.latLngToContainerPoint([lat, lon]);
      const gx = p.x / cellSize;
      const gy = p.y / cellSize;
      if (gx < -r || gy < -r || gx > width + r || gy > height + r) {
        continue;
      }
      const cx = Math.round(gx);
      const cy = Math.round(gy);
      for (let y = Math.max(0, cy - reach); y <= Math.min(height - 1, cy + reach); y++) {
        const dy2 = (y - gy) * (y - gy);
        for (let x = Math.max(0, cx - reach); x <= Math.min(width - 1, cx + reach); x++) {
          const d2 = (x - gx) * (x - gx) + dy2;
          if (d2 < r2) {
            const k = (1 - d2 / r2) ** 2;
            const i = y * width + x;
            weights[i] += k;
            sums[i] += k * value;
          }
        }
      }
    }

    this.buffer.width = width;
    this.buffer.height = height;
    const bufferCtx = this.buffer.getContext('2d');
    if (!bufferCtx) {
      return;
    }
    const image = bufferCtx.createImageData(width, height);
    const data = image.data;
    for (let i = 0; i < weights.length; i++) {
      const weight = weights[i];
      if (weight <= 0.001) {
        continue;
      }
      const level = Math.min(255, Math.max(0, Math.round((sums[i] / weight / max) * 255))) * 4;
      data[i * 4] = this.palette[level];
      data[i * 4 + 1] = this.palette[level + 1];
      data[i * 4 + 2] = this.palette[level + 2];
      data[i * 4 + 3] = Math.min(1, weight / saturation) ** 0.6 * opacity * 255;
    }
    bufferCtx.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.buffer, 0, 0, width * cellSize, height * cellSize);
  }
}
