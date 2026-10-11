import * as L from 'leaflet';
import { Grid, GridCell } from '../../core/api/map.models';
import { DoseScale } from '../../core/units/dose-scale';

export type GridMetric = 'avg' | 'max';

/** Cell index along one axis (south-west corners are multiples of `cellDeg`). */
function cellIndex(value: number, cellDeg: number): number {
  return Math.floor(value / cellDeg + 1e-9);
}

/**
 * Canvas layer drawing `/api/map/grid` cells as squares coloured by the dose scale (average or maximum µSv/h).
 * One canvas for up to 10 000 cells; redrawn after every move / zoom (hidden during the zoom animation).
 */
export class GridLayer extends L.Layer {
  private grid: Grid | null = null;
  private metric: GridMetric = 'avg';
  private index = new Map<string, GridCell>();
  private mapRef?: L.Map;
  private canvas?: HTMLCanvasElement;
  private frame = 0;
  private highlighted: GridCell | null = null;

  setGrid(grid: Grid | null): this {
    this.grid = grid;
    this.index.clear();
    if (grid) {
      for (const cell of grid.cells) {
        this.index.set(`${cellIndex(cell.lat, grid.cellDeg)}:${cellIndex(cell.lon, grid.cellDeg)}`, cell);
      }
    }
    this.highlighted = null;
    this.scheduleDraw();
    return this;
  }

  setMetric(metric: GridMetric): this {
    this.metric = metric;
    this.scheduleDraw();
    return this;
  }

  /** Outlines a cell (hover); null clears. */
  highlight(cell: GridCell | null): void {
    if (cell !== this.highlighted) {
      this.highlighted = cell;
      this.scheduleDraw();
    }
  }

  /** The cell containing a position, if it has data. */
  cellAt(latLng: L.LatLng): GridCell | null {
    const grid = this.grid;
    if (!grid) {
      return null;
    }
    const lng = L.Util.wrapNum(latLng.lng, [-180, 180], true);
    return this.index.get(`${cellIndex(latLng.lat, grid.cellDeg)}:${cellIndex(lng, grid.cellDeg)}`) ?? null;
  }

  /** South-west and north-east corner of a cell. */
  cellBounds(cell: GridCell): L.LatLngBounds {
    const size = this.grid?.cellDeg ?? 0;
    return L.latLngBounds([cell.lat, cell.lon], [cell.lat + size, cell.lon + size]);
  }

  override onAdd(map: L.Map): this {
    this.mapRef = map;
    this.canvas = L.DomUtil.create('canvas', 'app-grid-layer leaflet-zoom-hide');
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
    const ratio = window.devicePixelRatio || 1;
    L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
    canvas.width = Math.round(size.x * ratio);
    canvas.height = Math.round(size.y * ratio);
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
    const canvas = this.canvas;
    const ctx = canvas?.getContext('2d');
    if (!map || !canvas || !ctx) {
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const size = map.getSize();
    ctx.clearRect(0, 0, size.x, size.y);
    const grid = this.grid;
    if (!grid) {
      return;
    }
    const view = map.getBounds().pad(0.05);
    const d = grid.cellDeg;
    for (const cell of grid.cells) {
      if (cell.lat > view.getNorth() || cell.lat + d < view.getSouth()
        || cell.lon > view.getEast() || cell.lon + d < view.getWest()) {
        continue;
      }
      const sw = map.latLngToContainerPoint([cell.lat, cell.lon]);
      const ne = map.latLngToContainerPoint([cell.lat + d, cell.lon + d]);
      const x = Math.floor(sw.x);
      const y = Math.floor(ne.y);
      const w = Math.max(2, Math.ceil(ne.x) - x);
      const h = Math.max(2, Math.ceil(sw.y) - y);
      const value = this.metric === 'max' ? cell.maxUsv : cell.avgUsv;
      ctx.fillStyle = DoseScale.rgba(value, 0.72);
      // 1 px gap between neighbouring cells once they are big enough to show it
      ctx.fillRect(x, y, w > 6 ? w - 1 : w, h > 6 ? h - 1 : h);
    }
    const hot = this.highlighted;
    if (hot) {
      const sw = map.latLngToContainerPoint([hot.lat, hot.lon]);
      const ne = map.latLngToContainerPoint([hot.lat + d, hot.lon + d]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.strokeRect(Math.floor(sw.x) - 1, Math.floor(ne.y) - 1, Math.ceil(ne.x - sw.x) + 2, Math.ceil(sw.y - ne.y) + 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.floor(sw.x), Math.floor(ne.y), Math.ceil(ne.x - sw.x), Math.ceil(sw.y - ne.y));
    }
  }
}
