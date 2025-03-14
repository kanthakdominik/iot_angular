import { Injectable } from '@angular/core';
import { Chart, ChartOptions } from 'chart.js';
import { IotData } from '../models/iot-data.model';
import 'chart.js/auto';

@Injectable({
  providedIn: 'root'
})
export class ChartService {
  private radiationChart: Chart | undefined;
  private cpmChart: Chart | undefined;

  initRadiationChart(canvas: HTMLCanvasElement, data: IotData[], onPointClick: (id: number) => void): void {
    if (this.radiationChart) {
      this.radiationChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.radiationChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.getTimeLabels(data),
        datasets: [{
          label: 'Radiation Level (µSv/h)',
          data: data.map(d => d.usvPerHour),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          tension: 0.1,
          fill: true
        }]
      },
      options: this.getChartOptions('Radiation Level (µSv/h)', data, onPointClick)
    });
  }

  initCpmChart(canvas: HTMLCanvasElement, data: IotData[], onPointClick: (id: number) => void): void {
    if (this.cpmChart) {
      this.cpmChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.cpmChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.getTimeLabels(data),
        datasets: [{
          label: 'Counts Per Minute (CPM)',
          data: data.map(d => d.cpm),
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          tension: 0.1,
          fill: true
        }]
      },
      options: this.getChartOptions('Counts Per Minute (CPM)', data, onPointClick)
    });
  }

  destroy(): void {
    if (this.radiationChart) {
      this.radiationChart.destroy();
    }
    if (this.cpmChart) {
      this.cpmChart.destroy();
    }
  }

  private getTimeLabels(data: IotData[]): string[] {
    return data.map(d => new Date(d.timestamp).toLocaleTimeString());
  }

  private getChartOptions(yAxisLabel: string, data: IotData[], onPointClick: (id: number) => void): ChartOptions {
    return {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (event: any, elements: any[]) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const pointId = data[index].id;
          onPointClick(pointId);
        }
      },
      interaction: {
        intersect: true,
        mode: 'nearest'
      },
      plugins: {
        tooltip: {
          callbacks: {
            footer: () => 'Click to delete this point'
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: yAxisLabel
          }
        },
        x: {
          title: {
            display: true,
            text: 'Time'
          },
          ticks: {
            maxTicksLimit: 15,
            maxRotation: 45,
            autoSkip: true,
          }
        }
      }
    };
  }
}