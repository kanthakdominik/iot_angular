import { ActiveElement, Chart, ChartType, Plugin } from 'chart.js';

export interface CrosshairOptions {
  /** Line colour (default: Chart.defaults.color). */
  readonly color?: string;
  /** Hovered data index (or null when the pointer leaves) – feed it to the map / other charts. */
  readonly onHover?: (index: number | null) => void;
}

declare module 'chart.js' {
  interface PluginOptionsByType<TType extends ChartType> {
    appCrosshair?: CrosshairOptions;
  }
}

interface CrosshairState {
  hovered: number | null;
  external: number | null;
}

const states = new WeakMap<Chart, CrosshairState>();

function stateOf(chart: Chart): CrosshairState {
  let state = states.get(chart);
  if (!state) {
    state = { hovered: null, external: null };
    states.set(chart, state);
  }
  return state;
}

/**
 * Vertical cursor line + hover sync. Reports the hovered data index through `options.plugins.appCrosshair.onHover`
 * and draws the line at either the hovered index or one set from outside with `setCrosshairIndex()`.
 * Indices refer to the data arrays (dataset 0 positions the line), so use the same index as the map track.
 *
 * ```ts
 * new Chart(canvas, { type: 'line', data, plugins: [crosshairPlugin],
 *   options: { plugins: { appCrosshair: { onHover: i => this.hovered.set(i) } } } });
 * effect(() => setCrosshairIndex(chart, this.hovered()));
 * ```
 */
export const crosshairPlugin: Plugin<ChartType, CrosshairOptions> = {
  id: 'appCrosshair',

  afterEvent(chart, args, options) {
    const event = args.event;
    const state = stateOf(chart);
    let index: number | null = state.hovered;
    if (event.type === 'mouseout') {
      index = null;
    } else if ((event.type === 'mousemove' || event.type === 'click') && event.native) {
      const elements = chart.getElementsAtEventForMode(event.native, 'index', { intersect: false }, false);
      index = args.inChartArea && elements.length ? elements[0].index : null;
    }
    if (index !== state.hovered) {
      state.hovered = index;
      options.onHover?.(index);
      args.changed = true;
    }
  },

  afterDatasetsDraw(chart, _args, options) {
    const state = states.get(chart);
    const index = state?.hovered ?? state?.external ?? null;
    const point = index === null ? undefined : chart.getDatasetMeta(0).data[index];
    if (!point) {
      return;
    }
    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(Math.round(point.x) + 0.5, chartArea.top);
    ctx.lineTo(Math.round(point.x) + 0.5, chartArea.bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = options.color ?? String(Chart.defaults.color);
    ctx.stroke();
    ctx.restore();
  },

  afterDestroy(chart) {
    states.delete(chart);
  },
};

/** Moves the cursor (and tooltip) to `index` from outside, e.g. when the map is hovered; null hides it. */
export function setCrosshairIndex(chart: Chart, index: number | null): void {
  const state = stateOf(chart);
  if (state.external === index) {
    return;
  }
  state.external = index;
  const point = index === null ? undefined : chart.getDatasetMeta(0).data[index];
  const active: ActiveElement[] = index === null || !point ? [] : chart.data.datasets
    .map((_, datasetIndex) => ({ datasetIndex, index, element: chart.getDatasetMeta(datasetIndex).data[index] }))
    .filter((item): item is ActiveElement => !!item.element && chart.isDatasetVisible(item.datasetIndex));
  if (state.hovered === null) {
    chart.setActiveElements(active);
    chart.tooltip?.setActiveElements(active, { x: point?.x ?? 0, y: point?.y ?? 0 });
  }
  chart.update('none');
}
