import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Chart } from 'chart.js';
import 'chart.js/auto';

import { IotData } from '../../models/iot-data.model';
import { Route } from '../../models/route.model';
import { RouteService } from '../../services/route.service';

@Component({
  selector: 'app-route-chart',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './route-chart.component.html',
  styleUrls: ['./route-chart.component.scss']
})
export class RouteChartComponent implements OnInit {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartCanvasCpm') chartCanvasCpm!: ElementRef<HTMLCanvasElement>;

  routeName = '';
  loading = false;
  error = '';

  private routeId!: number;
  private routeData: IotData[] = [];
  private chart: Chart | undefined;
  private chartCpm: Chart | undefined;

  constructor(
    private route: ActivatedRoute,
    private routeService: RouteService
  ) { }

  ngOnInit(): void {
    this.initializeRouteId();
  }

  private initializeRouteId(): void {
    this.routeId = Number(this.route.snapshot.paramMap.get('id'));
    if (this.routeId) {
      this.loadRouteDetails();
    }
  }

  private loadRouteDetails(): void {
    this.loading = true;
    this.routeService.getRoute(this.routeId).subscribe({
      next: (route: Route) => {
        this.routeName = route.name;
        this.loadRouteData();
      },
      error: (err: any) => {
        this.handleError('Failed to load route details', err);
      }
    });
  }

  private loadRouteData(): void {
    this.routeService.getRouteData(this.routeId).subscribe({
      next: (data) => {
        this.routeData = data;
        this.loading = false;
        if (this.chartCanvas) {
          this.initChart();
        }
      },
      error: (err) => {
        this.handleError('Failed to load route data', err);
      }
    });
  }

  private initChart(): void {
    this.initRadiationChart();
    this.initCpmChart();
  }

  private initRadiationChart(): void {
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.getTimeLabels(),
        datasets: [{
          label: 'Radiation Level (µSv/h)',
          data: this.routeData.map(d => d.usvPerHour),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          tension: 0.1,
          fill: true
        }]
      },
      options: this.getChartOptions('Radiation Level (µSv/h)')
    });
  }

  private initCpmChart(): void {
    const ctxCpm = this.chartCanvasCpm.nativeElement.getContext('2d');
    if (!ctxCpm) return;

    this.chartCpm = new Chart(ctxCpm, {
      type: 'line',
      data: {
        labels: this.getTimeLabels(),
        datasets: [{
          label: 'Counts Per Minute (CPM)',
          data: this.routeData.map(d => d.cpm),
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          tension: 0.1,
          fill: true
        }]
      },
      options: this.getChartOptions('Counts Per Minute (CPM)')
    });
  }

  private getTimeLabels(): string[] {
    return this.routeData.map(d => new Date(d.timestamp).toLocaleTimeString());
  }

  private getChartOptions(yAxisLabel: string): any {
    return {
      responsive: true,
      maintainAspectRatio: false,
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

  private handleError(message: string, error: any): void {
    this.error = message;
    this.loading = false;
    console.error(`${message}:`, error);
  }
}