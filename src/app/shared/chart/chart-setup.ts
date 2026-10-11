import {
  BarController, BarElement, CategoryScale, Chart, Filler, Legend, LineController, LineElement, LinearScale,
  PointElement, Tooltip,
} from 'chart.js';

let registered = false;

/**
 * Registers only the Chart.js parts the app uses (line + bar charts, linear / category scales, tooltip, legend, fill).
 * Called by ChartTheme; call it yourself before `new Chart()` only if you do not inject ChartTheme.
 */
export function registerCharts(): void {
  if (!registered) {
    Chart.register(LineController, LineElement, PointElement, BarController, BarElement, LinearScale, CategoryScale,
      Tooltip, Legend, Filler);
    registered = true;
  }
}
