import { Injectable } from '@angular/core';
import { Chart, ChartOptions } from 'chart.js';
import 'chart.js/auto';
import { Measurement } from '../models/measurement.model';

const NO_FIX_COLOR = 'rgba(108, 117, 125, 0.9)';

/**
 * Time charts of a route (µSv/h and CPM). All samples are shown - also those without a GNSS fix,
 * which are drawn as grey points.
 */
@Injectable({
  providedIn: 'root'
})
export class ChartService {
  private radiationChart?: Chart;
  private cpmChart?: Chart;

  initRadiationChart(canvas: HTMLCanvasElement, data: Measurement[], onPointClick?: (m: Measurement) => void): void {
    this.radiationChart?.destroy();
    this.radiationChart = this.createChart(canvas, data, 'Radiation level (µSv/h)', d => d.usvPerHour,
      'rgb(255, 99, 132)', 'rgba(255, 99, 132, 0.2)', onPointClick);
  }

  initCpmChart(canvas: HTMLCanvasElement, data: Measurement[], onPointClick?: (m: Measurement) => void): void {
    this.cpmChart?.destroy();
    this.cpmChart = this.createChart(canvas, data, 'Counts per minute (CPM)', d => d.cpm,
      'rgb(54, 162, 235)', 'rgba(54, 162, 235, 0.2)', onPointClick);
  }

  destroy(): void {
    this.radiationChart?.destroy();
    this.cpmChart?.destroy();
    this.radiationChart = undefined;
    this.cpmChart = undefined;
  }

  private createChart(canvas: HTMLCanvasElement, data: Measurement[], label: string,
                      value: (m: Measurement) => number, color: string, fill: string,
                      onPointClick?: (m: Measurement) => void): Chart | undefined {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return undefined;
    }
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => new Date(d.timestamp).toLocaleTimeString()),
        datasets: [{
          label,
          data: data.map(value),
          borderColor: color,
          backgroundColor: fill,
          pointBackgroundColor: data.map(d => d.gpsFix ? color : NO_FIX_COLOR),
          pointRadius: data.length > 600 ? 0 : 2,
          pointHoverRadius: 5,
          tension: 0.1,
          fill: true
        }]
      },
      options: this.options(label, data, onPointClick)
    });
  }

  private options(yAxisLabel: string, data: Measurement[], onPointClick?: (m: Measurement) => void): ChartOptions<'line'> {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      onClick: onPointClick ? (_event, elements) => {
        if (elements.length > 0) {
          onPointClick(data[elements[0].index]);
        }
      } : undefined,
      interaction: {
        intersect: false,
        mode: 'nearest',
        axis: 'x'
      },
      plugins: {
        tooltip: {
          callbacks: {
            afterLabel: item => data[item.dataIndex].gpsFix ? '' : 'no GPS fix',
            footer: () => onPointClick ? 'Click to delete this point' : ''
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: yAxisLabel }
        },
        x: {
          title: { display: true, text: 'Time' },
          ticks: { maxTicksLimit: 15, maxRotation: 45, autoSkip: true }
        }
      }
    };
  }
}
